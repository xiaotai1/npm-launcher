<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { currentTerminalTheme } from '../terminalTheme'
import { installTerminalDragRecovery } from '../terminalDragState'

// 当前主题下的终端背景色（用于 region 容器背景，与 xterm 主题保持同步）
const terminalBg = ref(currentTerminalTheme().background || '#0e1525')

const props = defineProps<{
  id: string
  cwd: string
  visible: boolean
  nodeVersion?: string
}>()
const sessionId = props.id

const terminalContainer = ref<HTMLDivElement>()
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let cleanupData: (() => void) | null = null
let cleanupExit: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
let contextMenuHandler: ((e: MouseEvent) => void) | null = null
let cleanupDragRecovery: (() => void) | null = null
let terminalGeneration = 0

function waitForLayout() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
}

function writeToPty(data: string) {
  void window.desktopAPI.ptyWrite(sessionId, data)
}

async function copySelection() {
  const selection = terminal?.getSelection()
  try {
    if (selection) await window.desktopAPI.writeClipboardText(selection)
  } catch (error) {
    console.error('复制终端内容失败', error)
  } finally {
    terminal?.clearSelection()
    terminal?.focus()
  }
}

async function pasteClipboard() {
  try {
    const text = await window.desktopAPI.readClipboardText()
    if (text) writeToPty(text)
  } catch (error) {
    console.error('读取剪贴板失败', error)
  } finally {
    terminal?.clearSelection()
    terminal?.focus()
  }
}

function clearTerminal() {
  terminal?.clear()
  terminal?.focus()
}

async function restartTerminal() {
  await dispose()
  await nextTick()
  if (props.visible) await initTerminal()
}

async function initTerminal() {
  if (!terminalContainer.value || terminal) return

  const generation = ++terminalGeneration
  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'bar',
    fontSize: 14,
    lineHeight: 1.45,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', 'Consolas', 'Menlo', monospace",
    fontWeight: 400,
    fontWeightBold: 600,
    letterSpacing: 0,
    scrollback: 5000,
    smoothScrollDuration: 60,
    theme: currentTerminalTheme()
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(terminalContainer.value)
  const currentTerminal = terminal
  cleanupDragRecovery = installTerminalDragRecovery(terminalContainer.value, () => terminal?.clearSelection())

  // 用户输入 → PTY
  terminal.onData((data) => {
    writeToPty(data)
  })

  // 复制粘贴：Ctrl+Shift+C 复制，Ctrl+Shift+V / 右键 粘贴
  terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
    if (event.type !== 'keydown') return true

    if (event.ctrlKey && event.shiftKey && (event.key === 'C' || event.key === 'c')) {
      void copySelection()
      return false
    }
    if (event.ctrlKey && event.shiftKey && (event.key === 'V' || event.key === 'v')) {
      void pasteClipboard()
      return false
    }
    if (event.ctrlKey && event.key === 'Insert') {
      void copySelection()
      return false
    }
    if (event.shiftKey && event.key === 'Insert') {
      void pasteClipboard()
      return false
    }

    return true
  })

  // 右键粘贴（类似 Windows cmd）
  const container = terminalContainer.value
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    const selection = terminal?.getSelection()
    if (selection) {
      void copySelection()
    } else {
      void pasteClipboard()
    }
  }
  container?.addEventListener('contextmenu', onContextMenu)
  contextMenuHandler = onContextMenu

  // PTY 输出 → 终端显示
  // 监听容器大小变化
  resizeObserver = new ResizeObserver(() => {
    if (fitAddon && terminal) {
      try {
        fitAddon.fit()
        void window.desktopAPI.ptyResize(sessionId, terminal.cols, terminal.rows)
      } catch {
        // 容器隐藏时 fit 会失败
      }
    }
  })
  resizeObserver.observe(terminalContainer.value)

  let stopData: (() => void) | null = null
  try {
    stopData = await window.desktopAPI.onPtyData(({ id, data }) => {
      if (generation === terminalGeneration && id === sessionId) {
        currentTerminal.write(data)
      }
    })
    const stopExit = await window.desktopAPI.onPtyExit(({ id }) => {
      if (generation === terminalGeneration && id === sessionId) {
        currentTerminal.write('\r\n\x1b[90m[进程已退出]\x1b[0m\r\n')
      }
    })
    if (generation !== terminalGeneration || terminal !== currentTerminal) {
      stopData()
      stopExit()
      return
    }
    cleanupData = stopData
    cleanupExit = stopExit
  } catch {
    stopData?.()
    await dispose()
    return
  }

  await nextTick()
  await waitForLayout()
  if (generation === terminalGeneration && fitAddon && terminal === currentTerminal) {
    try {
      fitAddon.fit()
    } catch {
      // 快速切换项目时容器可能已经隐藏，使用 xterm 默认行列启动即可。
    }
    await window.desktopAPI.ptySpawn(
      sessionId,
      currentTerminal.cols,
      currentTerminal.rows,
      props.cwd,
      props.nodeVersion
    )
    if (props.visible && generation === terminalGeneration && terminal === currentTerminal) {
      currentTerminal.focus()
    }
  }
}

async function dispose() {
  const currentTerminal = terminal
  terminalGeneration += 1
  cleanupData?.()
  cleanupExit?.()
  resizeObserver?.disconnect()
  cleanupDragRecovery?.()
  if (contextMenuHandler && terminalContainer.value) {
    terminalContainer.value.removeEventListener('contextmenu', contextMenuHandler)
  }
  currentTerminal?.dispose()
  terminal = null
  fitAddon = null
  cleanupData = null
  cleanupExit = null
  resizeObserver = null
  contextMenuHandler = null
  cleanupDragRecovery = null
  await window.desktopAPI.ptyKill(sessionId)
}

async function restoreVisibleTerminal() {
  await nextTick()
  await waitForLayout()
  if (!props.visible || !terminal || !fitAddon) return

  try {
    terminal.clearSelection()
    fitAddon.fit()
    await window.desktopAPI.ptyResize(sessionId, terminal.cols, terminal.rows)
  } catch {
    return
  }

  if (props.visible) terminal.focus()
}

// 当可见性变化时：首次可见则初始化；离开时立即释放隐藏输入框的焦点和选区。
watch(() => props.visible, async (val) => {
  if (!val) {
    terminal?.clearSelection()
    terminal?.blur()
    return
  }

  if (!terminal) {
    await nextTick()
    if (props.visible) await initTerminal()
  } else {
    await restoreVisibleTerminal()
  }
})

// 项目目录或 Node.js 版本变化时，重建 PTY 以应用新的环境。
watch(() => [props.cwd, props.nodeVersion] as const, async ([newCwd, newNodeVersion], [oldCwd, oldNodeVersion]) => {
  if (newCwd !== oldCwd || newNodeVersion !== oldNodeVersion) {
    await restartTerminal()
  }
})

// 主题切换时更新终端配色
const themeObserver = new MutationObserver(() => {
  const next = currentTerminalTheme()
  if (terminal) {
    terminal.options.theme = next
  }
  if (next.background) terminalBg.value = next.background
})
onMounted(() => {
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
})

onMounted(() => {
  if (props.visible) {
    void nextTick(() => initTerminal())
  }
})

onBeforeUnmount(() => {
  themeObserver.disconnect()
  void dispose()
})
</script>

<template>
  <div class="terminal-shell">
    <div class="terminal-toolbar" aria-label="终端工具">
      <span class="terminal-path" :title="cwd">{{ cwd }}</span>
      <div class="terminal-actions">
        <div class="terminal-primary-actions">
          <button type="button" class="terminal-action primary" aria-label="复制选中内容" title="复制选中内容" @click="copySelection">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>复制</span>
          </button>
          <button type="button" class="terminal-action primary" aria-label="粘贴剪贴板内容" title="粘贴剪贴板内容" @click="pasteClipboard">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 4h8a2 2 0 0 1 2 2v1H6V6a2 2 0 0 1 2-2z"/><path d="M6 7h12v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 3h6"/></svg>
            <span>粘贴</span>
          </button>
        </div>
        <div class="terminal-secondary-actions">
          <button type="button" class="terminal-action secondary" aria-label="清空终端显示" title="清空终端显示" @click="clearTerminal">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/></svg>
            <span>清空</span>
          </button>
          <button type="button" class="terminal-action secondary" aria-label="重启交互终端" title="重启交互终端" @click="restartTerminal">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
            <span>重启</span>
          </button>
        </div>
      </div>
    </div>
    <div class="terminal-region" :style="{ background: terminalBg }">
      <div class="terminal-region-glow" aria-hidden="true"></div>
      <div ref="terminalContainer" class="terminal-container"></div>
    </div>
  </div>
</template>

<style scoped>
.terminal-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 终端区有它独立的视觉语言：用稍微突出的边框把它从外层应用里"框"出来 */
  border-top: 1px solid var(--border-muted);
}

.terminal-toolbar {
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px 0 14px;
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-fill);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

.terminal-path {
  min-width: 0;
  overflow: hidden;
  color: var(--text-tertiary);
  font: 12px/1 var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  margin-left: auto;
}

.terminal-primary-actions,
.terminal-secondary-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.terminal-secondary-actions {
  padding-left: 8px;
  border-left: 1px solid var(--border-muted);
}

.terminal-action {
  min-width: 0;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  transition: color 160ms ease, background 160ms ease;
}

.terminal-action.primary {
  color: var(--text-secondary);
  background: var(--bg-subtle);
}

.terminal-action:hover {
  color: var(--accent-primary);
  background: var(--bg-hover);
}

.terminal-action.secondary:hover {
  color: var(--text-primary);
}

/* 终端区域：科技感顶发光 + 终端感背景 */
.terminal-region { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; box-shadow: inset 0 1px 0 color-mix(in srgb, var(--accent-primary) 14%, transparent); transition: background 300ms ease; }
.terminal-region-glow { position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-primary) 60%, transparent), transparent); pointer-events: none; z-index: 2; }

.terminal-container {
  flex: 1;
  min-height: 0;
  background: transparent;
  border: none;
  outline: none;
}

::deep(.xterm),
::deep(.xterm-screen),
::deep(.xterm-viewport),
::deep(.xterm-rows) {
  background: transparent !important;
  border: none;
  outline: none;
}

::deep(.xterm) {
  padding: 14px 18px 18px;
  height: 100%;
}

::deep(.xterm-viewport) {
  background: transparent !important;
}

::deep(.xterm-rows) {
  font-variant-ligatures: contextual;
}

::deep(.xterm-rows > div) {
  letter-spacing: 0.1px;
  line-height: 1.45;
}

::deep(.xterm-screen) {
  height: 100%;
}

::deep(.xterm-viewport::-webkit-scrollbar) {
  width: 10px;
}

::deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: transparent;
}

::deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: var(--scrollbar-thumb);
  border-radius: 5px;
  border: 3px solid transparent;
  background-clip: content-box;
}

::deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background: var(--text-tertiary);
  background-clip: content-box;
}
</style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { currentTerminalTheme } from '../terminalTheme'

const props = defineProps<{
  id: string
  cwd: string
  visible: boolean
  nodeVersion?: string
}>()

const terminalContainer = ref<HTMLDivElement>()
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let cleanupData: (() => void) | null = null
let cleanupExit: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
let contextMenuHandler: ((e: MouseEvent) => void) | null = null

function writeToPty(data: string) {
  window.electronAPI.ptyWrite(props.id, data)
}

function copySelection() {
  const selection = terminal?.getSelection()
  if (selection) {
    navigator.clipboard.writeText(selection)
  }
  terminal?.focus()
}

async function pasteClipboard() {
  const text = await navigator.clipboard.readText()
  if (text) {
    writeToPty(text)
  }
  terminal?.focus()
}

function clearTerminal() {
  terminal?.clear()
  terminal?.focus()
}

function restartTerminal() {
  dispose()
  nextTick(() => {
    if (props.visible) initTerminal()
  })
}

function initTerminal() {
  if (!terminalContainer.value || terminal) return

  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    lineHeight: 1.4,
    fontFamily: "'Consolas', 'JetBrains Mono', 'Fira Code', monospace",
    theme: currentTerminalTheme()
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(terminalContainer.value)

  nextTick(() => {
    if (fitAddon && terminal) {
      fitAddon.fit()
      // spawn PTY
      window.electronAPI.ptySpawn(props.id, terminal.cols, terminal.rows, props.cwd, props.nodeVersion)
      terminal.focus()
    }
  })

  // 用户输入 → PTY
  terminal.onData((data) => {
    writeToPty(data)
  })

  // 复制粘贴：Ctrl+Shift+C 复制，Ctrl+Shift+V / 右键 粘贴
  terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
    // 只处理 keydown，其他事件类型一律放行
    if (event.type !== 'keydown') return true

    // Ctrl+Shift+C → 复制选中文字
    if (event.ctrlKey && event.shiftKey && (event.key === 'C' || event.key === 'c')) {
      copySelection()
      return false
    }
    // Ctrl+Shift+V → 粘贴
    if (event.ctrlKey && event.shiftKey && (event.key === 'V' || event.key === 'v')) {
      void pasteClipboard()
      return false
    }
    // Ctrl+Insert → 复制
    if (event.ctrlKey && event.key === 'Insert') {
      copySelection()
      return false
    }
    // Shift+Insert → 粘贴
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
      // 有选中文字 → 复制
      copySelection()
    } else {
      // 无选中 → 粘贴
      void pasteClipboard()
    }
  }
  container?.addEventListener('contextmenu', onContextMenu)
  contextMenuHandler = onContextMenu

  // PTY 输出 → 终端显示
  cleanupData = window.electronAPI.onPtyData(({ id, data }) => {
    if (id === props.id) {
      terminal?.write(data)
    }
  })

  // PTY 退出
  cleanupExit = window.electronAPI.onPtyExit(({ id }) => {
    if (id === props.id) {
      terminal?.write('\r\n\x1b[90m[进程已退出]\x1b[0m\r\n')
    }
  })

  // 监听容器大小变化
  resizeObserver = new ResizeObserver(() => {
    if (fitAddon && terminal) {
      try {
        fitAddon.fit()
        window.electronAPI.ptyResize(props.id, terminal.cols, terminal.rows)
      } catch {
        // 容器隐藏时 fit 会失败
      }
    }
  })
  resizeObserver.observe(terminalContainer.value)
}

function dispose() {
  window.electronAPI.ptyKill(props.id)
  cleanupData?.()
  cleanupExit?.()
  resizeObserver?.disconnect()
  if (contextMenuHandler && terminalContainer.value) {
    terminalContainer.value.removeEventListener('contextmenu', contextMenuHandler)
  }
  terminal?.dispose()
  terminal = null
  fitAddon = null
  cleanupData = null
  cleanupExit = null
  resizeObserver = null
  contextMenuHandler = null
}

// 当可见性变化时：首次可见则初始化，之后只做 fit，不销毁
watch(() => props.visible, async (val) => {
  if (val) {
    await nextTick()
    if (!terminal) {
      initTerminal()
    } else if (fitAddon) {
      try {
        fitAddon.fit()
        window.electronAPI.ptyResize(props.id, terminal.cols, terminal.rows)
      } catch {
        // 容器尺寸未就绪
      }
      nextTick(() => terminal?.focus())
    }
  }
})

// 当 cwd 变化时重新创建终端
watch(() => props.cwd, (newCwd, oldCwd) => {
  if (newCwd !== oldCwd && props.visible) {
    dispose()
    nextTick(() => initTerminal())
  }
})

// 主题切换时更新终端配色
const themeObserver = new MutationObserver(() => {
  if (terminal) {
    terminal.options.theme = currentTerminalTheme()
  }
})
onMounted(() => {
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
})

onMounted(() => {
  if (props.visible) {
    nextTick(() => initTerminal())
  }
})

onBeforeUnmount(() => {
  themeObserver.disconnect()
  dispose()
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
    <div ref="terminalContainer" class="terminal-container"></div>
  </div>
</template>

<style scoped>
.terminal-shell {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--console-bg);
}

.terminal-toolbar {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px 0 12px;
  border-bottom: 1px solid var(--border-muted);
  background: var(--bg-surface);
}

.terminal-path {
  min-width: 0;
  overflow: hidden;
  color: var(--text-tertiary);
  font: 11px/1 var(--font-mono);
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
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 8px;
  border-radius: 7px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
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

.terminal-container {
  flex: 1;
  min-height: 0;
  background: var(--console-bg);
  border: none;
  outline: none;
}

:deep(.xterm),
:deep(.xterm-screen),
:deep(.xterm-viewport),
:deep(.xterm-rows) {
  background: var(--console-bg) !important;
  border: none;
  outline: none;
}

:deep(.xterm) {
  padding: 4px 8px;
  height: 100%;
}

:deep(.xterm-screen) {
  height: 100%;
}

:deep(.xterm-viewport::-webkit-scrollbar) {
  width: 6px;
}

:deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}
</style>

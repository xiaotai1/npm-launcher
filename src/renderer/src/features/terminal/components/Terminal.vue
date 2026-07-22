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
    window.electronAPI.ptyWrite(props.id, data)
  })

  // 复制粘贴：Ctrl+Shift+C 复制，Ctrl+Shift+V / 右键 粘贴
  terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
    // 只处理 keydown，其他事件类型一律放行
    if (event.type !== 'keydown') return true

    // Ctrl+Shift+C → 复制选中文字
    if (event.ctrlKey && event.shiftKey && (event.key === 'C' || event.key === 'c')) {
      const selection = terminal?.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection)
      }
      return false
    }
    // Ctrl+Shift+V → 粘贴
    if (event.ctrlKey && event.shiftKey && (event.key === 'V' || event.key === 'v')) {
      navigator.clipboard.readText().then((text) => {
        if (text) {
          window.electronAPI.ptyWrite(props.id, text)
        }
      })
      return false
    }
    // Ctrl+Insert → 复制
    if (event.ctrlKey && event.key === 'Insert') {
      const selection = terminal?.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection)
      }
      return false
    }
    // Shift+Insert → 粘贴
    if (event.shiftKey && event.key === 'Insert') {
      navigator.clipboard.readText().then((text) => {
        if (text) {
          window.electronAPI.ptyWrite(props.id, text)
        }
      })
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
      navigator.clipboard.writeText(selection)
    } else {
      // 无选中 → 粘贴
      navigator.clipboard.readText().then((text) => {
        if (text) {
          window.electronAPI.ptyWrite(props.id, text)
        }
      })
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
  <div ref="terminalContainer" class="w-full h-full bg-console-bg border-none outline-none"></div>
</template>

<style scoped>
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

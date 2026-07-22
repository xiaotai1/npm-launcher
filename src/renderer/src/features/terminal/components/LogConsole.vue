<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { currentTerminalTheme } from '../terminalTheme'

const props = defineProps<{
  isRunning: boolean
  projectId: string
  hasError: boolean
  hasLogs: boolean
}>()

const emit = defineEmits<{
  'analyze-errors': []
  'export-result': [success: boolean, message: string]
}>()

const terminalContainer = ref<HTMLDivElement>()
const exporting = ref(false)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let globalCleanup: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null

// 按项目缓存日志历史，切换项目时回放
const logHistory = new Map<string, string[]>()
const MAX_HISTORY = 500

function clear() {
  terminal?.clear()
  logHistory.delete(props.projectId)
}

defineExpose({ clear })

function initTerminal() {
  if (!terminalContainer.value || terminal) return

  terminal = new Terminal({
    cursorBlink: false,
    fontSize: 13,
    lineHeight: 1.4,
    fontFamily: "'Consolas', 'JetBrains Mono', 'Fira Code', monospace",
    theme: currentTerminalTheme(),
    scrollback: 5000,
    disableStdin: true
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(terminalContainer.value)

  nextTick(() => {
    if (fitAddon) {
      fitAddon.fit()
    }
  })

  // 回放当前项目的历史日志
  const history = logHistory.get(props.projectId)
  if (history && history.length > 0) {
    terminal.write(history.join('\r\n') + '\r\n')
  }

  // 监听容器大小变化（防抖，避免对话框弹出/关闭时瞬间重排）
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  resizeObserver = new ResizeObserver(() => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      resizeTimer = null
      if (fitAddon && terminal) {
        try {
          fitAddon.fit()
        } catch {
          // 容器隐藏时 fit 会失败
        }
      }
    }, 150)
  })
  resizeObserver.observe(terminalContainer.value)
}

function disposeTerminal() {
  resizeObserver?.disconnect()
  terminal?.dispose()
  terminal = null
  fitAddon = null
  resizeObserver = null
}

// 全局日志监听 — 缓存所有项目的日志，仅实时写入当前项目
function setupGlobalListener() {
  if (globalCleanup) return
  globalCleanup = window.electronAPI.onLogData((log) => {
    // 缓存所有项目的日志（带类型）
    if (!logHistory.has(log.projectId)) {
      logHistory.set(log.projectId, [])
    }
    const buf = logHistory.get(log.projectId)!
    buf.push(log.data)
    if (buf.length > MAX_HISTORY) {
      buf.splice(0, buf.length - MAX_HISTORY)
    }
    // 仅当前项目实时写入 xterm
    if (log.projectId === props.projectId && terminal) {
      terminal.write(log.data + '\r\n')
    }
  })
}

// 当 projectId 变化时，重建终端并回放历史
watch(() => props.projectId, (newId, oldId) => {
  if (newId !== oldId) {
    disposeTerminal()
    nextTick(() => initTerminal())
  }
})

// 主题切换时更新终端配色
themeObserver = new MutationObserver(() => {
  if (terminal) {
    terminal.options.theme = currentTerminalTheme()
  }
})

onMounted(() => {
  themeObserver?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
  setupGlobalListener()
  nextTick(() => initTerminal())
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  globalCleanup?.()
  globalCleanup = null
  disposeTerminal()
})

async function exportLog() {
  if (exporting.value) return
  exporting.value = true
  try {
    const result = await window.electronAPI.exportLog(props.projectId)
    if (result.success) {
      emit('export-result', true, `日志已导出到: ${result.path}`)
    } else if (result.error) {
      emit('export-result', false, result.error)
    } else {
      // 用户取消了对话框
      exporting.value = false
    }
  } catch (error: any) {
    emit('export-result', false, error.message || '导出失败')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-50 overflow-hidden">
    <div class="flex items-center justify-between px-4 py-2 border-b border-border-muted bg-surface console-header">
      <div class="flex items-center gap-2.5">
        <span class="text-[10px] font-semibold text-ttertiary uppercase tracking-[0.8px]">控制台</span>
        <span v-if="isRunning" class="flex items-center gap-1.25 text-[10px] font-semibold text-success-c">
          <span class="running-dot w-1.25 h-1.25 rounded-full bg-success-c animate-dot-pulse"></span>
          运行中
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="hasError"
          class="flex items-center gap-1 py-0.5 px-2 text-[10px] font-medium text-error border border-error/30 rounded hover:bg-error/10 transition-colors"
          @click="emit('analyze-errors')"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          分析错误
        </button>
        <button
          v-if="hasLogs"
          class="flex items-center gap-1 py-0.5 px-2 text-[10px] font-medium text-ttertiary border border-border rounded hover:bg-hover transition-colors"
          :disabled="exporting"
          @click="exportLog"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {{ exporting ? '导出中...' : '导出日志' }}
        </button>
        <button
          v-if="hasLogs"
          class="flex items-center gap-1 py-1 px-2.5 min-h-7 text-[11px] font-medium text-ttertiary border border-border rounded-md hover:bg-hover transition-colors"
          @click="clear"
        >
          清空
        </button>
      </div>
    </div>
    <div ref="terminalContainer" class="flex-1 min-h-0 bg-console-bg border-none outline-none"></div>
  </div>
</template>

<style scoped>
.running-dot {
  box-shadow: 0 0 6px var(--success);
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

:deep(.xterm-viewport::-webkit-scrollbar) {
  width: 6px;
}

:deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}
</style>

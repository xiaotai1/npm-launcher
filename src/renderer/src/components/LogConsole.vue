<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import type { LogEntry } from '../types'

const MAX_LOG_LINES = 5000
const VISIBLE_LOG_LINES = 500

const props = defineProps<{
  logs: LogEntry[]
  isRunning: boolean
  projectId: string
  hasError: boolean
}>()

const emit = defineEmits<{
  'analyze-errors': []
}>()

const consoleEl = ref<HTMLElement | null>(null)
const autoScroll = ref(true)
const exporting = ref(false)

// 截断后的日志（保留最新的 MAX_LOG_LINES 行）
const truncatedLogs = computed(() => {
  if (props.logs.length <= MAX_LOG_LINES) {
    return props.logs
  }
  return props.logs.slice(-MAX_LOG_LINES)
})

// 可视区域日志（保留最新的 VISIBLE_LOG_LINES 行）
const displayLogs = computed(() => {
  if (truncatedLogs.value.length <= VISIBLE_LOG_LINES) {
    return truncatedLogs.value
  }
  return truncatedLogs.value.slice(-VISIBLE_LOG_LINES)
})

watch(() => props.logs.length, async () => {
  if (autoScroll.value) {
    await nextTick()
    consoleEl.value?.scrollTo({ top: consoleEl.value.scrollHeight })
  }
})

function onScroll() {
  if (!consoleEl.value) return
  const { scrollTop, scrollHeight, clientHeight } = consoleEl.value
  autoScroll.value = scrollHeight - scrollTop - clientHeight < 60
}

function lineClass(type: LogEntry['type']): string {
  return `log-${type}`
}

async function exportLog() {
  if (exporting.value) return
  exporting.value = true
  try {
    const result = await window.electronAPI.exportLog(props.projectId)
    if (result.success) {
      // 导出成功
    }
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
          class="flex items-center gap-1 py-0.5 px-2 text-[10px] font-medium text-ttertiary border border-border rounded hover:bg-hover transition-colors"
          :disabled="exporting"
          @click="exportLog"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {{ exporting ? '导出中...' : '导出日志' }}
        </button>
        <label class="flex items-center gap-1.5 text-[11px] text-ttertiary cursor-pointer select-none">
          <input type="checkbox" v-model="autoScroll" class="w-3.5 h-3.5 cursor-pointer p-0" />
          自动滚动
        </label>
      </div>
    </div>

    <div ref="consoleEl" class="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-[1.8] bg-console-bg text-console-text relative console-body" @scroll="onScroll">
      <div v-if="logs.length === 0" class="h-full flex items-center justify-center text-ttertiary font-sans text-[13px] opacity-50">
        <p>等待输出...</p>
      </div>
      <div v-if="truncatedLogs.length > VISIBLE_LOG_LINES" class="sticky top-0 z-1 py-1 px-2 text-[11px] text-center text-tsecondary bg-elevated">
        显示最近 {{ VISIBLE_LOG_LINES }} 行（共 {{ truncatedLogs.length }} 行）
      </div>
      <div v-for="(log, i) in displayLogs" :key="i" :class="['relative py-1 px-2 pl-3 mb-px rounded whitespace-pre-wrap break-all animate-log-in log-block', lineClass(log.type)]">
        <span class="font-mono text-xs leading-[1.7]">{{ log.data }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.running-dot {
  box-shadow: 0 0 6px var(--success);
}

.console-body::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(59, 130, 246, 0.006) 2px, rgba(59, 130, 246, 0.006) 4px);
  pointer-events: none;
}

.log-block::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 1px;
}

.log-stdout {
  color: var(--console-text);
}

.log-stdout::before {
  background: var(--console-text);
  opacity: 0.15;
}

.log-stderr {
  color: var(--console-warn);
}

.log-stderr::before {
  background: var(--console-warn);
  opacity: 0.4;
}

.log-info {
  color: var(--console-info);
}

.log-info::before {
  background: var(--console-info);
  opacity: 0.5;
}

.log-error {
  color: var(--console-error);
  background: var(--error-bg);
  border-radius: 6px;
}

.log-error::before {
  background: var(--console-error);
  opacity: 0.7;
}
</style>
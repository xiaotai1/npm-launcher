<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { LogEntry } from '../types'

const props = defineProps<{
  logs: LogEntry[]
  isRunning: boolean
}>()

const consoleEl = ref<HTMLElement | null>(null)
const autoScroll = ref(true)

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
</script>

<template>
  <div class="console-container">
    <div class="console-header">
      <div class="console-title-row">
        <span class="console-title">控制台</span>
        <span v-if="isRunning" class="running-badge">
          <span class="running-dot"></span>
          运行中
        </span>
      </div>
      <label class="auto-scroll-label">
        <input type="checkbox" v-model="autoScroll" />
        自动滚动
      </label>
    </div>

    <div ref="consoleEl" class="console-body" @scroll="onScroll">
      <div v-if="logs.length === 0" class="console-empty">
        <p>等待输出...</p>
      </div>
      <div v-for="(log, i) in logs" :key="i" :class="['log-line', lineClass(log.type)]">
        {{ log.data }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.console-container{
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px;
  overflow: hidden;
}

.console-header{
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border-muted);
  background: var(--bg-surface);
}

.console-title-row{
  display: flex;
  align-items: center;
  gap: 10px;
}

.console-title{
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.running-badge{
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  color: var(--success);
}

.running-dot{
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 8px var(--success);
}

.auto-scroll-label{
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  user-select: none;
}

.auto-scroll-label input{
  width: 14px;
  height: 14px;
  cursor: pointer;
  padding: 0;
}

.console-body{
  flex: 1;
  overflow-y: auto;
  padding: 14px 20px;
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.8;
  background: var(--console-bg);
  color: var(--console-text);
}

.console-empty{
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  font-size: 13px;
  opacity: 0.6;
}

.log-line{
  white-space: pre-wrap;
  word-break: break-all;
}

.log-stdout{
  color: var(--console-text);
}

.log-stderr{
  color: var(--console-warn);
}

.log-info{
  color: var(--console-info);
}

.log-error{
  color: var(--console-error);
}
</style>

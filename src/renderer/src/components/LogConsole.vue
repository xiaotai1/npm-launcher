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
      <div v-for="(log, i) in logs" :key="i" :class="['log-block', lineClass(log.type)]">
        <span class="log-text">{{ log.data }}</span>
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
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-muted);
  background: var(--bg-surface);
}

.console-title-row{
  display: flex;
  align-items: center;
  gap: 10px;
}

.console-title{
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.running-badge{
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  color: var(--success);
}

.running-dot{
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--success);
  animation: dotPulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 6px var(--success);
}

.auto-scroll-label{
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
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
  padding: 12px 16px;
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.8;
  background: var(--console-bg);
  color: var(--console-text);
  position: relative;
}

.console-body::before{
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(59, 130, 246, 0.006) 2px, rgba(59, 130, 246, 0.006) 4px);
  pointer-events: none;
}

.console-empty{
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  font-size: 13px;
  opacity: 0.5;
}

.log-block{
  position: relative;
  padding: 4px 8px 4px 12px;
  margin-bottom: 1px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  animation: logIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.log-block::before{
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 1px;
}

.log-text{
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.7;
}

.log-stdout{
  color: var(--console-text);
}

.log-stdout::before{
  background: var(--console-text);
  opacity: 0.15;
}

.log-stderr{
  color: var(--console-warn);
}

.log-stderr::before{
  background: var(--console-warn);
  opacity: 0.4;
}

.log-info{
  color: var(--console-info);
}

.log-info::before{
  background: var(--console-info);
  opacity: 0.5;
}

.log-error{
  color: var(--console-error);
  background: var(--error-bg);
  border-radius: 6px;
}

.log-error::before{
  background: var(--console-error);
  opacity: 0.7;
}
</style>

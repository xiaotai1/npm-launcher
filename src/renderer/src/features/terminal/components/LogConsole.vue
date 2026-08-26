<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { LogEntry, Project } from '../../../shared/types'
import { clearSessionLogs, getSessionLogs, subscribeSessionLogs } from '../model/sessionLogs'
import { formatLogForView, formatLogsForExport, type LogFilter } from '../model/logView'
import { currentTerminalTheme } from '../terminalTheme'
import { installTerminalDragRecovery } from '../terminalDragState'

const props = defineProps<{
  isRunning: boolean
  projectId: string
  hasError: boolean
  hasLogs: boolean
  project?: Project | null
  nodeVersion?: string | null
}>()

const emit = defineEmits<{
  'analyze-errors': []
  'export-result': [success: boolean, message: string]
  'start': []
  'copy-command': [command: string]
}>()

const terminalContainer = ref<HTMLDivElement>()
const exporting = ref(false)
const searchQuery = ref('')
const logFilter = ref<LogFilter>('all')
const hasSessionLogs = ref(false)
const canExport = computed(() => hasSessionLogs.value)
// 空状态：项目未启动且尚未产生任何日志时显示
const showEmptyState = computed(() => !hasSessionLogs.value && !props.isRunning)
const isMac = computed(() => window.desktopAPI?.platform === 'darwin')
const primaryShortcutKey = computed(() => isMac.value ? '⌘' : 'Ctrl')
const primaryShortcutLabel = computed(() => isMac.value ? 'Command' : 'Control')
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let cleanupSessionLogs: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null
let cleanupDragRecovery: (() => void) | null = null

function currentReadonlyLogTheme() {
  return {
    ...currentTerminalTheme(),
    cursor: 'transparent',
    cursorAccent: 'transparent'
  }
}

function updateLogState() {
  hasSessionLogs.value = getSessionLogs(props.projectId).length > 0
}

function clear() {
  terminal?.clear()
  clearSessionLogs(props.projectId)
  updateLogState()
}

defineExpose({ clear })

function writeLogEntry(log: LogEntry) {
  const data = formatLogForView(log, logFilter.value, searchQuery.value)
  if (data) terminal?.write(data + '\r\n')
}

function replayCurrentProjectLogs() {
  if (!terminal) return
  terminal.clearSelection()
  terminal.clear()
  const logs = getSessionLogs(props.projectId)
  hasSessionLogs.value = logs.length > 0
  for (const log of logs) {
    writeLogEntry(log)
  }
}

function initTerminal() {
  if (!terminalContainer.value || terminal) return

  terminal = new Terminal({
    cursorBlink: false,
    fontSize: 14,
    lineHeight: 1.4,
    fontFamily: "'Consolas', 'JetBrains Mono', 'Fira Code', monospace",
    theme: currentReadonlyLogTheme(),
    scrollback: 5000,
    disableStdin: true
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(terminalContainer.value)
  cleanupDragRecovery = installTerminalDragRecovery(terminalContainer.value, () => terminal?.clearSelection())

  nextTick(() => {
    if (fitAddon) {
      fitAddon.fit()
    }
  })

  replayCurrentProjectLogs()

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
  cleanupDragRecovery?.()
  terminal?.dispose()
  terminal = null
  fitAddon = null
  resizeObserver = null
  cleanupDragRecovery = null
}

function setupSessionLogListener() {
  if (cleanupSessionLogs) return
  cleanupSessionLogs = subscribeSessionLogs((log) => {
    if (log.projectId === props.projectId) hasSessionLogs.value = true
    if (log.projectId === props.projectId && terminal) {
      writeLogEntry(log)
    }
  })
}

watch(() => props.projectId, (newId, oldId) => {
  if (newId !== oldId) {
    updateLogState()
    disposeTerminal()
    nextTick(() => initTerminal())
  }
})

watch([searchQuery, logFilter], () => {
  replayCurrentProjectLogs()
})

themeObserver = new MutationObserver(() => {
  if (terminal) {
    terminal.options.theme = currentReadonlyLogTheme()
  }
})

onMounted(() => {
  themeObserver?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
  setupSessionLogListener()
  updateLogState()
  nextTick(() => initTerminal())
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  cleanupSessionLogs?.()
  cleanupSessionLogs = null
  disposeTerminal()
})

function buildExportFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${props.projectId}-${timestamp}.log`
}

async function exportLog() {
  if (exporting.value) return
  exporting.value = true
  try {
    const content = formatLogsForExport(getSessionLogs(props.projectId))
    const result = await window.desktopAPI.exportLog(buildExportFilename(), content)
    if (result.success) {
      emit('export-result', true, `日志已导出到: ${result.path}`)
    } else if (result.error) {
      emit('export-result', false, result.error)
    } else {
      exporting.value = false
    }
  } catch (error: any) {
    emit('export-result', false, error.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

function truncate(value: string, max: number) {
  if (!value || value.length <= max) return value
  const head = Math.ceil((max - 1) / 2)
  const tail = Math.floor((max - 1) / 2)
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`
}

async function copyLaunchCommand() {
  if (!props.project) return
  const command = `npm run ${props.project.command}`
  try {
    await navigator.clipboard.writeText(command)
    emit('export-result', true, `已复制启动命令: ${command}`)
    emit('copy-command', command)
  } catch (error: any) {
    emit('export-result', false, error?.message || '复制失败')
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-50 overflow-hidden">
    <div class="flex items-center justify-between px-4 py-2 bg-surface console-header">
      <div class="flex items-center gap-2.5">
        <span class="text-[11px] font-semibold text-ttertiary uppercase tracking-[0.8px]">控制台</span>
        <span v-if="isRunning" class="flex items-center gap-1.25 text-[11px] font-semibold text-success-c">
          <span class="running-dot w-1.25 h-1.25 rounded-full bg-success-c animate-dot-pulse"></span>
          运行中
        </span>
        <span v-else-if="hasSessionLogs" class="flex items-center gap-1.25 text-[11px] font-semibold text-ttertiary">
          <span class="w-1.25 h-1.25 rounded-full bg-ttertiary"></span>
          已停止
        </span>
        <span v-else class="flex items-center gap-1.25 text-[11px] font-semibold text-ttertiary">
          <span class="w-1.25 h-1.25 rounded-full bg-ttertiary/60"></span>
          等待运行
        </span>
      </div>
      <div class="console-toolbar-cluster">
        <div v-if="hasLogs || hasSessionLogs" class="log-tools console-toolbar-group">
          <select v-model="logFilter" aria-label="日志类型过滤">
            <option value="all">全部</option>
            <option value="stdout">输出</option>
            <option value="stderr">警告</option>
            <option value="error">错误</option>
            <option value="info">信息</option>
          </select>
          <input v-model="searchQuery" aria-label="搜索日志" placeholder="搜索日志" />
          <button v-if="searchQuery" type="button" aria-label="清空搜索" @click="searchQuery = ''">清空</button>
        </div>
        <button
          v-if="hasError"
          class="console-toolbar-button console-toolbar-button-danger"
          @click="emit('analyze-errors')"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          分析错误
        </button>
        <button
          v-if="canExport"
          class="console-toolbar-button"
          :disabled="exporting"
          @click="exportLog"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {{ exporting ? '导出中...' : '导出日志' }}
        </button>
        <button
          v-if="hasSessionLogs"
          class="console-toolbar-button"
          @click="clear"
        >
          清空
        </button>
      </div>
    </div>
    <div class="terminal-region">
      <div ref="terminalContainer" :class="['terminal-canvas', { hidden: showEmptyState }]"></div>
      <div v-if="showEmptyState" class="console-empty" aria-live="polite">
        <div class="console-empty-decoration" aria-hidden="true">
          <span class="console-empty-blob console-empty-blob-a"></span>
          <span class="console-empty-blob console-empty-blob-b"></span>
          <span class="console-empty-grid"></span>
        </div>
        <div class="console-empty-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 17 10 11 4 5"/>
            <line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
        </div>
        <h3>控制台等待启动</h3>
        <p>启动项目后，stdout / stderr 输出会实时流式显示在这里。</p>

        <div v-if="project" class="console-empty-card">
          <div class="console-empty-card-head">
            <span class="console-empty-card-tag">即将执行</span>
            <span class="console-empty-card-runtime">{{ project.nodeVersion || nodeVersion || '系统 Node' }}</span>
          </div>
          <div class="console-empty-command">
            <span class="console-empty-prompt">$</span>
            <code>npm run {{ project.command }}</code>
            <button
              type="button"
              class="console-empty-copy"
              :aria-label="'复制启动命令'"
              title="复制启动命令"
              @click="copyLaunchCommand"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>复制</span>
            </button>
          </div>
          <div class="console-empty-meta">
            <span class="console-empty-meta-item">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
              <span :title="project.path">{{ truncate(project.path, 32) }}</span>
            </span>
            <span class="console-empty-meta-item">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg>
              <span>点击右上角「启动」即可开始</span>
            </span>
          </div>
        </div>

        <div class="console-empty-actions">
          <button type="button" class="console-empty-action primary" @click="emit('start')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg>
            <span>启动项目</span>
          </button>
          <span class="console-empty-shortcuts" aria-label="当前项目快捷键">
            <span class="console-empty-shortcut">
              <kbd :aria-label="primaryShortcutLabel">{{ primaryShortcutKey }}</kbd>
              <span>+</span>
              <kbd>R</kbd>
              <span>运行</span>
            </span>
            <span class="console-empty-shortcut muted">
              <kbd :aria-label="primaryShortcutLabel">{{ primaryShortcutKey }}</kbd>
              <span>+</span>
              <kbd>.</kbd>
              <span>停止</span>
            </span>
          </span>
        </div>

        <div class="console-empty-tips">
          <span class="console-empty-tip">
            <span class="tip-dot dot-info"></span>
            <span>输出</span>
          </span>
          <span class="console-empty-tip">
            <span class="tip-dot dot-warning"></span>
            <span>警告</span>
          </span>
          <span class="console-empty-tip">
            <span class="tip-dot dot-error"></span>
            <span>错误</span>
          </span>
          <span class="console-empty-divider" aria-hidden="true"></span>
          <span class="console-empty-tip muted">日志支持高亮、过滤与全文搜索</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.console-toolbar-cluster {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.console-toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 2px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-surface) 82%, transparent);
}

.running-dot {
  box-shadow: 0 0 6px var(--success);
}

.console-header {
  gap: 10px;
  min-height: 42px;
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-fill);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
}

.console-header > div:last-child {
  min-width: 0;
}

.log-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.log-tools select,
.log-tools input {
  min-height: 28px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-secondary);
  background: var(--bg-surface);
  font-size: 12px;
  line-height: 1;
}

.log-tools select {
  max-width: 82px;
  padding: 0 8px;
}

.log-tools input {
  width: 180px;
  max-width: min(36vw, 220px);
  padding: 0 10px;
}

.log-tools select:focus-visible,
.log-tools input:focus-visible {
  outline: none;
}

.log-tools button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.log-tools button:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.console-toolbar-button {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-tertiary);
  background: var(--bg-surface);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
}

.console-toolbar-button:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.console-toolbar-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.console-toolbar-button-danger {
  color: var(--error);
  border-color: color-mix(in srgb, var(--error) 30%, var(--border-default));
  background: color-mix(in srgb, var(--error-bg) 50%, var(--bg-surface));
}

.console-toolbar-button-danger:hover:not(:disabled) {
  color: var(--error);
  background: color-mix(in srgb, var(--error-bg) 72%, var(--bg-hover));
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

.terminal-region { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--console-bg); }
.terminal-canvas { flex: 1; min-height: 0; border: none; outline: none; }
.terminal-canvas.hidden { visibility: hidden; }
:deep(.terminal-canvas .xterm-cursor-layer) { display: none !important; }
.console-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 36px 28px; text-align: center; pointer-events: none; overflow: hidden; animation: consoleEmptyFade 320ms cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes consoleEmptyFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.console-empty-decoration { position: absolute; inset: 0; pointer-events: none; z-index: -1; overflow: hidden; }
.console-empty-blob { position: absolute; border-radius: 50%; filter: blur(56px); opacity: 0.55; }
.console-empty-blob-a { top: 28%; left: 32%; width: 240px; height: 240px; background: radial-gradient(circle, var(--accent-glow), transparent 72%); animation: glowPulse 6s ease-in-out infinite; }
.console-empty-blob-b { bottom: 18%; right: 28%; width: 200px; height: 200px; background: radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 14%, transparent), transparent 72%); opacity: 0.4; }
.console-empty-grid { position: absolute; inset: 0; background-image: radial-gradient(color-mix(in srgb, var(--text-tertiary) 22%, transparent) 1px, transparent 1px); background-size: 22px 22px; opacity: 0.32; mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, #000 35%, transparent 78%); -webkit-mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, #000 35%, transparent 78%); }
.console-empty-icon { display: grid; place-items: center; width: 64px; height: 64px; margin-bottom: 4px; border: 1px solid var(--accent-border); border-radius: 18px; color: var(--accent-primary); background: color-mix(in srgb, var(--accent-glow) 70%, var(--bg-surface)); box-shadow: 0 8px 28px var(--accent-glow), inset 0 1px 0 color-mix(in srgb, var(--bg-surface) 60%, transparent); }
.console-empty h3 { margin: 0; color: var(--text-primary); font-size: 17px; font-weight: 750; letter-spacing: -0.01em; }
.console-empty > p { margin: 0; max-width: 380px; color: var(--text-secondary); font-size: 13.5px; line-height: 1.65; }

/* 命令预览卡 */
.console-empty-card { pointer-events: auto; width: 100%; max-width: 520px; margin-top: 8px; padding: 14px 16px; border: 1px solid var(--border-default); border-radius: 14px; background: color-mix(in srgb, var(--bg-surface) 90%, transparent); box-shadow: var(--shadow-md); text-align: left; animation: scaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.console-empty-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.console-empty-card-tag { display: inline-flex; align-items: center; padding: 2px 8px; border: 1px solid var(--accent-border); border-radius: 999px; color: var(--accent-primary); background: var(--accent-glow); font: 700 10px/1.4 var(--font-mono); letter-spacing: 0.12em; }
.console-empty-card-runtime { color: var(--text-tertiary); font: 700 11px/1 var(--font-mono); letter-spacing: 0.04em; }
.console-empty-command { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border-muted); border-radius: 10px; background: var(--console-bg); }
.console-empty-prompt { color: var(--accent-primary); font: 700 15px/1 var(--font-mono); }
.console-empty-command code { flex: 1; min-width: 0; overflow: hidden; color: var(--text-primary); font: 700 15px/1.4 var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
.console-empty-copy { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 28px; padding: 0 10px; border: 1px solid var(--border-default); border-radius: 8px; color: var(--text-tertiary); background: var(--bg-surface); font-size: 12px; font-weight: 600; line-height: 1; transition: color 160ms ease, background 160ms ease, border-color 160ms ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
.console-empty-copy:hover { color: var(--accent-primary); border-color: var(--accent-border); background: var(--accent-glow); }
.console-empty-meta { display: flex; align-items: center; gap: 14px; margin-top: 10px; color: var(--text-tertiary); font-size: 11.5px; }
.console-empty-meta-item { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
.console-empty-meta-item span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 启动操作区 */
.console-empty-actions { pointer-events: auto; display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 4px; flex-wrap: wrap; }
.console-empty-action { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 16px; border: none; border-radius: 10px; color: #fff; background: var(--accent-primary); box-shadow: 0 6px 18px var(--accent-glow); font-size: 13px; font-weight: 700; transition: transform 160ms ease, box-shadow 200ms ease, background 200ms ease; }
.console-empty-action:hover { transform: translateY(-1px); background: var(--accent-primary-hover); box-shadow: 0 9px 22px color-mix(in srgb, var(--accent-primary) 30%, transparent); }
.console-empty-shortcuts { display: inline-flex; align-items: center; gap: 12px; }
.console-empty-shortcut { display: inline-flex; align-items: center; gap: 5px; color: var(--text-tertiary); font-size: 12px; font-weight: 700; }
.console-empty-shortcut.muted { opacity: 0.76; }
.console-empty-shortcut kbd { display: inline-grid; place-items: center; min-width: 34px; height: 30px; padding: 0 9px; border: 1px solid color-mix(in srgb, var(--border-default) 86%, #fff); border-bottom-width: 3px; border-radius: 9px; color: var(--text-secondary); background: linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 84%, #fff), var(--bg-elevated)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72), inset 0 -1px 0 rgba(0, 0, 0, 0.06), 0 2px 4px rgba(30, 45, 65, 0.1); font: 800 14px/1 var(--font-mono); letter-spacing: -0.02em; }
.console-empty-shortcut kbd:first-child { min-width: 40px; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', var(--font-mono); }
.console-empty-shortcut > span:not(:last-child) { color: var(--text-tertiary); font-size: 15px; font-weight: 800; }
:global(:root[data-theme='dark']) .console-empty-shortcut kbd { border-color: rgba(148, 163, 184, 0.24); border-bottom-color: rgba(148, 163, 184, 0.34); background: linear-gradient(180deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.96)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.28), 0 2px 5px rgba(0, 0, 0, 0.28); }

/* 控制台终端区域：使用 xterm 主题背景，与上层玻璃面板衔接 */
.terminal-region {
  background: var(--console-bg);
}

.terminal-canvas {
  background: transparent;
}

/* 颜色提示行 */
.console-empty-tips { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 8px; padding: 8px 14px; border: 1px solid var(--border-muted); border-radius: 999px; background: color-mix(in srgb, var(--bg-surface) 60%, transparent); font-size: 11.5px; }
.console-empty-tip { display: inline-flex; align-items: center; gap: 5px; color: var(--text-secondary); font: 700 11px/1 var(--font-mono); letter-spacing: 0.04em; }
.console-empty-tip.muted { color: var(--text-tertiary); font-weight: 500; letter-spacing: 0; font-family: var(--font-ui); }
.console-empty-divider { width: 1px; height: 12px; background: var(--border-muted); }
.tip-dot { width: 7px; height: 7px; border-radius: 50%; }
.dot-info { background: var(--console-info, #0969da); }
.dot-warning { background: var(--console-warn, #9a6700); }
.dot-error { background: var(--console-error, #cf222e); }
:root[data-theme='dark'] .dot-info { background: var(--console-info, #60a5fa); }
:root[data-theme='dark'] .dot-warning { background: var(--console-warn, #fbbf24); }
:root[data-theme='dark'] .dot-error { background: var(--console-error, #f87171); }
</style>

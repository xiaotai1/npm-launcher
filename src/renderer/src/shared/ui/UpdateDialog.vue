<script setup lang="ts">
import { ref } from 'vue'
import type { UpdaterStatus } from '../../app/useAppUpdater'
import BaseDialog from './BaseDialog.vue'

const props = defineProps<{
  visible: boolean
  currentVersion: string
  nextVersion: string
  notes: string
  status: UpdaterStatus
  progressPercent: number | null
  runningCount: number
  errorMessage: string
}>()

const emit = defineEmits<{
  close: []
  install: []
}>()

const cancelButtonRef = ref<HTMLButtonElement | null>(null)

const isLocked = () => props.status === 'downloading' || props.status === 'installing'

function close() {
  if (!isLocked()) emit('close')
}

// BaseDialog 负责 Esc/关闭；下载/安装期间禁止关闭
function requestClose() {
  close()
}

function installButtonLabel() {
  if (props.status === 'error') return '重试更新'
  if (props.status === 'downloading') return '正在下载'
  if (props.status === 'installing') return '正在安装'
  return '立即更新'
}
</script>

<template>
  <BaseDialog
    :visible="visible"
    title="发现新版本"
    eyebrow="应用更新"
    size="lg"
    :closeable="isLocked() ? false : true"
    autofocus="first"
    @close="requestClose"
  >
    <div class="update-body">
      <div class="version-row">
        <span>当前版本 <strong>v{{ currentVersion }}</strong></span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
        <span>新版本 <strong>v{{ nextVersion }}</strong></span>
      </div>

      <section class="release-notes" aria-label="更新说明">
        <h3>更新说明</h3>
        <p>{{ notes }}</p>
      </section>

      <div v-if="runningCount > 0" class="running-warning">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 9v4m0 4h.01"/><path d="M10.3 3.6 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/></svg>
        <span>更新会关闭应用，并停止当前运行的 {{ runningCount }} 个项目。</span>
      </div>

      <div v-if="status === 'downloading' || status === 'installing'" class="update-progress" aria-live="polite">
        <div class="progress-copy">
          <span>{{ status === 'installing' ? '正在安装更新…' : '正在下载更新…' }}</span>
          <strong>{{ progressPercent === null ? '计算中' : `${progressPercent}%` }}</strong>
        </div>
        <div class="progress-track" role="progressbar" :aria-valuenow="progressPercent ?? undefined" aria-valuemin="0" aria-valuemax="100">
          <span v-if="progressPercent !== null" :style="{ width: `${progressPercent}%` }"></span>
          <span v-else class="indeterminate"></span>
        </div>
      </div>

      <p v-if="status === 'error'" class="update-error" role="alert">更新失败：{{ errorMessage }}</p>
    </div>

    <template #footer>
      <button ref="cancelButtonRef" type="button" class="button-secondary" :disabled="isLocked()" @click="close">
        稍后更新
      </button>
      <button type="button" class="button-primary" :disabled="isLocked()" @click="emit('install')">
        {{ installButtonLabel() }}
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.update-body {
  min-height: 242px;
  max-height: calc(100vh - 210px);
  overflow-y: auto;
  padding: 22px;
}

.version-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 13px 16px;
  border: 1px solid var(--border-muted);
  border-radius: 8px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  font-size: 12px;
}
.version-row strong {
  margin-left: 4px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
}
.version-row svg {
  flex: none;
  color: var(--accent-primary);
}

.release-notes {
  margin-top: 20px;
}
.release-notes h3 {
  margin: 0 0 8px;
  color: var(--text-primary);
  font-size: 13px;
}
.release-notes p {
  max-height: 156px;
  margin: 0;
  overflow-y: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.running-warning {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 18px;
  padding: 11px 12px;
  border: 1px solid color-mix(in srgb, var(--warning) 24%, transparent);
  border-radius: 8px;
  color: var(--warning);
  background: var(--warning-bg);
  font-size: 12px;
  line-height: 1.55;
}
.running-warning svg {
  flex: none;
  margin-top: 1px;
}

.update-progress {
  margin-top: 20px;
}
.progress-copy {
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-secondary);
  font-size: 12px;
}
.progress-copy strong {
  color: var(--accent-primary);
  font-family: var(--font-mono);
}
.progress-track {
  height: 6px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--bg-subtle);
}
.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent-primary);
  transition: width 180ms ease;
}
.progress-track .indeterminate {
  width: 36%;
  animation: update-indeterminate 1.2s ease-in-out infinite;
}

.update-error {
  margin: 18px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--error);
  background: var(--error-bg);
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.update-actions-inline {
  display: contents;
}

@media (max-width: 520px) {
  .version-row {
    gap: 8px;
    padding-inline: 10px;
  }
}

@keyframes update-indeterminate {
  from {
    transform: translateX(-110%);
  }
  to {
    transform: translateX(280%);
  }
}
</style>

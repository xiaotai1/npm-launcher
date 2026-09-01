<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { UpdaterStatus } from '../../app/useAppUpdater'

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

const dialogRef = ref<HTMLElement | null>(null)
const cancelButtonRef = ref<HTMLButtonElement | null>(null)
const titleId = `update-dialog-title-${crypto.randomUUID()}`
let previouslyFocused: HTMLElement | null = null

const isLocked = () => props.status === 'downloading' || props.status === 'installing'

function close() {
  if (!isLocked()) emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !dialogRef.value) return

  const focusable = Array.from(dialogRef.value.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.visible, visible => {
  if (visible) {
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    nextTick(() => cancelButtonRef.value?.focus())
  } else if (previouslyFocused?.isConnected) {
    nextTick(() => previouslyFocused?.focus())
    previouslyFocused = null
  }
})

onBeforeUnmount(() => {
  if (previouslyFocused?.isConnected) previouslyFocused.focus()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="update-dialog">
      <div v-if="visible" class="update-backdrop" @mousedown.self="close">
        <section ref="dialogRef" class="update-dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" @keydown="handleKeydown">
          <header class="update-header">
            <div>
              <p>应用更新</p>
              <h2 :id="titleId">发现新版本</h2>
            </div>
            <button v-if="!isLocked()" class="update-close" type="button" aria-label="关闭更新窗口" @click="close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
            </button>
          </header>

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

          <footer class="update-actions">
            <button ref="cancelButtonRef" type="button" class="button-secondary" :disabled="isLocked()" @click="close">
              稍后更新
            </button>
            <button type="button" class="button-primary" :disabled="isLocked()" @click="emit('install')">
              {{ status === 'error' ? '重试更新' : status === 'downloading' ? '正在下载' : status === 'installing' ? '正在安装' : '立即更新' }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-backdrop { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; padding: 28px; background: var(--modal-backdrop); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); -webkit-app-region: no-drag; }
.update-dialog { width: min(500px, calc(100vw - 40px)); max-height: min(620px, calc(100vh - 40px)); overflow: hidden; color: var(--text-primary); border: 1px solid var(--glass-border); border-radius: 18px; background: color-mix(in srgb, var(--bg-surface) 96%, transparent); box-shadow: var(--glass-shadow); }
.update-header { min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 22px; border-bottom: 1px solid var(--border-muted); }
.update-header p { margin: 0 0 4px; color: var(--accent-primary); font: 700 10px/1 var(--font-mono); letter-spacing: 0; }
.update-header h2 { margin: 0; font-size: 17px; line-height: 1.35; letter-spacing: 0; }
.update-close { width: 32px; height: 32px; display: grid; place-items: center; flex: none; border-radius: 8px; color: var(--text-tertiary); }
.update-close:hover { color: var(--text-primary); background: var(--bg-hover); }
.update-body { min-height: 242px; max-height: calc(100vh - 210px); overflow-y: auto; padding: 22px; }
.version-row { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 13px 16px; border: 1px solid var(--border-muted); border-radius: 8px; color: var(--text-tertiary); background: var(--bg-subtle); font-size: 12px; }
.version-row strong { margin-left: 4px; color: var(--text-primary); font-family: var(--font-mono); font-size: 13px; }
.version-row svg { flex: none; color: var(--accent-primary); }
.release-notes { margin-top: 20px; }
.release-notes h3 { margin: 0 0 8px; color: var(--text-primary); font-size: 13px; }
.release-notes p { max-height: 156px; margin: 0; overflow-y: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-secondary); font-size: 13px; line-height: 1.65; }
.running-warning { display: flex; align-items: flex-start; gap: 9px; margin-top: 18px; padding: 11px 12px; border: 1px solid color-mix(in srgb, var(--warning) 24%, transparent); border-radius: 8px; color: var(--warning); background: var(--warning-bg); font-size: 12px; line-height: 1.55; }
.running-warning svg { flex: none; margin-top: 1px; }
.update-progress { margin-top: 20px; }
.progress-copy { min-height: 20px; display: flex; align-items: center; justify-content: space-between; color: var(--text-secondary); font-size: 12px; }
.progress-copy strong { color: var(--accent-primary); font-family: var(--font-mono); }
.progress-track { height: 6px; margin-top: 8px; overflow: hidden; border-radius: 3px; background: var(--bg-subtle); }
.progress-track span { display: block; height: 100%; border-radius: inherit; background: var(--accent-primary); transition: width 180ms ease; }
.progress-track .indeterminate { width: 36%; animation: update-indeterminate 1.2s ease-in-out infinite; }
.update-error { margin: 18px 0 0; padding: 10px 12px; border-radius: 8px; color: var(--error); background: var(--error-bg); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
.update-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 22px; border-top: 1px solid var(--border-muted); }
.update-actions button { min-height: 36px; min-width: 88px; padding: 0 15px; border-radius: 8px; font-size: 12px; font-weight: 700; }
.update-actions button:disabled { cursor: wait; opacity: .62; }
@keyframes update-indeterminate { from { transform: translateX(-110%); } to { transform: translateX(280%); } }
.update-dialog-enter-active, .update-dialog-leave-active { transition: opacity 180ms ease; }
.update-dialog-enter-active .update-dialog, .update-dialog-leave-active .update-dialog { transition: transform 180ms ease, opacity 180ms ease; }
.update-dialog-enter-from, .update-dialog-leave-to { opacity: 0; }
.update-dialog-enter-from .update-dialog, .update-dialog-leave-to .update-dialog { opacity: 0; transform: translateY(8px) scale(.985); }
@media (prefers-reduced-motion: reduce) { .update-dialog-enter-active, .update-dialog-leave-active, .update-dialog-enter-active .update-dialog, .update-dialog-leave-active .update-dialog, .progress-track .indeterminate { animation-duration: 0s; transition-duration: 0s; } }
@media (max-width: 520px) { .update-backdrop { padding: 16px; } .update-dialog { width: 100%; } .version-row { gap: 8px; padding-inline: 10px; } }
</style>

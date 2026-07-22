<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const cancelButtonRef = ref<HTMLButtonElement | null>(null)
const instanceId = crypto.randomUUID()
const titleId = `confirm-dialog-title-${instanceId}`
const messageId = `confirm-dialog-message-${instanceId}`
let previouslyFocused: HTMLElement | null = null

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}

function restorePreviousFocus() {
  const target = previouslyFocused
  previouslyFocused = null
  if (target?.isConnected) nextTick(() => target.focus())
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    onCancel()
    return
  }

  if (event.key !== 'Tab' || !dialogRef.value) return

  const focusable = Array.from(dialogRef.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ))
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
    previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    nextTick(() => cancelButtonRef.value?.focus())
  } else {
    restorePreviousFocus()
  }
}, { immediate: true })

onBeforeUnmount(restorePreviousFocus)
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="visible" class="confirm-dialog-backdrop" @mousedown.self="onCancel">
        <section
          ref="dialogRef"
          class="confirm-dialog"
          :class="{ danger }"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="messageId"
          @keydown="handleDialogKeydown"
        >
          <header class="dialog-header">
            <div>
              <p>{{ danger ? '危险操作' : '请确认操作' }}</p>
              <h2 :id="titleId">{{ title }}</h2>
            </div>
            <button class="dialog-close" type="button" aria-label="关闭确认窗口" @click="onCancel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18"/>
              </svg>
            </button>
          </header>

          <div class="dialog-body">
            <div class="dialog-icon" aria-hidden="true">
              <svg v-if="danger" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.3 3.6 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/>
                <path d="M12 9v4M12 17h.01"/>
              </svg>
              <svg v-else width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <div class="dialog-copy">
              <p :id="messageId">{{ message }}</p>
            </div>
          </div>

          <footer class="dialog-actions">
            <button ref="cancelButtonRef" type="button" class="cancel-button" @click="onCancel">
              {{ cancelText || '取消' }}
            </button>
            <button type="button" class="confirm-button" :class="{ danger }" @click="onConfirm">
              {{ confirmText || '确认' }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(4, 9, 17, .52);
  backdrop-filter: blur(3px);
  -webkit-app-region: no-drag;
}

.confirm-dialog {
  width: min(420px, calc(100vw - 40px));
  overflow: hidden;
  color: var(--text-primary);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
}

.dialog-header {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-muted);
}

.dialog-header p {
  margin: 0 0 4px;
  color: var(--text-tertiary);
  font: 700 9px/1 var(--font-mono);
  letter-spacing: .14em;
}

.confirm-dialog.danger .dialog-header p {
  color: var(--error);
}

.dialog-header h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.35;
  letter-spacing: -.025em;
}

.dialog-close {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 8px;
  color: var(--text-tertiary);
}

.dialog-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.dialog-body {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 13px;
  padding: 20px;
}

.dialog-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid var(--accent-border);
  border-radius: 10px;
  color: var(--accent-primary);
  background: var(--accent-glow);
}

.confirm-dialog.danger .dialog-icon {
  color: var(--error);
  border-color: color-mix(in srgb, var(--error) 24%, transparent);
  background: var(--error-bg);
}

.dialog-copy {
  min-width: 0;
  padding-top: 1px;
}

.dialog-copy p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-muted);
  background: color-mix(in srgb, var(--bg-subtle) 55%, var(--bg-surface));
}

.cancel-button,
.confirm-button {
  min-height: 36px;
  padding: 0 15px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
}

.cancel-button {
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}

.cancel-button:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.confirm-button {
  min-width: 82px;
  color: #fff;
  background: var(--accent-primary);
  box-shadow: 0 3px 10px var(--accent-glow);
}

.confirm-button:hover {
  background: var(--accent-primary-hover);
}

.confirm-button.danger {
  background: var(--error);
  box-shadow: 0 3px 10px var(--error-bg);
}

.confirm-button.danger:hover {
  filter: brightness(1.08);
}

.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: opacity 180ms ease;
}

.confirm-dialog-enter-active .confirm-dialog,
.confirm-dialog-leave-active .confirm-dialog {
  transition: transform 180ms ease, opacity 180ms ease;
}

.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
  opacity: 0;
}

.confirm-dialog-enter-from .confirm-dialog,
.confirm-dialog-leave-to .confirm-dialog {
  opacity: 0;
  transform: translateY(6px) scale(.985);
}

@media (prefers-reduced-motion: reduce) {
  .confirm-dialog-enter-active,
  .confirm-dialog-leave-active,
  .confirm-dialog-enter-active .confirm-dialog,
  .confirm-dialog-leave-active .confirm-dialog {
    transition-duration: 0s;
  }
}
</style>

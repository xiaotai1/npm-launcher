<script setup lang="ts">
import { ref } from 'vue'
import BaseDialog from './BaseDialog.vue'

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

const cancelButtonRef = ref<HTMLButtonElement | null>(null)
const confirmButtonRef = ref<HTMLButtonElement | null>(null)

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}

function handleFooterKeydown(event: KeyboardEvent) {
  // 两个相邻按钮之间用方向键快速选择
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  if (event.target === cancelButtonRef.value) {
    event.preventDefault()
    confirmButtonRef.value?.focus()
  } else if (event.target === confirmButtonRef.value) {
    event.preventDefault()
    cancelButtonRef.value?.focus()
  }
}
</script>

<template>
  <BaseDialog
    :visible="visible"
    :title="title"
    eyebrow="请确认操作"
    autofocus="first"
    @close="onCancel"
  >
    <div class="dialog-body" :class="{ danger: props.danger }">
      <div class="dialog-icon" :class="{ danger: props.danger }" aria-hidden="true">
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
        <p>{{ message }}</p>
      </div>
    </div>

    <template #footer>
      <button
        ref="cancelButtonRef"
        type="button"
        class="dialog-button cancel"
        @click="onCancel"
        @keydown="handleFooterKeydown"
      >
        {{ cancelText || '取消' }}
      </button>
      <button
        ref="confirmButtonRef"
        type="button"
        class="dialog-button confirm"
        :class="{ danger: props.danger }"
        @click="onConfirm"
        @keydown="handleFooterKeydown"
      >
        {{ confirmText || '确认' }}
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.dialog-body {
  position: relative;
  z-index: 1;
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

.dialog-icon.danger {
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
  font-size: 14px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.dialog-button {
  min-height: 36px;
  padding: 0 15px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
}

.dialog-button.cancel {
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}

.dialog-button.cancel:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.dialog-button.confirm {
  min-width: 82px;
  color: #fff;
  background: var(--accent-primary);
  box-shadow: 0 4px 12px var(--accent-glow);
  transition: transform 160ms ease, background 180ms ease, box-shadow 180ms ease;
}

.dialog-button.confirm:hover {
  transform: translateY(-1px);
  background: var(--accent-primary-hover);
  box-shadow: 0 8px 18px var(--accent-glow);
}

.dialog-button.confirm.danger {
  background: var(--error);
  box-shadow: 0 4px 12px var(--error-bg);
}

.dialog-button.confirm.danger:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
  box-shadow: 0 8px 18px var(--error-bg);
}

.dialog-button:disabled {
  cursor: wait;
  opacity: 0.62;
}
</style>
<script setup lang="ts">
import { ref, watch } from 'vue'

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

const show = ref(false)

watch(() => props.visible, (val) => {
  if (val) {
    show.value = true
  }
})

function onConfirm() {
  emit('confirm')
  show.value = false
}

function onCancel() {
  emit('cancel')
  show.value = false
}

function onOverlayClick() {
  onCancel()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="onOverlayClick">
        <div class="modal-dialog" @click.stop>
          <div class="modal-content">
            <div class="modal-header">
              <span class="modal-icon" :class="{ danger }">
                <svg v-if="danger" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </span>
              <h3 class="modal-title">{{ title }}</h3>
            </div>
            <p class="modal-message">{{ message }}</p>
            <div class="modal-actions">
              <button class="modal-btn cancel" @click="onCancel">
                {{ cancelText || '取消' }}
              </button>
              <button class="modal-btn confirm" :class="{ danger }" @click="onConfirm">
                {{ confirmText || '确认' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  -webkit-app-region: no-drag;
}

.modal-dialog {
  min-width: 340px;
  max-width: 420px;
  border-radius: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  animation: dialogIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-content {
  padding: 24px 28px;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.modal-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
  flex-shrink: 0;
}

.modal-icon.danger {
  color: #DC2626;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.2px;
}

.modal-message {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 24px;
  padding-left: 28px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 180ms ease;
}

.modal-btn.cancel {
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border-default);
}

.modal-btn.cancel:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.modal-btn.confirm {
  color: #fff;
  background: var(--accent-primary);
  border: none;
}

.modal-btn.confirm:hover {
  filter: brightness(1.1);
}

.modal-btn.confirm.danger {
  background: #DC2626;
}

.modal-btn.confirm.danger:hover {
  background: #EF4444;
}

.modal-enter-active {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-leave-active {
  animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) reverse;
}

@keyframes dialogIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>

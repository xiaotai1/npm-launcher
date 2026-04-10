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
          <div class="modal-icon">
            <svg v-if="danger" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="1.8">
              <path d="M12 9v4"/>
              <path d="M12 17h.01"/>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <h3 class="modal-title">{{ title }}</h3>
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
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay{
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-app-region: no-drag;
}

.modal-dialog{
  min-width: 300px;
  max-width: 380px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(0, 0, 0, 0.03);
  padding: 28px 32px 24px;
  text-align: center;
  animation: dialogIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-icon{
  margin-bottom: 12px;
  opacity: 0.9;
}

.modal-title{
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  letter-spacing: -0.2px;
}

.modal-message{
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
}

.modal-actions{
  display: flex;
  gap: 8px;
  justify-content: center;
}

.modal-btn{
  flex: 1;
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-btn.cancel{
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
}

.modal-btn.cancel:hover{
  background: var(--bg-hover);
}

.modal-btn.confirm{
  color: #fff;
  background: var(--accent-primary);
  border: 1px solid transparent;
}

.modal-btn.confirm:hover{
  background: var(--accent-primary-hover);
  transform: translateY(-1px);
}

.modal-btn.confirm.danger{
  background: var(--error);
}

.modal-btn.confirm.danger:hover{
  opacity: 0.85;
}

/* 动画 */
.modal-enter-active{
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-leave-active{
  animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) reverse;
}

@keyframes dialogIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>

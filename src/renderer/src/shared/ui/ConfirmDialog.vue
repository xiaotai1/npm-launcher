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
      <div v-if="show" class="fixed inset-0 z-2000 flex items-center justify-center modal-overlay" @click="onOverlayClick">
        <div class="min-w-85 max-w-105 rounded-2xl animate-dialog-in modal-dialog" @click.stop>
          <div class="p-6 px-7 modal-content">
            <div class="flex items-center gap-2.5 mb-2.5 modal-header">
              <span class="flex items-center justify-center shrink-0 modal-icon" :class="{ danger }">
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
              <h3 class="text-[15px] font-semibold text-tprimary tracking-[-0.2px]">{{ title }}</h3>
            </div>
            <p class="text-[13px] text-tsecondary leading-[1.7] mb-6 pl-7">{{ message }}</p>
            <div class="flex gap-2.5 justify-end">
              <button class="px-5 py-2 text-[13px] font-medium rounded-lg transition-all duration-180 ease-out modal-btn cancel" @click="onCancel">
                {{ cancelText || '取消' }}
              </button>
              <button class="px-5 py-2 text-[13px] font-medium rounded-lg transition-all duration-180 ease-out text-white modal-btn confirm" :class="{ danger }" @click="onConfirm">
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
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  -webkit-app-region: no-drag;
}

.modal-dialog {
  background: var(--bg-surface);
  border: 1.5px solid var(--border-default);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
}

.modal-icon {
  color: var(--accent-primary);
}

.modal-icon.danger {
  color: #DC2626;
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
</style>

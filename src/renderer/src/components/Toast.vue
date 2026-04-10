<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  message: string
  type?: 'success' | 'error' | 'warning'
  duration?: number
}>()

const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

watch(() => props.message, (val) => {
  if (!val) return
  visible.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = false
  }, props.duration || 3000)
})

function close() {
  visible.value = false
  if (timer) clearTimeout(timer)
}
</script>

<template>
  <Transition name="toast">
    <div v-if="visible" class="toast-container" :class="type || 'error'" @click="close">
      <span class="toast-icon">{{ type === 'success' ? '✓' : type === 'warning' ? '!' : '✕' }}</span>
      <span class="toast-msg">{{ message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  z-index: 9999;
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(12px);
  border: 1px solid;
  max-width: 90vw;
}

.toast-container.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--error);
  border-color: rgba(239, 68, 68, 0.2);
}

.toast-container.success {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
  border-color: rgba(16, 185, 129, 0.2);
}

.toast-container.warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
  border-color: rgba(245, 158, 11, 0.2);
}

.toast-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.error .toast-icon {
  background: var(--error);
  color: #fff;
}

.success .toast-icon {
  background: var(--success);
  color: #fff;
}

.warning .toast-icon {
  background: var(--warning);
  color: #fff;
}

.toast-msg {
  line-height: 1.4;
}

.toast-enter-active {
  animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-leave-active {
  animation: toastIn 0.2s cubic-bezier(0.4, 0, 1, 1) reverse;
}

@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>

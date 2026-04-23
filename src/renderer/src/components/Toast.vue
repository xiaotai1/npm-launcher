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
    <div v-if="visible" class="fixed top-15 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-medium z-9999 cursor-pointer shadow-lg backdrop-blur-xs border border-solid max-w-[90vw]" :class="type || 'error'" @click="close">
      <span class="w-4.5 h-4.5 flex items-center justify-center rounded-full text-[11px] font-bold shrink-0 toast-icon">{{ type === 'success' ? '✓' : type === 'warning' ? '!' : '✕' }}</span>
      <span class="leading-snug toast-msg">{{ message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--error);
  border-color: rgba(239, 68, 68, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

.success {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
  border-color: rgba(16, 185, 129, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

.warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
  border-color: rgba(245, 158, 11, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
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

.toast-enter-active {
  animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-leave-active {
  animation: toastIn 0.2s cubic-bezier(0.4, 0, 1, 1) reverse;
}
</style>

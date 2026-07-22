<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isMaximized = ref(false)
const isHovering = ref(false)

async function handleMinimize() {
  await window.electronAPI.minimize()
}

async function handleMaximize() {
  await window.electronAPI.maximize()
  isMaximized.value = await window.electronAPI.isMaximized()
}

async function handleClose() {
  await window.electronAPI.close()
}

async function checkMaximized() {
  isMaximized.value = await window.electronAPI.isMaximized()
}

onMounted(() => {
  checkMaximized()
  // 监听窗口最大化状态变化
  window.addEventListener('resize', checkMaximized)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMaximized)
})
</script>

<template>
  <div class="window-controls">
    <button class="window-btn" @click="handleMinimize" title="最小化">
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
        <line x1="2" y1="6" x2="10" y2="6"/>
      </svg>
    </button>
    <button class="window-btn" @click="handleMaximize" :title="isMaximized ? '向下还原' : '最大化'">
      <svg v-if="!isMaximized" width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1.5" y="1.5" width="9" height="9" rx="0.5"/>
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2.5" y="3.5" width="6" height="5"/>
        <polyline points="5.5 3.5 5.5 1.5 10.5 1.5 10.5 6.5 8.5 6.5"/>
      </svg>
    </button>
    <button class="window-btn close" @click="handleClose" title="关闭">
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <line x1="2.5" y1="2.5" x2="9.5" y2="9.5"/>
        <line x1="9.5" y1="2.5" x2="2.5" y2="9.5"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.window-controls {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
  margin-left: auto;
}

.window-btn {
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
}
</style>

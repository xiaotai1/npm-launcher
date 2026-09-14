<script setup lang="ts">
import BaseDialog from '../ui/BaseDialog.vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  quit: []
  'hide-to-tray': []
  cancel: []
}>()
</script>

<template>
  <BaseDialog
    :visible="visible"
    title="关闭 NPM Launcher"
    eyebrow="退出确认"
    autofocus="first"
    @close="emit('cancel')"
  >
    <div class="close-dialog-body">
      <div class="close-icon" aria-hidden="true">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v9"/>
          <path d="M18.36 6.64a9 9 0 1 1-12.72 0"/>
        </svg>
      </div>
      <div class="close-copy">
        <p>关闭后会停止所有正在运行的 NPM 项目进程。</p>
        <p class="close-subtitle">若只是想暂时避让，可选择最小化到托盘，项目继续在后台运行。</p>
      </div>
    </div>

    <template #footer>
      <button type="button" class="close-button cancel" @click="emit('cancel')">取消</button>
      <button type="button" class="close-button hide" @click="emit('hide-to-tray')">最小化到托盘</button>
      <button type="button" class="close-button quit" @click="emit('quit')">退出</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.close-dialog-body {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 20px;
}

.close-icon {
  width: 42px;
  height: 42px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid var(--accent-border);
  border-radius: 10px;
  color: var(--accent-primary);
  background: var(--accent-glow);
}

.close-copy {
  min-width: 0;
  padding-top: 1px;
}

.close-copy p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.close-copy .close-subtitle {
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.55;
}

.close-button {
  min-height: 36px;
  padding: 0 15px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
}

.close-button.cancel {
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}

.close-button.cancel:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.close-button.hide {
  color: var(--accent-primary);
  border: 1px solid var(--accent-border);
  background: var(--accent-glow);
}

.close-button.hide:hover {
  color: #fff;
  background: var(--accent-primary);
}

.close-button.quit {
  color: #fff;
  background: var(--error);
  box-shadow: 0 4px 12px var(--error-bg);
}

.close-button.quit:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
  box-shadow: 0 8px 18px var(--error-bg);
}
</style>
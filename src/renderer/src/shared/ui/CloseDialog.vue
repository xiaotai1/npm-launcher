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
    title="离开 NPM Launcher？"
    eyebrow="退出确认"
    autofocus="first"
    @close="emit('cancel')"
  >
    <div class="close-body">
      <p class="close-lead">正在运行的项目不会被自动保存，你希望怎么处理？</p>

      <div class="close-options">
        <button type="button" class="close-option hide" @click="emit('hide-to-tray')">
          <span class="option-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 4v8"/>
              <path d="m8 11 4 4 4-4"/>
              <path d="M4 20h16"/>
            </svg>
          </span>
          <span class="option-copy">
            <strong>最小化到托盘</strong>
            <em>窗口收起，项目继续在后台运行</em>
          </span>
        </button>

        <button type="button" class="close-option quit" @click="emit('quit')">
          <span class="option-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v9"/>
              <path d="M18.36 6.64a9 9 0 1 1-12.72 0"/>
            </svg>
          </span>
          <span class="option-copy">
            <strong>退出并停止项目</strong>
            <em>关闭应用，同时停止所有运行的进程</em>
          </span>
        </button>
      </div>
    </div>

    <template #footer>
      <button type="button" class="close-cancel" @click="emit('cancel')">取消</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.close-body {
  position: relative;
  z-index: 1;
  padding: 20px;
}

.close-lead {
  margin: 0 0 14px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.close-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.close-option {
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  color: var(--text-secondary);
  background: var(--bg-surface);
  text-align: left;
  transition: transform 160ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
}

.close-option:hover {
  transform: translateY(-1px);
  border-color: var(--accent-border);
  background: var(--bg-hover);
  box-shadow: var(--shadow-sm);
}

.close-option.hide:hover {
  border-color: var(--accent-border);
}

.close-option.quit:hover {
  border-color: color-mix(in srgb, var(--error) 40%, var(--border-default));
}

.option-icon {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--accent-primary);
  background: var(--accent-glow);
}

.close-option.quit .option-icon {
  color: var(--error);
  background: var(--error-bg);
}

.option-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.option-copy strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
}

.option-copy em {
  color: var(--text-tertiary);
  font-size: 11px;
  font-style: normal;
  line-height: 1.4;
}

.close-cancel {
  min-height: 36px;
  padding: 0 15px;
  border-radius: 10px;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  font-size: 12px;
  font-weight: 700;
}

.close-cancel:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
</style>
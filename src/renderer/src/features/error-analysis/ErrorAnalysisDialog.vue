<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ErrorAnalysis } from '../../shared/types'

const props = defineProps<{
  visible: boolean
  analysis: ErrorAnalysis | null
}>()

const emit = defineEmits<{ close: [] }>()

const show = ref(false)

watch(() => props.visible, (val) => {
  if (val) {
    show.value = true
  }
})

function onClose() {
  show.value = false
  emit('close')
}

function onOverlayClick() {
  onClose()
}

function severityLabel(severity: string): string {
  if (severity === 'critical') return '严重'
  if (severity === 'warning') return '警告'
  return '提示'
}

function severityClass(severity: string): string {
  return `severity-${severity}`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show && analysis" class="fixed inset-0 z-2000 flex items-center justify-center modal-overlay" @click="onOverlayClick">
        <div class="min-w-85 max-w-120 rounded-2xl animate-dialog-in modal-dialog" @click.stop>
          <div class="p-6 px-7 modal-content">
            <div class="flex items-center gap-2.5 mb-4 modal-header">
              <span class="flex items-center justify-center shrink-0 modal-icon danger">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </span>
              <h3 class="text-[15px] font-semibold text-tprimary tracking-[-0.2px]">错误分析</h3>
              <span class="ml-auto text-[11px] font-mono text-ttertiary">退出代码: {{ analysis.exitCode }}</span>
            </div>

            <p class="text-[13px] text-tsecondary leading-[1.7] mb-4">{{ analysis.summary }}</p>

            <div v-if="analysis.matches.length > 0" class="space-y-3 mb-5">
              <div v-for="(match, i) in analysis.matches" :key="i" class="p-3 rounded-lg border border-border bg-elevated">
                <div class="flex items-center gap-2 mb-2">
                  <span :class="['inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold severity-badge', severityClass(match.severity)]">
                    {{ severityLabel(match.severity) }}
                  </span>
                  <span class="text-[13px] font-medium text-tprimary">{{ match.name }}</span>
                </div>
                <div class="mb-2 space-y-0.5">
                  <div v-for="(line, j) in match.lines" :key="j" class="font-mono text-[11px] text-ttertiary leading-[1.6] truncate">
                    {{ line }}
                  </div>
                </div>
                <div class="flex items-start gap-1.5 text-[12px] text-tsecondary">
                  <svg class="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.663 17h4.673M12 3v1m6.913 4.087l-.707.707M21 12h-1M4 12H3m3.293-4.293l-.707-.707M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"/></svg>
                  <span>{{ match.suggestion }}</span>
                </div>
              </div>
            </div>

            <div v-else class="p-3 rounded-lg border border-border bg-elevated mb-5">
              <p class="text-[12px] text-ttertiary">未匹配到已知错误模式，请查看运行日志面板排查问题。</p>
            </div>

            <div class="flex gap-2.5 justify-end">
              <button class="px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-180 ease-out modal-btn cancel" @click="onClose">
                关闭
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

.modal-icon.danger {
  color: #DC2626;
}

.severity-badge.severity-critical {
  background: rgba(220, 38, 38, 0.12);
  color: #DC2626;
}

.severity-badge.severity-warning {
  background: rgba(245, 158, 11, 0.12);
  color: #D97706;
}

.severity-badge.severity-info {
  background: rgba(59, 130, 246, 0.12);
  color: #3B82F6;
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
  color: white;
}

.modal-btn.confirm:hover {
  filter: brightness(1.1);
}

.modal-enter-active {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-leave-active {
  animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) reverse;
}
</style>

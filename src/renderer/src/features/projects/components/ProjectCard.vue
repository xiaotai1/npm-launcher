<script setup lang="ts">
import { computed } from 'vue'
import type { ProcessStatus, Project } from '../../../shared/types'
import type { LaunchFailure } from '../../workspace/model/launchFailures'
import { projectDisplayMeta, projectSecondaryLabel } from '../model/projectDisplay'

const props = defineProps<{
  project: Project
  status?: ProcessStatus
  globalNodeVersion: string | null
  localUrl?: string | null
  launchFailure?: LaunchFailure | null
}>()

const emit = defineEmits<{
  select: [id: string]
  start: [id: string]
  stop: [id: string]
  'open-url': [url: string]
}>()

const statusLabel = computed(() => {
  if (props.status?.status === 'running') return '运行中'
  if (props.status?.status === 'error') return '异常'
  if (props.launchFailure) return '启动失败'
  return '未启动'
})

const statusClass = computed(() => {
  if (props.status?.status) return props.status.status
  if (props.launchFailure) return 'error'
  return 'stopped'
})

const cardMeta = computed(() => projectDisplayMeta(props.project, props.localUrl))
const contextLabel = computed(() => {
  const label = projectSecondaryLabel(props.project, props.localUrl)
  return label.startsWith(':') ? `localhost${label}` : label
})
const nodeLabel = computed(() => {
  if (!props.project.nodeVersion || props.project.nodeVersion === props.globalNodeVersion) return null
  return `Node ${props.project.nodeVersion}`
})
</script>

<template>
  <article :class="['project-overview-card', statusClass]" tabindex="0" :title="project.path" @click="emit('select', project.id)" @keyup.enter="emit('select', project.id)">
    <header class="project-card-header">
      <div class="project-card-title">
        <div class="project-title-row">
          <strong :title="project.name">{{ project.name }}</strong>
          <span :class="['project-status-inline', statusClass]">
            <i aria-hidden="true"></i>
            {{ statusLabel }}
          </span>
        </div>
        <p class="project-card-meta project-card-meta-line" :title="`${cardMeta} · ${project.path}`">
          <code>npm run {{ project.command }}</code>
          <span class="project-meta-separator">·</span>
          <span>{{ contextLabel }}</span>
          <template v-if="nodeLabel">
            <span class="project-meta-separator">·</span>
            <span>{{ nodeLabel }}</span>
          </template>
        </p>
      </div>
    </header>
    <p v-if="launchFailure && status?.status !== 'running'" class="project-card-failure" :title="launchFailure.message">{{ launchFailure.message }}</p>
    <footer class="project-card-actions">
      <button
        v-if="localUrl"
        class="card-action subtle"
        :aria-label="`打开 ${project.name} 页面`"
        @click.stop="emit('open-url', localUrl)"
      >打开</button>
      <button
        v-if="status?.status === 'running'"
        class="card-action danger"
        :aria-label="`停止 ${project.name}`"
        @click.stop="emit('stop', project.id)"
      >停止</button>
      <button
        v-else
        class="card-action primary"
        :aria-label="`启动 ${project.name}`"
        @click.stop="emit('start', project.id)"
      >启动</button>
    </footer>
  </article>
</template>

<style scoped>
.project-overview-card { min-width: 0; min-height: 104px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; padding: 14px 16px; overflow: hidden; border: 1px solid var(--border-default); border-radius: 10px; background: var(--bg-surface); box-shadow: var(--shadow-card); cursor: pointer; transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease, background 180ms ease; }
.project-overview-card.running { border-color: color-mix(in srgb, var(--success) 16%, var(--border-default)); background: color-mix(in srgb, var(--success-bg) 22%, var(--bg-surface)); }
.project-overview-card.error { border-color: color-mix(in srgb, var(--error) 18%, var(--border-default)); background: color-mix(in srgb, var(--error-bg) 18%, var(--bg-surface)); }
.project-overview-card:hover { transform: translateY(-1px); border-color: var(--border-strong); box-shadow: var(--shadow-card-hover); }
.project-overview-card:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
.project-card-header { min-width: 0; }
.project-card-title { min-width: 0; flex: 1; }
.project-title-row { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.project-card-title strong { min-width: 0; overflow: hidden; color: var(--text-primary); font-size: 14px; font-weight: 700; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.project-status-inline { display: inline-flex; align-items: center; gap: 6px; flex: none; color: var(--text-tertiary); font-size: 11px; font-weight: 650; line-height: 1; }
.project-status-inline i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.project-status-inline.running { color: var(--success); }
.project-status-inline.error { color: var(--error); }
.project-card-meta { min-width: 0; margin: 8px 0 0; overflow: hidden; color: var(--text-tertiary); font: 11px/1.35 var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
.project-card-meta-line code,.project-card-meta-line span { vertical-align: middle; }
.project-card-meta-line code { color: var(--text-secondary); font-family: var(--font-mono); }
.project-meta-separator { margin: 0 6px; color: var(--text-tertiary); opacity: .7; }
.project-card-failure { margin: -4px 0 0; overflow: hidden; color: var(--error); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.project-card-actions { display: flex; align-items: center; justify-content: flex-end; gap: 7px; min-width: 0; }
.card-action { min-height: 30px; min-width: 54px; padding: 0 11px; border: 1px solid var(--border-default); border-radius: 7px; color: var(--text-secondary); background: var(--bg-surface); font-size: 12px; font-weight: 700; transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease; }
.card-action:hover { transform: translateY(-1px); }
.card-action.primary { color: var(--accent-primary); border-color: var(--accent-border); background: var(--accent-glow); }
.card-action.primary:hover { color: #fff; border-color: var(--accent-primary); background: var(--accent-primary); }
.card-action.danger { color: var(--error); border-color: color-mix(in srgb, var(--error) 22%, var(--border-default)); background: color-mix(in srgb, var(--error-bg) 58%, var(--bg-surface)); }
.card-action.subtle { color: var(--accent-primary); border-color: var(--accent-border); background: var(--bg-surface); }
.card-action.subtle:hover { background: var(--accent-glow); }
@media (prefers-reduced-motion: reduce) {
  .project-overview-card,.card-action { transition: none; }
  .project-overview-card:hover,.card-action:hover { transform: none; }
}
</style>

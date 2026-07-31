<script setup lang="ts">
import { computed } from 'vue'
import type { ProcessStatus, Project } from '../../../shared/types'
import type { LaunchFailure } from '../../workspace/model/launchFailures'

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
</script>

<template>
  <article class="project-overview-card" tabindex="0" @click="emit('select', project.id)" @keyup.enter="emit('select', project.id)">
    <header class="project-card-header">
      <span :class="['project-status-dot', statusClass]" aria-hidden="true"></span>
      <strong :title="project.name">{{ project.name }}</strong>
      <span :class="['project-status-label', statusClass]">{{ statusLabel }}</span>
    </header>
    <p class="project-card-path" :title="project.path">{{ project.path }}</p>
    <p v-if="launchFailure && status?.status !== 'running'" class="project-card-failure" :title="launchFailure.message">{{ launchFailure.message }}</p>
    <footer class="project-card-footer">
      <span class="meta-chip">Node {{ project.nodeVersion || globalNodeVersion || '系统' }}</span>
      <span class="meta-chip">npm run {{ project.command }}</span>
      <button
        v-if="localUrl"
        class="card-action link"
        :aria-label="`打开 ${project.name} 页面`"
        @click.stop="emit('open-url', localUrl)"
      >打开页面</button>
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
.project-overview-card { min-width: 0; padding: 16px; border: 1px solid var(--border-default); border-radius: 10px; background: var(--bg-surface); box-shadow: var(--shadow-card); cursor: pointer; transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease; }
.project-overview-card:hover { transform: translateY(-1px); border-color: var(--border-strong); box-shadow: var(--shadow-card-hover); }
.project-overview-card:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
.project-card-header { display: flex; align-items: center; gap: 9px; min-width: 0; }
.project-card-header strong { min-width: 0; overflow: hidden; color: var(--text-primary); font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.project-status-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--text-tertiary); }
.project-status-dot.running { background: var(--success); box-shadow: 0 0 0 3px var(--success-bg); }
.project-status-dot.error { background: var(--error); box-shadow: 0 0 0 3px var(--error-bg); }
.project-status-label { margin-left: auto; flex: none; color: var(--text-tertiary); font-size: 11px; }
.project-status-label.running { color: var(--success); }
.project-status-label.error { color: var(--error); }
.project-card-path { margin: 9px 0 14px; overflow: hidden; color: var(--text-tertiary); font: 11px/1.5 var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
.project-card-failure { margin: -7px 0 12px; overflow: hidden; color: var(--error); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.project-card-footer { display: flex; align-items: center; gap: 6px; min-width: 0; }
.meta-chip { max-width: 38%; overflow: hidden; padding: 4px 7px; border-radius: 6px; color: var(--text-secondary); background: var(--bg-subtle); font: 10px/1.2 var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
.card-action { min-height: 30px; margin-left: auto; padding: 0 12px; border-radius: 7px; color: #fff; font-size: 11px; font-weight: 700; }
.card-action + .card-action { margin-left: 0; }
.card-action.primary { background: var(--accent-primary); }
.card-action.danger { background: var(--error); }
.card-action.link { color: var(--accent-primary); border: 1px solid var(--accent-border); background: var(--accent-glow); }
</style>

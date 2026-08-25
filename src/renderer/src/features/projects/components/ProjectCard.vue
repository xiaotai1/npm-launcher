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
  launching?: boolean
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
  if (props.launching) return '启动中'
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
  if (props.project.nodeVersion) return `Node ${props.project.nodeVersion}`
  return props.globalNodeVersion ? `跟随全局 ${props.globalNodeVersion}` : '跟随全局'
})

function compactProjectPath(path: string) {
  const parts = path.split(/[\\/]+/).filter(Boolean)
  if (parts.length <= 2) return path
  return `.../${parts.slice(-2).join('/')}`
}

function formatLocalUrl(url: string) {
  return url.replace(/^https?:\/\//, '')
}
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
        </p>
      </div>
    </header>

    <section class="project-local-section">
      <div class="project-section-heading">
        <strong>本地页面</strong>
        <span>{{ localUrl ? '已识别访问地址' : '运行后自动识别' }}</span>
      </div>
      <button
        v-if="localUrl"
        type="button"
        class="project-local-button"
        :title="localUrl"
        :aria-label="`打开 ${project.name} 页面`"
        :disabled="status?.status !== 'running'"
        @click.stop="emit('open-url', localUrl)"
      >
        <span>{{ project.name }}</span>
        <code>{{ formatLocalUrl(localUrl) }}</code>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
      </button>
      <div v-else class="project-local-empty">运行后自动识别访问地址</div>
    </section>

    <dl class="project-meta-grid">
      <div>
        <dt>Node</dt>
        <dd>{{ nodeLabel }}</dd>
      </div>
      <div>
        <dt>项目路径</dt>
        <dd :title="project.path">{{ compactProjectPath(project.path) }}</dd>
      </div>
    </dl>

    <p v-if="launchFailure && status?.status !== 'running'" class="project-card-failure" :title="launchFailure.message">{{ launchFailure.message }}</p>
    <footer class="project-card-actions">
      <button class="card-action" :aria-label="`进入 ${project.name} 工作区`" @click.stop="emit('select', project.id)">进入工作区</button>
      <button
        v-if="status?.status === 'running'"
        class="card-action danger"
        :aria-label="`停止 ${project.name}`"
        @click.stop="emit('stop', project.id)"
      >停止</button>
      <button
        v-else
        class="card-action primary"
        :disabled="launching"
        :aria-label="launching ? `正在启动 ${project.name}` : `启动 ${project.name}`"
        @click.stop="emit('start', project.id)"
      >{{ launching ? '启动中…' : '启动' }}</button>
    </footer>
  </article>
</template>

<style scoped>
.project-overview-card { position: relative; min-width: 0; min-height: 208px; display: flex; flex-direction: column; justify-content: flex-start; gap: 12px; padding: 16px; border: 1px solid var(--border-default); border-radius: 14px; background: var(--bg-surface); box-shadow: var(--shadow-card); cursor: pointer; transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease, background 180ms ease; }
.project-overview-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: var(--border-gradient); opacity: 0.6; pointer-events: none; }
.project-overview-card.running { border-color: color-mix(in srgb, var(--success) 16%, var(--border-default)); background: color-mix(in srgb, var(--success-bg) 22%, var(--bg-surface)); }
.project-overview-card.error { border-color: color-mix(in srgb, var(--error) 18%, var(--border-default)); background: color-mix(in srgb, var(--error-bg) 18%, var(--bg-surface)); }
.project-overview-card:hover { transform: translateY(-2px); border-color: var(--border-strong); box-shadow: var(--shadow-card-hover); }
.project-overview-card:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
.project-card-header { min-width: 0; }
.project-card-title { min-width: 0; flex: 1; }
.project-title-row { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.project-card-title strong { min-width: 0; overflow: hidden; color: var(--text-primary); font-size: 18px; font-weight: 750; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.project-status-inline { display: inline-flex; align-items: center; gap: 6px; flex: none; color: var(--text-tertiary); font-size: 12px; font-weight: 650; line-height: 1; }
.project-status-inline i { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 6px currentColor; }
.project-status-inline.running { color: var(--success); }
.project-status-inline.error { color: var(--error); }
.project-card-meta { min-width: 0; margin: 8px 0 0; overflow: hidden; color: var(--text-tertiary); font: 12px/1.35 var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
.project-card-meta-line code,.project-card-meta-line span { vertical-align: middle; }
.project-card-meta-line code { color: var(--text-secondary); font-family: var(--font-mono); }
.project-meta-separator { margin: 0 6px; color: var(--text-tertiary); opacity: .7; }
.project-local-section { display: flex; flex-direction: column; gap: 7px; }
.project-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.project-section-heading strong { color: var(--text-primary); font-size: 12px; }
.project-section-heading span { color: var(--text-tertiary); font-size: 10px; }
.project-local-button { width: 100%; min-height: 40px; display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.2fr) auto; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--border-muted); border-radius: 8px; color: var(--text-secondary); background: var(--bg-subtle); text-align: left; }
.project-local-button:hover:not(:disabled) { color: var(--accent-primary); border-color: var(--accent-border); background: var(--bg-hover); }
.project-local-button span,.project-local-button code { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.project-local-button span { font-size: 11px; font-weight: 700; }
.project-local-button code { color: var(--text-tertiary); font: 11px/1 var(--font-mono); }
.project-local-button svg { flex: none; }
.project-local-empty { min-height: 40px; display: flex; align-items: center; justify-content: center; padding: 0 12px; border: 1px dashed var(--border-default); border-radius: 8px; color: var(--text-tertiary); background: var(--bg-subtle); font-size: 11px; text-align: center; }
.project-meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 12px; margin: 0; }
.project-meta-grid div { min-width: 0; }
.project-meta-grid dt { color: var(--text-tertiary); font-size: 10px; font-weight: 700; }
.project-meta-grid dd { min-width: 0; margin: 3px 0 0; overflow: hidden; color: var(--text-secondary); font-size: 12px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.project-card-failure { margin: -4px 0 0; overflow: hidden; color: var(--error); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.project-card-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; gap: 7px; min-width: 0; margin-top: auto; }
.card-action { min-height: 30px; min-width: 54px; padding: 0 11px; border: 1px solid var(--border-default); border-radius: 7px; color: var(--text-secondary); background: var(--bg-surface); font-size: 13px; font-weight: 700; transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease; }
.card-action:hover { transform: translateY(-1px); }
.card-action.primary { color: var(--accent-primary); border-color: var(--accent-border); background: var(--accent-glow); }
.card-action.primary:hover { color: #fff; border-color: var(--accent-primary); background: var(--accent-primary); }
.card-action.danger { color: var(--error); border-color: color-mix(in srgb, var(--error) 22%, var(--border-default)); background: color-mix(in srgb, var(--error-bg) 58%, var(--bg-surface)); }
@media (prefers-reduced-motion: reduce) {
  .project-overview-card,.card-action { transition: none; }
  .project-overview-card:hover,.card-action:hover { transform: none; }
}
</style>

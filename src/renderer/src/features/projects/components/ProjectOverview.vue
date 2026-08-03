<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityItem, ProcessStatus, Project } from '../../../shared/types'
import { getOverviewCounts } from '../../workspace/model/workspaceState'
import type { LaunchFailureState } from '../../workspace/model/launchFailures'
import ProjectCard from './ProjectCard.vue'

const props = defineProps<{
  projects: Project[]
  statuses: Record<string, ProcessStatus>
  activities: ActivityItem[]
  nodeVersion: string | null
  projectUrls: Record<string, string>
  launchFailures: LaunchFailureState
}>()

const emit = defineEmits<{
  select: [id: string]
  start: [id: string]
  stop: [id: string]
  'start-all': []
  'stop-all': []
  'add-project': []
  'clear-activities': []
  'open-url': [url: string]
  'edit-project': [id: string]
  'open-folder': [id: string]
}>()

const counts = computed(() => getOverviewCounts(props.projects, props.statuses))
const hasRunningProjects = computed(() => counts.value.running > 0)
const failureItems = computed(() => Object.values(props.launchFailures)
  .filter(failure => props.projects.some(project => project.id === failure.projectId))
  .sort((a, b) => b.timestamp - a.timestamp))
const sessionSummary = computed(() => ({
  started: props.activities.filter(item => item.type === 'started').length,
  stopped: props.activities.filter(item => item.type === 'stopped').length,
  error: props.activities.filter(item => item.type === 'error').length,
  lastTime: props.activities[0] ? formatActivityTime(props.activities[0].timestamp) : '暂无'
}))
const addProjectSlots = computed(() => props.projects.length > 0 ? 1 : 0)

function projectName(projectId: string) {
  return props.projects.find(project => project.id === projectId)?.name || '已删除项目'
}

function activityLabel(type: ActivityItem['type']) {
  if (type === 'started') return '已启动'
  if (type === 'error') return '异常退出'
  return '已停止'
}

function formatActivityTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <section class="overview-page">
    <header class="overview-header">
      <div>
        <p class="section-eyebrow">WORKSPACE</p>
        <h1>项目总览</h1>
        <p>{{ counts.running }} 个项目正在运行<span v-if="counts.error">，{{ counts.error }} 个需要关注</span></p>
      </div>
      <div class="overview-actions">
        <button class="button-secondary" :disabled="!hasRunningProjects" @click="emit('stop-all')">全部停止</button>
        <button class="button-primary" :disabled="projects.length === 0" @click="emit('start-all')">全部启动</button>
      </div>
    </header>

    <div v-if="projects.length" class="overview-content">
      <div class="stat-grid" aria-label="项目状态统计">
        <article class="stat-card"><span>全部项目</span><strong>{{ counts.total }}</strong></article>
        <article class="stat-card running"><span>运行中</span><strong>{{ counts.running }}</strong></article>
        <article class="stat-card error"><span>异常</span><strong>{{ counts.error }}</strong></article>
      </div>

      <section v-if="failureItems.length" class="launch-failure-panel" aria-label="启动失败项目">
        <header>
          <div>
            <h2>启动失败</h2>
            <span>{{ failureItems.length }} 个项目需要处理</span>
          </div>
        </header>
        <div class="launch-failure-list">
          <article v-for="failure in failureItems" :key="failure.projectId" class="launch-failure-row">
            <div>
              <strong>{{ failure.projectName }}</strong>
              <span>{{ failure.message }}</span>
            </div>
            <div class="failure-actions">
              <button type="button" @click="emit('start', failure.projectId)">重试</button>
              <button type="button" @click="emit('edit-project', failure.projectId)">编辑</button>
              <button type="button" @click="emit('open-folder', failure.projectId)">打开目录</button>
            </div>
          </article>
        </div>
      </section>

      <div class="overview-main-grid">
        <div class="project-grid">
          <ProjectCard
            v-for="project in projects"
            :key="project.id"
            :project="project"
            :status="statuses[project.id]"
            :global-node-version="nodeVersion"
            :local-url="projectUrls[project.id] || null"
            :launch-failure="launchFailures[project.id] || null"
            @select="emit('select', $event)"
            @start="emit('start', $event)"
            @stop="emit('stop', $event)"
            @open-url="emit('open-url', $event)"
          />
          <button
            v-for="index in addProjectSlots"
            :key="`placeholder-${index}`"
            type="button"
            class="project-empty-slot"
            @click="emit('add-project')"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            <strong>添加项目</strong>
            <span>创建新的工作区项目</span>
          </button>
        </div>

        <aside class="overview-side-rail">
          <section class="activity-panel">
            <header>
              <div>
                <h2>会话</h2>
                <span>本次会话</span>
              </div>
              <button class="activity-clear" :disabled="activities.length === 0" @click="emit('clear-activities')">清空</button>
            </header>
            <section class="activity-block">
              <div class="side-section-title">
                <strong>最近活动</strong>
                <span>{{ activities.length ? `最近 ${Math.min(activities.length, 8)} 条` : '等待动作' }}</span>
              </div>
              <div v-if="activities.length" class="activity-list">
                <div v-for="item in activities.slice(0, 8)" :key="item.id" class="activity-row">
                  <div>
                    <time>{{ formatActivityTime(item.timestamp) }}</time>
                    <strong>{{ projectName(item.projectId) }}</strong>
                  </div>
                  <span :class="item.type">{{ activityLabel(item.type) }}</span>
                </div>
              </div>
              <div v-else class="activity-empty">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></svg>
                <strong>暂无活动</strong>
                <span>启动、停止或异常退出会记录在这里。</span>
              </div>
            </section>
            <section class="session-summary" aria-label="本次摘要">
              <div class="side-section-title">
                <strong>本次摘要</strong>
                <span>最近操作 {{ sessionSummary.lastTime }}</span>
              </div>
              <dl class="session-metric-grid">
                <div>
                  <dt>启动次数</dt>
                  <dd class="started">{{ sessionSummary.started }}</dd>
                </div>
                <div>
                  <dt>停止次数</dt>
                  <dd>{{ sessionSummary.stopped }}</dd>
                </div>
                <div>
                  <dt>异常次数</dt>
                  <dd class="error">{{ sessionSummary.error }}</dd>
                </div>
              </dl>
            </section>
          </section>
        </aside>
      </div>
    </div>

    <div v-else class="overview-empty">
      <div class="empty-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7m-3.5-3.5h7"/>
        </svg>
      </div>
      <h2>添加第一个 NPM 项目</h2>
      <p>选择包含 package.json 的目录，即可集中管理启动命令、日志和终端。</p>
      <button class="button-primary" @click="emit('add-project')">添加第一个项目</button>
    </div>
  </section>
</template>

<style scoped>
.overview-page { height: 100%; overflow-y: auto; background: var(--bg-app); }
.overview-header { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 88px; padding: 18px 24px; border-bottom: 1px solid var(--border-muted); background: color-mix(in srgb, var(--bg-surface) 92%, transparent); backdrop-filter: blur(14px); }
.section-eyebrow { margin: 0 0 3px; color: var(--text-tertiary); font: 700 9px/1 var(--font-mono); letter-spacing: .14em; }
.overview-header h1 { margin: 0; color: var(--text-primary); font-size: 20px; letter-spacing: 0; }
.overview-header p:not(.section-eyebrow) { margin: 4px 0 0; color: var(--text-secondary); font-size: 12px; }
.overview-actions { display: flex; gap: 8px; }
.overview-content { min-height: calc(100% - 88px); max-width: 1180px; margin: 0 auto 0 0; padding: 22px 24px 32px; display: flex; flex-direction: column; }
.stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.stat-card { padding: 14px 16px; border: 1px solid var(--border-default); border-radius: 10px; background: var(--bg-surface); }
.stat-card span { color: var(--text-tertiary); font-size: 11px; }
.stat-card strong { display: block; margin-top: 4px; color: var(--text-primary); font-size: 22px; line-height: 1.1; }
.stat-card.running strong { color: var(--success); }.stat-card.error strong { color: var(--error); }
.launch-failure-panel { margin-top: 12px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--error) 26%, var(--border-default)); border-radius: 10px; background: color-mix(in srgb, var(--error-bg) 42%, var(--bg-surface)); }
.launch-failure-panel > header { min-height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; border-bottom: 1px solid var(--border-muted); }
.launch-failure-panel h2 { margin: 0; color: var(--text-primary); font-size: 12px; }.launch-failure-panel header span { display: block; margin-top: 2px; color: var(--error); font-size: 10px; }
.launch-failure-list { display: grid; gap: 1px; }
.launch-failure-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 10px 14px; background: color-mix(in srgb, var(--bg-surface) 72%, transparent); }
.launch-failure-row strong { display: block; color: var(--text-primary); font-size: 12px; }.launch-failure-row span { display: block; margin-top: 3px; overflow: hidden; color: var(--text-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.failure-actions { display: flex; align-items: center; gap: 6px; }.failure-actions button { min-height: 28px; padding: 0 9px; border: 1px solid var(--border-default); border-radius: 6px; color: var(--text-secondary); background: var(--bg-surface); font-size: 10px; font-weight: 700; }.failure-actions button:hover { color: var(--error); border-color: color-mix(in srgb, var(--error) 36%, var(--border-default)); background: var(--error-bg); }
.overview-main-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: start; margin-top: 10px; }
.project-grid { grid-column: span 2; min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-items: stretch; }
.project-empty-slot { height: 100%; min-height: 208px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 18px; border: 1px dashed var(--border-default); border-radius: 10px; color: var(--text-tertiary); background: color-mix(in srgb, var(--bg-surface) 42%, transparent); text-align: center; }
.project-empty-slot:hover { color: var(--accent-primary); border-color: var(--accent-border); background: color-mix(in srgb, var(--accent-glow) 42%, transparent); }
.project-empty-slot strong { color: var(--text-secondary); font-size: 12px; }
.project-empty-slot span { font-size: 10px; }
.overview-side-rail { min-width: 0; display: block; align-self: start; }
.activity-panel { height: 360px; min-height: 0; overflow: hidden; border: 1px solid var(--border-default); border-radius: 10px; background: var(--bg-surface); }
.activity-panel { display: flex; flex-direction: column; }
.activity-panel > header { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 14px; border-bottom: 1px solid var(--border-muted); }
.activity-panel h2 { margin: 0; font-size: 12px; }.activity-panel header span { display: block; margin-top: 2px; color: var(--text-tertiary); font-size: 9px; }
.activity-clear { min-height: 28px; padding: 0 9px; border: 1px solid transparent; border-radius: 6px; color: var(--text-tertiary); font-size: 10px; }.activity-clear:hover:not(:disabled) { color: var(--error); border-color: var(--border-default); background: var(--error-bg); }
.activity-block { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.side-section-title { min-height: 36px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px 8px; }
.side-section-title strong { color: var(--text-primary); font-size: 11px; font-weight: 750; }
.side-section-title span { color: var(--text-tertiary); font-size: 9px; }
.activity-list { min-height: 0; overflow-y: auto; padding: 6px 0; }
.activity-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 7px 14px; color: var(--text-secondary); font-size: 11px; }
.activity-row + .activity-row { border-top: 1px solid var(--border-muted); }
.activity-row div { min-width: 0; display: flex; align-items: center; gap: 8px; }
.activity-row time { flex: none; color: var(--text-tertiary); font-family: var(--font-mono); }
.activity-row strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-row span { flex: none; font-weight: 700; }.activity-row .started { color: var(--success); }.activity-row .error { color: var(--error); }
.activity-empty { flex: 1; min-height: 112px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px 24px; color: var(--text-tertiary); text-align: center; }.activity-empty svg { margin-bottom: 9px; opacity: .72; }.activity-empty strong { color: var(--text-secondary); font-size: 12px; font-weight: 650; }.activity-empty span { margin-top: 4px; font-size: 10px; }
.session-summary { padding-bottom: 14px; border-top: 1px solid var(--border-muted); background: color-mix(in srgb, var(--bg-subtle) 52%, transparent); }
.session-metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0 14px; }
.session-metric-grid div { min-width: 0; padding: 10px 8px; border: 1px solid var(--border-muted); border-radius: 8px; background: color-mix(in srgb, var(--bg-surface) 72%, transparent); }
.session-metric-grid dt { color: var(--text-tertiary); font-size: 9px; font-weight: 700; text-align: center; }
.session-metric-grid dd { margin: 5px 0 0; color: var(--text-primary); font-size: 18px; font-weight: 800; line-height: 1; text-align: center; }
.session-metric-grid dd.started { color: var(--success); }
.session-metric-grid dd.error { color: var(--error); }
.overview-empty { height: calc(100% - 88px); display: grid; place-content: center; justify-items: center; padding: 40px; text-align: center; }
.empty-icon { display: grid; place-items: center; width: 54px; height: 54px; border: 1px solid var(--border-default); border-radius: 14px; color: var(--accent-primary); background: var(--bg-surface); font: 700 20px var(--font-mono); }
.overview-empty h2 { margin: 16px 0 6px; font-size: 18px; }.overview-empty p { max-width: 420px; margin: 0 0 18px; color: var(--text-secondary); font-size: 13px; }
@media (max-width: 980px) { .overview-main-grid { grid-template-columns: 1fr; }.project-grid { grid-column: auto; grid-template-columns: 1fr; }.activity-panel { height: auto; } }
@media (max-width: 700px) { .launch-failure-row { grid-template-columns: 1fr; gap: 8px; }.failure-actions { flex-wrap: wrap; } }
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityItem, ProcessStatus, Project } from '../../../shared/types'
import { getOverviewCounts } from '../../workspace/model/workspaceState'
import ProjectCard from './ProjectCard.vue'

const props = defineProps<{
  projects: Project[]
  statuses: Record<string, ProcessStatus>
  activities: ActivityItem[]
  nodeVersion: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  start: [id: string]
  stop: [id: string]
  'start-all': []
  'stop-all': []
  'add-project': []
}>()

const counts = computed(() => getOverviewCounts(props.projects, props.statuses))
const hasRunningProjects = computed(() => counts.value.running > 0)

function projectName(projectId: string) {
  return props.projects.find(project => project.id === projectId)?.name || '已删除项目'
}

function activityLabel(type: ActivityItem['type']) {
  if (type === 'started') return '已启动'
  if (type === 'error') return '异常退出'
  return '已停止'
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

      <div class="project-grid">
        <ProjectCard
          v-for="project in projects"
          :key="project.id"
          :project="project"
          :status="statuses[project.id]"
          :global-node-version="nodeVersion"
          @select="emit('select', $event)"
          @start="emit('start', $event)"
          @stop="emit('stop', $event)"
        />
      </div>

      <section class="activity-panel">
        <header><h2>最近活动</h2><span>本次会话</span></header>
        <div v-if="activities.length" class="activity-list">
          <div v-for="item in activities.slice(0, 8)" :key="item.id" class="activity-row">
            <time>{{ new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</time>
            <strong>{{ projectName(item.projectId) }}</strong>
            <span :class="item.type">{{ activityLabel(item.type) }}</span>
          </div>
        </div>
        <div v-else class="activity-empty">启动或停止项目后，活动会显示在这里。</div>
      </section>
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
.overview-header h1 { margin: 0; color: var(--text-primary); font-size: 20px; letter-spacing: -.03em; }
.overview-header p:not(.section-eyebrow) { margin: 4px 0 0; color: var(--text-secondary); font-size: 12px; }
.overview-actions { display: flex; gap: 8px; }
.overview-content { max-width: 1180px; margin: 0 auto; padding: 22px 24px 32px; }
.stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.stat-card { padding: 14px 16px; border: 1px solid var(--border-default); border-radius: 10px; background: var(--bg-surface); }
.stat-card span { color: var(--text-tertiary); font-size: 11px; }
.stat-card strong { display: block; margin-top: 4px; color: var(--text-primary); font-size: 22px; line-height: 1.1; }
.stat-card.running strong { color: var(--success); }.stat-card.error strong { color: var(--error); }
.project-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.activity-panel { margin-top: 12px; overflow: hidden; border: 1px solid var(--border-default); border-radius: 10px; background: var(--bg-surface); }
.activity-panel > header { display: flex; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border-muted); }
.activity-panel h2 { margin: 0; font-size: 12px; }.activity-panel header span { color: var(--text-tertiary); font-size: 10px; }
.activity-row { display: grid; grid-template-columns: 82px minmax(120px, 180px) 1fr; gap: 12px; padding: 8px 14px; color: var(--text-secondary); font-size: 11px; }
.activity-row time { color: var(--text-tertiary); font-family: var(--font-mono); }.activity-row .started { color: var(--success); }.activity-row .error { color: var(--error); }
.activity-empty { padding: 24px; color: var(--text-tertiary); font-size: 12px; text-align: center; }
.overview-empty { height: calc(100% - 88px); display: grid; place-content: center; justify-items: center; padding: 40px; text-align: center; }
.empty-icon { display: grid; place-items: center; width: 54px; height: 54px; border: 1px solid var(--border-default); border-radius: 14px; color: var(--accent-primary); background: var(--bg-surface); font: 700 20px var(--font-mono); }
.overview-empty h2 { margin: 16px 0 6px; font-size: 18px; }.overview-empty p { max-width: 420px; margin: 0 0 18px; color: var(--text-secondary); font-size: 13px; }
@media (max-width: 860px) { .project-grid { grid-template-columns: 1fr; } }
</style>

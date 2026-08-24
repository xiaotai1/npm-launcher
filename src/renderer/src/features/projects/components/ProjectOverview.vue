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
  'import-config': []
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

const onboardingSteps = [
  {
    title: '从本地目录添加',
    description: '选择包含 package.json 的文件夹，自动识别启动脚本。',
    tag: '推荐',
    primary: true,
    action: 'add-project',
    icon: 'folder'
  },
  {
    title: '导入已有配置',
    description: '从 JSON 文件恢复项目列表，适合多设备同步配置。',
    tag: null,
    primary: false,
    action: 'import-config',
    icon: 'download'
  }
]

function triggerOnboarding(action: string | null) {
  if (action === 'add-project') emit('add-project')
  else if (action === 'import-config') emit('import-config')
}

const isMac = computed(() => window.desktopAPI?.platform === 'darwin')

const recentProjects = computed(() => props.projects.slice(0, 2))

function getStatusColor(projectId: string) {
  const status = props.statuses[projectId]?.status
  return status === 'running' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--text-tertiary)'
}
</script>

<template>
  <section class="overview-page">
    <div class="overview-decoration" aria-hidden="true">
      <span class="overview-dots"></span>
      <span class="overview-blob blob-one"></span>
      <span class="overview-blob blob-two"></span>
      <span class="overview-blob blob-three"></span>
      <span class="overview-blob blob-four"></span>
      <span class="overview-blob blob-five"></span>
    </div>

    <header class="overview-header">
      <div class="overview-title-block">
        <p class="section-eyebrow">WORKSPACE</p>
        <h1>
          项目总览
          <span class="overview-title-accent">·</span>
          <span class="overview-title-tag">NPM Launcher</span>
        </h1>
        <p class="overview-subtitle">
          <span class="overview-pulse-dot"></span>
          {{ counts.running }} 个项目正在运行<span v-if="counts.error">，{{ counts.error }} 个需要关注</span>
        </p>
      </div>
      <div class="overview-actions">
        <button class="button-secondary" :disabled="!hasRunningProjects" @click="emit('stop-all')">全部停止</button>
        <button class="button-primary" :disabled="projects.length === 0" @click="emit('start-all')">全部启动</button>
      </div>
    </header>

    <div v-if="projects.length" class="overview-content">
      <div class="stat-grid" aria-label="项目状态统计">
        <article class="stat-card">
          <div class="stat-card-head">
            <span class="stat-card-icon icon-total">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            </span>
            <span>全部项目</span>
          </div>
          <strong>{{ counts.total }}</strong>
          <span class="stat-card-meta">含 {{ counts.running }} 个运行中</span>
        </article>
        <article class="stat-card running">
          <div class="stat-card-head">
            <span class="stat-card-icon icon-running">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg>
            </span>
            <span>运行中</span>
          </div>
          <strong>{{ counts.running }}</strong>
          <span class="stat-card-meta">实时守护进程</span>
        </article>
        <article class="stat-card error">
          <div class="stat-card-head">
            <span class="stat-card-icon icon-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="12" y1="16" x2="12" y2="16.5"/></svg>
            </span>
            <span>异常</span>
          </div>
          <strong>{{ counts.error }}</strong>
          <span class="stat-card-meta">需要立即处理</span>
        </article>
        <article class="stat-card node">
          <div class="stat-card-head">
            <span class="stat-card-icon icon-node">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 8v8l8 5 8-5V8z"/><path d="M4 8l8 5 8-5"/><path d="M12 22V13"/></svg>
            </span>
            <span>Node 版本</span>
          </div>
          <strong>{{ nodeVersion || '—' }}</strong>
          <span class="stat-card-meta">全局运行时</span>
        </article>
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
    </div>

    <div v-else class="overview-empty">
      <div class="empty-hero">
        <h2>添加第一个 NPM 项目</h2>
        <p>选择一个包含 <code>package.json</code> 的目录，集中管理启动命令、实时日志和终端。</p>
        <button class="button-primary empty-hero-action" @click="emit('add-project')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          添加第一个项目
        </button>
      </div>

      <div class="onboarding-grid">
        <button
          v-for="(step, index) in onboardingSteps"
          :key="step.title"
          type="button"
          class="onboarding-card"
          :class="{ primary: step.primary, clickable: !!step.action }"
          :disabled="!step.action"
          @click="triggerOnboarding(step.action)"
        >
          <div class="onboarding-card-head">
            <span class="onboarding-step-index">0{{ index + 1 }}</span>
            <span v-if="step.tag" class="onboarding-tag">{{ step.tag }}</span>
          </div>
          <div class="onboarding-card-icon">
            <svg v-if="step.icon === 'folder'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
            <svg v-else-if="step.icon === 'download'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 20h16"/></svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><polygon points="12 3 22 8 12 13 2 8 12 3"/><polyline points="2 14 12 19 22 14"/><polyline points="2 20 12 25 22 20"/></svg>
          </div>
          <h3>{{ step.title }}</h3>
          <p>{{ step.description }}</p>
          <span v-if="step.action" class="onboarding-cta">
            开始
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>
          </span>
        </button>
      </div>

      <div class="empty-shortcuts">
        <div class="shortcut-row">
          <kbd v-if="isMac" class="shortcut-modifier" aria-label="Command"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6a3 3 0 1 0-3 3"/><path d="M15 6a3 3 0 1 1 3 3"/><path d="M9 18a3 3 0 1 1-3-3"/><path d="M15 18a3 3 0 1 0 3-3"/><path d="M9 6l6 12"/></svg></kbd>
          <kbd v-else class="shortcut-modifier">Ctrl</kbd>
          <span>+</span><kbd>N</kbd>
          <span class="shortcut-desc">快速添加项目</span>
        </div>
        <div class="shortcut-row">
          <kbd v-if="isMac" class="shortcut-modifier" aria-label="Command"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6a3 3 0 1 0-3 3"/><path d="M15 6a3 3 0 1 1 3 3"/><path d="M9 18a3 3 0 1 1-3-3"/><path d="M15 18a3 3 0 1 0 3-3"/><path d="M9 6l6 12"/></svg></kbd>
          <kbd v-else class="shortcut-modifier">Ctrl</kbd>
          <span>+</span><kbd>K</kbd>
          <span class="shortcut-desc">打开命令面板</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.overview-page { position: relative; height: 100%; overflow: hidden; background: transparent; }

/* 背景装饰：在浅色/深色主题下都使用的 subtle gradient blob + 点阵纹理
   整体降一档透明度，避免在卡片间隙"突然冒出色斑"造成视觉色差 */
.overview-decoration { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.overview-dots { position: absolute; inset: 0; background-image: radial-gradient(color-mix(in srgb, var(--text-tertiary) 18%, transparent) 1px, transparent 1px); background-size: 26px 26px; opacity: 0.18; mask-image: radial-gradient(ellipse 70% 55% at 50% 38%, #000 20%, transparent 78%); -webkit-mask-image: radial-gradient(ellipse 70% 55% at 50% 38%, #000 20%, transparent 78%); }
.overview-blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.3; }
.blob-one { top: -120px; left: -80px; width: 360px; height: 360px; background: radial-gradient(circle, var(--accent-glow), transparent 70%); animation: glowPulse 6s ease-in-out infinite; }
.blob-two { top: 40%; right: -160px; width: 420px; height: 420px; background: radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 12%, transparent), transparent 70%); opacity: 0.22; }
.blob-three { bottom: -180px; left: 30%; width: 480px; height: 480px; background: radial-gradient(circle, color-mix(in srgb, var(--success) 10%, transparent), transparent 70%); opacity: 0.25; }
.blob-four { top: 18%; left: 45%; width: 320px; height: 320px; background: radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 8%, transparent), transparent 72%); opacity: 0.2; animation: glowPulse 8s ease-in-out infinite reverse; }
.blob-five { top: 62%; right: 12%; width: 280px; height: 280px; background: radial-gradient(circle, color-mix(in srgb, var(--warning) 8%, transparent), transparent 72%); opacity: 0.18; }

.overview-header { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 96px; padding: 22px 28px; border-bottom: 1px solid var(--border-muted); background: var(--glass-fill-strong); backdrop-filter: blur(calc(var(--glass-blur) + 6px)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 6px)) saturate(var(--glass-saturate)); }
.section-eyebrow { margin: 0 0 6px; color: var(--text-tertiary); font: 700 11px/1 var(--font-mono); letter-spacing: .18em; }
.overview-title-block { display: flex; flex-direction: column; gap: 2px; }
.overview-header h1 { display: flex; align-items: center; gap: 10px; margin: 0; color: var(--text-primary); font-size: 22px; font-weight: 750; letter-spacing: 0; }
.overview-title-accent { color: var(--accent-primary); font-weight: 500; opacity: 0.6; }
.overview-title-tag { display: inline-flex; align-items: center; padding: 3px 8px; border: 1px solid var(--accent-border); border-radius: 999px; color: var(--accent-primary); background: var(--accent-glow); font: 700 10px/1 var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }
.overview-subtitle { display: flex; align-items: center; gap: 7px; margin: 6px 0 0; color: var(--text-secondary); font-size: 13px; }
.overview-pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 0 var(--success); animation: dotPulse 1.5s ease-in-out infinite; color: var(--success); }
.overview-actions { display: flex; gap: 8px; }

.overview-content {
  position: relative;
  z-index: 1;
  width: min(100%, 1760px);
  height: calc(100% - 96px);
  margin: 0 auto;
  padding: clamp(16px, 1.6vw, 26px) clamp(24px, 2vw, 40px) 24px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* 统计卡片 — 等宽 4 列，节奏整齐 */
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.stat-card { position: relative; padding: 16px 18px; border: 1px solid var(--glass-border); border-radius: 16px; background: var(--glass-fill); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: var(--glass-shadow); transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease, border-color 200ms ease; overflow: hidden; }
.stat-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, transparent 60%, color-mix(in srgb, var(--accent-primary) 8%, transparent)); opacity: 0; transition: opacity 200ms ease; }
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--accent-border); }
.stat-card:hover::before { opacity: 1; }
.stat-card-head { display: flex; align-items: center; gap: 8px; color: var(--text-tertiary); font-size: 12px; font-weight: 650; letter-spacing: .04em; }
.stat-card-icon { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; background: var(--bg-subtle); color: var(--text-secondary); }
.stat-card.running .stat-card-icon { color: var(--success); background: color-mix(in srgb, var(--success) 14%, transparent); }
.stat-card.error .stat-card-icon { color: var(--error); background: color-mix(in srgb, var(--error) 14%, transparent); }
.stat-card.node .stat-card-icon { color: var(--accent-primary); background: color-mix(in srgb, var(--accent-primary) 14%, transparent); }
.stat-card strong { display: block; margin-top: 10px; color: var(--text-primary); font-size: 26px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; position: relative; z-index: 1; }
.stat-card.running strong { color: var(--success); }
.stat-card.error strong { color: var(--error); }
.stat-card.node strong { color: var(--accent-primary); font-size: 22px; font-family: var(--font-mono); letter-spacing: 0; }
.stat-card-meta { display: block; margin-top: 6px; color: var(--text-tertiary); font-size: 11px; }

.launch-failure-panel { margin-top: 14px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--error) 26%, var(--border-default)); border-radius: 12px; background: color-mix(in srgb, var(--error-bg) 42%, var(--bg-surface)); }
.launch-failure-panel > header { min-height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; border-bottom: 1px solid var(--border-muted); }
.launch-failure-panel h2 { margin: 0; color: var(--text-primary); font-size: 13px; }
.launch-failure-panel header span { display: block; margin-top: 2px; color: var(--error); font-size: 11px; }
.launch-failure-list { display: grid; gap: 1px; }
.launch-failure-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 10px 14px; background: color-mix(in srgb, var(--bg-surface) 72%, transparent); }
.launch-failure-row strong { display: block; color: var(--text-primary); font-size: 13px; }
.launch-failure-row span { display: block; margin-top: 3px; overflow: hidden; color: var(--text-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.failure-actions { display: flex; align-items: center; gap: 6px; }
.failure-actions button { min-height: 28px; padding: 0 9px; border: 1px solid var(--border-default); border-radius: 6px; color: var(--text-secondary); background: var(--bg-surface); font-size: 11px; font-weight: 700; }
.failure-actions button:hover { color: var(--error); border-color: color-mix(in srgb, var(--error) 36%, var(--border-default)); background: var(--error-bg); }

/* 项目网格：占满主区剩余空间，2 列独立滚动 */
.project-grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-content: start; align-items: stretch; padding: 2px 2px 2px 0; margin-top: clamp(14px, 1.4vw, 20px); }
.project-empty-slot { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 18px; border: 1px dashed var(--glass-border); border-radius: 16px; color: var(--text-tertiary); background: var(--glass-fill); backdrop-filter: blur(calc(var(--glass-blur) + 4px)) saturate(calc(var(--glass-saturate) - 20%)); -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px)) saturate(calc(var(--glass-saturate) - 20%)); text-align: center; }
.project-empty-slot:hover { color: var(--accent-primary); border-color: var(--accent-border); background: var(--glass-fill-hover); }
.project-empty-slot strong { color: var(--text-secondary); font-size: 13px; }
.project-empty-slot span { font-size: 11px; }

/* 玻璃化项目卡片：让背景色与页面装饰统一，消除"上下色差" */
.project-grid :deep(.project-overview-card) { background: var(--glass-fill); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); border-color: transparent; box-shadow: var(--glass-shadow); }
.project-grid :deep(.project-overview-card.running) { background: color-mix(in srgb, var(--success-bg) 30%, var(--glass-fill)); }
.project-grid :deep(.project-overview-card.error) { background: color-mix(in srgb, var(--error-bg) 22%, var(--glass-fill)); }

/* 旧的侧栏/运行时/活动等样式已随总览重构移除 */
:global(:root[data-theme='dark']) .runtime-panel { background: rgba(22, 28, 40, 0.85); border-color: rgba(255, 255, 255, 0.08); }
.runtime-panel > header { min-height: 38px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 14px; border-bottom: 1px solid var(--border-muted); }
.runtime-panel h2 { margin: 0; color: var(--text-primary); font-size: 12.5px; font-weight: 750; letter-spacing: -0.005em; }
.runtime-version-tag { display: inline-flex; align-items: center; padding: 3px 8px; border: 1px solid var(--accent-border); border-radius: 999px; color: var(--accent-primary); background: var(--accent-glow); font: 700 11px/1 var(--font-mono); letter-spacing: 0.04em; }
.runtime-summary { padding: 12px 14px; }
.runtime-cell { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--border-muted); border-radius: 10px; background: color-mix(in srgb, var(--bg-subtle) 60%, transparent); overflow: hidden; min-width: 0; }
.runtime-cell-label { color: var(--text-tertiary); font: 700 10px/1 var(--font-mono); letter-spacing: 0.12em; text-transform: uppercase; }
.runtime-cell strong { color: var(--text-primary); font-size: 17px; font-weight: 800; line-height: 1; letter-spacing: -0.01em; }
.runtime-hint { margin: 0; padding: 0 14px 12px; color: var(--text-tertiary); font-size: 11.5px; line-height: 1.5; }


/* ===== 快捷键面板（已移除，残留样式待清理） ===== */
:global(:root[data-theme='dark']) .shortcut-key kbd { border-color: rgba(148, 163, 184, 0.24); border-bottom-color: rgba(148, 163, 184, 0.34); color: var(--text-secondary); background: linear-gradient(180deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.96)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.28), 0 2px 5px rgba(0, 0, 0, 0.28); }
.shortcut-soon { padding: 2px 7px; border: 1px dashed var(--border-strong); border-radius: 999px; color: var(--text-tertiary); font: 700 10px/1.2 var(--font-mono); letter-spacing: 0.04em; }

/* 旧的 activity/session 样式已随侧栏会话面板移除 */

/* 空状态：hero + 引导卡片 + 快捷键，顶部对齐紧凑排列，一屏放下无滚动 */
.overview-empty { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; box-sizing: border-box; padding: 8px 32px 24px; gap: 14px; }

.empty-hero { display: flex; flex-direction: column; align-items: center; max-width: 560px; text-align: center; }
.empty-hero h2 { margin: 0; font-size: 22px; font-weight: 750; letter-spacing: -0.01em; }
.empty-hero p { max-width: 460px; margin: 8px 0 18px; color: var(--text-secondary); font-size: 14px; line-height: 1.6; }
.empty-hero p code { padding: 2px 7px; border-radius: 6px; color: var(--accent-primary); background: var(--accent-glow); font: 700 12px var(--font-mono); }
.empty-hero-action { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 20px; font-size: 13px; font-weight: 700; box-shadow: 0 6px 18px var(--accent-glow); }
.empty-hero-action:hover { transform: translateY(-1px); box-shadow: 0 10px 24px color-mix(in srgb, var(--accent-primary) 26%, transparent); }

.onboarding-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; width: 100%; max-width: 720px; }
.onboarding-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 16px; min-height: 0; border: 1px solid var(--border-default); border-radius: 12px; background: color-mix(in srgb, var(--bg-surface) 92%, transparent); text-align: left; box-shadow: var(--shadow-sm); transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease, box-shadow 200ms ease; }
.onboarding-card.clickable { cursor: pointer; }
.onboarding-card.clickable:hover { transform: translateY(-2px); border-color: var(--accent-border); box-shadow: var(--shadow-md); }
.onboarding-card.clickable:hover .onboarding-card-icon { background: var(--accent-glow); color: var(--accent-primary); }
.onboarding-card.clickable:hover .onboarding-cta { color: var(--accent-primary); gap: 8px; }
.onboarding-card.primary { border-color: var(--accent-border); background: linear-gradient(180deg, color-mix(in srgb, var(--accent-glow) 80%, var(--bg-surface)) 0%, var(--bg-surface) 100%); }

.onboarding-card-head { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.onboarding-step-index { color: var(--text-tertiary); font: 700 11px/1 var(--font-mono); letter-spacing: .14em; }
.onboarding-tag { display: inline-flex; align-items: center; padding: 3px 7px; border: 1px solid var(--accent-border); border-radius: 999px; color: var(--accent-primary); background: color-mix(in srgb, var(--accent-glow) 70%, transparent); font: 700 10px/1 var(--font-mono); letter-spacing: .08em; }

.onboarding-card-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; color: var(--text-secondary); background: var(--bg-subtle); transition: background 200ms ease, color 200ms ease; }
.onboarding-card h3 { margin: 2px 0 0; color: var(--text-primary); font-size: 14px; font-weight: 700; letter-spacing: -0.005em; }
.onboarding-card p { margin: 0; color: var(--text-secondary); font-size: 12px; line-height: 1.5; }
.onboarding-cta { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; color: var(--text-tertiary); font-size: 12px; font-weight: 700; transition: gap 200ms ease, color 200ms ease; }

.empty-shortcuts { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 14px; padding: 10px 16px; border: 1px solid var(--border-muted); border-radius: 10px; background: color-mix(in srgb, var(--bg-surface) 60%, transparent); color: var(--text-tertiary); font-size: 12px; }
.shortcut-row { display: inline-flex; align-items: center; gap: 4px; }
.shortcut-row kbd { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border: 1px solid var(--border-default); border-bottom-width: 2px; border-radius: 5px; color: var(--text-secondary); background: var(--bg-elevated); font: 700 11px/1 var(--font-mono); }
.shortcut-row kbd.shortcut-modifier { padding: 0 5px; }
.shortcut-row span:not(.shortcut-desc) { color: var(--text-tertiary); font-weight: 700; }
.shortcut-row .shortcut-desc { margin-left: 6px; color: var(--text-tertiary); }

@media (max-width: 980px) {
  .overview-main-grid { grid-template-columns: 1fr; }
  .project-grid { grid-column: auto; grid-template-columns: 1fr; }
  .runtime-panel { overflow: visible; }
  .onboarding-grid { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  .launch-failure-row { grid-template-columns: 1fr; gap: 8px; }
  .failure-actions { flex-wrap: wrap; }
  .overview-header { flex-direction: column; align-items: flex-start; }
  .overview-title-block { width: 100%; }
  .stat-grid { grid-template-columns: 1fr; }
  .empty-shortcuts { flex-direction: column; align-items: stretch; }
}
</style>

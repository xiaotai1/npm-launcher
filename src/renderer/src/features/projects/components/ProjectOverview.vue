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
  launchingProjects: Record<string, boolean>
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
const showAddFab = computed(() => props.projects.length > 0)

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
      <section class="overview-summary-bar" aria-label="工作区摘要">
        <article class="summary-pill total">
          <span class="summary-label">全部项目</span>
          <strong>{{ counts.total }}</strong>
        </article>
        <article class="summary-pill running">
          <span class="summary-label">运行中</span>
          <strong>{{ counts.running }}</strong>
        </article>
        <article class="summary-pill error" :class="{ alert: counts.error > 0 }">
          <span class="summary-label">异常</span>
          <strong>{{ counts.error }}</strong>
        </article>
        <article class="summary-pill node">
          <span class="summary-label">全局 Node</span>
          <strong>{{ nodeVersion || '—' }}</strong>
        </article>
      </section>

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

      <div class="project-section-head">
        <div>
          <h2>项目列表</h2>
          <p>优先处理异常项目，再启动或进入正在开发的项目。</p>
        </div>
      </div>

      <div class="project-grid">
        <ProjectCard
          v-for="project in projects"
          :key="project.id"
          :project="project"
          :status="statuses[project.id]"
          :global-node-version="nodeVersion"
          :local-url="projectUrls[project.id] || null"
          :launch-failure="launchFailures[project.id] || null"
          :launching="launchingProjects[project.id] || false"
          @select="emit('select', $event)"
          @start="emit('start', $event)"
          @stop="emit('stop', $event)"
          @open-url="emit('open-url', $event)"
        />
      </div>

      <button
        v-if="showAddFab"
        type="button"
        class="project-fab"
        aria-label="添加项目"
        @click="emit('add-project')"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        <span class="project-fab-label">添加项目</span>
      </button>
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

.overview-header { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 84px; padding: 18px 24px; border-bottom: 1px solid var(--border-muted); background: var(--glass-fill-strong); backdrop-filter: blur(calc(var(--glass-blur) + 6px)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 6px)) saturate(var(--glass-saturate)); }
.section-eyebrow { margin: 0 0 4px; color: var(--text-tertiary); font: 700 10px/1 var(--font-mono); letter-spacing: .16em; }
.overview-title-block { display: flex; flex-direction: column; gap: 2px; }
.overview-header h1 { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--text-primary); font-size: 20px; font-weight: 750; letter-spacing: 0; }
.overview-title-accent { color: var(--accent-primary); font-weight: 500; opacity: 0.5; }
.overview-title-tag { display: inline-flex; align-items: center; padding: 3px 7px; border: 1px solid var(--accent-border); border-radius: 999px; color: var(--accent-primary); background: var(--accent-glow); font: 700 9px/1 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; }
.overview-subtitle { display: flex; align-items: center; gap: 7px; margin: 5px 0 0; color: var(--text-secondary); font-size: 12px; }
.overview-pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 0 var(--success); animation: dotPulse 1.5s ease-in-out infinite; color: var(--success); }
.overview-actions { display: flex; gap: 8px; }

.overview-content {
  position: relative;
  z-index: 1;
  width: min(100%, 1760px);
  height: calc(100% - 84px);
  margin: 0 auto;
  padding: clamp(14px, 1.4vw, 22px) clamp(20px, 1.8vw, 32px) 22px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* 顶部摘要条：比四张统计卡更像控制台，减少视觉重量，把注意力留给项目列表 */
.overview-summary-bar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.summary-pill { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; padding: 11px 14px; border: 1px solid var(--glass-border); border-radius: 12px; background: color-mix(in srgb, var(--glass-fill) 86%, transparent); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: var(--glass-shadow); }
.summary-label { color: var(--text-tertiary); font-size: 11px; font-weight: 650; letter-spacing: 0.03em; white-space: nowrap; }
.summary-pill strong { color: var(--text-primary); font-size: 20px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
.summary-pill.running strong { color: var(--success); }
.summary-pill.error strong { color: var(--error); }
.summary-pill.error.alert { border-color: color-mix(in srgb, var(--error) 26%, var(--border-default)); background: color-mix(in srgb, var(--error-bg) 28%, var(--glass-fill)); }
.summary-pill.node strong { color: var(--accent-primary); font-size: 17px; font-family: var(--font-mono); letter-spacing: 0; }

.launch-failure-panel { margin-top: 12px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--error) 24%, var(--border-default)); border-radius: 10px; background: color-mix(in srgb, var(--error-bg) 38%, var(--bg-surface)); }
.launch-failure-panel > header { min-height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border-muted); }
.launch-failure-panel h2 { margin: 0; color: var(--text-primary); font-size: 12px; }
.launch-failure-panel header span { display: block; margin-top: 2px; color: var(--error); font-size: 10px; }
.launch-failure-list { display: grid; gap: 1px; }
.launch-failure-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 9px 12px; background: color-mix(in srgb, var(--bg-surface) 74%, transparent); }
.launch-failure-row strong { display: block; color: var(--text-primary); font-size: 12px; }
.launch-failure-row span { display: block; margin-top: 3px; overflow: hidden; color: var(--text-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.failure-actions { display: flex; align-items: center; gap: 6px; }
.failure-actions button { min-height: 26px; padding: 0 8px; border: 1px solid var(--border-default); border-radius: 6px; color: var(--text-secondary); background: var(--bg-surface); font-size: 10px; font-weight: 700; }
.failure-actions button:hover { color: var(--error); border-color: color-mix(in srgb, var(--error) 36%, var(--border-default)); background: var(--error-bg); }

/* 项目区：明确告诉用户这里才是主要操作区 */
.project-section-head { display: flex; align-items: end; justify-content: space-between; gap: 14px; margin-top: 2px; margin-bottom: 10px; }
.project-section-head h2 { margin: 0; color: var(--text-primary); font-size: 14px; font-weight: 750; letter-spacing: -0.01em; }
.project-section-head p { margin: 4px 0 0; color: var(--text-tertiary); font-size: 11px; }
.project-grid { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: max-content; gap: 12px; align-content: start; align-items: start; padding: 2px 2px 2px 0; margin-top: 0; }
.project-empty-slot { display: none; }

/* 圆形悬浮按钮（FAB）：总览页有项目时显示在主区右下角 */
.project-fab { position: absolute; right: 36px; bottom: 36px; z-index: 6; display: flex; align-items: center; justify-content: center; gap: 0; padding: 0; width: 48px; height: 48px; border: 1px solid color-mix(in srgb, var(--accent-primary) 60%, transparent); border-radius: 50%; color: #fff; background: var(--accent-primary); box-shadow: 0 8px 20px color-mix(in srgb, var(--accent-primary) 28%, transparent), 0 2px 6px rgba(15, 23, 42, 0.14); cursor: pointer; transition: width 220ms cubic-bezier(0.16, 1, 0.3, 1), gap 220ms cubic-bezier(0.16, 1, 0.3, 1), padding 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms ease, transform 180ms ease; overflow: hidden; white-space: nowrap; }
.project-fab svg { display: block; flex: none; }
.project-fab-label { max-width: 0; opacity: 0; color: inherit; font-size: 12px; font-weight: 700; letter-spacing: 0.01em; transition: max-width 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease, padding-left 220ms ease; }
.project-fab:hover { width: 136px; gap: 8px; padding: 0 16px; border-radius: 24px; box-shadow: 0 12px 24px color-mix(in srgb, var(--accent-primary) 36%, transparent), 0 4px 10px rgba(15, 23, 42, 0.18); transform: translateY(-2px); }
.project-fab:hover .project-fab-label { max-width: 72px; opacity: 1; }
.project-fab:active { transform: translateY(0); }
.project-fab:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 3px; }

/* 项目卡片在总览中：去掉强制 glass-fill 覆盖，避免深色背景下出现明显的深色矩形 */
.project-grid :deep(.project-overview-card) { backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); }


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
  .overview-summary-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .project-grid { grid-template-columns: 1fr; }
  .onboarding-grid { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  .launch-failure-row { grid-template-columns: 1fr; gap: 8px; }
  .failure-actions { flex-wrap: wrap; }
  .overview-header { flex-direction: column; align-items: flex-start; }
  .overview-title-block { width: 100%; }
  .overview-summary-bar { grid-template-columns: 1fr; }
  .project-section-head { align-items: flex-start; }
  .empty-shortcuts { flex-direction: column; align-items: stretch; }
}
</style>

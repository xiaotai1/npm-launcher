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
  },
  {
    title: '管理工作区',
    description: '使用文件夹分组项目，搭配收藏与搜索快速定位。',
    tag: null,
    primary: false,
    action: null,
    icon: 'layers'
  }
]

const quickStartSteps = [
  { title: '选择目录', desc: '添加包含 package.json 的项目文件夹' },
  { title: '确认脚本', desc: '识别并选择要运行的启动命令' },
  { title: '启动运行', desc: '一键启动，实时查看日志与终端' }
]

function triggerOnboarding(action: string | null) {
  if (action === 'add-project') emit('add-project')
  else if (action === 'import-config') emit('import-config')
}

const isMac = computed(() => window.electronAPI?.platform === 'darwin')
// 预留：用于在 macOS / Windows / Linux 上扩展更多快捷键提示时统一判断修饰键。
const modifierKey = computed(() => isMac.value ? 'mac' : 'win')

const recentProjects = computed(() => props.projects.slice(0, 3))

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
          <section class="runtime-panel" aria-label="运行时信息">
            <header>
              <div>
                <h2>运行时</h2>
                <span>本机 Node 环境</span>
              </div>
              <span class="runtime-version-tag" v-if="nodeVersion">{{ nodeVersion }}</span>
            </header>
            <div class="runtime-grid">
              <div class="runtime-cell">
                <span class="runtime-cell-label">Node.js</span>
                <strong>{{ nodeVersion || '—' }}</strong>
              </div>
              <div class="runtime-cell">
                <span class="runtime-cell-label">项目总数</span>
                <strong>{{ counts.total }}</strong>
              </div>
              <div class="runtime-cell accent">
                <span class="runtime-cell-label">运行中</span>
                <strong>{{ counts.running }}</strong>
              </div>
              <div class="runtime-cell" :class="{ alert: counts.error > 0 }">
                <span class="runtime-cell-label">异常</span>
                <strong>{{ counts.error }}</strong>
              </div>
            </div>
            <div v-if="recentProjects.length" class="runtime-recent">
              <span class="runtime-recent-label">最近选择</span>
              <ul>
                <li v-for="project in recentProjects" :key="project.id" class="runtime-recent-item">
                  <button type="button" @click="emit('select', project.id)">
                    <span class="runtime-recent-dot" :style="{ background: getStatusColor(project.id) }"></span>
                    <span class="runtime-recent-name">{{ project.name }}</span>
                    <span class="runtime-recent-cmd">{{ project.command }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </section>

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

          <section class="shortcuts-panel" aria-label="提示与快捷键">
            <header>
              <div>
                <h2>提示</h2>
                <span>常用操作</span>
              </div>
            </header>
            <ul class="shortcuts-list">
              <li>
                <span class="shortcut-key"><kbd>Ctrl</kbd><span>+</span><kbd>N</kbd></span>
                <span>快速添加项目</span>
              </li>
              <li>
                <span class="shortcut-key"><kbd>Ctrl</kbd><span>+</span><kbd>K</kbd></span>
                <span>命令面板</span>
                <span class="shortcut-soon">即将开放</span>
              </li>
              <li>
                <span class="shortcut-key"><kbd>Ctrl</kbd><span>+</span><kbd>R</kbd></span>
                <span>运行当前项目</span>
              </li>
              <li>
                <span class="shortcut-key"><kbd>Ctrl</kbd><span>+</span><kbd>.</kbd></span>
                <span>停止当前项目</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>

    <div v-else class="overview-empty">
      <div class="empty-hero">
        <div class="empty-hero-glow" aria-hidden="true"></div>
        <div class="empty-hero-icon" aria-hidden="true">
          <span class="hero-ring ring-one"></span>
          <span class="hero-ring ring-two"></span>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <path d="M17.5 14v7m-3.5-3.5h7"/>
          </svg>
        </div>
        <h2>添加第一个 NPM 项目</h2>
        <p>选择一个包含 <code>package.json</code> 的目录，集中管理启动命令、实时日志和终端。</p>
        <button class="button-primary empty-hero-action" @click="emit('add-project')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          添加第一个项目
        </button>
      </div>

      <div class="quick-start">
        <div class="quick-start-title">
          <span>快速上手</span>
          <small>三步启动你的第一个项目</small>
        </div>
        <div class="quick-start-track">
          <div v-for="(step, index) in quickStartSteps" :key="step.title" class="quick-start-step">
            <div class="quick-start-node">
              <span class="quick-start-index">{{ index + 1 }}</span>
              <svg v-if="index === 0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
              <svg v-else-if="index === 1" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
              <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg>
            </div>
            <div class="quick-start-text">
              <strong>{{ step.title }}</strong>
              <span>{{ step.desc }}</span>
            </div>
            <svg v-if="index < quickStartSteps.length - 1" class="quick-start-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>
          </div>
        </div>
      </div>

      <div class="empty-tips">
        <div class="empty-tips-divider">
          <span>其他方式</span>
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
          <span class="shortcut-label">提示</span>
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
            <span class="shortcut-desc">打开命令面板（规划中）</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.overview-page { position: relative; height: 100%; overflow-y: auto; background: var(--bg-app); }

/* 背景装饰：在浅色/深色主题下都使用的 subtle gradient blob + 点阵纹理 */
.overview-decoration { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.overview-dots { position: absolute; inset: 0; background-image: radial-gradient(color-mix(in srgb, var(--text-tertiary) 26%, transparent) 1px, transparent 1px); background-size: 26px 26px; opacity: 0.28; mask-image: radial-gradient(ellipse 70% 55% at 50% 38%, #000 20%, transparent 78%); -webkit-mask-image: radial-gradient(ellipse 70% 55% at 50% 38%, #000 20%, transparent 78%); }
.overview-blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.5; }
.blob-one { top: -120px; left: -80px; width: 360px; height: 360px; background: radial-gradient(circle, var(--accent-glow), transparent 70%); animation: glowPulse 6s ease-in-out infinite; }
.blob-two { top: 40%; right: -160px; width: 420px; height: 420px; background: radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 18%, transparent), transparent 70%); opacity: 0.35; }
.blob-three { bottom: -180px; left: 30%; width: 480px; height: 480px; background: radial-gradient(circle, color-mix(in srgb, var(--success) 14%, transparent), transparent 70%); opacity: 0.4; }
.blob-four { top: 18%; left: 45%; width: 320px; height: 320px; background: radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 12%, transparent), transparent 72%); opacity: 0.3; animation: glowPulse 8s ease-in-out infinite reverse; }
.blob-five { top: 62%; right: 12%; width: 280px; height: 280px; background: radial-gradient(circle, color-mix(in srgb, var(--warning) 12%, transparent), transparent 72%); opacity: 0.3; }

.overview-header { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 96px; padding: 22px 28px; border-bottom: 1px solid var(--border-muted); background: color-mix(in srgb, var(--bg-surface) 86%, transparent); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
.section-eyebrow { margin: 0 0 6px; color: var(--text-tertiary); font: 700 10px/1 var(--font-mono); letter-spacing: .18em; }
.overview-title-block { display: flex; flex-direction: column; gap: 2px; }
.overview-header h1 { display: flex; align-items: center; gap: 10px; margin: 0; color: var(--text-primary); font-size: 22px; font-weight: 750; letter-spacing: -0.01em; }
.overview-title-accent { color: var(--accent-primary); font-weight: 500; opacity: 0.6; }
.overview-title-tag { display: inline-flex; align-items: center; padding: 3px 8px; border: 1px solid var(--accent-border); border-radius: 999px; color: var(--accent-primary); background: var(--accent-glow); font: 700 9px/1 var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }
.overview-subtitle { display: flex; align-items: center; gap: 7px; margin: 6px 0 0; color: var(--text-secondary); font-size: 12px; }
.overview-pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 0 var(--success); animation: dotPulse 1.5s ease-in-out infinite; color: var(--success); }
.overview-actions { display: flex; gap: 8px; }

.overview-content { position: relative; z-index: 1; min-height: calc(100% - 96px); max-width: 1180px; margin: 0 auto 0 0; padding: 24px 28px 36px; display: flex; flex-direction: column; }

/* 统计卡片升级 — 2:1:1 不等宽网格 */
.stat-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; }
.stat-card { position: relative; padding: 16px 18px; border: 1px solid var(--border-default); border-radius: 14px; background: color-mix(in srgb, var(--bg-surface) 92%, transparent); box-shadow: var(--shadow-sm); transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease, border-color 200ms ease; overflow: hidden; }
.stat-card:first-child { grid-column: span 1; }
.stat-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, transparent 60%, color-mix(in srgb, var(--accent-primary) 8%, transparent)); opacity: 0; transition: opacity 200ms ease; }
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--accent-border); }
.stat-card:hover::before { opacity: 1; }
.stat-card-head { display: flex; align-items: center; gap: 8px; color: var(--text-tertiary); font-size: 11px; font-weight: 650; letter-spacing: .04em; }
.stat-card-icon { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; background: var(--bg-subtle); color: var(--text-secondary); }
.stat-card.running .stat-card-icon { color: var(--success); background: color-mix(in srgb, var(--success) 14%, transparent); }
.stat-card.error .stat-card-icon { color: var(--error); background: color-mix(in srgb, var(--error) 14%, transparent); }
.stat-card strong { display: block; margin-top: 10px; color: var(--text-primary); font-size: 28px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; position: relative; z-index: 1; }
.stat-card.running strong { color: var(--success); }
.stat-card.error strong { color: var(--error); }
.stat-card-meta { display: block; margin-top: 6px; color: var(--text-tertiary); font-size: 10px; }

.launch-failure-panel { margin-top: 14px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--error) 26%, var(--border-default)); border-radius: 12px; background: color-mix(in srgb, var(--error-bg) 42%, var(--bg-surface)); }
.launch-failure-panel > header { min-height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; border-bottom: 1px solid var(--border-muted); }
.launch-failure-panel h2 { margin: 0; color: var(--text-primary); font-size: 12px; }
.launch-failure-panel header span { display: block; margin-top: 2px; color: var(--error); font-size: 10px; }
.launch-failure-list { display: grid; gap: 1px; }
.launch-failure-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 10px 14px; background: color-mix(in srgb, var(--bg-surface) 72%, transparent); }
.launch-failure-row strong { display: block; color: var(--text-primary); font-size: 12px; }
.launch-failure-row span { display: block; margin-top: 3px; overflow: hidden; color: var(--text-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.failure-actions { display: flex; align-items: center; gap: 6px; }
.failure-actions button { min-height: 28px; padding: 0 9px; border: 1px solid var(--border-default); border-radius: 6px; color: var(--text-secondary); background: var(--bg-surface); font-size: 10px; font-weight: 700; }
.failure-actions button:hover { color: var(--error); border-color: color-mix(in srgb, var(--error) 36%, var(--border-default)); background: var(--error-bg); }

.overview-main-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 14px; align-items: start; margin-top: 14px; }
.project-grid { grid-column: span 1; min-width: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; align-items: stretch; }
.project-empty-slot { height: 100%; min-height: 208px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 18px; border: 1px dashed var(--border-default); border-radius: 14px; color: var(--text-tertiary); background: color-mix(in srgb, var(--bg-surface) 42%, transparent); text-align: center; }
.project-empty-slot:hover { color: var(--accent-primary); border-color: var(--accent-border); background: color-mix(in srgb, var(--accent-glow) 42%, transparent); }
.project-empty-slot strong { color: var(--text-secondary); font-size: 12px; }
.project-empty-slot span { font-size: 10px; }

.overview-side-rail { min-width: 0; display: flex; flex-direction: column; gap: 14px; align-self: start; }

/* ===== 运行时面板 ===== */
.runtime-panel { border: 1px solid var(--border-default); border-radius: 14px; background: var(--bg-surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; }
.runtime-panel > header { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--border-muted); }
.runtime-panel h2 { margin: 0; font-size: 12px; font-weight: 750; letter-spacing: -0.005em; }
.runtime-panel > header span { display: block; margin-top: 2px; color: var(--text-tertiary); font-size: 9px; }
.runtime-version-tag { display: inline-flex; align-items: center; padding: 3px 8px; border: 1px solid var(--accent-border); border-radius: 999px; color: var(--accent-primary); background: var(--accent-glow); font: 700 10px/1 var(--font-mono); letter-spacing: 0.04em; }
.runtime-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 12px 14px; }
.runtime-cell { position: relative; display: flex; flex-direction: column; gap: 5px; padding: 10px 12px; border: 1px solid var(--border-muted); border-radius: 10px; background: color-mix(in srgb, var(--bg-subtle) 60%, transparent); overflow: hidden; }
.runtime-cell::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-primary) 30%, transparent), transparent); opacity: 0; transition: opacity 200ms ease; }
.runtime-cell:hover::after { opacity: 1; }
.runtime-cell-label { color: var(--text-tertiary); font: 700 9px/1 var(--font-mono); letter-spacing: 0.12em; text-transform: uppercase; }
.runtime-cell strong { color: var(--text-primary); font-size: 18px; font-weight: 800; line-height: 1; letter-spacing: -0.01em; }
.runtime-cell.accent { background: color-mix(in srgb, var(--accent-glow) 80%, transparent); border-color: var(--accent-border); }
.runtime-cell.accent strong { color: var(--accent-primary); }
.runtime-cell.accent::after { opacity: 1; }
.runtime-cell.alert { background: color-mix(in srgb, var(--error-bg) 80%, transparent); border-color: color-mix(in srgb, var(--error) 30%, transparent); }
.runtime-cell.alert strong { color: var(--error); }
.runtime-recent { border-top: 1px solid var(--border-muted); padding: 10px 14px 12px; }
.runtime-recent-label { display: block; margin-bottom: 6px; color: var(--text-tertiary); font: 700 9px/1 var(--font-mono); letter-spacing: 0.14em; text-transform: uppercase; }
.runtime-recent ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.runtime-recent-item button { width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text-secondary); font-size: 11px; font-weight: 650; transition: border-color 160ms ease, background 160ms ease, transform 160ms ease; }
.runtime-recent-item button:hover { border-color: var(--accent-border); background: var(--bg-hover); color: var(--text-primary); transform: translateX(1px); }
.runtime-recent-dot { width: 6px; height: 6px; border-radius: 50%; flex: none; box-shadow: 0 0 5px currentColor; }
.runtime-recent-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.runtime-recent-cmd { margin-left: auto; color: var(--accent-primary); font: 700 10px/1 var(--font-mono); letter-spacing: 0.04em; }

/* ===== 快捷键面板 ===== */
.shortcuts-panel { border: 1px solid var(--border-default); border-radius: 14px; background: var(--bg-surface); display: flex; flex-direction: column; }
.shortcuts-panel > header { min-height: 44px; display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--border-muted); }
.shortcuts-panel h2 { margin: 0; font-size: 12px; font-weight: 750; }
.shortcuts-panel > header span { display: block; margin-top: 2px; color: var(--text-tertiary); font-size: 9px; }
.shortcuts-list { margin: 0; padding: 8px 14px 12px; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.shortcuts-list li { display: grid; grid-template-columns: 110px 1fr auto; align-items: center; gap: 12px; color: var(--text-secondary); font-size: 11px; }
.shortcut-key { display: inline-flex; align-items: center; gap: 3px; }
.shortcut-key kbd { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border: 1px solid var(--border-default); border-bottom-width: 2px; border-radius: 5px; color: var(--text-secondary); background: var(--bg-elevated); font: 700 10px/1 var(--font-mono); }
.shortcut-key span { color: var(--text-tertiary); font-weight: 700; }
.shortcut-soon { padding: 2px 7px; border: 1px dashed var(--border-strong); border-radius: 999px; color: var(--text-tertiary); font: 700 9px/1.2 var(--font-mono); letter-spacing: 0.04em; }

.activity-panel { border: 1px solid var(--border-default); border-radius: 14px; background: var(--bg-surface); display: flex; flex-direction: column; overflow: hidden; }
.activity-panel > header { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 14px; border-bottom: 1px solid var(--border-muted); }
.activity-panel h2 { margin: 0; font-size: 12px; }
.activity-panel header span { display: block; margin-top: 2px; color: var(--text-tertiary); font-size: 9px; }
.activity-clear { min-height: 28px; padding: 0 9px; border: 1px solid transparent; border-radius: 6px; color: var(--text-tertiary); font-size: 10px; }
.activity-clear:hover:not(:disabled) { color: var(--error); border-color: var(--border-default); background: var(--error-bg); }
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
.activity-row span { flex: none; font-weight: 700; }
.activity-row .started { color: var(--success); }
.activity-row .error { color: var(--error); }
.activity-empty { flex: 1; min-height: 112px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px 24px; color: var(--text-tertiary); text-align: center; }
.activity-empty svg { margin-bottom: 9px; opacity: .72; }
.activity-empty strong { color: var(--text-secondary); font-size: 12px; font-weight: 650; }
.activity-empty span { margin-top: 4px; font-size: 10px; }
.session-summary { padding-bottom: 14px; border-top: 1px solid var(--border-muted); background: color-mix(in srgb, var(--bg-subtle) 52%, transparent); }
.session-metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0 14px; }
.session-metric-grid div { min-width: 0; padding: 10px 8px; border: 1px solid var(--border-muted); border-radius: 8px; background: color-mix(in srgb, var(--bg-surface) 72%, transparent); }
.session-metric-grid dt { color: var(--text-tertiary); font-size: 9px; font-weight: 700; text-align: center; }
.session-metric-grid dd { margin: 5px 0 0; color: var(--text-primary); font-size: 18px; font-weight: 800; line-height: 1; text-align: center; }
.session-metric-grid dd.started { color: var(--success); }
.session-metric-grid dd.error { color: var(--error); }

/* 空状态重设计：hero + 快速上手 + 引导卡片 */
.overview-empty { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; padding: 48px 32px 60px; gap: 32px; }

.empty-hero { position: relative; display: flex; flex-direction: column; align-items: center; max-width: 600px; padding: 32px 32px 28px; text-align: center; }
.empty-hero-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 420px; height: 420px; background: radial-gradient(circle, var(--accent-glow), transparent 70%); filter: blur(48px); opacity: 0.9; z-index: -1; }
.empty-hero-icon { position: relative; display: grid; place-items: center; width: 120px; height: 120px; margin-bottom: 26px; border: 1px solid var(--accent-border); border-radius: 30px; color: var(--accent-primary); background: linear-gradient(180deg, color-mix(in srgb, var(--accent-glow) 85%, var(--bg-surface)) 0%, color-mix(in srgb, var(--bg-surface) 88%, transparent) 100%); box-shadow: 0 14px 44px var(--accent-glow), inset 0 1px 0 color-mix(in srgb, var(--bg-surface) 70%, transparent); }
.hero-ring { position: absolute; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--accent-primary) 26%, transparent); }
.hero-ring.ring-one { inset: -12px; animation: heroRing 3s ease-in-out infinite; }
.hero-ring.ring-two { inset: -26px; border-color: color-mix(in srgb, var(--accent-primary) 14%, transparent); animation: heroRing 3s ease-in-out 0.6s infinite; }
@keyframes heroRing { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.04); } }
.empty-hero h2 { margin: 0; font-size: 28px; font-weight: 750; letter-spacing: -0.02em; background: linear-gradient(180deg, var(--text-primary), color-mix(in srgb, var(--text-primary) 82%, transparent)); -webkit-background-clip: text; background-clip: text; }
.empty-hero p { max-width: 480px; margin: 12px 0 24px; color: var(--text-secondary); font-size: 14px; line-height: 1.65; }
.empty-hero p code { padding: 2px 7px; border-radius: 6px; color: var(--accent-primary); background: var(--accent-glow); font: 700 12px var(--font-mono); }
.empty-hero-action { display: inline-flex; align-items: center; gap: 7px; min-height: 46px; padding: 0 24px; font-size: 13px; font-weight: 700; box-shadow: 0 8px 24px var(--accent-glow); }
.empty-hero-action:hover { transform: translateY(-2px); box-shadow: 0 12px 32px color-mix(in srgb, var(--accent-primary) 28%, transparent); }

/* 快速上手 — 3 步流程条 */
.quick-start { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 720px; padding: 20px 24px; border: 1px solid var(--border-muted); border-radius: 16px; background: color-mix(in srgb, var(--bg-surface) 74%, transparent); }
.quick-start-title { display: flex; align-items: baseline; gap: 10px; }
.quick-start-title span { color: var(--text-primary); font-size: 13px; font-weight: 750; }
.quick-start-title small { color: var(--text-tertiary); font-size: 11px; }
.quick-start-track { display: flex; align-items: stretch; justify-content: space-between; gap: 8px; }
.quick-start-step { flex: 1; display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.quick-start-node { position: relative; flex: none; display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid var(--accent-border); border-radius: 10px; color: var(--accent-primary); background: var(--accent-glow); }
.quick-start-node .quick-start-index { display: none; }
.quick-start-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.quick-start-text strong { color: var(--text-secondary); font-size: 12px; font-weight: 700; white-space: nowrap; }
.quick-start-text span { color: var(--text-tertiary); font-size: 10px; line-height: 1.4; }
.quick-start-arrow { flex: none; align-self: center; color: var(--border-strong); margin: 0 4px; }
.quick-start-step:hover .quick-start-node { box-shadow: 0 0 14px var(--accent-glow); }
.quick-start-step:hover .quick-start-text strong { color: var(--text-primary); }

.empty-tips { display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%; max-width: 720px; }
.empty-tips-divider { display: flex; align-items: center; gap: 14px; width: 100%; color: var(--text-tertiary); font: 700 9px var(--font-mono); letter-spacing: .18em; text-transform: uppercase; }
.empty-tips-divider::before, .empty-tips-divider::after { content: ''; flex: 1; height: 1px; background: var(--divider, var(--border-muted)); }

.onboarding-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; width: 100%; }
.onboarding-card { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 20px; min-height: 176px; border: 1px solid var(--border-default); border-radius: 14px; background: color-mix(in srgb, var(--bg-surface) 92%, transparent); text-align: left; box-shadow: var(--shadow-sm); transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease, box-shadow 200ms ease; }
.onboarding-card.clickable { cursor: pointer; }
.onboarding-card.clickable:hover { transform: translateY(-3px); border-color: var(--accent-border); box-shadow: var(--shadow-md); }
.onboarding-card.clickable:hover .onboarding-card-icon { background: var(--accent-glow); color: var(--accent-primary); }
.onboarding-card.clickable:hover .onboarding-cta { color: var(--accent-primary); gap: 8px; }
.onboarding-card:disabled { cursor: default; }
.onboarding-card.primary { border-color: var(--accent-border); background: linear-gradient(180deg, color-mix(in srgb, var(--accent-glow) 80%, var(--bg-surface)) 0%, var(--bg-surface) 100%); }

.onboarding-card-head { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.onboarding-step-index { color: var(--text-tertiary); font: 700 10px/1 var(--font-mono); letter-spacing: .14em; }
.onboarding-tag { display: inline-flex; align-items: center; padding: 3px 7px; border: 1px solid var(--accent-border); border-radius: 999px; color: var(--accent-primary); background: color-mix(in srgb, var(--accent-glow) 70%, transparent); font: 700 9px/1 var(--font-mono); letter-spacing: .08em; }

.onboarding-card-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9px; color: var(--text-secondary); background: var(--bg-subtle); transition: background 200ms ease, color 200ms ease; }
.onboarding-card h3 { margin: 2px 0 0; color: var(--text-primary); font-size: 14px; font-weight: 700; letter-spacing: -0.005em; }
.onboarding-card p { margin: 0; color: var(--text-secondary); font-size: 12px; line-height: 1.55; }
.onboarding-cta { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; color: var(--text-tertiary); font-size: 11px; font-weight: 700; transition: gap 200ms ease, color 200ms ease; }

.empty-shortcuts { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 16px; padding: 14px 20px; border: 1px solid var(--border-muted); border-radius: 12px; background: color-mix(in srgb, var(--bg-surface) 60%, transparent); color: var(--text-tertiary); font-size: 11px; }
.shortcut-label { font: 700 9px/1 var(--font-mono); letter-spacing: .14em; text-transform: uppercase; color: var(--text-tertiary); }
.shortcut-row { display: inline-flex; align-items: center; gap: 4px; }
.shortcut-row kbd { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border: 1px solid var(--border-default); border-bottom-width: 2px; border-radius: 5px; color: var(--text-secondary); background: var(--bg-elevated); font: 700 10px/1 var(--font-mono); }
.shortcut-row kbd.shortcut-modifier { padding: 0 5px; }
.shortcut-row span:not(.shortcut-desc) { color: var(--text-tertiary); font-weight: 700; }
.shortcut-row .shortcut-desc { margin-left: 6px; color: var(--text-tertiary); }

@media (max-width: 980px) {
  .overview-main-grid { grid-template-columns: 1fr; }
  .project-grid { grid-column: auto; grid-template-columns: 1fr; }
  .activity-panel,
  .runtime-panel,
  .shortcuts-panel { overflow: visible; }
  .activity-list { max-height: 360px; }
  .onboarding-grid { grid-template-columns: 1fr; }
  .quick-start-track { flex-direction: column; gap: 14px; }
  .quick-start-arrow { transform: rotate(90deg); }
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
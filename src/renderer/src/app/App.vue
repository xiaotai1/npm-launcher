<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import ErrorAnalysisDialog from '../features/error-analysis/ErrorAnalysisDialog.vue'
import ProjectOverview from '../features/projects/components/ProjectOverview.vue'
import WorkspaceSidebar from '../features/projects/components/WorkspaceSidebar.vue'
import ProjectWorkspace from '../features/workspace/components/ProjectWorkspace.vue'
import { activityFromStatus, appendActivity, clearActivities } from '../features/workspace/model/workspaceState'
import Toast from '../shared/ui/Toast.vue'
import AppHeader from '../shared/window/AppHeader.vue'
import type { ActiveView, ActivityItem, AppConfig, ErrorAnalysis, Folder, LogEntry, ProcessStatus, Project } from '../shared/types'
import { applyTheme, installSystemThemeListener } from './useAppTheme'
import { findLocalUrls } from '../features/workspace/model/localUrls'
import { appendSessionLogEntry } from '../features/terminal/model/sessionLogs'
import { clearLaunchFailure, mergeLaunchFailures, setLaunchFailure, type LaunchFailureState } from '../features/workspace/model/launchFailures'

type WorkspaceTab = 'logs' | 'terminal' | 'info'

const config = ref<AppConfig | null>(null)
const nodeVersion = ref<string | null>(null)
const nodeVersions = ref<string[]>([])
const currentNodeVersion = ref<string | null>(null)
const switchingVersion = ref(false)
const selectedProjectId = ref<string | null>(null)
const processStatuses = ref<Record<string, ProcessStatus>>({})
const projectUrls = ref<Record<string, string>>({})
const launchFailures = ref<LaunchFailureState>({})
const activities = ref<ActivityItem[]>([])
const activeView = ref<ActiveView>('overview')
const projectTabs = ref<Record<string, WorkspaceTab>>({})
const editTrigger = ref(0)

const toastMessage = ref('')
const toastType = ref<'success' | 'error' | 'warning'>('error')
const toastSequence = ref(0)
const errorAnalysis = ref<ErrorAnalysis | null>(null)
const showErrorAnalysis = ref(false)

const sidebarCollapsed = ref(false)
const sidebarWidth = ref(parseInt(localStorage.getItem('sidebarWidth') || '272', 10))
const isResizing = ref(false)
const workspaceSidebarRef = ref<InstanceType<typeof WorkspaceSidebar> | null>(null)

let cleanupStatus: (() => void) | null = null
let cleanupLogs: (() => void) | null = null
let cleanupErrorAnalysis: (() => void) | null = null
let cleanupSystemTheme: (() => void) | null = null

const selectedProject = computed(() => {
  if (!selectedProjectId.value || !config.value) return null
  return config.value.projects.find(project => project.id === selectedProjectId.value) || null
})

const currentStatus = computed(() => selectedProjectId.value
  ? processStatuses.value[selectedProjectId.value] || null
  : null)

const activeProjectTab = computed<WorkspaceTab>(() => {
  if (!selectedProjectId.value) return 'logs'
  return projectTabs.value[selectedProjectId.value] || 'logs'
})

async function loadConfig() {
  const nextConfig = await window.electronAPI.getConfig()
  config.value = nextConfig
  if (!selectedProjectId.value || !nextConfig.projects.some(project => project.id === selectedProjectId.value)) {
    selectedProjectId.value = nextConfig.projects[0]?.id || null
    // 自动选中第一个项目时，切到项目视图，避免侧边栏同时高亮"项目总览"和该项目
    if (selectedProjectId.value) activeView.value = 'project'
  }
  if (!selectedProjectId.value) activeView.value = 'overview'
}

async function loadNodeVersion() {
  nodeVersion.value = (await window.electronAPI.getNodeVersion()).version
}

async function loadNodeVersions() {
  const result = await window.electronAPI.getNodeVersions()
  nodeVersions.value = result.versions
  currentNodeVersion.value = result.current
}

function showOverview() {
  activeView.value = 'overview'
  // 切回总览时清除项目选中，避免侧边栏同时高亮"项目总览"和某个项目
  selectedProjectId.value = null
}

function selectProject(id: string) {
  selectedProjectId.value = id
  activeView.value = 'project'
}

function openAddProject() {
  if (sidebarCollapsed.value) sidebarCollapsed.value = false
  workspaceSidebarRef.value?.openAddForm()
}

function startEditProject(id: string) {
  selectedProjectId.value = id
  activeView.value = 'project'
  projectTabs.value = { ...projectTabs.value, [id]: 'info' }
  editTrigger.value = Date.now()
}

function setActiveProjectTab(tab: WorkspaceTab) {
  if (!selectedProjectId.value) return
  projectTabs.value = { ...projectTabs.value, [selectedProjectId.value]: tab }
}

async function addProject(project: Project) {
  await window.electronAPI.addProject(project)
  await loadConfig()
  selectProject(project.id)
}

async function updateProject(project: Project) {
  try {
    const saved = await window.electronAPI.updateProject(project)
    if (!saved) {
      showToast('项目设置保存失败', 'error')
      return
    }

    launchFailures.value = clearLaunchFailure(launchFailures.value, project.id)
    await loadConfig()
    showToast('项目设置已保存', 'success')
  } catch (error) {
    console.error('保存项目设置失败:', error)
    showToast('项目设置保存失败', 'error')
  }
}

async function deleteProject(id: string) {
  await window.electronAPI.deleteProject(id)
  launchFailures.value = clearLaunchFailure(launchFailures.value, id)
  const nextTabs = { ...projectTabs.value }
  delete nextTabs[id]
  projectTabs.value = nextTabs
  await loadConfig()
  if (selectedProjectId.value === id) selectedProjectId.value = config.value?.projects[0]?.id || null
  if (!selectedProjectId.value) activeView.value = 'overview'
}

async function reorderProjects(ids: string[]) { await window.electronAPI.reorderProjects(ids); await loadConfig() }
async function toggleFavorite(id: string) { await window.electronAPI.toggleFavorite(id); await loadConfig() }
async function addFolder(folder: Folder) { await window.electronAPI.addFolder(folder); await loadConfig() }
async function reorderFolders(ids: string[]) { await window.electronAPI.reorderFolders(ids); await loadConfig() }
async function deleteFolder(id: string) { await window.electronAPI.deleteFolder(id); await loadConfig() }
async function renameFolder(folder: Folder) { await window.electronAPI.updateFolder(folder); await loadConfig() }
async function moveToFolder(projectId: string, folderId: string | null) { await window.electronAPI.moveProjectToFolder(projectId, folderId); await loadConfig() }

async function startProjectById(projectId: string) {
  const project = config.value?.projects.find(item => item.id === projectId)
  if (!project) return
  const result = await window.electronAPI.startProject(project.id)
  if (result.success) {
    launchFailures.value = clearLaunchFailure(launchFailures.value, project.id)
    return
  }
  const message = result.error || '启动前检查未通过'
  launchFailures.value = setLaunchFailure(launchFailures.value, {
    projectId: project.id,
    projectName: project.name,
    message
  })
  showToast(message, 'error')
}

async function stopProjectById(projectId: string) {
  await window.electronAPI.stopProject(projectId)
}

function startSelectedProject() { if (selectedProjectId.value) return startProjectById(selectedProjectId.value) }
function stopSelectedProject() { if (selectedProjectId.value) return stopProjectById(selectedProjectId.value) }

function handleStatus(status: ProcessStatus) {
  const previous = processStatuses.value[status.projectId]
  activities.value = appendActivity(activities.value, activityFromStatus(previous, status))
  processStatuses.value[status.projectId] = status
  if (status.status === 'running') {
    launchFailures.value = clearLaunchFailure(launchFailures.value, status.projectId)
  }
}

function handleLogData(log: LogEntry) {
  appendSessionLogEntry(log)
  const urls = findLocalUrls(log.data)
  if (urls[0]) {
    projectUrls.value[log.projectId] = urls[0]
  }
}

function clearRecentActivities() {
  activities.value = clearActivities(activities.value)
}

function handleErrorAnalysis(analysis: ErrorAnalysis) {
  errorAnalysis.value = analysis
  showErrorAnalysis.value = true
}

function closeErrorAnalysis() { showErrorAnalysis.value = false; errorAnalysis.value = null }
async function openProjectUrl(url: string) {
  const result = await window.electronAPI.openLocalUrl(url)
  if (!result.success) showToast(result.error || '打开页面失败', 'error')
}

async function handleAnalyzeErrors() {
  if (!selectedProjectId.value) return
  const exitCode = processStatuses.value[selectedProjectId.value]?.exitCode ?? 1
  const result = await window.electronAPI.analyzeErrors(selectedProjectId.value, exitCode)
  if (result) handleErrorAnalysis(result)
}

function showToast(message: string, type: 'success' | 'error' | 'warning') {
  toastMessage.value = message
  toastType.value = type
  toastSequence.value += 1
}
function handleExportResult(success: boolean, message: string) { showToast(message, success ? 'success' : 'error') }

async function exportConfig() {
  const result = await window.electronAPI.exportConfig()
  if (result.success) showToast(`配置已导出到: ${result.path}`, 'success')
  else if (result.error) showToast(result.error, 'error')
}

async function importConfig() {
  const result = await window.electronAPI.importConfig()
  if (result.success) {
    launchFailures.value = {}
    projectUrls.value = {}
    await loadConfig()
    showToast('配置已导入', 'success')
  } else if (result.error) {
    showToast(result.error, 'error')
  }
}

async function switchNodeVersion(version: string) {
  switchingVersion.value = true
  const result = await window.electronAPI.switchNodeVersion(version)
  switchingVersion.value = false
  if (result.success) {
    const normalized = version.startsWith('v') ? version : `v${version}`
    nodeVersion.value = normalized
    currentNodeVersion.value = normalized
    showToast(`已切换到 Node ${normalized}`, 'success')
  } else showToast(`切换失败: ${result.error || '未知错误'}`, 'error')
}

async function startAllProjects() {
  if (!config.value) return
  const projectIds = config.value.projects.map(project => project.id)
  const result = await window.electronAPI.startAllProjects(projectIds)
  launchFailures.value = mergeLaunchFailures(launchFailures.value, result.failures, projectIds)
  showToast(result.failed ? `已启动 ${result.success} 个项目，${result.failed} 个失败` : `已启动 ${result.success} 个项目`, result.failed ? 'warning' : 'success')
}

async function stopAllProjects() { await window.electronAPI.stopAllProjects(); showToast('已停止所有项目', 'success') }

async function setProjectNodeVersion(projectId: string, version: string | null) {
  const project = config.value?.projects.find(item => item.id === projectId)
  if (!project) return
  if (version) project.nodeVersion = version
  else delete project.nodeVersion
  await window.electronAPI.updateProject(toRaw(project))
  await loadConfig()
}

async function setProjectCommand(projectId: string, command: string) {
  const project = config.value?.projects.find(item => item.id === projectId)
  if (!project || project.command === command) return
  await window.electronAPI.updateProject(toRaw({ ...project, command }))
  await loadConfig()
  launchFailures.value = clearLaunchFailure(launchFailures.value, projectId)
  showToast(`已切换启动方案: ${command}`, 'success')
}

async function openProjectFolderById(projectId: string) {
  const project = config.value?.projects.find(item => item.id === projectId)
  if (!project) return
  const result = await window.electronAPI.openInFileManager(project.path)
  if (!result.success) showToast(result.error || '打开文件夹失败', 'error')
}

async function refreshVersions() { await Promise.all([loadNodeVersion(), loadNodeVersions()]) }

async function toggleTheme() {
  if (!config.value) return
  const themes: AppConfig['theme'][] = ['light', 'dark', 'system']
  config.value.theme = themes[(themes.indexOf(config.value.theme) + 1) % themes.length]
  applyTheme(config.value.theme)
  await window.electronAPI.saveConfig(toRaw(config.value))
}

function getStatusColor(projectId: string) {
  const status = processStatuses.value[projectId]?.status
  return status === 'running' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--text-tertiary)'
}

function getStatusLabel(projectId: string) {
  const status = processStatuses.value[projectId]?.status
  return status === 'running' ? '运行中' : status === 'error' ? '异常' : '未启动'
}

function getProjectInitial(name: string) {
  return Array.from(name.trim())[0]?.toUpperCase() || '?'
}

function getCollapsedProjectTooltip(project: Project) {
  return `${project.name}\n脚本: npm run ${project.command}\n状态: ${getStatusLabel(project.id)}`
}

function toggleSidebar() { sidebarCollapsed.value = !sidebarCollapsed.value }

function onResizeStart(event: MouseEvent) {
  event.preventDefault()
  isResizing.value = true
  const startX = event.clientX
  const startWidth = sidebarWidth.value
  const move = (next: MouseEvent) => { sidebarWidth.value = Math.min(500, Math.max(190, startWidth + next.clientX - startX)) }
  const stop = () => {
    isResizing.value = false
    localStorage.setItem('sidebarWidth', String(sidebarWidth.value))
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', stop)
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', stop)
}

onMounted(async () => {
  await Promise.all([loadConfig(), loadNodeVersion(), loadNodeVersions()])
  applyTheme(config.value?.theme || 'system')
  cleanupStatus = window.electronAPI.onProcessStatus(handleStatus)
  cleanupLogs = window.electronAPI.onLogData(handleLogData)
  cleanupErrorAnalysis = window.electronAPI.onErrorAnalysis?.(handleErrorAnalysis) || null
  cleanupSystemTheme = installSystemThemeListener(() => config.value?.theme || 'system')
})

onUnmounted(() => { cleanupStatus?.(); cleanupLogs?.(); cleanupErrorAnalysis?.(); cleanupSystemTheme?.() })
watch(() => config.value?.theme, theme => { if (theme) applyTheme(theme) })
</script>

<template>
  <div class="app-shell">
        <Toast :message="toastMessage" :type="toastType" :sequence="toastSequence" />
    <ErrorAnalysisDialog :visible="showErrorAnalysis" :analysis="errorAnalysis" @close="closeErrorAnalysis" />
    <AppHeader
      :node-version="nodeVersion" :available-versions="nodeVersions" :current-version="currentNodeVersion"
      :switching="switchingVersion" :theme="config?.theme || 'system'"
      @toggle-theme="toggleTheme" @switch-version="switchNodeVersion" @refresh-versions="refreshVersions"
      @export-config="exportConfig" @import-config="importConfig"
    />
    <main class="app-main">
      <aside class="app-sidebar" :class="{ collapsed: sidebarCollapsed, resizing: isResizing }" :style="{ width: sidebarCollapsed ? '48px' : `${sidebarWidth}px` }">
        <WorkspaceSidebar
          ref="workspaceSidebarRef" v-show="!sidebarCollapsed" :active-view="activeView"
          :projects="config?.projects || []" :folders="config?.folders || []" :selected-id="selectedProjectId" :statuses="processStatuses"
          :project-urls="projectUrls"
          @select-overview="showOverview" @select="selectProject" @add="addProject" @reorder="reorderProjects"
          @edit="startEditProject" @delete="deleteProject" @toggle-favorite="toggleFavorite" @add-folder="addFolder"
          @reorder-folders="reorderFolders" @delete-folder="deleteFolder" @rename-folder="renameFolder" @move-to-folder="moveToFolder"
        />
        <div v-if="sidebarCollapsed" class="collapsed-navigation">
          <button :class="{ active: activeView === 'overview' }" aria-label="项目总览" @click="showOverview">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          </button>
          <button
            v-for="project in config?.projects || []"
            :key="project.id"
            class="collapsed-project-button"
            :class="{ active: activeView === 'project' && selectedProjectId === project.id }"
            :title="getCollapsedProjectTooltip(project)"
            :aria-label="getCollapsedProjectTooltip(project)"
            @click="selectProject(project.id)"
          >
            <span class="collapsed-project-mark">{{ getProjectInitial(project.name) }}</span>
            <span class="collapsed-status-dot" :style="{ background: getStatusColor(project.id) }"></span>
          </button>
        </div>
        <button class="sidebar-toggle" :aria-label="sidebarCollapsed ? '展开侧栏' : '收起侧栏'" @click="toggleSidebar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline :points="sidebarCollapsed ? '9 6 15 12 9 18' : '15 6 9 12 15 18'"/></svg>
        </button>
      </aside>
      <div v-if="!sidebarCollapsed" class="sidebar-resizer" :class="{ active: isResizing }" @mousedown="onResizeStart"></div>
      <section class="app-content">
        <ProjectOverview
          v-if="activeView === 'overview'" :projects="config?.projects || []" :statuses="processStatuses" :activities="activities" :node-version="nodeVersion"
          :project-urls="projectUrls" :launch-failures="launchFailures"
          @select="selectProject" @start="startProjectById" @stop="stopProjectById" @start-all="startAllProjects" @stop-all="stopAllProjects" @add-project="openAddProject"
          @clear-activities="clearRecentActivities" @open-url="openProjectUrl" @edit-project="startEditProject" @open-folder="openProjectFolderById"
          @import-config="importConfig"
        />
        <ProjectWorkspace
          v-else-if="selectedProject" :project="selectedProject" :status="currentStatus" :active-tab="activeProjectTab" :edit-trigger="editTrigger"
          :local-url="projectUrls[selectedProject.id] || null"
          :node-versions="nodeVersions" :global-node-version="nodeVersion" @update:active-tab="setActiveProjectTab"
          @start="startSelectedProject" @stop="stopSelectedProject" @edit="startEditProject(selectedProject.id)" @update="updateProject"
          @delete="deleteProject" @toast="showToast" @set-node-version="setProjectNodeVersion" @set-command="setProjectCommand" @open-url="openProjectUrl" @analyze-errors="handleAnalyzeErrors" @export-result="handleExportResult"
        />
      </section>
    </main>
  </div>
</template>

<style scoped>
.app-shell { height: 100vh; display: flex; flex-direction: column; overflow: hidden; color: var(--text-primary); background: var(--ios-app-bg); background-attachment: fixed; }
.app-main { flex: 1; display: flex; min-height: 0; overflow: visible; }.app-sidebar { position: relative; flex: none; min-width: 0; border-right: 1px solid var(--glass-border); background: var(--glass-fill-strong); -webkit-backdrop-filter: blur(24px) saturate(160%); backdrop-filter: blur(24px) saturate(160%); transition: width 250ms cubic-bezier(0.16, 1, 0.3, 1); }.app-sidebar.resizing { transition: none; }.app-content { flex: 1; min-width: 0; overflow: hidden; }
.sidebar-resizer { width: 3px; margin-left: -2px; z-index: 4; cursor: col-resize; }.sidebar-resizer:hover,.sidebar-resizer.active { background: var(--accent-primary); }
.sidebar-toggle { position: absolute; top: 50%; right: -12px; z-index: 8; width: 24px; height: 24px; display: grid; place-items: center; transform: translateY(-50%); border: 1px solid var(--border-default); border-radius: 50%; color: var(--text-tertiary); background: var(--bg-surface); box-shadow: var(--shadow-sm); }.sidebar-toggle:hover { color: var(--accent-primary); border-color: var(--accent-border); }
.collapsed-navigation { height: 100%; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 6px; overflow-y: auto; }
.collapsed-navigation button { position: relative; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; color: var(--text-tertiary); }
.collapsed-navigation button:hover,.collapsed-navigation button.active { color: var(--accent-primary); background: var(--bg-selected); }
.collapsed-project-mark { width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid var(--border-default); border-radius: 6px; color: var(--text-secondary); background: var(--bg-surface); font-size: 11px; font-weight: 700; line-height: 1; }
.collapsed-project-button:hover .collapsed-project-mark,.collapsed-project-button.active .collapsed-project-mark { color: var(--accent-primary); border-color: var(--accent-border); }
.collapsed-status-dot { position: absolute; right: 4px; bottom: 4px; width: 7px; height: 7px; border: 2px solid var(--bg-sidebar); border-radius: 50%; box-sizing: content-box; }
</style>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import ErrorAnalysisDialog from '../features/error-analysis/ErrorAnalysisDialog.vue'
import ProjectOverview from '../features/projects/components/ProjectOverview.vue'
import WorkspaceSidebar from '../features/projects/components/WorkspaceSidebar.vue'
import ProjectWorkspace from '../features/workspace/components/ProjectWorkspace.vue'
import { activityFromStatus, appendActivity, clearActivities } from '../features/workspace/model/workspaceState'
import Toast from '../shared/ui/Toast.vue'
import CommandPalette from '../shared/ui/CommandPalette.vue'
import AppHeader from '../shared/window/AppHeader.vue'
import type { ActiveView, ActivityItem, AppConfig, ErrorAnalysis, Folder, LogEntry, ProcessStatus, Project } from '../shared/types'
import { applyTheme, installSystemThemeListener } from './useAppTheme'
import { findLocalUrls } from '../features/workspace/model/localUrls'
import { appendSessionLogEntry, getSessionLogs } from '../features/terminal/model/sessionLogs'
import { clearLaunchFailure, mergeLaunchFailures, setLaunchFailure, type LaunchFailureState } from '../features/workspace/model/launchFailures'
import { installDefaultContextMenuGuard } from '../shared/window/defaultContextMenuGuard'
import { installFirstMouseActivation } from '../shared/window/firstMouseActivation'

type WorkspaceTab = 'logs' | 'terminal' | 'info'

const isMac = window.desktopAPI?.platform === 'darwin'
const config = ref<AppConfig | null>(null)
const nodeVersion = ref<string | null>(null)
const nodeVersions = ref<string[]>([])
const currentNodeVersion = ref<string | null>(null)
const switchingVersion = ref(false)
const refreshingVersions = ref(false)
const selectedProjectId = ref<string | null>(null)
const processStatuses = ref<Record<string, ProcessStatus>>({})
const launchingProjects = ref<Record<string, boolean>>({})
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
const showCommandPalette = ref(false)

const sidebarCollapsed = ref(false)
const sidebarWidth = ref(parseInt(localStorage.getItem('sidebarWidth') || '272', 10))
const isResizing = ref(false)
const workspaceSidebarRef = ref<InstanceType<typeof WorkspaceSidebar> | null>(null)

let cleanupStatus: (() => void) | null = null
let cleanupLogs: (() => void) | null = null
let cleanupErrorAnalysis: (() => void) | null = null
let cleanupSystemTheme: (() => void) | null = null
let cleanupDefaultContextMenuGuard: (() => void) | null = null
let cleanupFirstMouseActivation: (() => void) | null = null

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

const shortcutProjectId = computed(() => {
  if (activeView.value !== 'project') return null
  const projects = config.value?.projects || []
  if (selectedProjectId.value && projects.some(project => project.id === selectedProjectId.value)) return selectedProjectId.value
  return null
})

async function loadConfig() {
  const nextConfig = await window.desktopAPI.getConfig()
  config.value = nextConfig
  if (!selectedProjectId.value || !nextConfig.projects.some(project => project.id === selectedProjectId.value)) {
    selectedProjectId.value = nextConfig.projects[0]?.id || null
    // 自动选中第一个项目时，切到项目视图，避免侧边栏同时高亮"项目总览"和该项目
    if (selectedProjectId.value) activeView.value = 'project'
  }
  if (!selectedProjectId.value) activeView.value = 'overview'
}

async function loadNodeVersions() {
  const result = await window.desktopAPI.getNodeVersions()
  nodeVersions.value = result.versions
  currentNodeVersion.value = result.current
  nodeVersion.value = result.current
}

function showOverview() {
  activeView.value = 'overview'
}

function selectProject(id: string) {
  selectedProjectId.value = id
  activeView.value = 'project'
}

function openAddProject() {
  if (sidebarCollapsed.value) sidebarCollapsed.value = false
  workspaceSidebarRef.value?.openAddForm()
}

function openCommandPalette() {
  showErrorAnalysis.value = false
  showCommandPalette.value = true
}

function closeCommandPalette() {
  showCommandPalette.value = false
}

function handlePaletteAction(action: () => void) {
  action()
  closeCommandPalette()
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

async function persistConfigChange(operation: () => Promise<boolean>, errorMessage: string) {
  try {
    const saved = await operation()
    if (!saved) {
      showToast(errorMessage, 'error')
      return false
    }
    await loadConfig()
    return true
  } catch (error) {
    console.error(errorMessage, error)
    showToast(errorMessage, 'error')
    return false
  }
}

async function addProject(project: Project) {
  const saved = await persistConfigChange(() => window.desktopAPI.addProject(project), '项目创建失败')
  if (!saved) return
  selectProject(project.id)
}

async function updateProject(project: Project) {
  try {
    const saved = await window.desktopAPI.updateProject(project)
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
  const saved = await persistConfigChange(() => window.desktopAPI.deleteProject(id), '项目删除失败')
  if (!saved) return
  launchFailures.value = clearLaunchFailure(launchFailures.value, id)
  const nextTabs = { ...projectTabs.value }
  delete nextTabs[id]
  projectTabs.value = nextTabs
  if (selectedProjectId.value === id) selectedProjectId.value = config.value?.projects[0]?.id || null
  if (!selectedProjectId.value) activeView.value = 'overview'
}

async function reorderProjects(ids: string[]) { await persistConfigChange(() => window.desktopAPI.reorderProjects(ids), '项目排序保存失败') }
async function toggleFavorite(id: string) { await persistConfigChange(() => window.desktopAPI.toggleFavorite(id), '收藏状态保存失败') }
async function addFolder(folder: Folder) { await persistConfigChange(() => window.desktopAPI.addFolder(folder), '文件夹创建失败') }
async function reorderFolders(ids: string[]) { await persistConfigChange(() => window.desktopAPI.reorderFolders(ids), '文件夹排序保存失败') }
async function deleteFolder(id: string) { await persistConfigChange(() => window.desktopAPI.deleteFolder(id), '文件夹删除失败') }
async function updateFolder(folder: Folder) { await persistConfigChange(() => window.desktopAPI.updateFolder(folder), '文件夹设置保存失败') }
async function moveToFolder(projectId: string, folderId: string | null) { await persistConfigChange(() => window.desktopAPI.moveProjectToFolder(projectId, folderId), '项目分组保存失败') }

async function startProjectById(projectId: string) {
  const project = config.value?.projects.find(item => item.id === projectId)
  if (!project) return
  if (launchingProjects.value[project.id]) return
  launchingProjects.value = { ...launchingProjects.value, [project.id]: true }
  try {
    const result = await window.desktopAPI.startProject(project.id)
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
  } catch (error) {
    console.error('启动项目失败:', error)
    showToast('启动项目失败，请稍后重试', 'error')
  } finally {
    launchingProjects.value = { ...launchingProjects.value, [project.id]: false }
  }
}

async function stopProjectById(projectId: string) {
  await window.desktopAPI.stopProject(projectId)
}

function startSelectedProject() { if (selectedProjectId.value) return startProjectById(selectedProjectId.value) }
function stopSelectedProject() { if (selectedProjectId.value) return stopProjectById(selectedProjectId.value) }

function startShortcutProject() {
  const projectId = shortcutProjectId.value
  if (!projectId) {
    showToast('请先进入一个项目', 'warning')
    return
  }
  return startProjectById(projectId)
}

function stopShortcutProject() {
  const projectId = shortcutProjectId.value
  if (!projectId) {
    showToast('请先进入一个项目', 'warning')
    return
  }
  return stopProjectById(projectId)
}

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
  const result = await window.desktopAPI.openLocalUrl(url)
  if (!result.success) showToast(result.error || '打开页面失败', 'error')
}

async function handleAnalyzeErrors() {
  if (!selectedProjectId.value) return
  const exitCode = processStatuses.value[selectedProjectId.value]?.exitCode ?? 1
  const result = await window.desktopAPI.analyzeErrors(selectedProjectId.value, exitCode)
  if (result) handleErrorAnalysis(result)
}

function showToast(message: string, type: 'success' | 'error' | 'warning') {
  toastMessage.value = message
  toastType.value = type
  toastSequence.value += 1
}
function handleExportResult(success: boolean, message: string) { showToast(message, success ? 'success' : 'error') }

async function exportConfig() {
  const result = await window.desktopAPI.exportConfig()
  if (result.success) showToast(`配置已导出到: ${result.path}`, 'success')
  else if (result.error) showToast(result.error, 'error')
}

async function importConfig() {
  const result = await window.desktopAPI.importConfig()
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
  try {
    const result = await window.desktopAPI.switchNodeVersion(version)
    if (result.success) {
      const normalized = version.startsWith('v') ? version : `v${version}`
      const refreshed = await refreshVersions(false)
      if (refreshed) showToast(`已切换到 Node ${currentNodeVersion.value || nodeVersion.value || normalized}`, 'success')
      else showToast(`已切换到 Node ${normalized}，版本状态刷新失败`, 'warning')
    } else showToast(`切换失败: ${result.error || '未知错误'}`, 'error')
  } catch (error) {
    showToast(`切换失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    switchingVersion.value = false
  }
}

async function startAllProjects() {
  if (!config.value) return
  const projectIds = config.value.projects.map(project => project.id)
  const result = await window.desktopAPI.startAllProjects(projectIds)
  launchFailures.value = mergeLaunchFailures(launchFailures.value, result.failures, projectIds)
  showToast(result.failed ? `已启动 ${result.success} 个项目，${result.failed} 个失败` : `已启动 ${result.success} 个项目`, result.failed ? 'warning' : 'success')
}

async function stopAllProjects() { await window.desktopAPI.stopAllProjects(); showToast('已停止所有项目', 'success') }

async function setProjectNodeVersion(projectId: string, version: string | null) {
  const project = config.value?.projects.find(item => item.id === projectId)
  if (!project) return
  const nextProject = { ...project }
  if (version) nextProject.nodeVersion = version
  else delete nextProject.nodeVersion
  await persistConfigChange(() => window.desktopAPI.updateProject(toRaw(nextProject)), '项目 Node.js 版本保存失败')
}

async function setProjectCommand(projectId: string, command: string) {
  const project = config.value?.projects.find(item => item.id === projectId)
  if (!project || project.command === command) return
  const saved = await persistConfigChange(
    () => window.desktopAPI.updateProject(toRaw({ ...project, command })),
    '项目启动方案保存失败'
  )
  if (!saved) return
  launchFailures.value = clearLaunchFailure(launchFailures.value, projectId)
  showToast(`已切换启动方案: ${command}`, 'success')
}

async function openProjectFolderById(projectId: string) {
  const project = config.value?.projects.find(item => item.id === projectId)
  if (!project) return
  const result = await window.desktopAPI.openInFileManager(project.path)
  if (!result.success) showToast(result.error || '打开文件夹失败', 'error')
}

async function refreshVersions(notify = true) {
  if (refreshingVersions.value) return false
  refreshingVersions.value = true
  try {
    const versionsResult = await window.desktopAPI.getNodeVersions()
    nodeVersions.value = versionsResult.versions
    currentNodeVersion.value = versionsResult.current
    nodeVersion.value = versionsResult.current
    const error = versionsResult.error
    if (error) {
      if (notify) showToast(`刷新失败: ${error}`, 'error')
      return false
    }
    if (notify) showToast('Node 版本列表已刷新', 'success')
    return true
  } catch (error) {
    if (notify) showToast(`刷新失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
    return false
  } finally {
    refreshingVersions.value = false
  }
}

async function toggleTheme() {
  if (!config.value) return
  const themes: AppConfig['theme'][] = ['light', 'dark', 'system']
  const previousTheme = config.value.theme
  config.value.theme = themes[(themes.indexOf(previousTheme) + 1) % themes.length]
  applyTheme(config.value.theme)
  try {
    const saved = await window.desktopAPI.saveConfig(toRaw(config.value))
    if (saved) return
  } catch (error) {
    console.error('主题设置保存失败', error)
  }
  config.value.theme = previousTheme
  applyTheme(previousTheme)
  showToast('主题设置保存失败', 'error')
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

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.getAttribute('role') === 'textbox'
}

function isPrimaryShortcutPressed(event: KeyboardEvent) {
  return isMac
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
}

function hasOpenModal() {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
}

function handleGlobalShortcut(event: KeyboardEvent) {
  if (hasOpenModal() || !isPrimaryShortcutPressed(event) || event.altKey || event.shiftKey || event.repeat || isEditableShortcutTarget(event.target)) return
  const key = event.key.toLowerCase()
  if (key === 'n') {
    event.preventDefault()
    openAddProject()
    return
  }
  if (key === 'k') {
    event.preventDefault()
    openCommandPalette()
    return
  }
  if (key === 'r') {
    event.preventDefault()
    void startShortcutProject()
    return
  }
  if (event.key === '.' || event.code === 'Period') {
    event.preventDefault()
    void stopShortcutProject()
  }
}

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

// 页面刷新后内存日志会清空，这里把后端保留的当次会话日志取回来重放，
// 避免项目仍在运行但控制台一片空白。
async function restoreSessionLogs() {
  const projects = config.value?.projects || []
  for (const project of projects) {
    // 已有内存日志说明本次会话已经在收集，不重复填充
    if (getSessionLogs(project.id).length > 0) continue
    try {
      const logs = await window.desktopAPI.getSessionLogs?.(project.id)
      if (!logs?.length) continue
      for (const log of logs) appendSessionLogEntry({ ...log, timestamp: 0 })
    } catch {
      // 单个项目取不到日志时跳过，不影响其他项目
    }
  }
}

// 页面刷新后事件推送不会回放当前状态，这里主动批量查询一次，
// 恢复仍在运行的项目状态（不产生活动记录，避免刷新后出现虚假的启动活动）。
async function restoreProcessStatuses() {
  const projects = config.value?.projects || []
  if (projects.length === 0) return
  try {
    const statuses = await window.desktopAPI.getProcessStatuses(projects.map(project => project.id))
    for (const status of statuses) {
      if (status.status === 'running') {
        processStatuses.value[status.projectId] = status
      }
    }
  } catch {
    // 查询失败时静默等待后续事件推送
  }
}

onMounted(async () => {
  cleanupDefaultContextMenuGuard = installDefaultContextMenuGuard()
  if (isMac) cleanupFirstMouseActivation = installFirstMouseActivation()
  await Promise.all([loadConfig(), loadNodeVersions()])
  applyTheme(config.value?.theme || 'system')
  cleanupStatus = window.desktopAPI.onProcessStatus(handleStatus)
  cleanupLogs = window.desktopAPI.onLogData(handleLogData)
  cleanupErrorAnalysis = window.desktopAPI.onErrorAnalysis?.(handleErrorAnalysis) || null
  cleanupSystemTheme = installSystemThemeListener(() => config.value?.theme || 'system')
  window.addEventListener('keydown', handleGlobalShortcut)
  await restoreProcessStatuses()
  await restoreSessionLogs()
})

onUnmounted(() => { cleanupStatus?.(); cleanupLogs?.(); cleanupErrorAnalysis?.(); cleanupSystemTheme?.(); cleanupDefaultContextMenuGuard?.(); cleanupFirstMouseActivation?.(); window.removeEventListener('keydown', handleGlobalShortcut) })
watch(() => config.value?.theme, theme => { if (theme) applyTheme(theme) })
</script>

<template>
  <div class="app-shell">
        <Toast :message="toastMessage" :type="toastType" :sequence="toastSequence" />
    <ErrorAnalysisDialog :visible="showErrorAnalysis" :analysis="errorAnalysis" @close="closeErrorAnalysis" />
    <CommandPalette
      :visible="showCommandPalette"
      :projects="config?.projects || []"
      :statuses="processStatuses"
      @close="closeCommandPalette"
      @add-project="handlePaletteAction(openAddProject)"
      @import-config="handlePaletteAction(importConfig)"
      @toggle-theme="handlePaletteAction(toggleTheme)"
      @start-all="handlePaletteAction(() => startAllProjects())"
      @stop-all="handlePaletteAction(() => stopAllProjects())"
      @start-project="(id) => handlePaletteAction(() => startProjectById(id))"
      @stop-project="(id) => handlePaletteAction(() => stopProjectById(id))"
    />
    <AppHeader
      :node-version="nodeVersion" :available-versions="nodeVersions" :current-version="currentNodeVersion"
      :switching="switchingVersion" :refreshing="refreshingVersions" :theme="config?.theme || 'system'"
      @toggle-theme="toggleTheme" @switch-version="switchNodeVersion" @refresh-versions="refreshVersions"
      @export-config="exportConfig" @import-config="importConfig"
    />
    <main class="app-main">
      <aside class="app-sidebar" :class="{ collapsed: sidebarCollapsed, resizing: isResizing }" :style="{ width: sidebarCollapsed ? '48px' : `${sidebarWidth}px` }">
        <WorkspaceSidebar
          ref="workspaceSidebarRef" v-show="!sidebarCollapsed" :active-view="activeView"
          :projects="config?.projects || []" :folders="config?.folders || []" :selected-id="activeView === 'project' ? selectedProjectId : null" :statuses="processStatuses"
          :project-urls="projectUrls"
          @select-overview="showOverview" @select="selectProject" @add="addProject" @reorder="reorderProjects"
          @edit="startEditProject" @delete="deleteProject" @toggle-favorite="toggleFavorite" @add-folder="addFolder"
          @reorder-folders="reorderFolders" @delete-folder="deleteFolder" @rename-folder="updateFolder" @update-folder="updateFolder" @move-to-folder="moveToFolder"
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
          v-show="activeView === 'overview'" :projects="config?.projects || []" :statuses="processStatuses" :activities="activities" :node-version="nodeVersion"
          :project-urls="projectUrls" :launch-failures="launchFailures" :launching-projects="launchingProjects"
          @select="selectProject" @start="startProjectById" @stop="stopProjectById" @start-all="startAllProjects" @stop-all="stopAllProjects" @add-project="openAddProject"
          @clear-activities="clearRecentActivities" @open-url="openProjectUrl" @edit-project="startEditProject" @open-folder="openProjectFolderById"
          @import-config="importConfig"
        />
        <ProjectWorkspace
          v-if="selectedProject" v-show="activeView === 'project'" :project="selectedProject" :projects="config?.projects || []" :visible="activeView === 'project'"
          :status="currentStatus" :active-tab="activeProjectTab" :edit-trigger="editTrigger"
          :local-url="projectUrls[selectedProject.id] || null"
          :node-versions="nodeVersions" :global-node-version="nodeVersion" :launching="launchingProjects[selectedProject.id] || false" @update:active-tab="setActiveProjectTab"
          @start="startSelectedProject" @stop="stopSelectedProject" @edit="startEditProject(selectedProject.id)" @update="updateProject"
          @delete="deleteProject" @toast="showToast" @set-node-version="setProjectNodeVersion" @set-command="setProjectCommand" @open-url="openProjectUrl" @analyze-errors="handleAnalyzeErrors" @export-result="handleExportResult"
        />
      </section>
    </main>
  </div>
</template>

<style scoped>
.app-shell { height: 100vh; display: flex; flex-direction: column; overflow: hidden; color: var(--text-primary); background: var(--ios-app-bg); background-attachment: fixed; }
.app-main { flex: 1; display: flex; min-height: 0; overflow: visible; }.app-sidebar { position: relative; z-index: 2; flex: none; min-width: 0; border-right: 1px solid var(--glass-border); background: var(--glass-fill-strong); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); transition: width 250ms cubic-bezier(0.16, 1, 0.3, 1); }.app-sidebar.resizing { transition: none; }.app-content { flex: 1; min-width: 0; overflow: hidden; }
.sidebar-resizer { position: relative; width: 4px; margin-left: -2px; z-index: 4; cursor: col-resize; }.sidebar-resizer:hover { background: linear-gradient(180deg, transparent 4%, var(--accent-border) 22%, var(--accent-border) 78%, transparent 96%); }.sidebar-resizer.active { background: linear-gradient(180deg, transparent 3%, color-mix(in srgb, var(--accent-primary) 34%, transparent) 20%, color-mix(in srgb, var(--accent-primary) 34%, transparent) 80%, transparent 97%); }
.sidebar-toggle { position: absolute; top: 50%; right: 0; transform: translate(50%, -50%); z-index: 12; width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid var(--border-default); border-radius: 50%; color: var(--text-secondary); background: var(--bg-elevated); box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18), 0 1px 2px rgba(15, 23, 42, 0.08); transition: color 150ms ease, border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease; }:root[data-theme='dark'] .sidebar-toggle { background: rgba(255, 255, 255, 0.06); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.42), 0 1px 2px rgba(0, 0, 0, 0.24); }.sidebar-toggle:hover { color: var(--accent-primary); border-color: var(--accent-border); box-shadow: 0 4px 10px rgba(15, 23, 42, 0.22), 0 1px 3px rgba(15, 23, 42, 0.12); transform: translate(50%, -50%) scale(1.06); }
.collapsed-navigation { height: 100%; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 6px; overflow-y: auto; }
.collapsed-navigation button { position: relative; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; color: var(--text-tertiary); }
.collapsed-navigation button:hover,.collapsed-navigation button.active { color: var(--accent-primary); background: var(--bg-selected); }
.collapsed-project-mark { width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid var(--border-default); border-radius: 6px; color: var(--text-secondary); background: var(--bg-surface); font-size: 12px; font-weight: 700; line-height: 1; }
.collapsed-project-button:hover .collapsed-project-mark,.collapsed-project-button.active .collapsed-project-mark { color: var(--accent-primary); border-color: var(--accent-border); }
.collapsed-status-dot { position: absolute; right: 4px; bottom: 4px; width: 7px; height: 7px; border: 2px solid var(--bg-sidebar); border-radius: 50%; box-sizing: content-box; }
</style>

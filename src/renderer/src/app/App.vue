<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import ErrorAnalysisDialog from '../features/error-analysis/ErrorAnalysisDialog.vue'
import ProjectOverview from '../features/projects/components/ProjectOverview.vue'
import WorkspaceSidebar from '../features/projects/components/WorkspaceSidebar.vue'
import ProjectWorkspace from '../features/workspace/components/ProjectWorkspace.vue'
import { activityFromStatus, appendActivity, clearActivities } from '../features/workspace/model/workspaceState'
import Toast from '../shared/ui/Toast.vue'
import AppHeader from '../shared/window/AppHeader.vue'
import type { ActiveView, ActivityItem, AppConfig, ErrorAnalysis, Folder, ProcessStatus, Project } from '../shared/types'
import { applyTheme, installSystemThemeListener } from './useAppTheme'

const config = ref<AppConfig | null>(null)
const nodeVersion = ref<string | null>(null)
const nodeVersions = ref<string[]>([])
const currentNodeVersion = ref<string | null>(null)
const switchingVersion = ref(false)
const selectedProjectId = ref<string | null>(null)
const processStatuses = ref<Record<string, ProcessStatus>>({})
const activities = ref<ActivityItem[]>([])
const activeView = ref<ActiveView>('overview')
const activeTab = ref<'logs' | 'terminal' | 'info'>('logs')
const editTrigger = ref(0)

const toastMessage = ref('')
const toastType = ref<'success' | 'error' | 'warning'>('error')
const errorAnalysis = ref<ErrorAnalysis | null>(null)
const showErrorAnalysis = ref(false)

const sidebarCollapsed = ref(false)
const sidebarWidth = ref(parseInt(localStorage.getItem('sidebarWidth') || '260', 10))
const isResizing = ref(false)
const workspaceSidebarRef = ref<InstanceType<typeof WorkspaceSidebar> | null>(null)

let cleanupStatus: (() => void) | null = null
let cleanupErrorAnalysis: (() => void) | null = null
let cleanupSystemTheme: (() => void) | null = null

const selectedProject = computed(() => {
  if (!selectedProjectId.value || !config.value) return null
  return config.value.projects.find(project => project.id === selectedProjectId.value) || null
})

const currentStatus = computed(() => selectedProjectId.value
  ? processStatuses.value[selectedProjectId.value] || null
  : null)

async function loadConfig() {
  config.value = await window.electronAPI.getConfig()
  if (config.value.projects.length && !selectedProjectId.value) selectedProjectId.value = config.value.projects[0].id
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
  activeTab.value = 'info'
  editTrigger.value = Date.now()
}

async function addProject(project: Project) {
  await window.electronAPI.addProject(project)
  await loadConfig()
  selectProject(project.id)
}

async function updateProject(project: Project) {
  await window.electronAPI.updateProject(project)
  await loadConfig()
}

async function deleteProject(id: string) {
  await window.electronAPI.deleteProject(id)
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
  await window.electronAPI.startProject(project.id, project.path, project.command, project.nodeVersion)
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
}

function clearRecentActivities() {
  activities.value = clearActivities(activities.value)
}

function handleErrorAnalysis(analysis: ErrorAnalysis) {
  errorAnalysis.value = analysis
  showErrorAnalysis.value = true
}

function closeErrorAnalysis() { showErrorAnalysis.value = false; errorAnalysis.value = null }
async function openLogDir(projectId: string) { await window.electronAPI.openLogDir(projectId) }

async function handleAnalyzeErrors() {
  if (!selectedProjectId.value) return
  const exitCode = processStatuses.value[selectedProjectId.value]?.exitCode ?? 1
  const result = await window.electronAPI.analyzeErrors(selectedProjectId.value, exitCode)
  if (result) handleErrorAnalysis(result)
}

function showToast(message: string, type: 'success' | 'error' | 'warning') { toastMessage.value = message; toastType.value = type }
function handleExportResult(success: boolean, message: string) { showToast(message, success ? 'success' : 'error') }

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
  const projects = config.value.projects.map(project => ({ id: project.id, path: project.path, command: project.command, nodeVersion: project.nodeVersion }))
  const result = await window.electronAPI.startAllProjects(projects)
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
  cleanupErrorAnalysis = window.electronAPI.onErrorAnalysis?.(handleErrorAnalysis) || null
  cleanupSystemTheme = installSystemThemeListener(() => config.value?.theme || 'system')
})

onUnmounted(() => { cleanupStatus?.(); cleanupErrorAnalysis?.(); cleanupSystemTheme?.() })
watch(() => config.value?.theme, theme => { if (theme) applyTheme(theme) })
</script>

<template>
  <div class="app-shell">
    <Toast :message="toastMessage" :type="toastType" />
    <ErrorAnalysisDialog :visible="showErrorAnalysis" :analysis="errorAnalysis" @close="closeErrorAnalysis" @open-log-dir="openLogDir" />
    <AppHeader
      :node-version="nodeVersion" :available-versions="nodeVersions" :current-version="currentNodeVersion"
      :switching="switchingVersion" :theme="config?.theme || 'system'"
      @toggle-theme="toggleTheme" @switch-version="switchNodeVersion" @refresh-versions="refreshVersions"
    />
    <main class="app-main">
      <aside class="app-sidebar" :class="{ collapsed: sidebarCollapsed, resizing: isResizing }" :style="{ width: sidebarCollapsed ? '48px' : `${sidebarWidth}px` }">
        <WorkspaceSidebar
          ref="workspaceSidebarRef" v-show="!sidebarCollapsed" :active-view="activeView"
          :projects="config?.projects || []" :folders="config?.folders || []" :selected-id="selectedProjectId" :statuses="processStatuses"
          @select-overview="showOverview" @select="selectProject" @add="addProject" @reorder="reorderProjects"
          @edit="startEditProject" @delete="deleteProject" @toggle-favorite="toggleFavorite" @add-folder="addFolder"
          @reorder-folders="reorderFolders" @delete-folder="deleteFolder" @rename-folder="renameFolder" @move-to-folder="moveToFolder"
        />
        <div v-if="sidebarCollapsed" class="collapsed-navigation">
          <button :class="{ active: activeView === 'overview' }" aria-label="项目总览" @click="showOverview">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          </button>
          <button v-for="project in config?.projects || []" :key="project.id" :class="{ active: activeView === 'project' && selectedProjectId === project.id }" :aria-label="`${project.name}，${processStatuses[project.id]?.status || '未启动'}`" @click="selectProject(project.id)">
            <span class="collapsed-dot" :style="{ background: getStatusColor(project.id) }"></span>
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
          @select="selectProject" @start="startProjectById" @stop="stopProjectById" @start-all="startAllProjects" @stop-all="stopAllProjects" @add-project="openAddProject"
          @clear-activities="clearRecentActivities"
        />
        <ProjectWorkspace
          v-else-if="selectedProject" :project="selectedProject" :status="currentStatus" :active-tab="activeTab" :edit-trigger="editTrigger"
          :node-versions="nodeVersions" :global-node-version="nodeVersion" @update:active-tab="activeTab = $event"
          @start="startSelectedProject" @stop="stopSelectedProject" @edit="startEditProject(selectedProject.id)" @update="updateProject"
          @delete="deleteProject" @toast="showToast" @set-node-version="setProjectNodeVersion" @analyze-errors="handleAnalyzeErrors" @export-result="handleExportResult"
        />
      </section>
    </main>
  </div>
</template>

<style scoped>
.app-shell { height: 100vh; display: flex; flex-direction: column; overflow: hidden; color: var(--text-primary); background: var(--bg-app); }
.app-main { flex: 1; display: flex; min-height: 0; overflow: hidden; }.app-sidebar { position: relative; flex: none; min-width: 0; border-right: 1px solid var(--border-default); background: var(--bg-sidebar); transition: width 220ms ease; }.app-sidebar.resizing { transition: none; }.app-content { flex: 1; min-width: 0; overflow: hidden; }
.sidebar-resizer { width: 3px; margin-left: -2px; z-index: 4; cursor: col-resize; }.sidebar-resizer:hover,.sidebar-resizer.active { background: var(--accent-primary); }
.sidebar-toggle { position: absolute; top: 50%; right: -12px; z-index: 8; width: 24px; height: 24px; display: grid; place-items: center; transform: translateY(-50%); border: 1px solid var(--border-default); border-radius: 50%; color: var(--text-tertiary); background: var(--bg-surface); box-shadow: var(--shadow-sm); }.sidebar-toggle:hover { color: var(--accent-primary); border-color: var(--accent-border); }
.collapsed-navigation { height: 100%; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 6px; overflow-y: auto; }.collapsed-navigation button { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; color: var(--text-tertiary); }.collapsed-navigation button:hover,.collapsed-navigation button.active { color: var(--accent-primary); background: var(--bg-selected); }.collapsed-dot { width: 8px; height: 8px; border-radius: 50%; }
</style>

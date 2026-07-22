<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, toRaw } from 'vue'
import ProjectList from '../features/projects/components/WorkspaceSidebar.vue'
import ProjectDetail from '../features/projects/components/ProjectDetail.vue'
import LogConsole from '../features/terminal/components/LogConsole.vue'
import Terminal from '../features/terminal/components/Terminal.vue'
import Header from '../shared/window/AppHeader.vue'
import Toast from '../shared/ui/Toast.vue'
import ErrorAnalysisDialog from '../features/error-analysis/ErrorAnalysisDialog.vue'
import type { Project, AppConfig, Folder, ProcessStatus, ErrorAnalysis } from '../shared/types'

// 状态
const config = ref<AppConfig | null>(null)
const nodeVersion = ref<string | null>(null)
const nodeVersions = ref<string[]>([])
const currentNodeVersion = ref<string | null>(null)
const switchingVersion = ref(false)
const selectedProjectId = ref<string | null>(null)
const processStatuses = ref<Record<string, ProcessStatus>>({})
const activeTab = ref<'logs' | 'terminal'>('logs')
const toastMessage = ref('')
const toastType = ref<'success' | 'error' | 'warning'>('error')

// 错误分析状态
const errorAnalysis = ref<ErrorAnalysis | null>(null)
const showErrorAnalysis = ref(false)

// 侧边栏状态
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(parseInt(localStorage.getItem('sidebarWidth') || '260', 10))
const isResizing = ref(false)
const logConsoleRef = ref<InstanceType<typeof LogConsole> | null>(null)

// 清理函数
let cleanupStatus: (() => void) | null = null

// 计算属性
const selectedProject = computed(() => {
  if (!selectedProjectId.value || !config.value) return null
  return config.value.projects.find(p => p.id === selectedProjectId.value) || null
})

const currentStatus = computed(() => {
  if (!selectedProjectId.value) return null
  return processStatuses.value[selectedProjectId.value] || null
})

// 方法
async function loadConfig() {
  config.value = await window.electronAPI.getConfig()
  if (config.value?.projects.length && !selectedProjectId.value) {
    selectedProjectId.value = config.value.projects[0].id
  }
}

async function loadNodeVersion() {
  const result = await window.electronAPI.getNodeVersion()
  nodeVersion.value = result.version
}

async function loadNodeVersions() {
  const result = await window.electronAPI.getNodeVersions()
  nodeVersions.value = result.versions
  currentNodeVersion.value = result.current
}

function selectProject(id: string) {
  selectedProjectId.value = id
}

function startEditProject(id: string) {
  selectedProjectId.value = id
  editTrigger.value = Date.now()
}

const editTrigger = ref(0)

async function addProject(project: Project) {
  await window.electronAPI.addProject(project)
  await loadConfig()
  selectedProjectId.value = project.id
}

async function updateProject(project: Project) {
  await window.electronAPI.updateProject(project)
  await loadConfig()
}

async function deleteProject(id: string) {
  await window.electronAPI.deleteProject(id)
  await loadConfig()
  if (selectedProjectId.value === id) {
    selectedProjectId.value = config.value?.projects[0]?.id || null
  }
}

async function reorderProjects(ids: string[]) {
  await window.electronAPI.reorderProjects(ids)
  await loadConfig()
}

async function toggleFavorite(id: string) {
  await window.electronAPI.toggleFavorite(id)
  await loadConfig()
}

async function addFolder(folder: Folder) {
  await window.electronAPI.addFolder(folder)
  await loadConfig()
}

async function reorderFolders(ids: string[]) {
  await window.electronAPI.reorderFolders(ids)
  await loadConfig()
}

async function deleteFolder(id: string) {
  await window.electronAPI.deleteFolder(id)
  await loadConfig()
}

async function renameFolder(folder: Folder) {
  await window.electronAPI.updateFolder(folder)
  await loadConfig()
}

async function moveToFolder(projectId: string, folderId: string | null) {
  await window.electronAPI.moveProjectToFolder(projectId, folderId)
  await loadConfig()
}

async function startProject() {
  const project = selectedProject.value
  if (!project) return
  await window.electronAPI.startProject(project.id, project.path, project.command, project.nodeVersion)
}

async function stopProject() {
  const project = selectedProject.value
  if (!project) return
  await window.electronAPI.stopProject(project.id)
}

function handleStatus(status: ProcessStatus) {
  processStatuses.value[status.projectId] = status
}

function handleErrorAnalysis(analysis: ErrorAnalysis) {
  errorAnalysis.value = analysis
  showErrorAnalysis.value = true
}

function closeErrorAnalysis() {
  showErrorAnalysis.value = false
  errorAnalysis.value = null
}

async function openLogDir(projectId: string) {
  await window.electronAPI.openLogDir(projectId)
}

async function handleAnalyzeErrors() {
  if (!selectedProjectId.value) return
  const status = processStatuses.value[selectedProjectId.value]
  const exitCode = status?.exitCode ?? 1
  const result = await window.electronAPI.analyzeErrors(selectedProjectId.value, exitCode)
  if (result) {
    errorAnalysis.value = result
    showErrorAnalysis.value = true
  }
}

function handleExportResult(success: boolean, message: string) {
  showToast(message, success ? 'success' : 'error')
}

// Node 版本切换
async function handleNodeVersionChanged() {
  await loadNodeVersion()
}

async function switchNodeVersion(version: string) {
  switchingVersion.value = true
  const result = await window.electronAPI.switchNodeVersion(version)
  switchingVersion.value = false
  if (result.success) {
    const v = version.startsWith('v') ? version : 'v' + version
    nodeVersion.value = v
    currentNodeVersion.value = v
    toastType.value = 'success'
    toastMessage.value = `已切换到 Node ${v}`
  } else {
    toastType.value = 'error'
    toastMessage.value = '切换失败: ' + (result.error || '未知错误')
  }
}

// 批量操作
async function startAllProjects() {
  if (!config.value) return
  const projects = config.value.projects.map(p => ({ id: p.id, path: p.path, command: p.command, nodeVersion: p.nodeVersion }))
  const result = await window.electronAPI.startAllProjects(projects)
  if (result.failed > 0) {
    toastType.value = 'warning'
    toastMessage.value = `已启动 ${result.success} 个项目，${result.failed} 个失败`
  } else {
    toastType.value = 'success'
    toastMessage.value = `已启动 ${result.success} 个项目`
  }
}

async function stopAllProjects() {
  await window.electronAPI.stopAllProjects()
  toastType.value = 'success'
  toastMessage.value = '已停止所有项目'
}

// Toast 显示
function showToast(message: string, type: 'success' | 'error' | 'warning') {
  toastMessage.value = message
  toastType.value = type
}

// 设置项目 Node 版本
async function setProjectNodeVersion(projectId: string, version: string | null) {
  if (!config.value) return
  const project = config.value.projects.find(p => p.id === projectId)
  if (!project) return
  if (version) {
    project.nodeVersion = version
  } else {
    delete project.nodeVersion
  }
  await window.electronAPI.updateProject(toRaw(project))
  await loadConfig()
}

async function refreshVersions() {
  await Promise.all([loadNodeVersion(), loadNodeVersions()])
}

// 获取项目状态颜色（折叠态指示器用）
function getStatusColor(projectId: string): string {
  const status = processStatuses.value[projectId]
  if (status?.status === 'running') return 'var(--success)'
  if (status?.status === 'error') return 'var(--error)'
  return 'var(--text-tertiary)'
}

// 侧边栏折叠
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// 侧边栏拖拽调整宽度
function onResizeStart(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  function onMouseMove(ev: MouseEvent) {
    const newWidth = startWidth + (ev.clientX - startX)
    sidebarWidth.value = Math.min(500, Math.max(180, newWidth))
  }

  function onMouseUp() {
    isResizing.value = false
    localStorage.setItem('sidebarWidth', String(sidebarWidth.value))
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// 主题切换
async function toggleTheme() {
  if (!config.value) return
  const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
  const nextTheme = themes[(themes.indexOf(config.value.theme) + 1) % themes.length]
  config.value.theme = nextTheme
  applyTheme(nextTheme)
  await window.electronAPI.saveConfig(toRaw(config.value))
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  let effectiveTheme = theme
  if (theme === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.setAttribute('data-theme', effectiveTheme)
  window.electronAPI.setNativeTheme(theme)
}

// 生命周期
onMounted(async () => {
  await Promise.all([loadConfig(), loadNodeVersion(), loadNodeVersions()])
  applyTheme(config.value?.theme || 'system')

  cleanupStatus = window.electronAPI.onProcessStatus(handleStatus)

  // 监听错误分析事件
  window.electronAPI.onErrorAnalysis?.(handleErrorAnalysis)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (config.value?.theme === 'system') {
      applyTheme('system')
    }
  })
})

onUnmounted(() => {
  cleanupStatus?.()
})

watch(() => config.value?.theme, (theme) => {
  if (theme) applyTheme(theme)
})
</script>

<template>
  <div class="h-screen flex flex-col bg-base">
    <Toast :message="toastMessage" :type="toastType" />
    <ErrorAnalysisDialog
      :visible="showErrorAnalysis"
      :analysis="errorAnalysis"
      @close="closeErrorAnalysis"
      @open-log-dir="openLogDir"
    />
    <Header
      :node-version="nodeVersion"
      :available-versions="nodeVersions"
      :current-version="currentNodeVersion"
      :switching="switchingVersion"
      :theme="config?.theme || 'system'"
      @toggle-theme="toggleTheme"
      @switch-version="switchNodeVersion"
      @refresh-versions="refreshVersions"
    />
    <main class="flex-1 flex overflow-hidden">
      <aside
        class="sidebar min-w-0 border-r border-border flex flex-col overflow-hidden relative"
        :class="{ collapsed: sidebarCollapsed, resizing: isResizing }"
        :style="{ width: sidebarCollapsed ? '' : sidebarWidth + 'px' }"
      >
        <ProjectList
          v-show="!sidebarCollapsed"
          :projects="config?.projects || []"
          :folders="config?.folders || []"
          :selected-id="selectedProjectId"
          :statuses="processStatuses"
          @select="selectProject"
          @add="addProject"
          @reorder="reorderProjects"
          @edit="startEditProject"
          @delete="deleteProject"
          @toggle-favorite="toggleFavorite"
          @add-folder="addFolder"
          @reorder-folders="reorderFolders"
          @delete-folder="deleteFolder"
          @rename-folder="renameFolder"
          @move-to-folder="moveToFolder"
          @start-all="startAllProjects"
          @stop-all="stopAllProjects"
        />
        <!-- 折叠态指示器 -->
        <div v-if="sidebarCollapsed" class="flex-1 flex flex-col items-center gap-1 py-3.5 pb-2 overflow-y-auto overflow-x-hidden">
          <div
            v-for="project in (config?.projects || [])"
            :key="project.id"
            :class="['w-1.5 h-1.5 rounded-full cursor-pointer transition-all duration-180 ease-out shrink-0 opacity-45 indicator-dot', { active: selectedProjectId === project.id }]"
            :style="{ background: getStatusColor(project.id) }"
            :title="project.name"
            @click="selectProject(project.id)"
          ></div>
        </div>
        <!-- 折叠切换按钮 -->
        <button class="absolute -right-3.25 top-1/2 -translate-y-1/2 w-6.5 h-6.5 flex items-center justify-center bg-surface border border-border rounded-full text-ttertiary z-10 shadow-xs opacity-0 transition-all duration-200 ease-out sidebar-toggle" @click="toggleSidebar" :title="sidebarCollapsed ? '展开侧栏' : '收起侧栏'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline :points="sidebarCollapsed ? '9 6 15 12 9 18' : '15 6 9 12 15 18'"/>
          </svg>
        </button>
      </aside>
      <!-- 拖拽调整宽度手柄 -->
      <div
        v-if="!sidebarCollapsed"
        class="w-0.75 -ml-px cursor-col-resize relative z-5 shrink-0 resize-handle"
        :class="{ active: isResizing }"
        @mousedown="onResizeStart"
      ></div>
      <section class="flex-1 flex flex-col overflow-hidden bg-base">
        <template v-if="selectedProject">
          <ProjectDetail
            :project="selectedProject"
            :status="currentStatus"
            :edit-trigger="editTrigger"
            :node-versions="nodeVersions"
            :global-node-version="nodeVersion"
            @update="updateProject"
            @delete="deleteProject"
            @start="startProject"
            @stop="stopProject"
            @clear-logs="logConsoleRef?.clear()"
            @toast="showToast"
            @set-node-version="setProjectNodeVersion"
          />
          <div class="flex-1 flex flex-col min-h-50 overflow-hidden">
            <div class="flex border-b border-border bg-surface px-3.5 relative panel-tabs">
              <button
                :class="['px-4 py-2 text-[11px] font-medium text-ttertiary border-b-2 border-transparent transition-all duration-200 ease-out tracking-[0.3px] panel-tab', { active: activeTab === 'logs' }]"
                @click="activeTab = 'logs'"
              >日志</button>
              <button
                :class="['px-4 py-2 text-[11px] font-medium text-ttertiary border-b-2 border-transparent transition-all duration-200 ease-out tracking-[0.3px] panel-tab', { active: activeTab === 'terminal' }]"
                @click="activeTab = 'terminal'"
              >终端</button>
            </div>
            <div class="flex-1 flex flex-col overflow-hidden relative">
              <div v-show="activeTab === 'logs'" class="absolute inset-0 flex flex-col">
                <LogConsole
                  ref="logConsoleRef"
                  :is-running="currentStatus?.status === 'running'"
                  :project-id="selectedProjectId || ''"
                  :has-error="currentStatus?.status === 'error'"
                  :has-logs="currentStatus?.status === 'running' || currentStatus?.status === 'error'"
                  @analyze-errors="handleAnalyzeErrors"
                  @export-result="handleExportResult"
                />
              </div>
              <div class="absolute inset-0 flex flex-col" :class="{ 'invisible pointer-events-none': activeTab !== 'terminal' }">
                <Terminal
                  :id="'pty-' + selectedProject.id"
                  :cwd="selectedProject.path"
                  :visible="activeTab === 'terminal'"
                  :node-version="selectedProject.nodeVersion"
                />
              </div>
            </div>
          </div>
        </template>
        <div v-else class="flex-1 flex flex-col items-center justify-center text-ttertiary animate-fade-in">
          <div class="w-12 h-12 mb-3.5 opacity-30 text-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-full h-full">
              <path d="M3 16l4-4m0 0l4 4m4-4m4 4m4-4m4 4" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 20h18" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="text-[13px] tracking-[0.2px]">选择或添加项目开始使用</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.sidebar {
  background: var(--sidebar-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  transition: width 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar.resizing {
  transition: none !important;
}

.sidebar.collapsed {
  width: 40px;
  align-items: center;
}

.sidebar::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--sidebar-border);
  pointer-events: none;
}

.indicator-dot:hover {
  transform: scale(1.6);
  opacity: 1;
}

.indicator-dot.active {
  width: 4px;
  height: 16px;
  border-radius: 2px;
  opacity: 1;
  box-shadow: 0 0 10px var(--accent-glow);
}

.sidebar:hover .sidebar-toggle,
.sidebar.collapsed .sidebar-toggle {
  opacity: 0.7;
}

.sidebar-toggle:hover {
  opacity: 1 !important;
  color: var(--accent-primary);
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.resize-handle:hover,
.resize-handle.active {
  background: var(--border-strong);
  border-radius: 1.5px;
}

.resize-handle.active {
  background: var(--text-tertiary);
}

.panel-tabs::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--header-glow);
  pointer-events: none;
}

.panel-tab:hover {
  color: var(--text-secondary);
}

.panel-tab.active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
  text-shadow: 0 0 8px var(--accent-glow);
}

.sidebar :deep(.search-input) {
  border-radius: 8px;
}
</style>

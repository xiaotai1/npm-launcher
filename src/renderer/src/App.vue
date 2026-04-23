<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, toRaw } from 'vue'
import ProjectList from './components/ProjectList.vue'
import ProjectDetail from './components/ProjectDetail.vue'
import LogConsole from './components/LogConsole.vue'
import Terminal from './components/Terminal.vue'
import Header from './components/Header.vue'
import Toast from './components/Toast.vue'
import type { Project, AppConfig, Folder, ProcessStatus, LogEntry } from './types'

// 状态
const config = ref<AppConfig | null>(null)
const nodeVersion = ref<string | null>(null)
const nodeVersions = ref<string[]>([])
const currentNodeVersion = ref<string | null>(null)
const switchingVersion = ref(false)
const selectedProjectId = ref<string | null>(null)
const processStatuses = ref<Record<string, ProcessStatus>>({})
const projectLogs = ref<Record<string, LogEntry[]>>({})
const activeTab = ref<'logs' | 'terminal'>('logs')
const toastMessage = ref('')
const toastType = ref<'success' | 'error' | 'warning'>('error')

// 侧边栏状态
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(parseInt(localStorage.getItem('sidebarWidth') || '260', 10))
const isResizing = ref(false)

// 清理函数
let cleanupLog: (() => void) | null = null
let cleanupStatus: (() => void) | null = null

// 计算属性
const selectedProject = computed(() => {
  if (!selectedProjectId.value || !config.value) return null
  return config.value.projects.find(p => p.id === selectedProjectId.value) || null
})

const currentLogs = computed(() => {
  if (!selectedProjectId.value) return []
  return projectLogs.value[selectedProjectId.value] || []
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
  // 触发 ProjectDetail 进入编辑模式 —— 通过临时设置一个标记
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
  projectLogs.value[project.id] = []
  await window.electronAPI.startProject(project.id, project.path, project.command, project.nodeVersion)
}

async function stopProject() {
  const project = selectedProject.value
  if (!project) return
  await window.electronAPI.stopProject(project.id)
}

function clearLogs() {
  if (selectedProjectId.value) {
    projectLogs.value[selectedProjectId.value] = []
  }
}

function handleLog(log: LogEntry) {
  if (!projectLogs.value[log.projectId]) {
    projectLogs.value[log.projectId] = []
  }
  projectLogs.value[log.projectId].push(log)
}

function handleStatus(status: ProcessStatus) {
  processStatuses.value[status.projectId] = status
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
    // 信任切换结果，直接更新 UI
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
  const currentIndex = themes.indexOf(config.value.theme)
  const nextTheme = themes[(currentIndex + 1) % themes.length]
  config.value.theme = nextTheme
  await window.electronAPI.saveConfig(toRaw(config.value))
  applyTheme(nextTheme)
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  let effectiveTheme = theme
  if (theme === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.setAttribute('data-theme', effectiveTheme)
  window.electronAPI.setNativeTheme(theme)
  window.electronAPI.setTitlebarOverlay(effectiveTheme as 'light' | 'dark')
}

// 生命周期
onMounted(async () => {
  await Promise.all([loadConfig(), loadNodeVersion(), loadNodeVersions()])
  applyTheme(config.value?.theme || 'system')

  cleanupLog = window.electronAPI.onLogData(handleLog)
  cleanupStatus = window.electronAPI.onProcessStatus(handleStatus)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (config.value?.theme === 'system') {
      applyTheme('system')
    }
  })
})

onUnmounted(() => {
  cleanupLog?.()
  cleanupStatus?.()
})

watch(() => config.value?.theme, (theme) => {
  if (theme) applyTheme(theme)
})
</script>

<template>
  <div class="app-container">
    <Toast :message="toastMessage" :type="toastType" />
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
    <main class="main-content">
      <aside
        class="sidebar"
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
        <div v-if="sidebarCollapsed" class="collapsed-indicators">
          <div
            v-for="project in (config?.projects || [])"
            :key="project.id"
            :class="['indicator-dot', { active: selectedProjectId === project.id }]"
            :style="{ background: getStatusColor(project.id) }"
            :title="project.name"
            @click="selectProject(project.id)"
          ></div>
        </div>
        <!-- 折叠切换按钮 -->
        <button class="sidebar-toggle" @click="toggleSidebar" :title="sidebarCollapsed ? '展开侧栏' : '收起侧栏'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline :points="sidebarCollapsed ? '9 6 15 12 9 18' : '15 6 9 12 15 18'"/>
          </svg>
        </button>
      </aside>
      <!-- 拖拽调整宽度手柄 -->
      <div
        v-if="!sidebarCollapsed"
        class="resize-handle"
        :class="{ active: isResizing }"
        @mousedown="onResizeStart"
      ></div>
      <section class="content">
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
            @clear-logs="clearLogs"
            @toast="showToast"
            @set-node-version="setProjectNodeVersion"
          />
          <div class="bottom-panel">
            <div class="panel-tabs">
              <button
                :class="['panel-tab', { active: activeTab === 'logs' }]"
                @click="activeTab = 'logs'"
              >日志</button>
              <button
                :class="['panel-tab', { active: activeTab === 'terminal' }]"
                @click="activeTab = 'terminal'"
              >终端</button>
            </div>
            <div class="panel-content">
              <div v-show="activeTab === 'logs'" class="panel-layer">
                <LogConsole
                  :logs="currentLogs"
                  :is-running="currentStatus?.status === 'running'"
                />
              </div>
              <div class="panel-layer" :class="{ 'layer-hidden': activeTab !== 'terminal' }">
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
        <div v-else class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 16l4-4m0 0l4 4m4-4m4 4m4-4m4 4" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 20h18" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="empty-text">选择或添加项目开始使用</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar{
  width: 260px;
  min-width: 0;
  border-right: 1px solid var(--border-default);
  background: var(--sidebar-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  transition: width 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* 拖拽时禁用过渡动画，消除卡顿 */
.sidebar.resizing{
  transition: none !important;
}

.sidebar.collapsed{
  width: 40px;
  align-items: center;
}

.sidebar::after{
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--sidebar-border);
  pointer-events: none;
}

/* 折叠态指示器 */
.collapsed-indicators{
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 0 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

.indicator-dot{
  width: 6px;
  height: 6px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 180ms ease;
  flex-shrink: 0;
  opacity: 0.45;
}

.indicator-dot:hover{
  transform: scale(1.6);
  opacity: 1;
}

.indicator-dot.active{
  width: 4px;
  height: 16px;
  border-radius: 2px;
  opacity: 1;
  box-shadow: 0 0 10px var(--accent-glow);
}

/* 折叠切换按钮 */
.sidebar-toggle{
  position: absolute;
  right: -13px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 50%;
  color: var(--text-tertiary);
  z-index: 10;
  box-shadow: var(--shadow-sm);
  opacity: 0;
  transition: all 200ms ease;
}

.sidebar:hover .sidebar-toggle,
.sidebar.collapsed .sidebar-toggle{
  opacity: 0.7;
}

.sidebar-toggle:hover{
  opacity: 1 !important;
  color: var(--accent-primary);
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

/* 拖拽调整宽度手柄 */
.resize-handle{
  width: 3px;
  margin-left: -1px;
  cursor: col-resize;
  position: relative;
  z-index: 5;
  flex-shrink: 0;
}

.resize-handle:hover,
.resize-handle.active{
  background: var(--border-strong);
  border-radius: 1.5px;
}

.resize-handle.active{
  background: var(--text-tertiary);
}

.content{
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-base);
}

.empty-state{
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.empty-icon{
  width: 48px;
  height: 48px;
  margin-bottom: 14px;
  opacity: 0.3;
  color: var(--accent-primary);
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-text{
  font-size: 13px;
  letter-spacing: 0.2px;
}

/* 底部面板 */
.bottom-panel{
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px;
  overflow: hidden;
}

.panel-tabs{
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-surface);
  padding: 0 14px;
  position: relative;
}

.panel-tabs::after{
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--header-glow);
  pointer-events: none;
}

.panel-tab{
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  border-bottom: 2px solid transparent;
  transition: all 200ms ease;
  letter-spacing: 0.3px;
}

.panel-tab:hover{
  color: var(--text-secondary);
}

.panel-tab.active{
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
  text-shadow: 0 0 8px var(--accent-glow);
}

.panel-content{
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.panel-layer{
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}

.panel-layer.layer-hidden{
  visibility: hidden;
  pointer-events: none;
}

/* 搜索框样式覆盖 */
.sidebar :deep(.search-input){
  border-radius: 8px;
}
</style>

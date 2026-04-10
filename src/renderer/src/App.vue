<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, toRaw } from 'vue'
import ProjectList from './components/ProjectList.vue'
import ProjectDetail from './components/ProjectDetail.vue'
import LogConsole from './components/LogConsole.vue'
import Terminal from './components/Terminal.vue'
import Header from './components/Header.vue'
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
const showTerminal = ref(false)
const activeTab = ref<'logs' | 'terminal'>('logs')

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
  await window.electronAPI.startProject(project.id, project.path, project.command)
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
    await Promise.all([loadNodeVersion(), loadNodeVersions()])
  } else {
    alert('切换失败: ' + (result.error || '未知错误'))
  }
}

async function refreshVersions() {
  await Promise.all([loadNodeVersion(), loadNodeVersions()])
}

function openTerminalWithCommand(command: string) {
  activeTab.value = 'terminal'
  // 等终端可见后发送命令
  setTimeout(() => {
    window.electronAPI.ptyWrite('pty-' + (selectedProjectId.value || ''), command + '\r')
  }, 300)
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
      <aside class="sidebar">
        <ProjectList
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
        />
      </aside>
      <section class="content">
        <template v-if="selectedProject">
          <ProjectDetail
            :project="selectedProject"
            :status="currentStatus"
            :edit-trigger="editTrigger"
            @update="updateProject"
            @delete="deleteProject"
            @start="startProject"
            @stop="stopProject"
            @clear-logs="clearLogs"
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
              <div v-if="activeTab === 'terminal' && selectedProject" class="panel-layer">
                <Terminal
                  :id="'pty-' + selectedProject.id"
                  :cwd="selectedProject.path"
                  :visible="activeTab === 'terminal'"
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
  border-right: 1px solid var(--border-default);
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
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
</style>

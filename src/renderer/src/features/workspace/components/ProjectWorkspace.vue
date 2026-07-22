<script setup lang="ts">
import type { ProcessStatus, Project } from '../../../shared/types'
import ProjectInfoPanel from '../../projects/components/ProjectInfoPanel.vue'
import LogConsole from '../../terminal/components/LogConsole.vue'
import Terminal from '../../terminal/components/Terminal.vue'
import ProjectContextBar from './ProjectContextBar.vue'

const props = defineProps<{
  project: Project
  status: ProcessStatus | null
  activeTab: 'logs' | 'terminal' | 'info'
  editTrigger: number
  nodeVersions: string[]
  globalNodeVersion: string | null
}>()

const emit = defineEmits<{
  'update:activeTab': [tab: 'logs' | 'terminal' | 'info']
  update: [project: Project]
  delete: [id: string]
  start: []
  stop: []
  edit: []
  toast: [message: string, type: 'success' | 'error' | 'warning']
  'set-node-version': [projectId: string, version: string | null]
  'analyze-errors': []
  'export-result': [success: boolean, message: string]
}>()

async function openFolder() {
  const result = await window.electronAPI.openInFileManager(props.project.path)
  if (!result.success) emit('toast', result.error || '打开文件夹失败', 'error')
}

async function openInVscode() {
  const result = await window.electronAPI.openInVscode(props.project.path)
  if (!result.success) emit('toast', result.error || '未找到 VS Code', 'warning')
}

function editProject() {
  emit('update:activeTab', 'info')
  emit('edit')
}
</script>

<template>
  <section class="project-workspace">
    <ProjectContextBar
      :project="project"
      :status="status"
      :global-node-version="globalNodeVersion"
      @start="emit('start')"
      @stop="emit('stop')"
      @edit="editProject"
      @open-folder="openFolder"
      @open-vscode="openInVscode"
    />
    <nav class="workspace-tabs" aria-label="项目工作区">
      <button :class="{ active: activeTab === 'logs' }" @click="emit('update:activeTab', 'logs')">运行日志</button>
      <button :class="{ active: activeTab === 'terminal' }" @click="emit('update:activeTab', 'terminal')">交互终端</button>
      <button :class="{ active: activeTab === 'info' }" @click="emit('update:activeTab', 'info')">项目信息</button>
    </nav>
    <div class="workspace-panels">
      <div v-show="activeTab === 'logs'" class="workspace-panel">
        <LogConsole
          :is-running="status?.status === 'running'"
          :project-id="project.id"
          :has-error="status?.status === 'error'"
          :has-logs="status?.status === 'running' || status?.status === 'error'"
          @analyze-errors="emit('analyze-errors')"
          @export-result="(success, message) => emit('export-result', success, message)"
        />
      </div>
      <div class="workspace-panel" :class="{ hidden: activeTab !== 'terminal' }">
        <Terminal :id="`pty-${project.id}`" :cwd="project.path" :visible="activeTab === 'terminal'" :node-version="project.nodeVersion" />
      </div>
      <div v-show="activeTab === 'info'" class="workspace-panel info-panel">
        <ProjectInfoPanel
          :project="project"
          :edit-trigger="editTrigger"
          :node-versions="nodeVersions"
          :global-node-version="globalNodeVersion"
          @update="emit('update', $event)"
          @delete="emit('delete', $event)"
          @toast="(message, type) => emit('toast', message, type)"
          @set-node-version="(id, version) => emit('set-node-version', id, version)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.project-workspace { height: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-app); }
.workspace-tabs { height: 40px; display: flex; align-items: end; gap: 4px; padding: 0 14px; border-bottom: 1px solid var(--border-default); background: var(--bg-surface); }
.workspace-tabs button { height: 40px; padding: 0 13px; border-bottom: 2px solid transparent; color: var(--text-tertiary); font-size: 12px; font-weight: 650; }.workspace-tabs button:hover { color: var(--text-primary); }.workspace-tabs button.active { color: var(--accent-primary); border-bottom-color: var(--accent-primary); }
.workspace-panels { position: relative; flex: 1; min-height: 0; overflow: hidden; }.workspace-panel { position: absolute; inset: 0; display: flex; flex-direction: column; }.workspace-panel.hidden { visibility: hidden; pointer-events: none; }.info-panel { overflow-y: auto; background: var(--bg-app); }.info-panel :deep(.detail) { max-width: 860px; width: calc(100% - 40px); margin: 20px auto; border: 1px solid var(--border-default); border-radius: 12px; box-shadow: var(--shadow-card); }
</style>

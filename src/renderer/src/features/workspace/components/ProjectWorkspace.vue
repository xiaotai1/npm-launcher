<script setup lang="ts">
import type { ProcessStatus, Project } from '../../../shared/types'
import ProjectInfoPanel from '../../projects/components/ProjectInfoPanel.vue'
import LogConsole from '../../terminal/components/LogConsole.vue'
import Terminal from '../../terminal/components/Terminal.vue'
import ProjectContextBar from './ProjectContextBar.vue'

const props = defineProps<{
  project: Project
  projects: Project[]
  visible: boolean
  status: ProcessStatus | null
  activeTab: 'logs' | 'terminal' | 'info'
  editTrigger: number
  nodeVersions: string[]
  globalNodeVersion: string | null
  localUrl: string | null
  launching: boolean
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
  'set-command': [projectId: string, command: string]
  'open-url': [url: string]
  'analyze-errors': []
  'export-result': [success: boolean, message: string]
}>()

async function openFolder() {
  const result = await window.desktopAPI.openInFileManager(props.project.path)
  if (!result.success) emit('toast', result.error || '打开文件夹失败', 'error')
}

async function openInVscode() {
  const result = await window.desktopAPI.openInVscode(props.project.path)
  if (!result.success) emit('toast', result.error || '未找到 VS Code', 'warning')
}

function editProject() {
  emit('update:activeTab', 'info')
  emit('edit')
}

function selectTab(tab: 'logs' | 'terminal' | 'info') {
  emit('update:activeTab', tab)
}
</script>

<template>
  <section class="project-workspace">
    <ProjectContextBar
      :project="project"
      :status="status"
      :global-node-version="globalNodeVersion"
      :local-url="localUrl"
      :launching="launching"
      @start="emit('start')"
      @stop="emit('stop')"
      @edit="editProject"
      @open-folder="openFolder"
      @open-vscode="openInVscode"
      @open-url="emit('open-url', $event)"
      @set-command="command => emit('set-command', project.id, command)"
    />
    <nav class="workspace-tabs workspace-tab-strip" role="tablist" aria-label="项目工作区">
      <button id="logs-workspace-tab" role="tab" :aria-selected="activeTab === 'logs'" aria-controls="logs-workspace-panel" :class="{ active: activeTab === 'logs' }" @click="selectTab('logs')">运行日志</button>
      <button id="terminal-workspace-tab" role="tab" :aria-selected="activeTab === 'terminal'" aria-controls="terminal-workspace-panel" :class="{ active: activeTab === 'terminal' }" @click="selectTab('terminal')">交互终端</button>
      <button id="info-workspace-tab" role="tab" :aria-selected="activeTab === 'info'" aria-controls="info-workspace-panel" :class="{ active: activeTab === 'info' }" @click="selectTab('info')">项目设置</button>
    </nav>
    <div class="workspace-panels">
      <div id="logs-workspace-panel" v-show="activeTab === 'logs'" class="workspace-panel" role="tabpanel" aria-labelledby="logs-workspace-tab">
        <LogConsole
          :is-running="status?.status === 'running'"
          :project-id="project.id"
          :has-error="status?.status === 'error'"
          :has-logs="status?.status === 'running' || status?.status === 'error'"
          :project="project"
          :node-version="globalNodeVersion"
          @analyze-errors="emit('analyze-errors')"
          @start="emit('start')"
          @export-result="(success, message) => emit('export-result', success, message)"
        />
      </div>
      <div id="terminal-workspace-panel" class="workspace-panel" :class="{ hidden: activeTab !== 'terminal' }" role="tabpanel" aria-labelledby="terminal-workspace-tab">
        <Terminal
          v-for="terminalProject in projects"
          v-show="terminalProject.id === project.id"
          :id="`pty-${terminalProject.id}`"
          :key="terminalProject.id"
          :cwd="terminalProject.path"
          :visible="visible && activeTab === 'terminal' && terminalProject.id === project.id"
          :node-version="terminalProject.nodeVersion"
        />
      </div>
      <div id="info-workspace-panel" v-show="activeTab === 'info'" class="workspace-panel info-panel" role="tabpanel" aria-labelledby="info-workspace-tab">
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
.project-workspace { height: 100%; display: flex; flex-direction: column; overflow: hidden; background: transparent; }

.workspace-tabs { min-height: 46px; display: flex; align-items: stretch; gap: 2px; padding: 6px 14px 0; background: var(--glass-fill); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); border-bottom: 1px solid var(--glass-border); position: relative; }

.workspace-tabs button { position: relative; min-height: 40px; padding: 0 14px; border: 1px solid transparent; border-radius: 8px 8px 0 0; color: var(--text-tertiary); font-size: 13px; font-weight: 650; transition: color 160ms ease, background 160ms ease; }

.workspace-tabs button::after { content: ''; position: absolute; left: 10px; right: 10px; bottom: 0; height: 2px; border-radius: 2px 2px 0 0; background: var(--accent-primary); opacity: 0; transform: scaleX(0.6); transition: opacity 180ms ease, transform 180ms cubic-bezier(0.16, 1, 0.3, 1); }

.workspace-tabs button:hover { color: var(--text-primary); background: var(--glass-fill-hover); }

.workspace-tabs button:hover::after { opacity: 0.35; transform: scaleX(1); }

.workspace-tabs button.active { color: var(--accent-primary); background: var(--glass-fill-strong); }

.workspace-tabs button.active::after { opacity: 1; transform: scaleX(1); }

.workspace-panels { position: relative; flex: 1; min-height: 0; overflow: hidden; }
.workspace-panel { position: absolute; inset: 0; display: flex; flex-direction: column; }
.workspace-panel.hidden { visibility: hidden; pointer-events: none; }
.info-panel { overflow-y: auto; background: transparent; }
.info-panel :deep(.settings-page) { flex: none; width: 100%; min-height: 100%; }

/* 和全局滚动条保持一致 */
.workspace-panels ::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

.workspace-panels ::-webkit-scrollbar-track {
  background: transparent;
}

.workspace-panels ::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 10px;
}

.workspace-panels ::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
</style>

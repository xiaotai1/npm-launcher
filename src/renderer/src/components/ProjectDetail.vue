<script setup lang="ts">
import { ref, watch, toRaw } from 'vue'
import type { Project, ProcessStatus } from '../types'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps<{
  project: Project
  status: ProcessStatus | null
  editTrigger?: number
  nodeVersions: string[]
  globalNodeVersion: string | null
}>()

const emit = defineEmits<{
  update: [project: Project]
  delete: [id: string]
  start: []
  stop: []
  'clear-logs': []
  toast: [message: string, type: 'success' | 'error' | 'warning']
  'set-node-version': [projectId: string, version: string | null]
}>()

const isEditing = ref(false)
const editForm = ref({ ...props.project })
const editScripts = ref<string[]>([])
const isRunning = () => props.status?.status === 'running'
const showDeleteConfirm = ref(false)

watch(() => props.project, (p) => {
  editForm.value = { ...p }
  isEditing.value = false
})

watch(() => props.editTrigger, (val) => {
  if (val && val > 0) {
    editForm.value = { ...props.project }
    isEditing.value = true
  }
})

watch(isEditing, async (val) => {
  if (val && editForm.value.path) {
    const result = await window.electronAPI.getPackageScripts(editForm.value.path)
    editScripts.value = result.scripts
  } else {
    editScripts.value = []
  }
})

async function selectFolder() {
  const result = await window.electronAPI.selectFolder()
  if (result.canceled || !result.path) return
  editForm.value.path = result.path
  // 自动用文件夹名作为项目名称
  if (!editForm.value.name) {
    const parts = result.path.replace(/\\/g, '/').split('/')
    editForm.value.name = parts[parts.length - 1] || ''
  }
  // 读取 scripts
  editForm.value.command = ''
  const scripts = await window.electronAPI.getPackageScripts(result.path)
  editScripts.value = scripts.scripts
  if (scripts.scripts.length > 0) {
    editForm.value.command = scripts.scripts[0]
  }
}

function save() {
  emit('update', toRaw(editForm.value))
  isEditing.value = false
}

function cancelEdit() {
  editForm.value = { ...props.project }
  editScripts.value = []
  isEditing.value = false
}

function remove() {
  showDeleteConfirm.value = true
}

function onConfirmDelete() {
  emit('delete', props.project.id)
  showDeleteConfirm.value = false
}

async function openFolder() {
  const result = await window.electronAPI.openInFileManager(props.project.path)
  if (!result.success) {
    emit('toast', result.error || '打开文件夹失败', 'error')
  }
}

async function openInVscode() {
  const result = await window.electronAPI.openInVscode(props.project.path)
  if (!result.success) {
    emit('toast', result.error || '未找到 VS Code', 'warning')
  }
}

const showVersionDropdown = ref(false)

function selectNodeVersion(version: string | null) {
  emit('set-node-version', props.project.id, version)
  showVersionDropdown.value = false
}
</script>

<template>
  <div class="detail">
    <template v-if="!isEditing">
      <div class="detail-header">
        <div class="detail-title-row">
          <h2 class="detail-name">{{ project.name }}</h2>
          <div :class="['status-badge', status?.status || 'stopped']">
            <span class="status-dot"></span>
            {{ status?.status === 'running' ? '运行中' : status?.status === 'error' ? '错误' : '未启动' }}
            <span v-if="status?.pid" class="pid">PID {{ status.pid }}</span>
          </div>
        </div>
        <div class="detail-actions">
          <button class="btn-ghost" @click="isEditing = true">编辑</button>
          <button class="btn-danger-ghost" @click="remove">删除</button>
        </div>
      </div>

      <div class="detail-info">
        <div class="info-item">
          <span class="info-label">路径</span>
          <span class="info-value mono" :title="project.path">{{ project.path }}</span>
          <div class="info-actions">
            <button class="btn-quick-action" @click="openFolder" title="在文件管理器中打开">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span>打开</span>
            </button>
            <button class="btn-quick-action" @click="openInVscode" title="在 VS Code 中打开">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              <span>VS Code</span>
            </button>
          </div>
        </div>
        <div class="info-item">
          <span class="info-label">命令</span>
          <span class="info-value code">npm run {{ project.command }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Node</span>
          <div class="version-selector">
            <button class="version-btn" @click="showVersionDropdown = !showVersionDropdown">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
              <span :class="['version-text', { custom: project.nodeVersion }]">{{ project.nodeVersion || '跟随系统 (' + (globalNodeVersion || '--') + ')' }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div v-if="showVersionDropdown" class="version-dropdown">
              <button :class="['version-option', { active: !project.nodeVersion }]" @click="selectNodeVersion(null)">
                跟随系统{{ globalNodeVersion ? ' (' + globalNodeVersion + ')' : '' }}
              </button>
              <div v-if="nodeVersions.length" class="version-divider"></div>
              <button
                v-for="v in nodeVersions" :key="v"
                :class="['version-option', { active: project.nodeVersion === v }]"
                @click="selectNodeVersion(v)"
              >
                <svg v-if="project.nodeVersion === v" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                <span v-else class="version-check-placeholder"></span>
                {{ v }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-toolbar">
        <div class="toolbar-primary">
          <button v-if="!isRunning()" class="btn-start" @click="emit('start')">
            <span class="btn-icon">▶</span> 启动
          </button>
          <button v-else class="btn-stop" @click="emit('stop')">
            <span class="btn-icon">■</span> 停止
          </button>
        </div>
        <button class="btn-ghost" @click="emit('clear-logs')">清空日志</button>
      </div>
    </template>

    <template v-else>
      <div class="detail-header">
        <h2 class="detail-name">编辑项目</h2>
      </div>
      <div class="edit-form">
        <div class="field">
          <label>名称</label>
          <input v-model="editForm.name" />
        </div>
        <div class="field">
          <label>路径</label>
          <div class="path-field">
            <input v-model="editForm.path" readonly class="path-input" />
            <button class="btn-browse" @click="selectFolder">浏览</button>
          </div>
        </div>
        <div class="field">
          <label>命令</label>
          <select v-model="editForm.command" class="command-select">
            <option value="" disabled>选择命令</option>
            <option v-for="script in editScripts" :key="script" :value="script">{{ script }}</option>
          </select>
          <span v-if="editScripts.length === 0 && editForm.path" class="field-hint">未找到 package.json 或无 scripts</span>
        </div>
        <div class="edit-actions">
          <button class="btn-ghost" @click="cancelEdit">取消</button>
          <button class="btn-primary" @click="save">保存</button>
        </div>
      </div>
    </template>

    <ConfirmDialog
      :visible="showDeleteConfirm"
      title="删除项目"
      :message="`确定要删除「${project.name}」吗？此操作不可撤销。`"
      confirm-text="删除"
      :danger="true"
      @confirm="onConfirmDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<style scoped>
.detail{
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-surface);
  position: relative;
}

.detail::after{
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--header-glow);
  pointer-events: none;
}

.detail-header{
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.detail-title-row{
  display: flex;
  align-items: center;
  gap: 10px;
}

.detail-name{
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}

.detail-actions{
  display: flex;
  gap: 4px;
}

.status-badge{
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
  transition: all 300ms ease;
}

.status-badge.running{
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
  box-shadow: 0 0 12px var(--success-bg);
}

.status-badge.running .status-dot{
  background: var(--success);
  animation: dotPulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 6px var(--success);
}

.status-badge.stopped{
  background: var(--bg-elevated);
  color: var(--text-tertiary);
}

.status-badge.stopped .status-dot{
  background: var(--text-tertiary);
}

.status-badge.error{
  background: var(--error-bg);
  color: var(--error);
}

.status-badge.error .status-dot{
  background: var(--error);
}

.status-dot{
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.pid{
  opacity: 0.5;
  font-weight: 400;
  font-size: 10px;
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

.detail-info{
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 18px;
}

.info-item{
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.info-label{
  width: 56px;
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value{
  font-size: 12px;
  color: var(--text-primary);
}

.info-value.mono{
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-value.code{
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  background: var(--accent-glow);
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--accent-primary);
  border: 1px solid var(--accent-border);
  transition: all 200ms ease;
}

.info-value.code:hover{
  background: rgba(59, 130, 246, 0.12);
  border-color: var(--accent-primary);
}

.detail-toolbar{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.toolbar-primary{
  display: flex;
  gap: 6px;
}

.info-actions{
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}

.btn-quick-action{
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  transition: all 200ms ease;
  white-space: nowrap;
}

.btn-quick-action:hover{
  background: var(--bg-hover);
  color: var(--accent-primary);
  border-color: var(--accent-border);
}

.btn-quick-action:active{
  transform: scale(0.97);
}

.btn-start, .btn-stop{
  padding: 7px 20px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-start{
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  box-shadow: 0 2px 12px rgba(59, 130, 246, 0.25);
}

.btn-start:hover:not(:disabled){
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.35);
  transform: translateY(-1px);
}

.btn-start:active:not(:disabled){
  transform: translateY(0);
  box-shadow: 0 1px 6px rgba(59, 130, 246, 0.2);
}

.btn-stop{
  background: linear-gradient(135deg, #dc2626, #ef4444);
  box-shadow: 0 2px 12px rgba(239, 68, 68, 0.2);
}

.btn-stop:hover:not(:disabled){
  box-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);
  transform: translateY(-1px);
}

.btn-stop:active:not(:disabled){
  transform: translateY(0);
}

.btn-icon{
  font-size: 10px;
}

.btn-ghost{
  padding: 7px 14px;
  font-size: 12px;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  transition: all 200ms ease;
}

.btn-ghost:hover{
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.btn-danger-ghost{
  padding: 7px 14px;
  font-size: 12px;
  color: var(--text-tertiary);
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 200ms ease;
}

.btn-danger-ghost:hover{
  color: var(--error);
  background: var(--error-bg);
}

.btn-primary{
  padding: 7px 20px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover));
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--accent-glow);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary:hover{
  box-shadow: 0 4px 16px var(--accent-glow);
  transform: translateY(-1px);
}

.edit-form{
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field{
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field label{
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.path-field{
  display: flex;
  gap: 6px;
}

.path-input{
  flex: 1;
  cursor: pointer;
  color: var(--text-secondary) !important;
}

.btn-browse{
  flex-shrink: 0;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-primary);
  border: 1px solid var(--accent-border);
  border-radius: 6px;
  background: transparent;
  transition: all 200ms ease;
}

.btn-browse:hover{
  background: var(--accent-glow);
  border-color: var(--accent-primary);
}

.command-select{
  cursor: pointer;
  appearance: auto;
}

.field-hint{
  font-size: 11px;
  color: var(--text-tertiary);
}

.edit-actions{
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

/* 版本选择器 */
.version-selector{
  position: relative;
}

.version-btn{
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 5px;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  transition: all 200ms ease;
}

.version-btn:hover{
  background: var(--bg-hover);
  border-color: var(--accent-border);
}

.version-text{
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
}

.version-text.custom{
  color: var(--accent-primary);
  font-weight: 600;
}

.version-dropdown{
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 4px;
  min-width: 180px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: 100;
  animation: scaleIn 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top left;
}

.version-option{
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--text-primary);
  border-radius: 5px;
  text-align: left;
  transition: all 150ms ease;
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

.version-option:hover{
  background: var(--bg-hover);
}

.version-option.active{
  color: var(--accent-primary);
  font-weight: 600;
}

.version-check-placeholder{
  width: 12px;
  height: 12px;
}

.version-divider{
  height: 1px;
  background: var(--divider);
  margin: 3px 6px;
}
</style>

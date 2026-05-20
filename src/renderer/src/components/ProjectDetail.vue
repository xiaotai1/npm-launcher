<script setup lang="ts">
import { ref, watch, toRaw, onMounted, onBeforeUnmount } from 'vue'
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

// 弹框显示时同步更新标题栏颜色为遮罩色，关闭时恢复
watch(showDeleteConfirm, (val) => {
  if (window.electronAPI.platform === 'win32') {
    window.electronAPI.updateTitlebar({
      color: val ? 'rgba(0,0,0,0.55)' : (document.documentElement.getAttribute('data-theme') !== 'light' ? '#0f172a' : '#ffffff'),
      symbolColor: val ? 'rgba(255,255,255,0.5)' : undefined
    })
  }
})

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
const versionDropdownRef = ref<HTMLElement>()

function handleClickOutside(e: MouseEvent) {
  if (showVersionDropdown.value && versionDropdownRef.value && !versionDropdownRef.value.contains(e.target as Node)) {
    showVersionDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))

function selectNodeVersion(version: string | null) {
  emit('set-node-version', props.project.id, version)
  showVersionDropdown.value = false
}
</script>

<template>
  <div class="relative px-5.5 py-4.5 border-b border-border bg-surface detail">
    <template v-if="!isEditing">
      <div class="flex items-start justify-between mb-4.5">
        <div class="flex items-center gap-2.5">
          <h2 class="text-[17px] font-bold tracking-[-0.3px] text-tprimary">{{ project.name }}</h2>
          <div :class="['inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full text-[11px] font-medium transition-all duration-300 status-badge', status?.status || 'stopped']">
            <span class="w-1.5 h-1.5 rounded-full status-dot"></span>
            {{ status?.status === 'running' ? '运行中' : status?.status === 'error' ? '错误' : '未启动' }}
            <span v-if="status?.pid" class="opacity-50 font-normal text-[10px] font-mono">PID {{ status.pid }}</span>
          </div>
        </div>
        <div class="flex gap-1">
          <button class="py-1.75 px-3.5 text-xs text-tsecondary border border-border rounded-lg transition-all duration-200 ease-out btn-ghost" @click="isEditing = true">编辑</button>
          <button class="py-1.75 px-3.5 text-xs text-ttertiary border border-transparent rounded-lg transition-all duration-200 ease-out btn-danger-ghost" @click="remove">删除</button>
        </div>
      </div>

      <div class="flex flex-col gap-3 mb-4.5">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-14 shrink-0 text-[9px] font-medium text-ttertiary uppercase tracking-[0.5px]">路径</span>
          <span class="font-mono text-[11px] text-tsecondary overflow-hidden text-ellipsis whitespace-nowrap" :title="project.path">{{ project.path }}</span>
          <div class="flex gap-1 shrink-0 ml-auto">
            <button class="flex items-center gap-1 py-1 px-2.5 text-[11px] font-medium text-ttertiary border border-border rounded-lg transition-all duration-200 ease-out whitespace-nowrap btn-quick-action" @click="openFolder" title="在文件管理器中打开">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span>打开</span>
            </button>
            <button class="flex items-center gap-1 py-1 px-2.5 text-[11px] font-medium text-ttertiary border border-border rounded-lg transition-all duration-200 ease-out whitespace-nowrap btn-quick-action" @click="openInVscode" title="在 VS Code 中打开">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              <span>VS Code</span>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-14 shrink-0 text-[9px] font-medium text-ttertiary uppercase tracking-[0.5px]">命令</span>
          <span class="font-mono text-[11px] py-0.5 px-2 rounded text-accent border border-accent-border transition-all duration-200 ease-out info-code">{{ project.command ? 'npm run ' + project.command : '' }}</span>
        </div>
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-14 shrink-0 text-[9px] font-medium text-ttertiary uppercase tracking-[0.5px]">Node</span>
          <div ref="versionDropdownRef" class="relative">
            <button class="flex items-center gap-1.5 py-0.5 px-2 text-[11px] rounded-[5px] text-tsecondary border border-border transition-all duration-200 ease-out version-btn" @click="showVersionDropdown = !showVersionDropdown">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
              <span :class="['font-mono text-[11px] version-text', { custom: project.nodeVersion }]">{{ project.nodeVersion || '跟随系统 (' + (globalNodeVersion || '--') + ')' }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div v-if="showVersionDropdown" class="absolute left-0 top-full mt-1 min-w-45 bg-surface border border-border rounded-xl p-1 z-100 animate-scale-in origin-top-left version-dropdown">
              <div class="px-2.5 pt-1.5 pb-1 text-[10px] text-blue-500 font-medium">仅识别 nvm 管理的版本</div>
              <button :class="['flex items-center gap-1.5 w-full py-1.5 px-2.5 text-[11px] rounded-[5px] text-left transition-all duration-150 ease-out font-mono version-option', { active: !project.nodeVersion }]" @click="selectNodeVersion(null)">
                跟随系统{{ globalNodeVersion ? ' (' + globalNodeVersion + ')' : '' }}
              </button>
              <div v-if="nodeVersions.length" class="h-px mx-1.5 my-0.75 version-divider"></div>
              <button
                v-for="v in nodeVersions" :key="v"
                :class="['flex items-center gap-1.5 w-full py-1.5 px-2.5 text-[11px] rounded-[5px] text-left transition-all duration-150 ease-out font-mono version-option', { active: project.nodeVersion === v }]"
                @click="selectNodeVersion(v)"
              >
                <svg v-if="project.nodeVersion === v" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                <span v-else class="w-3 h-3"></span>
                {{ v }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-1.5">
        <div class="flex gap-1.5">
          <button v-if="!isRunning()" class="py-1.75 px-5 text-xs font-semibold rounded-lg flex items-center gap-1.5 text-white btn-start" @click="emit('start')">
            <span class="text-[10px]">▶</span> 启动
          </button>
          <button v-else class="py-1.75 px-5 text-xs font-semibold rounded-lg flex items-center gap-1.5 text-white btn-stop" @click="emit('stop')">
            <span class="text-[10px]">■</span> 停止
          </button>
        </div>
        <button class="py-1.75 px-3.5 text-xs text-tsecondary border border-border rounded-lg transition-all duration-200 ease-out btn-ghost" @click="emit('clear-logs')">清空日志</button>
      </div>
    </template>

    <template v-else>
      <div class="flex items-start justify-between mb-4.5">
        <h2 class="text-[17px] font-bold tracking-[-0.3px] text-tprimary">编辑项目</h2>
      </div>
      <div class="flex flex-col gap-3.5">
        <div class="flex flex-col gap-1.25">
          <label class="text-xs font-medium text-tsecondary">名称</label>
          <input v-model="editForm.name" />
        </div>
        <div class="flex flex-col gap-1.25">
          <label class="text-xs font-medium text-tsecondary">路径</label>
          <div class="flex gap-1.5">
            <input v-model="editForm.path" readonly class="flex-1 cursor-pointer path-input" />
            <button class="shrink-0 py-1.75 px-3.5 text-xs font-medium text-accent border border-accent-border rounded-md bg-transparent transition-all duration-200 ease-out btn-browse" @click="selectFolder">浏览</button>
          </div>
        </div>
        <div class="flex flex-col gap-1.25">
          <label class="text-xs font-medium text-tsecondary">命令</label>
          <select v-model="editForm.command" class="cursor-pointer appearance-auto">
            <option value="" disabled>选择命令</option>
            <option v-for="script in editScripts" :key="script" :value="script">{{ script }}</option>
          </select>
          <span v-if="editScripts.length === 0 && editForm.path" class="text-[11px] text-ttertiary">未找到 package.json 或无 scripts</span>
        </div>
        <div class="flex gap-2 justify-end mt-2">
          <button class="py-1.75 px-3.5 text-xs text-tsecondary border border-border rounded-lg transition-all duration-200 ease-out btn-ghost" @click="cancelEdit">取消</button>
          <button class="py-1.75 px-5 text-xs font-semibold text-white rounded-lg btn-primary" @click="save">保存</button>
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
/* Pseudo-element for glow line — cannot be a Tailwind utility */
.detail::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--header-glow);
  pointer-events: none;
}

/* Status badge variants — all use CSS variables for colors */
.status-badge.running {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
  box-shadow: 0 0 12px var(--success-bg);
}

.status-badge.running .status-dot {
  background: var(--success);
  animation: dotPulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 6px var(--success);
}

.status-badge.stopped {
  background: var(--bg-elevated);
  color: var(--text-tertiary);
}

.status-badge.stopped .status-dot {
  background: var(--text-tertiary);
}

.status-badge.error {
  background: var(--error-bg);
  color: var(--error);
}

.status-badge.error .status-dot {
  background: var(--error);
}

/* Info value code — CSS variable backgrounds/borders */
.info-code {
  background: var(--accent-glow);
  color: var(--accent-primary);
  border-color: var(--accent-border);
}

.info-code:hover {
  background: rgba(59, 130, 246, 0.12);
  border-color: var(--accent-primary);
}

/* Quick action buttons — hover states with CSS variables */
.btn-quick-action:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
  border-color: var(--accent-border);
}

.btn-quick-action:active {
  transform: scale(0.97);
}

/* Ghost button hover — CSS variables */
.btn-ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

/* Danger ghost button — hover with CSS variables */
.btn-danger-ghost:hover {
  color: var(--error);
  background: var(--error-bg);
}

/* Start button — gradient + shadow with CSS values */
.btn-start {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  box-shadow: 0 2px 12px rgba(59, 130, 246, 0.25);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-start:hover:not(:disabled) {
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.35);
  transform: translateY(-1px);
}

.btn-start:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 6px rgba(59, 130, 246, 0.2);
}

/* Stop button — gradient + shadow */
.btn-stop {
  background: linear-gradient(135deg, #dc2626, #ef4444);
  box-shadow: 0 2px 12px rgba(239, 68, 68, 0.2);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-stop:hover:not(:disabled) {
  box-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);
  transform: translateY(-1px);
}

.btn-stop:active:not(:disabled) {
  transform: translateY(0);
}

/* Primary button — CSS variable gradient */
.btn-primary {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover));
  box-shadow: 0 2px 8px var(--accent-glow);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary:hover {
  box-shadow: 0 4px 16px var(--accent-glow);
  transform: translateY(-1px);
}

/* Path input — CSS variable color override */
.path-input {
  color: var(--text-secondary) !important;
}

/* Browse button — hover with CSS variables */
.btn-browse:hover {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
}

/* Version button hover — CSS variables */
.version-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-border);
}

/* Version text custom state — CSS variable */
.version-text.custom {
  color: var(--accent-primary);
}

/* Version dropdown — CSS variable shadow */
.version-dropdown {
  box-shadow: var(--shadow-lg);
}

/* Version option states — CSS variables */
.version-option:hover {
  background: var(--bg-hover);
}

.version-option.active {
  color: var(--accent-primary);
  font-weight: 600;
}

/* Version divider — CSS variable gradient */
.version-divider {
  background: var(--divider);
}
</style>

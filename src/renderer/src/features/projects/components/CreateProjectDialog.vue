<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Folder, Project } from '../../../shared/types'
import {
  buildFolder,
  buildProject,
  canCreateFolder,
  canCreateProject,
  packageScriptsMessage,
  projectNameFromPath,
  type CreateMode,
  type ProjectDraft
} from '../model/createProjectForm'

const props = withDefaults(defineProps<{
  visible: boolean
  initialMode?: CreateMode
}>(), {
  initialMode: 'project'
})

const emit = defineEmits<{
  close: []
  add: [project: Project]
  'add-folder': [folder: Folder]
}>()

const mode = ref<CreateMode>('project')
const projectDraft = ref<ProjectDraft>({ name: '', path: '', command: '' })
const folderName = ref('')
const availableScripts = ref<string[]>([])
const loadingScripts = ref(false)
const scriptMessage = ref('选择包含 package.json 的项目目录')
const dialogRef = ref<HTMLElement | null>(null)
const projectNameInput = ref<HTMLInputElement | null>(null)
const folderNameInput = ref<HTMLInputElement | null>(null)

const canSubmit = computed(() => mode.value === 'project'
  ? canCreateProject(projectDraft.value)
  : canCreateFolder(folderName.value))

const submitLabel = computed(() => mode.value === 'project' ? '创建项目' : '创建文件夹')

function resetState() {
  mode.value = props.initialMode
  projectDraft.value = { name: '', path: '', command: '' }
  folderName.value = ''
  availableScripts.value = []
  loadingScripts.value = false
  scriptMessage.value = '选择包含 package.json 的项目目录'
}

function focusCurrentField() {
  nextTick(() => {
    if (mode.value === 'project') projectNameInput.value?.focus()
    else folderNameInput.value?.focus()
  })
}

function selectMode(nextMode: CreateMode) {
  mode.value = nextMode
  focusCurrentField()
}

function requestClose() {
  emit('close')
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    requestClose()
    return
  }
  if (event.key !== 'Tab' || !dialogRef.value) return

  const focusable = Array.from(dialogRef.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ))
  if (!focusable.length) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

async function selectFolder() {
  if (loadingScripts.value) return
  const result = await window.electronAPI.selectFolder()
  if (result.canceled || !result.path) return

  projectDraft.value.path = result.path
  if (!projectDraft.value.name.trim()) {
    projectDraft.value.name = projectNameFromPath(result.path)
  }

  loadingScripts.value = true
  availableScripts.value = []
  projectDraft.value.command = ''
  scriptMessage.value = '正在读取 package.json…'

  try {
    const scripts = await window.electronAPI.getPackageScripts(result.path)
    availableScripts.value = scripts.scripts

    if (scripts.scripts.length) {
      projectDraft.value.command = scripts.scripts[0]
    }
    scriptMessage.value = packageScriptsMessage(scripts)
  } catch {
    scriptMessage.value = '读取 package.json 失败，请重新选择目录'
  } finally {
    loadingScripts.value = false
  }
}

function submit() {
  if (!canSubmit.value) return

  if (mode.value === 'project') {
    emit('add', buildProject(projectDraft.value, crypto.randomUUID()))
  } else {
    emit('add-folder', buildFolder(folderName.value, crypto.randomUUID()))
  }
  requestClose()
}

watch(() => props.visible, visible => {
  if (visible) {
    resetState()
    focusCurrentField()
  } else {
    resetState()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="create-dialog">
      <div v-if="visible" class="create-dialog-backdrop" @mousedown.self="requestClose">
        <section
          ref="dialogRef"
          class="create-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-dialog-title"
          @keydown="handleDialogKeydown"
        >
          <header class="dialog-header">
            <div>
              <p>WORKSPACE</p>
              <h2 id="create-dialog-title">新建工作项</h2>
            </div>
            <button class="dialog-close" type="button" aria-label="关闭创建窗口" @click="requestClose">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
            </button>
          </header>

          <div class="mode-switch" role="tablist" aria-label="创建类型">
            <button type="button" role="tab" :aria-selected="mode === 'project'" :class="{ active: mode === 'project' }" @click="selectMode('project')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/></svg>
              项目
            </button>
            <button type="button" role="tab" :aria-selected="mode === 'folder'" :class="{ active: mode === 'folder' }" @click="selectMode('folder')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/></svg>
              文件夹
            </button>
          </div>

          <form class="dialog-form" :aria-busy="loadingScripts" @submit.prevent="submit">
            <template v-if="mode === 'project'">
              <div class="field-group">
                <label for="create-project-name">项目名称</label>
                <input id="create-project-name" ref="projectNameInput" v-model="projectDraft.name" autocomplete="off" placeholder="例如 admin-console" />
              </div>

              <div class="field-group">
                <label for="create-project-path">项目目录</label>
                <div class="path-control">
                  <input id="create-project-path" v-model="projectDraft.path" readonly aria-describedby="create-project-path-hint" placeholder="选择包含 package.json 的目录" @click="selectFolder" />
                  <button type="button" class="browse-button" :disabled="loadingScripts" @click="selectFolder">浏览</button>
                </div>
                <span id="create-project-path-hint" class="field-hint" aria-live="polite">{{ scriptMessage }}</span>
              </div>

              <div class="field-group">
                <label for="create-project-command">启动命令</label>
                <select id="create-project-command" v-model="projectDraft.command" :disabled="loadingScripts || availableScripts.length === 0">
                  <option value="" disabled>{{ loadingScripts ? '正在加载…' : availableScripts.length ? '选择启动命令' : '请先选择项目目录' }}</option>
                  <option v-for="script in availableScripts" :key="script" :value="script">npm run {{ script }}</option>
                </select>
              </div>
            </template>

            <template v-else>
              <div class="folder-intro">
                <div class="folder-mark" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/></svg>
                </div>
                <div><strong>整理项目列表</strong><span>创建后可将项目拖入文件夹中。</span></div>
              </div>
              <div class="field-group">
                <label for="create-folder-name">文件夹名称</label>
                <input id="create-folder-name" ref="folderNameInput" v-model="folderName" autocomplete="off" placeholder="例如 业务应用" />
              </div>
            </template>

            <footer class="dialog-actions">
              <button type="button" class="cancel-button" @click="requestClose">取消</button>
              <button type="submit" class="submit-button" :disabled="!canSubmit">{{ submitLabel }}</button>
            </footer>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.create-dialog-backdrop { position: fixed; inset: 0; z-index: 1100; display: grid; place-items: center; padding: 28px; background: rgba(4, 9, 17, .42); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.create-dialog { width: min(460px, calc(100vw - 40px)); overflow: hidden; border: 1px solid var(--glass-border); border-radius: 18px; color: var(--text-primary); background: var(--glass-fill-strong); backdrop-filter: blur(28px) saturate(170%); -webkit-backdrop-filter: blur(28px) saturate(170%); box-shadow: var(--glass-shadow); }
.create-dialog::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--glass-edge); pointer-events: none; }
.dialog-header { min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 20px; border-bottom: 1px solid var(--border-muted); }.dialog-header p { margin: 0 0 4px; color: var(--text-tertiary); font: 700 9px/1 var(--font-mono); letter-spacing: .14em; }.dialog-header h2 { margin: 0; font-size: 17px; letter-spacing: -.025em; }.dialog-close { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; color: var(--text-tertiary); }.dialog-close:hover { color: var(--text-primary); background: var(--bg-hover); }
.mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 16px 20px 0; padding: 4px; border-radius: 10px; background: var(--bg-subtle); }.mode-switch button { min-height: 34px; display: flex; align-items: center; justify-content: center; gap: 7px; border-radius: 7px; color: var(--text-tertiary); font-size: 12px; font-weight: 650; }.mode-switch button:hover { color: var(--text-primary); }.mode-switch button.active { color: var(--accent-primary); background: var(--bg-surface); box-shadow: var(--shadow-sm); }
.dialog-form { padding: 18px 20px 0; }.field-group { display: flex; flex-direction: column; gap: 7px; margin-bottom: 16px; }.field-group label { color: var(--text-secondary); font-size: 11px; font-weight: 650; }.field-group input,.field-group select { width: 100%; min-height: 40px; border-radius: 12px; font-size: 12px; }.field-group input[readonly] { color: var(--text-secondary); cursor: pointer; }.field-group input:focus,.field-group select:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 3px var(--accent-glow), 0 0 12px color-mix(in srgb, var(--accent-glow) 80%, transparent); outline: none; }.path-control { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }.browse-button { min-width: 68px; border: 1px solid var(--accent-border); border-radius: 10px; color: var(--accent-primary); background: var(--bg-surface); font-size: 11px; font-weight: 700; }.browse-button:hover:not(:disabled) { background: var(--accent-glow); }.field-hint { min-height: 16px; color: var(--text-secondary); font-size: 10px; }
.folder-intro { display: flex; align-items: center; gap: 12px; margin-bottom: 17px; padding: 12px; border: 1px solid var(--border-muted); border-radius: 10px; background: var(--bg-subtle); }.folder-mark { width: 38px; height: 38px; display: grid; place-items: center; flex: none; border-radius: 9px; color: var(--accent-primary); background: var(--accent-glow); }.folder-intro strong,.folder-intro span { display: block; }.folder-intro strong { color: var(--text-primary); font-size: 11px; }.folder-intro span { margin-top: 3px; color: var(--text-secondary); font-size: 10px; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin: 4px -20px 0; padding: 14px 20px; border-top: 1px solid var(--border-muted); background: color-mix(in srgb, var(--bg-subtle) 55%, var(--bg-surface)); }.cancel-button,.submit-button { min-height: 36px; padding: 0 15px; border-radius: 8px; font-size: 11px; font-weight: 700; }.cancel-button { color: var(--text-secondary); border: 1px solid var(--border-default); background: var(--bg-surface); }.cancel-button:hover { color: var(--text-primary); background: var(--bg-hover); }.submit-button { min-width: 94px; color: #fff; background: var(--accent-primary); box-shadow: 0 3px 10px var(--accent-glow); }.submit-button:hover:not(:disabled) { background: var(--accent-primary-hover); }
.create-dialog-enter-active,.create-dialog-leave-active { transition: opacity 180ms ease; }.create-dialog-enter-active .create-dialog,.create-dialog-leave-active .create-dialog { transition: transform 180ms ease, opacity 180ms ease; }.create-dialog-enter-from,.create-dialog-leave-to { opacity: 0; }.create-dialog-enter-from .create-dialog,.create-dialog-leave-to .create-dialog { opacity: 0; transform: translateY(6px) scale(.985); }
</style>

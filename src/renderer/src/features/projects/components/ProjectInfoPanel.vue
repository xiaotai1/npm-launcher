<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Project } from '../../../shared/types'
import ConfirmDialog from '../../../shared/ui/ConfirmDialog.vue'

type ProjectSettingsDraft = Omit<Project, 'nodeVersion'> & { nodeVersion: string }

const props = defineProps<{
  project: Project
  editTrigger?: number
  nodeVersions: string[]
  globalNodeVersion: string | null
}>()

const emit = defineEmits<{
  update: [project: Project]
  delete: [id: string]
  toast: [message: string, type: 'success' | 'error' | 'warning']
  'set-node-version': [projectId: string, version: string | null]
}>()

function toDraft(project: Project): ProjectSettingsDraft {
  return { ...project, nodeVersion: project.nodeVersion || '' }
}

const editForm = ref<ProjectSettingsDraft>(toDraft(props.project))
const editScripts = ref<string[]>([])
const showDeleteConfirm = ref(false)

const commandOptions = computed(() => Array.from(new Set([
  editForm.value.command,
  ...editScripts.value
].filter(Boolean))))

const isDirty = computed(() => (
  editForm.value.name.trim() !== props.project.name
  || editForm.value.path.trim() !== props.project.path
  || editForm.value.command.trim() !== props.project.command
  || editForm.value.nodeVersion !== (props.project.nodeVersion || '')
))

const canSave = computed(() => Boolean(
  isDirty.value
  && editForm.value.name.trim()
  && editForm.value.path.trim()
  && editForm.value.command.trim()
))

async function loadScripts(path = editForm.value.path) {
  if (!path) {
    editScripts.value = []
    return
  }
  const result = await window.electronAPI.getPackageScripts(path)
  editScripts.value = result.scripts
}

watch(() => props.project, (project) => {
  editForm.value = toDraft(project)
  loadScripts(project.path)
})

watch(() => props.editTrigger, (value) => {
  if (value && value > 0) {
    editForm.value = toDraft(props.project)
    loadScripts(props.project.path)
  }
})

onMounted(() => loadScripts())

async function selectFolder() {
  const result = await window.electronAPI.selectFolder()
  if (result.canceled || !result.path) return

  editForm.value.path = result.path
  if (!editForm.value.name.trim()) {
    const parts = result.path.replace(/\\/g, '/').split('/')
    editForm.value.name = parts[parts.length - 1] || ''
  }

  const scripts = await window.electronAPI.getPackageScripts(result.path)
  editScripts.value = scripts.scripts
  editForm.value.command = scripts.scripts[0] || ''
}

function save() {
  if (!canSave.value) return

  const nextProject: Project = {
    ...editForm.value,
    name: editForm.value.name.trim(),
    path: editForm.value.path.trim(),
    command: editForm.value.command.trim()
  }
  if (!editForm.value.nodeVersion) delete nextProject.nodeVersion

  emit('update', nextProject)
}

function cancelEdit() {
  if (!isDirty.value) return
  editForm.value = toDraft(props.project)
  loadScripts(props.project.path)
  emit('toast', '已还原未保存的修改', 'success')
}

function remove() {
  showDeleteConfirm.value = true
}

function onConfirmDelete() {
  emit('delete', props.project.id)
  showDeleteConfirm.value = false
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-header">
      <div>
        <h2>项目设置</h2>
        <p>调整项目名称、启动脚本和运行环境。</p>
      </div>
      <div class="settings-actions">
        <button type="button" class="settings-secondary" :disabled="!isDirty" @click="cancelEdit">还原修改</button>
        <button type="submit" form="project-settings-form" class="settings-primary" :disabled="!canSave">保存设置</button>
      </div>
    </header>

    <form id="project-settings-form" class="settings-content" @submit.prevent="save">
      <section class="settings-section" aria-labelledby="basic-settings-title">
        <header class="settings-section-heading">
          <h3 id="basic-settings-title">基础设置</h3>
          <p>用于识别项目并决定默认启动方式。</p>
        </header>

        <div class="settings-fields">
          <label class="settings-field">
            <span>项目名称</span>
            <input v-model="editForm.name" autocomplete="off" />
          </label>

          <label class="settings-field">
            <span>项目路径</span>
            <div class="path-picker">
              <input v-model="editForm.path" readonly :title="editForm.path" />
              <button type="button" @click="selectFolder">浏览</button>
            </div>
          </label>

          <label class="settings-field">
            <span>默认启动脚本</span>
            <div class="settings-select">
              <select v-model="editForm.command" :disabled="commandOptions.length === 0">
                <option value="" disabled>选择脚本</option>
                <option v-for="script in commandOptions" :key="script" :value="script">{{ script }}</option>
              </select>
              <svg class="settings-select-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <small v-if="editScripts.length === 0 && editForm.path">未找到 package.json 或没有可用 scripts</small>
          </label>

          <label class="settings-field">
            <span>Node 版本</span>
            <div class="settings-select">
              <select v-model="editForm.nodeVersion">
                <option value="">跟随系统{{ globalNodeVersion ? ` (${globalNodeVersion})` : '' }}</option>
                <option v-for="version in nodeVersions" :key="version" :value="version">{{ version }}</option>
              </select>
              <svg class="settings-select-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <small>仅识别 nvm 管理的版本；留空时使用顶部当前系统版本。</small>
          </label>
        </div>
      </section>
    </form>

    <footer class="settings-remove-row">
      <div class="settings-remove-heading">
        <strong>从启动器移除</strong>
      </div>
      <div class="settings-remove-content">
        <span>只会移除当前项目配置，不会删除本地目录。</span>
        <button type="button" @click="remove">移除项目</button>
      </div>
    </footer>

    <ConfirmDialog
      :visible="showDeleteConfirm"
      title="移除项目"
      :message="`确定要从启动器移除「${project.name}」吗？本地目录和文件会保留。`"
      confirm-text="移除"
      :danger="true"
      @confirm="onConfirmDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<style scoped>
.settings-page {
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 28px 32px 32px;
  background: var(--bg-app);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
}

.settings-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  letter-spacing: 0;
}

.settings-header p {
  margin: 5px 0 0;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.5;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-content {
  width: 100%;
}

.settings-section,
.settings-remove-row {
  display: grid;
  grid-template-columns: 180px minmax(320px, 760px);
  gap: 36px;
  width: 100%;
  max-width: 976px;
  border-top: 1px solid var(--border-muted);
}

.settings-section {
  padding: 26px 0 32px;
}

.settings-section-heading h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
}

.settings-section-heading p {
  margin: 6px 0 0;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.6;
}

.settings-fields {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.settings-field > span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 650;
}

.settings-field input,
.settings-field select {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 0 11px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-primary);
  background: var(--bg-surface);
  font-size: 12px;
}

.settings-field input[readonly] {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  cursor: pointer;
}

.settings-select {
  position: relative;
  min-width: 0;
}

.settings-select select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 40px;
  cursor: pointer;
}

.settings-select-icon {
  position: absolute;
  top: 50%;
  right: 14px;
  color: var(--text-secondary);
  transform: translateY(-50%);
  pointer-events: none;
}

.settings-select:focus-within .settings-select-icon {
  color: var(--accent-primary);
}

.settings-select select:disabled {
  cursor: not-allowed;
}

.settings-select select:disabled + .settings-select-icon {
  opacity: .45;
}

.settings-field input:focus,
.settings-field select:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--accent-glow);
  outline: none;
}

.settings-field small {
  margin-top: -1px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.5;
}

.path-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.path-picker button,
.settings-secondary,
.settings-primary,
.settings-remove-content button {
  min-height: 36px;
  padding: 0 13px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
}

.path-picker button,
.settings-secondary,
.settings-remove-content button {
  border: 1px solid transparent;
  background: transparent;
}

.path-picker button {
  color: var(--accent-primary);
  border: 1px solid var(--accent-border);
  background: var(--bg-surface);
}

.path-picker button:hover,
.settings-secondary:hover {
  background: var(--accent-glow);
}

.settings-secondary {
  color: var(--text-secondary);
}

.settings-secondary:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.settings-primary {
  color: #fff;
  background: var(--accent-primary);
  box-shadow: 0 3px 10px var(--accent-glow);
}

.settings-primary:hover:not(:disabled) {
  background: var(--accent-primary-hover);
}

.settings-primary:disabled {
  opacity: .45;
  box-shadow: none;
  cursor: not-allowed;
}

.settings-secondary:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.settings-remove-row {
  padding-top: 22px;
}

.settings-remove-heading strong {
  color: var(--text-secondary);
  font-size: 11px;
}

.settings-remove-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.settings-remove-content span {
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.5;
}

.settings-remove-content button {
  flex: none;
  color: var(--error);
}

.settings-remove-content button:hover {
  background: var(--error-bg);
}

@media (max-width: 900px) {
  .settings-section,
  .settings-remove-row {
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 24px;
  }
}

@media (max-width: 720px) {
  .settings-page {
    padding: 20px;
  }

  .settings-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .settings-section,
  .settings-remove-row {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .settings-remove-content {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

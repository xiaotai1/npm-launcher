<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Project } from '../../../shared/types'
import ConfirmDialog from '../../../shared/ui/ConfirmDialog.vue'
import CustomSelect from '../../../shared/ui/CustomSelect.vue'

type ProjectSettingsDraft = Omit<Project, 'nodeVersion' | 'customCommand'> & { nodeVersion: string; customCommand: string }

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
  return { ...project, nodeVersion: project.nodeVersion || '', customCommand: project.customCommand || '' }
}

const editForm = ref<ProjectSettingsDraft>(toDraft(props.project))
const editScripts = ref<string[]>([])
const showDeleteConfirm = ref(false)

type SettingsSection = 'basic' | 'environment' | 'danger'
const activeSection = ref<SettingsSection>('basic')

const settingsNav: { id: SettingsSection; label: string; desc: string; icon: 'info' | 'runtime' | 'alert' }[] = [
  { id: 'basic', label: '基础设置', desc: '名称、路径与启动脚本', icon: 'info' },
  { id: 'environment', label: '运行环境', desc: 'Node 版本选择', icon: 'runtime' },
  { id: 'danger', label: '危险操作', desc: '从启动器移除项目', icon: 'alert' }
]

const navItem = (id: SettingsSection) => settingsNav.find(n => n.id === id) || settingsNav[0]

const commandOptions = computed(() => Array.from(new Set([
  editForm.value.command,
  ...editScripts.value
].filter(Boolean))))
const useCustomCommand = computed(() => Boolean(editForm.value.customCommand.trim()))

const isDirty = computed(() => (
  editForm.value.name.trim() !== props.project.name
  || editForm.value.path.trim() !== props.project.path
  || editForm.value.command.trim() !== props.project.command
  || editForm.value.customCommand.trim() !== (props.project.customCommand || '')
  || editForm.value.nodeVersion !== (props.project.nodeVersion || '')
))

const canSave = computed(() => Boolean(
  isDirty.value
  && editForm.value.name.trim()
  && editForm.value.path.trim()
  && (editForm.value.command.trim() || editForm.value.customCommand.trim())
))

async function loadScripts(path = editForm.value.path) {
  if (!path) {
    editScripts.value = []
    return
  }
  const result = await window.desktopAPI.getPackageScripts(path)
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
  const result = await window.desktopAPI.selectFolder()
  if (result.canceled || !result.path) return

  editForm.value.path = result.path
  if (!editForm.value.name.trim()) {
    const parts = result.path.replace(/\\/g, '/').split('/')
    editForm.value.name = parts[parts.length - 1] || ''
  }

  const scripts = await window.desktopAPI.getPackageScripts(result.path)
  editScripts.value = scripts.scripts
  if (!editForm.value.customCommand.trim()) {
    editForm.value.command = scripts.scripts[0] || ''
  }
}

function save() {
  if (!canSave.value) return

  const nextProject: Project = {
    ...editForm.value,
    name: editForm.value.name.trim(),
    path: editForm.value.path.trim(),
    command: editForm.value.command.trim(),
    customCommand: editForm.value.customCommand.trim() || undefined
  }
  if (!editForm.value.nodeVersion) delete nextProject.nodeVersion
  if (!editForm.value.customCommand.trim()) delete nextProject.customCommand

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
      <div class="settings-title-block">
        <h2>项目设置</h2>
        <p>调整项目名称、启动脚本和运行环境。</p>
      </div>
      <div class="settings-actions">
        <button type="button" class="settings-secondary" :disabled="!isDirty" @click="cancelEdit">还原修改</button>
        <button type="submit" form="project-settings-form" class="settings-primary" :disabled="!canSave">保存设置</button>
      </div>
    </header>

    <div class="settings-body">
      <nav class="settings-nav" role="tablist" aria-label="设置目录">
        <button
          v-for="item in settingsNav"
          :key="item.id"
          :id="`${item.id}-settings-tab`"
          type="button"
          role="tab"
          :aria-selected="activeSection === item.id"
          :aria-controls="`${item.id}-settings-panel`"
          class="settings-nav-item"
          :class="{ active: activeSection === item.id }"
          @click="activeSection = item.id"
        >
          <span class="settings-nav-icon">
            <svg v-if="item.icon === 'info'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>
            <svg v-else-if="item.icon === 'runtime'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </span>
          <span class="settings-nav-text">
            <strong>{{ item.label }}</strong>
            <small>{{ item.desc }}</small>
          </span>
        </button>
      </nav>

      <form id="project-settings-form" class="settings-content" @submit.prevent="save">
          <section id="basic-settings-panel" v-if="activeSection === 'basic'" class="settings-section" role="tabpanel" aria-labelledby="basic-settings-tab" key="basic">
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
                <CustomSelect
                  v-model="editForm.command"
                  :options="commandOptions"
                  :disabled="useCustomCommand || commandOptions.length === 0"
                  placeholder="选择脚本"
                />
                <small v-if="useCustomCommand">已启用自定义命令，脚本选择不会参与启动。</small>
                <small v-else-if="editScripts.length === 0 && editForm.path">未找到 package.json 或没有可用 scripts</small>
              </label>

              <label class="settings-field">
                <span>自定义启动命令</span>
                <input
                  v-model="editForm.customCommand"
                  autocomplete="off"
                  placeholder="例如：node server.js 或 pnpm --filter web dev"
                  :title="editForm.customCommand"
                />
                <small>留空时执行上面的脚本；填写后将直接在项目目录中执行该命令，不要求以 npm run 开头。</small>
              </label>
            </div>
          </section>

          <section id="environment-settings-panel" v-else-if="activeSection === 'environment'" class="settings-section" role="tabpanel" aria-labelledby="environment-settings-tab" key="env">
            <div class="settings-fields">
              <label class="settings-field">
                <span>Node 版本</span>
                <CustomSelect
                  v-model="editForm.nodeVersion"
                  :options="nodeVersions"
                  :placeholder="`跟随系统${globalNodeVersion ? ` (${globalNodeVersion})` : ''}`"
                />
                <small>仅识别 nvm 管理的版本；留空时使用顶部当前系统版本。</small>
              </label>
            </div>
          </section>

          <section id="danger-settings-panel" v-else class="settings-section settings-danger" role="tabpanel" aria-labelledby="danger-settings-tab" key="danger">
            <div class="danger-zone">
              <div class="danger-zone-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </div>
              <div class="danger-zone-text">
                <strong>从启动器移除</strong>
                <span>只会移除当前项目配置，不会删除本地目录。</span>
              </div>
              <button type="button" class="danger-remove-btn" @click="remove">移除项目</button>
            </div>
          </section>
      </form>
    </div>

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
  padding: 24px 32px 28px;
  background: var(--bg-app);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-muted);
}

.settings-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 750;
  letter-spacing: 0;
}

.settings-header p {
  margin: 5px 0 0;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 左右两栏布局 */
.settings-body {
  flex: 1;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  padding-top: 22px;
}

/* 左侧目录导航 */
.settings-nav {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--border-muted);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-surface) 78%, transparent);
}

.settings-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 9px;
  color: var(--text-secondary);
  text-align: left;
  transition: background 180ms ease, color 180ms ease;
}

.settings-nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.settings-nav-item.active {
  color: var(--accent-primary);
  background: var(--accent-glow);
}

.settings-nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 2.5px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--accent-primary), var(--accent-primary-hover));
  box-shadow: 0 0 8px var(--accent-glow);
  transform: translateY(-50%);
  animation: indicatorSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.settings-nav-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
}

.settings-nav-item:hover .settings-nav-icon {
  color: var(--accent-primary);
  background: var(--accent-glow);
}

.settings-nav-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.settings-nav-text strong {
  font-size: 13px;
  font-weight: 700;
}

.settings-nav-text small {
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.4;
}

/* 右侧表单 */
.settings-content {
  width: 100%;
  min-width: 0;
  max-width: 600px;
}

.settings-section {
  animation: fadeIn 80ms cubic-bezier(0.16, 1, 0.3, 1);
}

.settings-fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.settings-field > span {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 650;
}

.settings-field input,
.settings-field select {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  color: var(--text-primary);
  background: var(--bg-surface);
  font-size: 13px;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.settings-field input[readonly] {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  cursor: pointer;
}

.settings-field input:focus,
.settings-field select:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-glow), 0 0 12px color-mix(in srgb, var(--accent-glow) 80%, transparent);
  outline: none;
}

.settings-field small {
  margin-top: -1px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.5;
}

.path-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.path-picker button,
.settings-secondary,
.settings-primary {
  min-height: 36px;
  padding: 0 13px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 700;
}

.path-picker button,
.settings-secondary {
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

/* 危险操作 */
.settings-danger .danger-zone {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--error) 30%, var(--border-default));
  border-radius: 14px;
  background: color-mix(in srgb, var(--error-bg) 40%, var(--bg-surface));
}

.danger-zone-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--error);
  background: color-mix(in srgb, var(--error) 14%, transparent);
}

.danger-zone-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.danger-zone-text strong {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.danger-zone-text span {
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.danger-remove-btn {
  flex: none;
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--error) 40%, transparent);
  border-radius: 9px;
  color: var(--error);
  background: var(--bg-surface);
  font-size: 13px;
  font-weight: 700;
  transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease;
}

.danger-remove-btn:hover {
  color: #fff;
  background: var(--error);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--error) 30%, transparent);
}

@media (max-width: 900px) {
  .settings-body {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .settings-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }
  .settings-nav-item {
    flex: 1;
    min-width: max-content;
  }
  .settings-nav-item.active::before {
    top: auto;
    left: 50%;
    bottom: 0;
    width: 50%;
    height: 2.5px;
    transform: translateX(-50%);
  }
}

@media (max-width: 720px) {
  .settings-page {
    padding: 18px;
  }

  .settings-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .settings-nav-item.active::before {
    width: 60%;
  }
}
</style>

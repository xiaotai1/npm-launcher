<script setup lang="ts">
import { ref, computed, toRaw, onMounted, onUnmounted } from 'vue'
import type { Project, Folder, ProcessStatus } from '../types'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps<{
  projects: Project[]
  folders: Folder[]
  selectedId: string | null
  statuses: Record<string, ProcessStatus>
}>()

const emit = defineEmits<{
  select: [id: string]
  add: [project: Project]
  reorder: [ids: string[]]
  edit: [id: string]
  delete: [id: string]
  'toggle-favorite': [id: string]
  'add-folder': [folder: Folder]
  'reorder-folders': [ids: string[]]
  'delete-folder': [id: string]
  'rename-folder': [folder: Folder]
  'move-to-folder': [projectId: string, folderId: string | null]
  'start-all': []
  'stop-all': []
}>()

const showForm = ref(false)
const form = ref({ name: '', path: '', command: '' })
const availableScripts = ref<string[]>([])
const loadingScripts = ref(false)

// 搜索
const searchQuery = ref('')

// 计算搜索过滤后的列表
const filteredProjects = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return props.projects
  return props.projects.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.path.toLowerCase().includes(q) ||
    p.command.toLowerCase().includes(q)
  )
})

const hasRunningProject = computed(() =>
  Object.values(props.statuses).some(s => s.status === 'running')
)

// 文件夹相关
const showFolderInput = ref(false)
const newFolderName = ref('')
const renamingFolder = ref<Folder | null>(null)
const renameInput = ref('')

// 拖拽状态
const dragProjectId = ref<string | null>(null)
const dragFolderId = ref<string | null>(null)
const dropTarget = ref<{ type: 'project' | 'folder' | 'root'; id?: string } | null>(null)

// 右键菜单
const contextMenu = ref<{ visible: boolean; x: number; y: number; target: Project | Folder | null; type: 'project' | 'folder' | null }>({
  visible: false, x: 0, y: 0, target: null, type: null
})

// 删除确认
const confirmState = ref<{ visible: boolean; type: 'project' | 'folder'; id: string; name: string }>({ visible: false, type: 'project', id: '', name: '' })

// 折叠状态
const collapsedFolders = ref<Set<string>>(new Set())

// 计算分组后的列表（使用搜索过滤）
const rootFavorites = computed(() =>
  filteredProjects.value.filter(p => p.favorite && !p.folderId)
)

const rootNormal = computed(() =>
  filteredProjects.value.filter(p => !p.favorite && !p.folderId)
)

function folderProjects(folderId: string) {
  return filteredProjects.value.filter(p => p.folderId === folderId)
}

// 搜索时只显示有匹配项目的文件夹
const visibleFolders = computed(() => {
  if (!searchQuery.value.trim()) return props.folders
  return props.folders.filter(f => folderProjects(f.id).length > 0)
})

function isCollapsed(folderId: string) {
  return collapsedFolders.value.has(folderId)
}

function toggleCollapse(folderId: string) {
  if (collapsedFolders.value.has(folderId)) {
    collapsedFolders.value.delete(folderId)
  } else {
    collapsedFolders.value.add(folderId)
  }
}

function getStatusInfo(projectId: string) {
  const status = props.statuses[projectId]
  if (status?.status === 'running') return { text: '运行中', color: 'var(--success)' }
  if (status?.status === 'error') return { text: '错误', color: 'var(--error)' }
  return { text: '未启动', color: 'var(--text-tertiary)' }
}

// 新建项目
async function selectFolder() {
  const result = await window.electronAPI.selectFolder()
  if (result.canceled || !result.path) return
  form.value.path = result.path
  if (!form.value.name) {
    const parts = result.path.replace(/\\/g, '/').split('/')
    form.value.name = parts[parts.length - 1] || ''
  }
  await loadScripts(result.path)
}

async function loadScripts(dir: string) {
  loadingScripts.value = true
  availableScripts.value = []
  form.value.command = ''
  const result = await window.electronAPI.getPackageScripts(dir)
  loadingScripts.value = false
  if (result.scripts.length > 0) {
    availableScripts.value = result.scripts
    form.value.command = result.scripts[0]
  }
}

function resetForm() {
  form.value = { name: '', path: '', command: '' }
  availableScripts.value = []
  showForm.value = false
}

function handleAdd() {
  if (!form.value.name || !form.value.path || !form.value.command) return
  emit('add', { id: crypto.randomUUID(), ...toRaw(form.value) })
  resetForm()
}

// 新建文件夹
function handleAddFolder() {
  if (!newFolderName.value.trim()) return
  emit('add-folder', { id: crypto.randomUUID(), name: newFolderName.value.trim() })
  newFolderName.value = ''
  showFolderInput.value = false
}

// 收藏
function onToggleFavorite(projectId: string, e: Event) {
  e.stopPropagation()
  emit('toggle-favorite', projectId)
}

// 拖拽
function onProjectDragStart(e: DragEvent, projectId: string) {
  dragProjectId.value = projectId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', projectId)
  }
}

function onProjectDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onFolderDragOver(e: DragEvent, folderId: string) {
  e.preventDefault()
  if (dragProjectId.value) {
    dropTarget.value = { type: 'folder', id: folderId }
  }
}

function onFolderDrop(e: DragEvent, folderId: string) {
  e.preventDefault()
  if (dragProjectId.value) {
    emit('move-to-folder', dragProjectId.value, folderId)
  }
  dragProjectId.value = null
  dropTarget.value = null
}

function onRootDragOver(e: DragEvent) {
  e.preventDefault()
  if (dragProjectId.value) {
    dropTarget.value = { type: 'root' }
  }
}

function onRootDrop(e: DragEvent) {
  e.preventDefault()
  if (dragProjectId.value) {
    // 拖到根区域，移出文件夹
    const project = props.projects.find(p => p.id === dragProjectId.value)
    if (project?.folderId) {
      emit('move-to-folder', dragProjectId.value, null)
    }
  }
  dragProjectId.value = null
  dropTarget.value = null
}

function onDragEnd() {
  dragProjectId.value = null
  dragFolderId.value = null
  dropTarget.value = null
}

// 文件夹拖拽排序
function onFolderDragStart(e: DragEvent, folderId: string) {
  dragFolderId.value = folderId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', 'folder:' + folderId)
  }
}

function onFolderDragOverForSort(e: DragEvent, folderId: string) {
  e.preventDefault()
  if (dragFolderId.value && dragFolderId.value !== folderId) {
    dropTarget.value = { type: 'folder', id: folderId }
  }
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onFolderDropForSort(e: DragEvent, targetFolderId: string) {
  e.preventDefault()
  if (dragFolderId.value && dragFolderId.value !== targetFolderId) {
    const currentIds = props.folders.map(f => f.id)
    const fromIdx = currentIds.indexOf(dragFolderId.value)
    const toIdx = currentIds.indexOf(targetFolderId)
    if (fromIdx !== -1 && toIdx !== -1) {
      currentIds.splice(fromIdx, 1)
      currentIds.splice(toIdx, 0, dragFolderId.value)
      emit('reorder-folders', currentIds)
    }
  }
  dragFolderId.value = null
  dropTarget.value = null
}

// 右键菜单
function onProjectContextMenu(e: MouseEvent, project: Project) {
  e.preventDefault()
  emit('select', project.id)
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, target: project, type: 'project' }
}

function onFolderContextMenu(e: MouseEvent, folder: Folder) {
  e.preventDefault()
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, target: folder, type: 'folder' }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function handleEdit() {
  if (contextMenu.value.type === 'project' && contextMenu.value.target) {
    emit('edit', (contextMenu.value.target as Project).id)
  }
  closeContextMenu()
}

async function handleOpenFolder() {
  if (contextMenu.value.type === 'project' && contextMenu.value.target) {
    const p = contextMenu.value.target as Project
    await window.electronAPI.openInFileManager(p.path)
  }
  closeContextMenu()
}

async function handleOpenInVscode() {
  if (contextMenu.value.type === 'project' && contextMenu.value.target) {
    const p = contextMenu.value.target as Project
    await window.electronAPI.openInVscode(p.path)
  }
  closeContextMenu()
}

function handleDelete() {
  if (contextMenu.value.type === 'project' && contextMenu.value.target) {
    const p = contextMenu.value.target as Project
    confirmState.value = { visible: true, type: 'project', id: p.id, name: p.name }
  } else if (contextMenu.value.type === 'folder' && contextMenu.value.target) {
    const f = contextMenu.value.target as Folder
    confirmState.value = { visible: true, type: 'folder', id: f.id, name: f.name }
  }
  closeContextMenu()
}

function handleRenameFolder() {
  if (contextMenu.value.type === 'folder' && contextMenu.value.target) {
    renamingFolder.value = contextMenu.value.target as Folder
    renameInput.value = (contextMenu.value.target as Folder).name
  }
  closeContextMenu()
}

function confirmRename() {
  if (renamingFolder.value && renameInput.value.trim()) {
    emit('rename-folder', { ...renamingFolder.value, name: renameInput.value.trim() })
  }
  renamingFolder.value = null
  renameInput.value = ''
}

function cancelRename() {
  renamingFolder.value = null
  renameInput.value = ''
}

function onConfirmDelete() {
  if (confirmState.value.type === 'project') {
    emit('delete', confirmState.value.id)
  } else {
    emit('delete-folder', confirmState.value.id)
  }
  confirmState.value = { visible: false, type: 'project', id: '', name: '' }
}

function onCancelDelete() {
  confirmState.value = { visible: false, type: 'project', id: '', name: '' }
}

function onClickOutside() {
  if (contextMenu.value.visible) closeContextMenu()
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div class="project-list">
    <div class="list-header">
      <span class="list-title">项目</span>
      <div class="header-btns">
        <button class="add-btn" @click="showFolderInput = !showFolderInput" title="新建文件夹">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button class="add-btn" @click="showForm = !showForm">
          <span class="add-icon">+</span> 新建
        </button>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="search-bar">
      <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        v-model="searchQuery"
        placeholder="搜索项目..."
        class="search-input"
      />
      <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-actions">
      <button class="batch-btn" @click="emit('start-all')" :disabled="projects.length === 0" title="启动所有项目">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        全部启动
      </button>
      <button :class="['batch-btn', { active: hasRunningProject }]" @click="emit('stop-all')" :disabled="!hasRunningProject" title="停止所有项目">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        全部停止
      </button>
    </div>

    <!-- 新建文件夹 -->
    <div v-if="showFolderInput" class="folder-input-card">
      <div class="folder-input-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span>新建文件夹</span>
      </div>
      <input
        v-model="newFolderName"
        placeholder="输入文件夹名称"
        @keyup.enter="handleAddFolder"
        @keyup.escape="showFolderInput = false"
        autofocus
      />
      <div class="folder-input-actions">
        <button class="btn-cancel" @click="showFolderInput = false; newFolderName = ''">取消</button>
        <button class="btn-primary" @click="handleAddFolder" :disabled="!newFolderName.trim()">确认</button>
      </div>
    </div>

    <!-- 新建项目表单 -->
    <div v-if="showForm" class="add-form">
      <input v-model="form.name" placeholder="项目名称" />
      <div class="path-field">
        <input v-model="form.path" placeholder="项目路径" readonly class="path-input" />
        <button class="btn-browse" @click="selectFolder">浏览</button>
      </div>
      <div class="command-field">
        <select v-model="form.command" class="command-select" :disabled="availableScripts.length === 0">
          <option value="" disabled>
            {{ loadingScripts ? '加载中...' : availableScripts.length === 0 ? '请先选择项目路径' : '选择命令' }}
          </option>
          <option v-for="script in availableScripts" :key="script" :value="script">{{ script }}</option>
        </select>
        <span v-if="availableScripts.length > 0" class="command-hint">npm run {{ form.command }}</span>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" @click="resetForm">取消</button>
        <button class="btn-primary" @click="handleAdd" :disabled="!form.name || !form.path || !form.command">确认</button>
      </div>
    </div>

    <!-- 项目列表 -->
    <div class="list-items" @dragover="onRootDragOver" @drop="onRootDrop">

      <!-- 根级别收藏项目 -->
      <template v-if="rootFavorites.length">
        <div class="section-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          收藏
        </div>
        <div
          v-for="project in rootFavorites"
          :key="project.id"
          :class="['project-card', { active: selectedId === project.id }]"
          draggable="true"
          @click="emit('select', project.id)"
          @contextmenu="onProjectContextMenu($event, project)"
          @dragstart="onProjectDragStart($event, project.id)"
          @dragover="onProjectDragOver"
          @dragend="onDragEnd"
        >
          <div class="card-drag-handle" title="拖拽排序">
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
              <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
              <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
              <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
            </svg>
          </div>
          <div class="card-body">
            <div class="card-top">
              <span class="card-name">{{ project.name }}</span>
              <span class="card-status-dot" :style="{ background: getStatusInfo(project.id).color }"></span>
            </div>
            <div class="card-bottom">
              <span class="card-command">npm run {{ project.command }}</span>
              <span class="card-status-text" :style="{ color: getStatusInfo(project.id).color }">{{ getStatusInfo(project.id).text }}</span>
            </div>
          </div>
          <button class="star-btn active" @click="onToggleFavorite(project.id, $event)" title="取消收藏">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          </button>
        </div>
        <div v-if="folders.length || rootNormal.length" class="section-divider"></div>
      </template>

      <!-- 文件夹 -->
      <template v-for="folder in visibleFolders" :key="folder.id">
        <div
          :class="['folder-row', { 'drop-highlight': dropTarget?.type === 'folder' && dropTarget?.id === folder.id, dragging: dragFolderId === folder.id }]"
          draggable="true"
          @dragstart="onFolderDragStart($event, folder.id)"
          @dragover="dragFolderId ? onFolderDragOverForSort($event, folder.id) : onFolderDragOver($event, folder.id)"
          @drop="dragFolderId ? onFolderDropForSort($event, folder.id) : onFolderDrop($event, folder.id)"
          @dragend="onDragEnd"
          @contextmenu="onFolderContextMenu($event, folder)"
        >
          <!-- 重命名模式 -->
          <template v-if="renamingFolder?.id === folder.id">
            <input
              v-model="renameInput"
              class="rename-input"
              @keyup.enter="confirmRename"
              @keyup.escape="cancelRename"
              @blur="confirmRename"
              autofocus
            />
          </template>
          <template v-else>
            <button class="folder-toggle" @click="toggleCollapse(folder.id)">
              <svg :class="['chevron', { collapsed: isCollapsed(folder.id) }]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="folder-icon">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="folder-name">{{ folder.name }}</span>
            <span class="folder-count">{{ folderProjects(folder.id).length }}</span>
          </template>
        </div>
        <!-- 文件夹内的项目 -->
        <div v-if="!isCollapsed(folder.id)" class="folder-projects">
          <div
            v-for="project in folderProjects(folder.id)"
            :key="project.id"
            :class="['project-card', { active: selectedId === project.id }]"
            draggable="true"
            @click="emit('select', project.id)"
            @contextmenu="onProjectContextMenu($event, project)"
            @dragstart="onProjectDragStart($event, project.id)"
            @dragover="onProjectDragOver"
            @dragend="onDragEnd"
          >
            <div class="card-drag-handle" title="拖拽排序">
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
                <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
                <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
              </svg>
            </div>
            <div class="card-body">
              <div class="card-top">
                <span class="card-name">{{ project.name }}</span>
                <span class="card-status-dot" :style="{ background: getStatusInfo(project.id).color }"></span>
              </div>
              <div class="card-bottom">
                <span class="card-command">npm run {{ project.command }}</span>
                <span class="card-status-text" :style="{ color: getStatusInfo(project.id).color }">{{ getStatusInfo(project.id).text }}</span>
              </div>
            </div>
            <button :class="['star-btn', { active: project.favorite }]" @click="onToggleFavorite(project.id, $event)" :title="project.favorite ? '取消收藏' : '收藏'">
              <svg v-if="project.favorite" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            </button>
          </div>
          <div v-if="folderProjects(folder.id).length === 0" class="folder-empty">
            拖拽项目到此处
          </div>
        </div>
      </template>

      <!-- 根级别普通项目 -->
      <div
        v-for="project in rootNormal"
        :key="project.id"
        :class="['project-card', { active: selectedId === project.id }]"
        draggable="true"
        @click="emit('select', project.id)"
        @contextmenu="onProjectContextMenu($event, project)"
        @dragstart="onProjectDragStart($event, project.id)"
        @dragover="onProjectDragOver"
        @dragend="onDragEnd"
      >
        <div class="card-drag-handle" title="拖拽排序">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
            <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
            <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
          </svg>
        </div>
        <div class="card-body">
          <div class="card-top">
            <span class="card-name">{{ project.name }}</span>
            <span class="card-status-dot" :style="{ background: getStatusInfo(project.id).color }"></span>
          </div>
          <div class="card-bottom">
            <span class="card-command">npm run {{ project.command }}</span>
            <span class="card-status-text" :style="{ color: getStatusInfo(project.id).color }">{{ getStatusInfo(project.id).text }}</span>
          </div>
        </div>
        <button :class="['star-btn', { active: project.favorite }]" @click="onToggleFavorite(project.id, $event)" :title="project.favorite ? '取消收藏' : '收藏'">
            <svg v-if="project.favorite" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          </button>
      </div>

      <div v-if="filteredProjects.length === 0" class="empty-list">
        <p>{{ searchQuery ? '未找到匹配项目' : '暂无项目' }}</p>
        <p class="hint">{{ searchQuery ? '尝试其他关键词' : '点击"新建"添加' }}</p>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <template v-if="contextMenu.type === 'project'">
          <button class="context-item" @click="handleEdit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>编辑</span>
          </button>
          <button class="context-item" @click="handleOpenFolder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span>打开文件夹</span>
          </button>
          <button class="context-item" @click="handleOpenInVscode">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            <span>在 VS Code 中打开</span>
          </button>
          <div class="context-divider"></div>
          <button class="context-item danger" @click="handleDelete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>删除</span>
          </button>
        </template>
        <template v-if="contextMenu.type === 'folder'">
          <button class="context-item" @click="handleRenameFolder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>重命名</span>
          </button>
          <div class="context-divider"></div>
          <button class="context-item danger" @click="handleDelete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>删除文件夹</span>
          </button>
        </template>
      </div>
    </Teleport>

    <!-- 确认弹窗 -->
    <ConfirmDialog
      :visible="confirmState.visible"
      :title="confirmState.type === 'project' ? '删除项目' : '删除文件夹'"
      :message="confirmState.type === 'project'
        ? `确定要删除项目「${confirmState.name}」吗？此操作不可撤销。`
        : `确定要删除文件夹「${confirmState.name}」吗？其下项目将移回根级别。`"
      confirm-text="删除"
      :danger="true"
      @confirm="onConfirmDelete"
      @cancel="onCancelDelete"
    />
  </div>
</template>

<style scoped>
.project-list{
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-header{
  padding: 16px 16px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-btns{
  display: flex;
  gap: 4px;
}

.list-title{
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 1.2px;
}

.add-btn{
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  border-radius: 5px;
  transition: all 150ms ease;
}

.add-btn:hover{
  color: var(--text-primary);
  background: var(--bg-hover);
}

.add-btn:first-child{
  width: 24px;
  height: 24px;
  padding: 0;
  justify-content: center;
}

.add-icon{ font-size: 13px; line-height: 1; }

/* 搜索框 */
.search-bar{
  position: relative;
  padding: 0 10px 8px;
}

.search-icon{
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}

.search-input{
  width: 100%;
  padding: 6px 28px 6px 30px;
  font-size: 11px;
  border-radius: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  transition: all 200ms ease;
}

.search-input::placeholder{
  color: var(--text-tertiary);
}

.search-input:focus{
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--accent-glow);
  outline: none;
}

.search-clear{
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--text-tertiary);
}

.search-clear:hover{
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 批量操作 */
.batch-actions{
  display: flex;
  gap: 4px;
  padding: 0 10px 6px;
}

.batch-btn{
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-tertiary);
  border-radius: 5px;
  transition: all 150ms ease;
}

.batch-btn:hover:not(:disabled){
  color: var(--text-primary);
  background: var(--bg-hover);
}

.batch-btn:disabled{
  opacity: 0.35;
  cursor: not-allowed;
}

.batch-btn.active{
  color: var(--error);
}

.batch-btn.active:hover:not(:disabled){
  background: var(--error-bg);
}

/* 文件夹输入卡片 */
.folder-input-card{
  margin: 6px 10px;
  padding: 12px;
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.folder-input-header{
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.folder-input-header svg{
  color: var(--accent-primary);
  filter: drop-shadow(0 0 3px var(--accent-glow));
}

.folder-input-card input{
  width: 100%;
  padding: 8px 10px;
  font-size: 12px;
  border-radius: 6px;
}

.folder-input-actions{
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* 新建表单 */
.add-form{
  padding: 16px 14px;
  border-top: 1px solid var(--border-default);
  border-bottom: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-base);
  animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.add-form input, .add-form select{
  width: 100%;
  padding: 7px 10px;
  font-size: 13px;
  border-radius: 6px;
}

.path-field{ display: flex; gap: 6px; }

.path-input{ flex: 1; cursor: pointer; color: var(--text-secondary); }

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

.btn-browse:hover{ background: var(--accent-glow); border-color: var(--accent-primary); }

.command-field{ display: flex; flex-direction: column; gap: 3px; }

.command-select{ cursor: pointer; appearance: auto; }

.command-hint{
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

.form-actions{ display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }

.btn-cancel{
  padding: 7px 14px;
  font-size: 12px;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
}

.btn-cancel:hover{ background: var(--bg-hover); }

.btn-primary{
  padding: 7px 18px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover));
  border-radius: 7px;
  box-shadow: 0 2px 8px var(--accent-glow);
}

.btn-primary:hover:not(:disabled){ box-shadow: 0 4px 16px var(--accent-glow); transform: translateY(-1px); }
.btn-primary:disabled{ opacity: 0.4; cursor: not-allowed; }

/* 列表 */
.list-items{ flex: 1; overflow-y: auto; padding: 4px 8px; }

.section-label{
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.section-label::after{
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.15), transparent);
}

.section-divider{
  height: 1px;
  background: var(--divider);
  margin: 6px 4px;
}

/* 文件夹 */
.folder-row{
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 8px;
  margin-bottom: 2px;
  border-radius: 8px;
  cursor: default;
  transition: all 150ms ease;
}

.folder-row:hover{ background: var(--bg-hover); }
.folder-row.drop-highlight{ background: var(--accent-glow); border: 1px dashed var(--accent-primary); }

.folder-toggle{
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--text-tertiary);
}

.folder-toggle:hover{ background: var(--bg-active); }

.chevron{
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-block;
}

.chevron.collapsed{
  transform: rotate(0deg);
}

.chevron:not(.collapsed){
  transform: rotate(90deg);
}

.folder-icon{
  color: var(--accent-primary);
  flex-shrink: 0;
  filter: drop-shadow(0 0 3px var(--accent-glow));
  transition: filter 200ms ease;
}

.folder-row:hover .folder-icon{
  filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.35));
}

.folder-name{
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 150ms ease;
}

.folder-row:hover .folder-name{
  color: var(--text-primary);
}

.folder-count{
  font-size: 10px;
  color: var(--text-tertiary);
  background: var(--bg-elevated);
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 22px;
  text-align: center;
  transition: all 200ms ease;
}

.folder-row:hover .folder-count{
  background: var(--accent-glow);
  color: var(--text-secondary);
}

.rename-input{
  flex: 1;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
}

.folder-projects{
  padding-left: 14px;
  margin-left: 18px;
  margin-bottom: 4px;
  position: relative;
  animation: slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.folder-projects::before{
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 8px;
  width: 1px;
  background: linear-gradient(180deg, var(--accent-border), transparent);
}

.folder-empty{
  padding: 12px 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  opacity: 0.5;
  text-align: center;
}

/* 项目卡片 */
.project-card{
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  margin-bottom: 2px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  border: 1px solid transparent;
}

.project-card:hover{
  background: var(--bg-hover);
}

.project-card:active{
  transform: scale(0.98);
}

.project-card.active{
  background: var(--card-active-bg);
  border-color: var(--card-active-border);
  box-shadow: 0 0 16px var(--accent-glow), inset 0 1px 0 var(--accent-glow);
  padding: 6px 7px;
}

.project-card.active::before{
  content: '';
  position: absolute;
  left: -1px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  border-radius: 1px;
  background: var(--indicator);
  box-shadow: 0 0 8px var(--accent-glow);
  animation: barGrow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.project-card.dragging{ opacity: 0.35; transform: scale(0.97); }

.card-drag-handle{
  flex-shrink: 0;
  width: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity 200ms ease;
  cursor: grab;
}

.card-drag-handle:active{ cursor: grabbing; }
.project-card:hover .card-drag-handle{ opacity: 0.4; }
.card-drag-handle:hover{ opacity: 0.7 !important; }

.card-body{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

.card-top{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-name{
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 150ms ease;
}

.project-card.active .card-name{
  color: var(--text-primary);
  font-weight: 600;
}

.project-card:hover .card-name{
  color: var(--text-primary);
}

.card-status-dot{
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 300ms ease;
}

.card-bottom{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-command{
  font-size: 10px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 150ms ease;
}

.project-card:hover .card-command{
  color: var(--text-secondary);
}

.card-status-text{
  font-size: 9px;
  font-weight: 600;
  flex-shrink: 0;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
}

/* 星标 */
.star-btn{
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  opacity: 0;
  transition: all 150ms ease;
  border-radius: 5px;
}

.project-card:hover .star-btn{ opacity: 0.5; }
.star-btn:hover{ opacity: 1 !important; background: var(--bg-hover); transform: scale(1.1); }

.star-btn.active{
  opacity: 1 !important;
  color: #f59e0b;
  filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.4));
}

/* 空状态 */
.empty-list{
  text-align: center;
  padding: 48px 18px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.empty-list .hint{ font-size: 12px; margin-top: 6px; opacity: 0.6; }

/* 右键菜单 */
.context-menu{
  position: fixed;
  z-index: 1000;
  min-width: 150px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  padding: 4px;
  animation: scaleIn 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top left;
}

.context-item{
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-primary);
  border-radius: 6px;
  text-align: left;
  transition: all 150ms ease;
}

.context-item:hover{ background: var(--bg-hover); }
.context-item.danger{ color: var(--text-tertiary); }
.context-item.danger:hover{ color: var(--error); background: var(--error-bg); }
.context-divider{ height: 1px; background: var(--divider); margin: 3px 8px; }
</style>

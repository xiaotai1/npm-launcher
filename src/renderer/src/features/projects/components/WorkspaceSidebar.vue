<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { ActiveView, Project, Folder, ProcessStatus } from '../../../shared/types'
import ConfirmDialog from '../../../shared/ui/ConfirmDialog.vue'
import CreateProjectDialog from './CreateProjectDialog.vue'
import {
  canReorderProjects,
  filterProjects,
  getFolderProjects,
  getRootFavorites,
  getRootProjects,
  reorderProjectIds,
  type ProjectDropPlacement
} from '../model/projectFilters'
import { clampContextMenuPosition } from '../model/contextMenuPosition'
import { projectDisplayMeta } from '../model/projectDisplay'

const props = defineProps<{
  projects: Project[]
  folders: Folder[]
  selectedId: string | null
  statuses: Record<string, ProcessStatus>
  projectUrls: Record<string, string>
  activeView: ActiveView
}>()

const emit = defineEmits<{
  'select-overview': []
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
}>()

const createDialogVisible = ref(false)
const createButtonRef = ref<HTMLButtonElement | null>(null)

// 搜索
const searchQuery = ref('')

// 计算搜索过滤后的列表
const filteredProjects = computed(() => filterProjects(props.projects, searchQuery.value))

// 文件夹相关
const renamingFolder = ref<Folder | null>(null)
const renameInput = ref('')

// 拖拽状态
const dragProjectId = ref<string | null>(null)
const dragFolderId = ref<string | null>(null)
const dropTarget = ref<{
  type: 'project' | 'folder' | 'root'
  id?: string
  placement?: ProjectDropPlacement
} | null>(null)

// 右键菜单
const contextMenu = ref<{ visible: boolean; x: number; y: number; target: Project | Folder | null; type: 'project' | 'folder' | null }>({
  visible: false, x: 0, y: 0, target: null, type: null
})

const contextMenuSizes = {
  project: { width: 176, height: 188 },
  folder: { width: 176, height: 104 }
}

// 删除确认
const confirmState = ref<{ visible: boolean; type: 'project' | 'folder'; id: string; name: string }>({ visible: false, type: 'project', id: '', name: '' })

// 折叠状态
const collapsedFolders = ref<Set<string>>(new Set())

// 计算分组后的列表（使用搜索过滤）
const rootFavorites = computed(() => getRootFavorites(filteredProjects.value))

const rootNormal = computed(() => getRootProjects(filteredProjects.value))

function folderProjects(folderId: string) {
  return getFolderProjects(filteredProjects.value, folderId)
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

function projectMeta(project: Project) {
  return projectDisplayMeta(project, props.projectUrls[project.id])
}

function openAddForm() {
  createDialogVisible.value = true
}

defineExpose({ openAddForm })

function closeCreateDialog() {
  createDialogVisible.value = false
  nextTick(() => createButtonRef.value?.focus())
}

// 收藏
function onToggleFavorite(projectId: string, e: Event) {
  e.stopPropagation()
  emit('toggle-favorite', projectId)
}

// 拖拽
function onProjectDragStart(e: DragEvent, projectId: string) {
  if (searchQuery.value.trim()) {
    e.preventDefault()
    return
  }
  dragProjectId.value = projectId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', projectId)
  }
}

function projectDropPlacement(e: DragEvent): ProjectDropPlacement {
  const target = e.currentTarget as HTMLElement
  const bounds = target.getBoundingClientRect()
  return e.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
}

function onProjectDragOver(e: DragEvent, targetProjectId: string) {
  if (!dragProjectId.value || !canReorderProjects(props.projects, dragProjectId.value, targetProjectId)) return
  e.preventDefault()
  dropTarget.value = {
    type: 'project',
    id: targetProjectId,
    placement: projectDropPlacement(e)
  }
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onProjectDrop(e: DragEvent, targetProjectId: string) {
  e.preventDefault()
  if (dragProjectId.value && canReorderProjects(props.projects, dragProjectId.value, targetProjectId)) {
    const projectIds = reorderProjectIds(
      props.projects,
      dragProjectId.value,
      targetProjectId,
      projectDropPlacement(e)
    )
    if (projectIds.some((id, index) => id !== props.projects[index]?.id)) {
      emit('reorder', projectIds)
    }
  }
  onDragEnd()
}

function projectDragClass(projectId: string) {
  const isTarget = dropTarget.value?.type === 'project' && dropTarget.value.id === projectId
  return {
    dragging: dragProjectId.value === projectId,
    'drop-before': isTarget && dropTarget.value?.placement === 'before',
    'drop-after': isTarget && dropTarget.value?.placement === 'after'
  }
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
  const position = clampContextMenuPosition(
    { x: e.clientX, y: e.clientY },
    { width: window.innerWidth, height: window.innerHeight },
    contextMenuSizes.project
  )
  contextMenu.value = { visible: true, x: position.x, y: position.y, target: project, type: 'project' }
}

function onFolderContextMenu(e: MouseEvent, folder: Folder) {
  e.preventDefault()
  const position = clampContextMenuPosition(
    { x: e.clientX, y: e.clientY },
    { width: window.innerWidth, height: window.innerHeight },
    contextMenuSizes.folder
  )
  contextMenu.value = { visible: true, x: position.x, y: position.y, target: folder, type: 'folder' }
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
  <div class="h-full flex flex-col">
    <div class="px-4 pt-4 pb-2.5 flex items-center justify-between">
      <span class="text-[10px] font-semibold text-ttertiary uppercase tracking-[1.2px]">项目</span>
      <button ref="createButtonRef" class="create-button" @click="openAddForm">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        新建
      </button>
    </div>

    <!-- 搜索框 -->
    <div class="relative mx-2.5 mb-1.5">
      <svg class="search-icon absolute left-2 top-1/2 -translate-y-1/2 text-ttertiary pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        v-model="searchQuery"
        placeholder="搜索项目..."
        class="search-input w-full py-1.75 px-7 text-[12px] rounded-[7px] transition-all duration-200 ease-in-out box-border"
      />
      <button v-if="searchQuery" class="search-clear absolute right-1.5 top-1/2 -translate-y-1/2 w-5.5 h-5.5 flex items-center justify-center rounded text-ttertiary" aria-label="清空搜索" @click="searchQuery = ''">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="sidebar-nav-block">
      <button
        class="overview-nav"
        :class="{ active: activeView === 'overview' }"
        @click="emit('select-overview')"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
        <span>项目总览</span>
        <span class="overview-count">{{ projects.length }}</span>
      </button>
    </div>

    <div class="sidebar-list-heading">
      <span>项目列表</span>
      <i>{{ filteredProjects.length }}</i>
    </div>

    <!-- 项目列表 -->
    <div :class="['flex-1 overflow-y-auto px-2 pt-1 pb-2 project-list-scroll', { 'is-searching': searchQuery.trim() }]" @dragover="onRootDragOver" @drop="onRootDrop">

      <!-- 根级别收藏项目 -->
      <template v-if="rootFavorites.length">
        <div class="flex items-center gap-1.5 px-2 py-1.5 pt-1.5 pb-1 text-[10px] font-semibold text-ttertiary uppercase tracking-[0.8px] section-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          收藏
        </div>
        <div
          v-for="project in rootFavorites"
          :key="project.id"
          :class="['flex items-center gap-2 py-1.75 px-2 mb-0.5 rounded-[10px] cursor-pointer transition-all duration-200 ease-out relative border border-transparent project-card', { active: selectedId === project.id }, projectDragClass(project.id)]"
          :draggable="!searchQuery.trim()"
          @click="emit('select', project.id)"
          @contextmenu="onProjectContextMenu($event, project)"
          @dragstart="onProjectDragStart($event, project.id)"
          @dragover.stop="onProjectDragOver($event, project.id)"
          @drop.stop="onProjectDrop($event, project.id)"
          @dragend="onDragEnd"
        >
          <div class="shrink-0 w-3.5 flex items-center justify-center text-ttertiary opacity-0 transition-opacity duration-200 ease-out cursor-grab card-drag-handle" title="拖拽排序">
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
              <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
              <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
              <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-medium text-tsecondary whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 ease-out card-name">{{ project.name }}</span>
              <span class="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300" :style="{ background: getStatusInfo(project.id).color }"></span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] text-ttertiary font-mono whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 ease-out card-command" :title="project.path">{{ projectMeta(project) }}</span>
              <span class="text-[9px] font-semibold shrink-0 tracking-[0.5px] px-1.5 py-px rounded-full" :style="{ color: getStatusInfo(project.id).color }">{{ getStatusInfo(project.id).text }}</span>
            </div>
          </div>
          <button class="shrink-0 w-6 h-6 flex items-center justify-center text-ttertiary opacity-0 transition-all duration-150 ease-out rounded-md star-btn active" @click="onToggleFavorite(project.id, $event)" title="取消收藏" aria-label="取消收藏">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          </button>
        </div>
        <div v-if="folders.length || rootNormal.length" class="h-px mx-1 my-1.5 section-divider"></div>
      </template>

      <!-- 文件夹 -->
      <template v-for="folder in visibleFolders" :key="folder.id">
        <div
          :class="['flex items-center gap-1.75 py-1.75 px-2 mb-0.5 rounded-lg cursor-default transition-all duration-150 ease-out folder-row', { 'drop-highlight': dropTarget?.type === 'folder' && dropTarget?.id === folder.id, dragging: dragFolderId === folder.id }]"
          draggable="true"
          @dragstart="onFolderDragStart($event, folder.id)"
          @dragover.stop="dragFolderId ? onFolderDragOverForSort($event, folder.id) : onFolderDragOver($event, folder.id)"
          @drop.stop="dragFolderId ? onFolderDropForSort($event, folder.id) : onFolderDrop($event, folder.id)"
          @dragend="onDragEnd"
          @contextmenu="onFolderContextMenu($event, folder)"
        >
          <!-- 重命名模式 -->
          <template v-if="renamingFolder?.id === folder.id">
            <input
              v-model="renameInput"
              class="flex-1 py-1 px-2 text-xs rounded"
              @keyup.enter="confirmRename"
              @keyup.escape="cancelRename"
              @blur="confirmRename"
              autofocus
            />
          </template>
          <template v-else>
            <button class="w-5.5 h-5.5 flex items-center justify-center rounded text-ttertiary folder-toggle" :aria-label="isCollapsed(folder.id) ? `展开${folder.name}` : `收起${folder.name}`" @click="toggleCollapse(folder.id)">
              <svg :class="['chevron', { collapsed: isCollapsed(folder.id) }]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="shrink-0 folder-icon">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="flex-1 text-xs font-medium text-tsecondary whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 ease-out folder-name">{{ folder.name }}</span>
            <span class="text-[10px] px-2 rounded-[10px] min-w-5.5 text-center folder-count">{{ folderProjects(folder.id).length }}</span>
          </template>
        </div>
        <!-- 文件夹内的项目 -->
        <div v-if="!isCollapsed(folder.id)" class="pl-3.5 ml-4.5 mb-1 relative folder-projects">
          <div
            v-for="project in folderProjects(folder.id)"
            :key="project.id"
            :class="['flex items-center gap-2 py-1.75 px-2 mb-0.5 rounded-[10px] cursor-pointer transition-all duration-200 ease-out relative border border-transparent project-card', { active: selectedId === project.id }, projectDragClass(project.id)]"
            :draggable="!searchQuery.trim()"
            @click="emit('select', project.id)"
            @contextmenu="onProjectContextMenu($event, project)"
            @dragstart="onProjectDragStart($event, project.id)"
            @dragover.stop="onProjectDragOver($event, project.id)"
            @drop.stop="onProjectDrop($event, project.id)"
            @dragend="onDragEnd"
          >
            <div class="shrink-0 w-3.5 flex items-center justify-center text-ttertiary opacity-0 transition-opacity duration-200 ease-out cursor-grab card-drag-handle" title="拖拽排序">
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
                <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
                <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-medium text-tsecondary whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 ease-out card-name">{{ project.name }}</span>
                <span class="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300" :style="{ background: getStatusInfo(project.id).color }"></span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] text-ttertiary font-mono whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 ease-out card-command" :title="project.path">{{ projectMeta(project) }}</span>
                <span class="text-[9px] font-semibold shrink-0 tracking-[0.5px] px-1.5 py-px rounded-full" :style="{ color: getStatusInfo(project.id).color }">{{ getStatusInfo(project.id).text }}</span>
              </div>
            </div>
            <button :class="['shrink-0 w-6 h-6 flex items-center justify-center text-ttertiary opacity-0 transition-all duration-150 ease-out rounded-md star-btn', { active: project.favorite }]" @click="onToggleFavorite(project.id, $event)" :title="project.favorite ? '取消收藏' : '收藏'" :aria-label="project.favorite ? '取消收藏' : '收藏'">
              <svg v-if="project.favorite" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            </button>
          </div>
          <div v-if="folderProjects(folder.id).length === 0" class="py-3 text-xs text-ttertiary opacity-50 text-center">
            拖拽项目到此处
          </div>
        </div>
      </template>

      <!-- 根级别普通项目 -->
      <div
        v-for="project in rootNormal"
        :key="project.id"
        :class="['flex items-center gap-2 py-1.75 px-2 mb-0.5 rounded-[10px] cursor-pointer transition-all duration-200 ease-out relative border border-transparent project-card', { active: selectedId === project.id }, projectDragClass(project.id)]"
        :draggable="!searchQuery.trim()"
        @click="emit('select', project.id)"
        @contextmenu="onProjectContextMenu($event, project)"
        @dragstart="onProjectDragStart($event, project.id)"
        @dragover.stop="onProjectDragOver($event, project.id)"
        @drop.stop="onProjectDrop($event, project.id)"
        @dragend="onDragEnd"
      >
        <div class="shrink-0 w-3.5 flex items-center justify-center text-ttertiary opacity-0 transition-opacity duration-200 ease-out cursor-grab card-drag-handle" title="拖拽排序">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
            <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
            <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-0.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-tsecondary whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 ease-out card-name">{{ project.name }}</span>
            <span class="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300" :style="{ background: getStatusInfo(project.id).color }"></span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] text-ttertiary font-mono whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 ease-out card-command" :title="project.path">{{ projectMeta(project) }}</span>
            <span class="text-[9px] font-semibold shrink-0 tracking-[0.5px] px-1.5 py-px rounded-full" :style="{ color: getStatusInfo(project.id).color }">{{ getStatusInfo(project.id).text }}</span>
          </div>
        </div>
        <button :class="['shrink-0 w-6 h-6 flex items-center justify-center text-ttertiary opacity-0 transition-all duration-150 ease-out rounded-md star-btn', { active: project.favorite }]" @click="onToggleFavorite(project.id, $event)" :title="project.favorite ? '取消收藏' : '收藏'" :aria-label="project.favorite ? '取消收藏' : '收藏'">
          <svg v-if="project.favorite" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
        </button>
      </div>

      <div v-if="filteredProjects.length === 0" class="text-center py-12 px-4.5 text-ttertiary text-[13px]">
        <p>{{ searchQuery ? '未找到匹配项目' : '暂无项目' }}</p>
        <p class="text-xs mt-1.5 opacity-60">{{ searchQuery ? '尝试其他关键词' : '点击"新建"添加' }}</p>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="fixed z-1000 min-w-37.5 border border-border rounded-xl p-1 context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <template v-if="contextMenu.type === 'project'">
          <button class="flex items-center gap-2 w-full py-2 px-3 text-xs text-tprimary rounded-md text-left transition-all duration-150 ease-out context-item" @click="handleEdit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>编辑</span>
          </button>
          <button class="flex items-center gap-2 w-full py-2 px-3 text-xs text-tprimary rounded-md text-left transition-all duration-150 ease-out context-item" @click="handleOpenFolder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span>打开文件夹</span>
          </button>
          <button class="flex items-center gap-2 w-full py-2 px-3 text-xs text-tprimary rounded-md text-left transition-all duration-150 ease-out context-item" @click="handleOpenInVscode">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            <span>在 VS Code 中打开</span>
          </button>
          <div class="h-px mx-2 my-0.75 context-divider"></div>
          <button class="flex items-center gap-2 w-full py-2 px-3 text-xs rounded-md text-left transition-all duration-150 ease-out context-item danger" @click="handleDelete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>删除</span>
          </button>
        </template>
        <template v-if="contextMenu.type === 'folder'">
          <button class="flex items-center gap-2 w-full py-2 px-3 text-xs text-tprimary rounded-md text-left transition-all duration-150 ease-out context-item" @click="handleRenameFolder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>重命名</span>
          </button>
          <div class="h-px mx-2 my-0.75 context-divider"></div>
          <button class="flex items-center gap-2 w-full py-2 px-3 text-xs rounded-md text-left transition-all duration-150 ease-out context-item danger" @click="handleDelete">
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
    <CreateProjectDialog
      :visible="createDialogVisible"
      @close="closeCreateDialog"
      @add="emit('add', $event)"
      @add-folder="emit('add-folder', $event)"
    />
  </div>
</template>

<style scoped>
.sidebar-nav-block {
  margin: 0 10px 10px;
  padding: 6px;
  border: 1px solid var(--border-muted);
  border-radius: 11px;
  background: var(--sidebar-nav-bg);
}

.overview-nav {
  width: 100%;
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 650;
  text-align: left;
}

.overview-nav:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.overview-nav.active {
  color: var(--accent-primary);
  background: var(--nav-active-bg);
  border-color: var(--nav-active-border);
  box-shadow: var(--shadow-sm);
}

.overview-count {
  margin-left: auto;
  min-width: 22px;
  padding: 1px 7px;
  border-radius: 999px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  font-size: 10px;
  text-align: center;
}

.sidebar-list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 2px 12px 6px;
  padding: 0 4px;
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 700;
}

.sidebar-list-heading span {
  letter-spacing: 0;
}

.sidebar-list-heading i {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  font-style: normal;
  text-align: center;
}

.create-button {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  border-radius: 7px;
  color: #fff;
  background: var(--accent-primary);
  box-shadow: 0 3px 10px var(--accent-glow);
  font-size: 11px;
  font-weight: 700;
}

.create-button:hover {
  background: var(--accent-primary-hover);
  box-shadow: 0 5px 14px var(--accent-glow);
}

/* 搜索框 — ::placeholder 和 focus 无法用 Tailwind 处理 */
.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--accent-glow);
  outline: none;
}

.search-clear:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 分区标签 — ::after 渐变 */
.section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.15), transparent);
}

.section-divider {
  background: var(--divider);
}

/* 文件夹 — 父子选择器 + CSS 变量 */
.folder-row:hover {
  background: var(--bg-hover);
}

.folder-row.drop-highlight {
  background: var(--accent-glow);
  border: 1px dashed var(--accent-primary);
}

.folder-toggle:hover {
  background: var(--bg-active);
}

.chevron {
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-block;
}

.chevron.collapsed {
  transform: rotate(0deg);
}

.chevron:not(.collapsed) {
  transform: rotate(90deg);
}

.folder-icon {
  color: var(--accent-primary);
  filter: drop-shadow(0 0 3px var(--accent-glow));
  transition: filter 200ms ease;
}

.folder-row:hover .folder-icon {
  filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.35));
}

.folder-count {
  color: var(--text-tertiary);
  background: var(--bg-elevated);
  transition: all 200ms ease;
}

.folder-row:hover .folder-count {
  background: var(--accent-glow);
  color: var(--text-secondary);
}

/* 文件夹内项目 — ::before 渐变线 */
.folder-projects {
  animation: slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.folder-projects::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 8px;
  width: 1px;
  background: linear-gradient(180deg, var(--accent-border), transparent);
}

/* 项目卡片 — 复杂状态 + ::before 指示器 */
.project-card {
  animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.project-card:hover {
  background: var(--bg-hover);
}

.project-card.dragging {
  opacity: 0.48;
}

.project-card.active {
  background: var(--project-active-bg);
  border-color: var(--project-active-border);
  box-shadow: var(--project-active-shadow);
}

.project-card.drop-before {
  box-shadow: inset 0 2px 0 var(--accent-primary);
}

.project-card.drop-after {
  box-shadow: inset 0 -2px 0 var(--accent-primary);
}

.project-card.active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  border-radius: 1px;
  background: var(--accent-primary);
  animation: barGrow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.project-card .card-drag-handle {
  opacity: 0.24;
}

.project-card:hover .card-drag-handle {
  opacity: 0.4;
}

.project-list-scroll.is-searching .card-drag-handle {
  opacity: 0;
}

.card-drag-handle:hover {
  opacity: 0.7 !important;
}

.card-drag-handle:active {
  cursor: grabbing;
}

.project-card.active .card-name {
  color: var(--text-primary);
  font-weight: 600;
}

.project-card:hover .card-name {
  color: var(--text-primary);
}

.project-card:hover .card-command {
  color: var(--text-secondary);
}

/* 星标 — 父子选择器 + CSS 变量 */
.project-card:hover .star-btn {
  opacity: 0.5;
}

.star-btn:hover {
  opacity: 1 !important;
  background: var(--bg-hover);
  transform: scale(1.1);
}

.star-btn.active {
  opacity: 1 !important;
  color: #f59e0b;
  filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.4));
}

/* 右键菜单 — CSS 变量 + animation */
.context-menu {
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
  animation: scaleIn 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top left;
}

.context-item:hover {
  background: var(--bg-hover);
}

.context-item.danger {
  color: var(--text-tertiary);
}

.context-item.danger:hover {
  color: var(--error);
  background: var(--error-bg);
}

.context-divider {
  background: var(--divider);
}
</style>

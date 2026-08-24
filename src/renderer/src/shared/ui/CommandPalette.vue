<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ProcessStatus, Project } from '../../shared/types'

const props = defineProps<{
  visible: boolean
  projects: Project[]
  statuses: Record<string, ProcessStatus>
}>()

const emit = defineEmits<{
  close: []
  'add-project': []
  'import-config': []
  'toggle-theme': []
  'start-all': []
  'stop-all': []
  'select-project': [id: string]
  'start-project': [id: string]
  'stop-project': [id: string]
}>()

type ActionCommand = {
  id: string
  group: string
  label: string
  description: string
  keywords: string
  icon: 'add' | 'import' | 'theme' | 'play' | 'stop' | 'project'
  action: () => void
}

type FilteredCommand = ActionCommand & { index: number }

const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLUListElement | null>(null)

function getStatusLabel(projectId: string) {
  const status = props.statuses[projectId]?.status
  if (status === 'running') return '运行中'
  if (status === 'error') return '异常'
  return '未启动'
}

const actionCommands = computed<ActionCommand[]>(() => [
  {
    id: 'add-project',
    group: '操作',
    label: '添加项目',
    description: '从本地目录添加一个新的 NPM 项目',
    keywords: '新建 新增 添加 add project',
    icon: 'add',
    action: () => emit('add-project')
  },
  {
    id: 'import-config',
    group: '操作',
    label: '导入配置',
    description: '从 JSON 文件恢复项目列表',
    keywords: '导入 import 恢复 配置',
    icon: 'import',
    action: () => emit('import-config')
  },
  {
    id: 'start-all',
    group: '批量',
    label: '启动所有项目',
    description: '一次性启动全部已配置的项目',
    keywords: '全部启动 start all 批量',
    icon: 'play',
    action: () => emit('start-all')
  },
  {
    id: 'stop-all',
    group: '批量',
    label: '停止所有项目',
    description: '停止当前正在运行的所有项目',
    keywords: '全部停止 stop all',
    icon: 'stop',
    action: () => emit('stop-all')
  },
  {
    id: 'toggle-theme',
    group: '偏好',
    label: '切换主题',
    description: '在浅色 / 深色 / 跟随系统之间切换',
    keywords: '主题 切换 theme 深色 浅色',
    icon: 'theme',
    action: () => emit('toggle-theme')
  }
])

const projectCommands = computed<ActionCommand[]>(() =>
  props.projects.map(project => ({
    id: `project-${project.id}`,
    group: '项目',
    label: project.name,
    description: `npm run ${project.command} · ${getStatusLabel(project.id)}`,
    keywords: `${project.name} ${project.command} ${project.path}`,
    icon: 'project',
    action: () => {
      if (props.statuses[project.id]?.status === 'running') emit('stop-project', project.id)
      else emit('start-project', project.id)
    }
  }))
)

const allCommands = computed<ActionCommand[]>(() => [
  ...actionCommands.value,
  ...projectCommands.value
])

const filteredCommands = computed<FilteredCommand[]>(() => {
  const q = query.value.trim().toLowerCase()
  const source = q
    ? allCommands.value.filter(command =>
        command.label.toLowerCase().includes(q)
        || command.keywords.toLowerCase().includes(q)
        || command.description.toLowerCase().includes(q)
      )
    : allCommands.value
  return source.map((command, index) => ({ ...command, index }))
})

const groupedCommands = computed(() => {
  const groups: { name: string; items: FilteredCommand[] }[] = []
  for (const command of filteredCommands.value) {
    let group = groups.find(g => g.name === command.group)
    if (!group) {
      group = { name: command.group, items: [] }
      groups.push(group)
    }
    group.items.push(command)
  }
  return groups
})

watch(filteredCommands, () => {
  selectedIndex.value = 0
  nextTick(() => scrollSelectedIntoView())
})

watch(() => props.visible, async visible => {
  if (visible) {
    query.value = ''
    selectedIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

function runCommand(command: ActionCommand) {
  command.action()
  emit('close')
}

function scrollSelectedIntoView() {
  const list = listRef.value
  if (!list) return
  const target = list.querySelector(`[data-index="${selectedIndex.value}"]`) as HTMLElement | null
  if (target) target.scrollIntoView({ block: 'nearest' })
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const max = filteredCommands.value.length - 1
    if (max < 0) return
    selectedIndex.value = Math.min(max, selectedIndex.value + 1)
    nextTick(scrollSelectedIntoView)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    const max = filteredCommands.value.length - 1
    if (max < 0) return
    selectedIndex.value = Math.max(0, selectedIndex.value - 1)
    nextTick(scrollSelectedIntoView)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const command = filteredCommands.value[selectedIndex.value]
    if (command) runCommand(command)
  }
}

function onOverlayClick() { emit('close') }

function onItemHover(globalIndex: number) { selectedIndex.value = globalIndex }

function onItemClick(globalIndex: number) {
  const command = filteredCommands.value[globalIndex]
  if (command) runCommand(command)
}

const empty = computed(() => filteredCommands.value.length === 0)
</script>

<template>
  <Teleport to="body">
    <Transition name="command-palette">
      <div v-if="visible" class="command-palette-overlay" @click="onOverlayClick">
        <div class="command-palette-dialog" role="dialog" aria-label="命令面板" @click.stop>
          <div class="command-palette-input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="command-palette-search-icon" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="command-palette-input"
              placeholder="输入命令或项目名…"
              autocomplete="off"
              spellcheck="false"
              @keydown="onKeyDown"
            />
            <kbd class="command-palette-esc">Esc</kbd>
          </div>

          <ul v-if="!empty" ref="listRef" class="command-palette-list" role="listbox">
            <template v-for="group in groupedCommands" :key="group.name">
              <li class="command-palette-group-title">{{ group.name }}</li>
              <li
                v-for="command in group.items"
                :key="command.id"
                :data-index="command.index"
                :class="['command-palette-item', { active: command.index === selectedIndex }]"
                role="option"
                :aria-selected="command.index === selectedIndex"
                @mouseenter="onItemHover(command.index)"
                @mousedown.prevent="onItemClick(command.index)"
              >
                <span class="command-palette-icon" :data-icon="command.icon">
                  <svg v-if="command.icon === 'add'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                  <svg v-else-if="command.icon === 'import'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 20h16"/></svg>
                  <svg v-else-if="command.icon === 'play'" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                  <svg v-else-if="command.icon === 'stop'" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  <svg v-else-if="command.icon === 'theme'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
                </span>
                <span class="command-palette-text">
                  <strong>{{ command.label }}</strong>
                  <span>{{ command.description }}</span>
                </span>
                <svg v-if="command.index === selectedIndex" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="command-palette-enter"><polyline points="9 10 4 15 9 20"/><line x1="5" y1="15" x2="20" y2="15"/></svg>
              </li>
            </template>
          </ul>
          <div v-else class="command-palette-empty">
            <span>未找到匹配的命令</span>
            <small>试试"添加项目"、"全部启动"或项目名</small>
          </div>

          <footer class="command-palette-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span><kbd>↵</kbd> 执行</span>
            <span><kbd>Esc</kbd> 关闭</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.command-palette-overlay { position: fixed; inset: 0; z-index: 2200; display: flex; align-items: flex-start; justify-content: center; padding: 14vh 16px 16px; background: rgba(15, 23, 42, 0.32); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }

.command-palette-dialog { width: min(560px, 100%); max-height: 70vh; display: flex; flex-direction: column; border-radius: 16px; background: var(--bg-elevated); box-shadow: 0 28px 64px rgba(15, 23, 42, 0.32), 0 2px 6px rgba(15, 23, 42, 0.16); overflow: hidden; }
:root[data-theme='dark'] .command-palette-dialog { background: rgba(22, 28, 40, 0.96); border: 1px solid rgba(255, 255, 255, 0.08); }

.command-palette-input-wrap { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border-muted); }
.command-palette-search-icon { color: var(--text-tertiary); flex: none; }
.command-palette-input { flex: 1; min-width: 0; padding: 4px 0; border: none; outline: none; background: transparent; color: var(--text-primary); font: 15px/1.4 var(--font-sans, system-ui); }
.command-palette-input::placeholder { color: var(--text-tertiary); }
.command-palette-esc { display: inline-grid; place-items: center; min-width: 28px; height: 22px; padding: 0 6px; border: 1px solid var(--border-default); border-radius: 5px; color: var(--text-tertiary); background: var(--bg-surface); font: 700 11px/1 var(--font-mono); }

.command-palette-list { flex: 1; min-height: 0; overflow-y: auto; margin: 0; padding: 6px; list-style: none; }
.command-palette-group-title { padding: 9px 12px 4px; color: var(--text-tertiary); font: 700 10px/1 var(--font-mono); letter-spacing: 0.14em; text-transform: uppercase; }
.command-palette-group-title + .command-palette-item { margin-top: 0; }

.command-palette-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; color: var(--text-secondary); cursor: pointer; transition: background 120ms ease, color 120ms ease; }
.command-palette-item.active { background: var(--accent-glow); color: var(--text-primary); }
.command-palette-icon { display: grid; place-items: center; width: 26px; height: 26px; flex: none; border-radius: 7px; background: var(--bg-subtle); color: var(--text-secondary); }
.command-palette-item.active .command-palette-icon { background: var(--accent-primary); color: #fff; }
.command-palette-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.command-palette-text strong { min-width: 0; overflow: hidden; color: var(--text-primary); font-size: 13.5px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.command-palette-text span { min-width: 0; overflow: hidden; color: var(--text-tertiary); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.command-palette-enter { color: var(--accent-primary); flex: none; }

.command-palette-empty { padding: 28px 20px; color: var(--text-tertiary); text-align: center; }
.command-palette-empty span { display: block; color: var(--text-secondary); font-size: 13px; font-weight: 650; }
.command-palette-empty small { display: block; margin-top: 4px; font-size: 11.5px; }

.command-palette-footer { display: flex; flex-wrap: wrap; gap: 14px; padding: 9px 14px; border-top: 1px solid var(--border-muted); background: color-mix(in srgb, var(--bg-subtle) 60%, transparent); color: var(--text-tertiary); font-size: 11px; }
.command-palette-footer kbd { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; margin: 0 1px; border: 1px solid var(--border-default); border-radius: 4px; background: var(--bg-elevated); font: 700 10px/1 var(--font-mono); color: var(--text-secondary); }

.command-palette-enter-from, .command-palette-leave-to { opacity: 0; transform: translateY(-8px); }
.command-palette-enter-active, .command-palette-leave-active { transition: opacity 160ms ease, transform 160ms ease; }
</style>

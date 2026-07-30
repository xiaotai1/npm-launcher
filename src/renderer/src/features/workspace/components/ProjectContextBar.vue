<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ProcessStatus, Project } from '../../../shared/types'
import { buildLaunchCommands } from '../model/launchCommands'

const props = defineProps<{
  project: Project
  status: ProcessStatus | null
  globalNodeVersion: string | null
  localUrl: string | null
}>()

const emit = defineEmits<{
  start: []
  stop: []
  edit: []
  'open-folder': []
  'open-vscode': []
  'open-url': [url: string]
  'set-command': [command: string]
}>()

const packageScripts = ref<string[]>([])
const showCommandMenu = ref(false)
const commandPickerRef = ref<HTMLElement | null>(null)
const launchCommands = computed(() => buildLaunchCommands(props.project.command, packageScripts.value))
const canSwitchCommand = computed(() => props.status?.status !== 'running' && launchCommands.value.length > 1)

async function loadPackageScripts() {
  const result = await window.electronAPI.getPackageScripts(props.project.path)
  packageScripts.value = result.scripts
}

function toggleCommandMenu() {
  if (!canSwitchCommand.value) return
  showCommandMenu.value = !showCommandMenu.value
}

function selectCommand(command: string) {
  if (command && command !== props.project.command) {
    emit('set-command', command)
  }
  showCommandMenu.value = false
}

function handleClickOutside(event: MouseEvent) {
  if (!showCommandMenu.value || !commandPickerRef.value) return
  if (!commandPickerRef.value.contains(event.target as Node)) {
    showCommandMenu.value = false
  }
}

onMounted(() => {
  loadPackageScripts()
  document.addEventListener('click', handleClickOutside)
})
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
watch(() => props.project.path, loadPackageScripts)
watch(() => props.project.id, () => { showCommandMenu.value = false })
watch(() => props.status?.status, () => {
  if (!canSwitchCommand.value) {
    showCommandMenu.value = false
  }
})
</script>

<template>
  <header class="project-context-bar">
    <div class="project-context-main">
      <div class="project-title-row">
        <h1 :title="project.name">{{ project.name }}</h1>
        <span :class="['context-status', status?.status || 'stopped']">
          <i aria-hidden="true"></i>
          {{ status?.status === 'running' ? '运行中' : status?.status === 'error' ? '异常' : '未启动' }}
          <span v-if="status?.pid">· PID {{ status.pid }}</span>
        </span>
      </div>
      <div class="project-context-meta">
        <span class="project-path" :title="project.path">{{ project.path }}</span>
        <span class="node-meta">Node {{ project.nodeVersion || globalNodeVersion || '系统' }}</span>
      </div>
    </div>
    <div class="project-context-actions">
      <div ref="commandPickerRef" class="command-picker-wrap">
        <button
          class="command-picker"
          type="button"
          title="选择当前项目的默认启动脚本"
          :aria-expanded="showCommandMenu"
          aria-haspopup="menu"
          :disabled="!canSwitchCommand"
          @click="toggleCommandMenu"
        >
          <span class="command-picker-label">脚本</span>
          <strong>{{ project.command }}</strong>
          <svg v-if="canSwitchCommand" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div v-if="showCommandMenu && canSwitchCommand" class="command-menu" role="menu">
          <button
            v-for="command in launchCommands"
            :key="command"
            :class="['command-option', { active: command === project.command }]"
            type="button"
            role="menuitem"
            @click="selectCommand(command)"
          >
            <span>{{ command }}</span>
            <svg v-if="command === project.command" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>
      </div>
      <button class="icon-action" aria-label="打开项目目录" title="打开项目目录" data-tooltip="打开项目目录" @click="emit('open-folder')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/></svg>
      </button>
      <button class="icon-action" aria-label="用 VS Code 打开项目" title="用 VS Code 打开项目" data-tooltip="用 VS Code 打开" @click="emit('open-vscode')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m16 5 5 3v8l-5 3-9-7z"/><path d="m7 12-4-3 2-2 4 3m-2 2-4 3 2 2 4-3"/></svg>
      </button>
      <button v-if="localUrl" class="button-secondary" :title="localUrl" @click="emit('open-url', localUrl)">打开页面</button>
      <button class="button-secondary" @click="emit('edit')">编辑</button>
      <button v-if="status?.status === 'running'" class="context-primary stop" @click="emit('stop')">停止</button>
      <button v-else class="context-primary" @click="emit('start')">启动</button>
    </div>
  </header>
</template>

<style scoped>
.project-context-bar { min-height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 22px; border-bottom: 1px solid var(--border-default); background: var(--bg-surface); }
.project-context-main { min-width: 0; }.project-title-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
h1 { min-width: 0; margin: 0; overflow: hidden; color: var(--text-primary); font-size: 18px; line-height: 1.2; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
.context-status { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 999px; color: var(--text-tertiary); background: var(--bg-subtle); font: 10px var(--font-mono); }
.context-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }.context-status.running { color: var(--success); background: var(--success-bg); }.context-status.error { color: var(--error); background: var(--error-bg); }
.project-context-meta { display: flex; align-items: center; gap: 10px; margin-top: 9px; color: var(--text-tertiary); font: 11px var(--font-mono); }
.project-path { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-meta { flex: none; }
.command-picker-wrap { position: relative; }
.command-picker { height: 34px; min-width: 118px; max-width: 176px; display: inline-flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--border-default); border-radius: 8px; color: var(--text-secondary); background: var(--bg-surface); box-shadow: var(--shadow-sm); }
.command-picker:hover:not(:disabled), .command-picker[aria-expanded='true'] { border-color: var(--accent-border); background: var(--bg-hover); }
.command-picker:disabled { cursor: default; opacity: 1; }
.command-picker-label { flex: none; color: var(--text-tertiary); font-family: var(--font-sans); font-size: 11px; font-weight: 700; }
.command-picker strong { min-width: 0; overflow: hidden; color: var(--accent-primary); font: 700 13px/1 var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
.command-picker svg { flex: none; color: var(--accent-primary); opacity: .85; }
.command-menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 50; min-width: 140px; padding: 5px; border: 1px solid var(--border-default); border-radius: 8px; background: var(--bg-surface); box-shadow: var(--shadow-lg); }
.command-option { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 8px; border-radius: 6px; color: var(--text-secondary); background: transparent; font: 700 12px/1 var(--font-mono); text-align: left; }
.command-option:hover { color: var(--accent-primary); background: var(--bg-hover); }
.command-option.active { color: var(--accent-primary); background: var(--accent-glow); }
.command-option svg { flex: none; }
.project-context-actions { display: flex; align-items: center; gap: 7px; flex: none; }.icon-action { position: relative; width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--border-default); border-radius: 8px; color: var(--text-secondary); background: var(--bg-surface); }.icon-action:hover { color: var(--accent-primary); border-color: var(--accent-border); background: var(--bg-hover); }
.icon-action::after { content: attr(data-tooltip); position: absolute; right: 50%; bottom: -34px; z-index: 20; transform: translateX(50%) translateY(-2px); padding: 5px 8px; border: 1px solid var(--border-default); border-radius: 6px; color: var(--text-primary); background: var(--bg-surface); box-shadow: var(--shadow-sm); font-size: 11px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 140ms ease, transform 140ms ease; }
.icon-action:hover::after { opacity: 1; transform: translateX(50%) translateY(0); }
.context-primary { min-width: 68px; min-height: 34px; padding: 0 14px; border-radius: 8px; color: #fff; background: var(--accent-primary); font-size: 12px; font-weight: 700; }.context-primary.stop { background: var(--error); }
</style>

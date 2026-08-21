<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const commandMenuPos = ref({ top: 0, left: 0, width: 140 })
const launchCommands = computed(() => buildLaunchCommands(props.project.command, packageScripts.value))
const canSwitchCommand = computed(() => props.status?.status !== 'running' && launchCommands.value.length > 1)

async function loadPackageScripts() {
  const result = await window.desktopAPI.getPackageScripts(props.project.path)
  packageScripts.value = result.scripts
}

function updateCommandMenuPos() {
  const btn = commandPickerRef.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  commandMenuPos.value = {
    top: rect.bottom + 6,
    left: rect.left,
    width: Math.max(rect.width, 140)
  }
}

function toggleCommandMenu() {
  if (!canSwitchCommand.value) return
  if (showCommandMenu.value) {
    showCommandMenu.value = false
    return
  }
  showCommandMenu.value = true
  nextTick(updateCommandMenuPos)
}

function selectCommand(command: string) {
  if (command && command !== props.project.command) {
    emit('set-command', command)
  }
  showCommandMenu.value = false
}

function handleClickOutside(event: MouseEvent) {
  if (!showCommandMenu.value || !commandPickerRef.value) return
  const target = event.target as Node
  if (!commandPickerRef.value.contains(target)) {
    showCommandMenu.value = false
  }
}

function handleReposition() {
  if (showCommandMenu.value) updateCommandMenuPos()
}

onMounted(() => {
  loadPackageScripts()
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', handleReposition)
  window.addEventListener('scroll', handleReposition, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleReposition)
  window.removeEventListener('scroll', handleReposition, true)
})
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
        <Teleport to="body">
          <div
            v-if="showCommandMenu && canSwitchCommand"
            class="command-menu"
            role="menu"
            :style="{ top: commandMenuPos.top + 'px', left: commandMenuPos.left + 'px', width: commandMenuPos.width + 'px' }"
          >
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
        </Teleport>
      </div>
      <button class="icon-action" aria-label="打开项目目录" data-tooltip="打开项目目录" @click="emit('open-folder')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/></svg>
      </button>
      <button class="icon-action" aria-label="用 VS Code 打开项目" data-tooltip="用 VS Code 打开" @click="emit('open-vscode')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m16 5 5 3v8l-5 3-9-7z"/><path d="m7 12-4-3 2-2 4 3m-2 2-4 3 2 2 4-3"/></svg>
      </button>
      <button v-if="localUrl" class="button-secondary" :title="localUrl" :disabled="status?.status !== 'running'" @click="emit('open-url', localUrl)">打开页面</button>
      <button class="button-secondary" @click="emit('edit')">编辑</button>
      <button v-if="status?.status === 'running'" class="context-primary stop" @click="emit('stop')">停止</button>
      <button v-else class="context-primary" @click="emit('start')">启动</button>
    </div>
  </header>
</template>

<style scoped>
.project-context-bar { position: relative; z-index: 8; overflow: visible; min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 22px; border-bottom: 1px solid var(--glass-border); background: var(--glass-fill); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset; }
.project-context-bar::after { content: ''; position: absolute; left: 22px; right: 22px; bottom: -1px; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-primary) 30%, transparent) 30%, color-mix(in srgb, var(--accent-primary) 30%, transparent) 70%, transparent); pointer-events: none; }
.project-context-main { position: relative; min-width: 0; }
.project-title-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
h1 { min-width: 0; margin: 0; overflow: hidden; color: var(--text-primary); font-size: 18px; line-height: 1.2; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
.context-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid currentColor; border-radius: 999px; color: var(--text-tertiary); background: linear-gradient(180deg, color-mix(in srgb, currentColor 18%, transparent) 0%, color-mix(in srgb, currentColor 8%, transparent) 100%); font: 11px var(--font-mono); }
.context-status i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 7px currentColor; }
.context-status.running { color: var(--success); border-color: color-mix(in srgb, var(--success) 30%, transparent); }
.context-status.error { color: var(--error); border-color: color-mix(in srgb, var(--error) 30%, transparent); }
.project-context-meta { display: flex; align-items: center; gap: 10px; margin-top: 9px; color: var(--text-tertiary); font: 12px var(--font-mono); }
.project-path { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-meta { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border: 1px solid var(--border-muted); border-radius: 6px; background: color-mix(in srgb, var(--bg-subtle) 60%, transparent); }
.command-picker-wrap { position: relative; }
.command-picker { height: 36px; min-width: 132px; max-width: 192px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; border: 1px solid var(--border-default); border-radius: 10px; color: var(--text-secondary); background: linear-gradient(180deg, var(--bg-surface) 0%, color-mix(in srgb, var(--bg-subtle) 80%, transparent) 100%); box-shadow: var(--shadow-sm); transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease, transform 180ms ease; }
.command-picker:hover:not(:disabled), .command-picker[aria-expanded='true'] { border-color: var(--accent-border); background: var(--bg-hover); transform: translateY(-1px); box-shadow: var(--shadow-md); }
.command-picker:disabled { cursor: default; opacity: 1; }
.command-picker-label { flex: none; color: var(--text-tertiary); font-family: var(--font-sans); font-size: 12px; font-weight: 700; }
.command-picker strong { flex: 1; min-width: 0; overflow: hidden; color: var(--accent-primary); font: 700 14px/1 var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
.command-picker svg { flex: none; margin-left: auto; color: var(--accent-primary); opacity: .85; }
/* Teleport 到 body，position: fixed + viewport 坐标，脱离一切祖先裁切/堆叠上下文 */
.command-menu { position: fixed; z-index: 10000; min-width: 140px; padding: 5px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--glass-fill-strong); backdrop-filter: blur(calc(var(--glass-blur) + 6px)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 6px)) saturate(var(--glass-saturate)); box-shadow: var(--glass-shadow); animation: glassIn 0.18s cubic-bezier(0.16, 1, 0.3, 1); }
.command-option { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 8px; border-radius: 6px; color: var(--text-secondary); background: transparent; font: 700 13px/1 var(--font-mono); text-align: left; }
.command-option:hover { color: var(--accent-primary); background: var(--bg-hover); }
.command-option.active { color: var(--accent-primary); background: var(--accent-glow); }
.command-option svg { flex: none; }
.project-context-actions { position: relative; z-index: 2; display: flex; align-items: center; gap: 7px; flex: none; }
.icon-action { position: relative; width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--border-default); border-radius: 10px; color: var(--text-secondary); background: linear-gradient(180deg, var(--bg-surface) 0%, color-mix(in srgb, var(--bg-subtle) 80%, transparent) 100%); transition: transform 160ms ease, border-color 180ms ease, background 180ms ease, color 180ms ease, box-shadow 180ms ease; }
.icon-action:hover { transform: translateY(-1px); color: var(--accent-primary); border-color: var(--accent-border); background: var(--bg-hover); box-shadow: var(--shadow-md); }
.icon-action::after { content: attr(data-tooltip); position: absolute; right: 50%; bottom: -40px; z-index: 200; transform: translateX(50%) translateY(-2px); padding: 6px 9px; border: 1px solid var(--border-default); border-radius: 7px; color: var(--text-primary); background: var(--bg-surface); box-shadow: var(--shadow-md); font-size: 12px; font-weight: 650; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 140ms ease, transform 140ms ease; }
.icon-action:hover::after { opacity: 1; transform: translateX(50%) translateY(0); }
.context-primary { min-width: 76px; min-height: 36px; padding: 0 16px; border-radius: 10px; color: #fff; background: var(--accent-primary); box-shadow: 0 4px 12px var(--accent-glow); font-size: 13px; font-weight: 700; transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease; }
.context-primary:hover { transform: translateY(-1px); background: var(--accent-primary-hover); box-shadow: 0 8px 18px var(--accent-glow); }
.context-primary.stop { background: var(--error); box-shadow: 0 3px 10px color-mix(in srgb, var(--error) 30%, transparent); }
.context-primary.stop:hover { background: color-mix(in srgb, var(--error) 88%, #000); box-shadow: 0 6px 16px color-mix(in srgb, var(--error) 34%, transparent); }
</style>

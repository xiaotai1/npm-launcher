<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  nodeVersion: string | null
  availableVersions: string[]
  currentVersion: string | null
  switching: boolean
  theme: 'light' | 'dark' | 'system'
}>()

const emit = defineEmits<{
  'toggle-theme': []
  'switch-version': [version: string]
  'refresh-versions': []
}>()

const isMac = window.electronAPI.platform === 'darwin'
const nvmListCommand = isMac ? 'nvm ls-remote' : 'nvm list available'

const themeIcon: Record<string, string> = { light: '☀', dark: '☾', system: '⊞' }
const themeLabel: Record<string, string> = { light: '浅色', dark: '深色', system: '系统' }

const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

function toggleDropdown() {
  if (props.switching) return
  showDropdown.value = !showDropdown.value
}

function selectVersion(version: string) {
  if (version === props.currentVersion) {
    showDropdown.value = false
    return
  }
  emit('switch-version', version)
  showDropdown.value = false
}

function refreshVersions() {
  emit('refresh-versions')
}

function onClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <header class="h-12 px-5 flex items-center justify-between border-b border-border bg-surface relative select-none app-header">
    <div class="flex items-center header-left" :class="{ 'mac-traffic-light': isMac }">
      <span class="text-[13px] font-semibold tracking-[-0.3px] text-tsecondary">NPM Launcher</span>
    </div>
    <div class="flex items-center gap-1.5 header-right" :class="{ 'mac-header-right': isMac }">
      <div class="relative" ref="dropdownRef">
        <button
          class="flex items-center gap-1.5 py-1 px-3.5 pl-2.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 ease-out node-badge"
          :class="{ switching, open: showDropdown }"
          @click="toggleDropdown"
          title="点击管理 Node 版本"
        >
          <span class="text-success-c text-[13px]" style="text-shadow: 0 0 6px var(--success)">⬢</span>
          <span class="text-accent font-mono text-[11.5px]">{{ switching ? '切换中...' : (nodeVersion || '...') }}</span>
          <span class="text-ttertiary text-[9px] transition-transform duration-250 ease-in-out dropdown-arrow" :class="{ open: showDropdown }">▾</span>
        </button>
        <Transition name="dropdown">
          <div v-if="showDropdown" class="absolute top-full mt-2 right-0 w-65 bg-surface border border-border rounded-xl p-1 z-100 animate-scale-in version-dropdown">
            <div class="flex items-center justify-between px-1 pt-1">
              <span class="px-2.5 pt-1.75 pb-1.25 text-[11px] font-semibold text-ttertiary tracking-[0.3px]">已安装版本</span>
              <span class="text-[10px] text-blue-500 font-medium mr-2">仅识别 nvm</span>
              <button class="w-6 h-6 flex items-center justify-center rounded-md text-ttertiary mr-1 refresh-btn" @click="refreshVersions" title="刷新版本列表">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            </div>
            <div class="max-h-70 overflow-y-auto py-0.5">
              <button
                v-for="ver in availableVersions"
                :key="ver"
                class="flex items-center justify-between w-full py-1.75 px-2.5 rounded-lg font-mono text-xs text-tsecondary text-left transition-all duration-150 ease-out version-item"
                :class="{ active: ver === currentVersion }"
                @click="selectVersion(ver)"
                :disabled="switching"
              >
                <span>{{ ver }}</span>
                <span v-if="ver === currentVersion" class="text-success-c text-[13px] animate-check-pop">✓</span>
              </button>
              <div v-if="availableVersions.length === 0" class="py-4 px-2.5 text-center text-xs text-ttertiary">
                暂无已安装版本
              </div>
            </div>
            <div class="px-3 py-2 text-[11px] text-ttertiary border-t border-border mt-1">使用终端输入 <code class="font-mono text-accent bg-accent-glow px-1 rounded-sm text-[10px]">{{ nvmListCommand }}</code> 查看更多版本</div>
          </div>
        </Transition>
      </div>
      <button class="w-8 h-8 flex items-center justify-center rounded-lg text-ttertiary text-sm transition-all duration-200 ease-out theme-btn" @click="emit('toggle-theme')" :title="themeLabel[theme]">
        {{ themeIcon[theme] }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  -webkit-app-region: drag;
}

.app-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--header-glow);
  pointer-events: none;
}

.header-left {
  -webkit-app-region: no-drag;
}

.header-left.mac-traffic-light {
  padding-left: 52px;
}

.header-right {
  padding-right: 136px;
  -webkit-app-region: no-drag;
}

.header-right.mac-header-right {
  padding-right: 12px;
}

.node-badge {
  background: var(--card-active-bg);
  border: 1px solid var(--accent-border);
  box-shadow: 0 0 12px var(--accent-glow);
}

.node-badge:hover:not(.switching) {
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.18);
  transform: translateY(-1px);
}

.node-badge.open {
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.18);
}

.node-badge.switching {
  opacity: 0.6;
  cursor: wait;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.version-dropdown {
  box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent-glow);
}

.refresh-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
}

.version-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.version-item.active {
  color: var(--success);
  font-weight: 600;
}

.dropdown-enter-active {
  animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-leave-active {
  animation: scaleIn 0.15s cubic-bezier(0.4, 0, 0.2, 1) reverse;
}

.theme-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
  transform: rotate(15deg);
}
</style>

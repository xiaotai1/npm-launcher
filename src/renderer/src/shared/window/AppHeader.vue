<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import WindowControls from './WindowControls.vue'

const props = defineProps<{
  nodeVersion: string | null
  availableVersions: string[]
  currentVersion: string | null
  switching: boolean
  refreshing: boolean
  checkingUpdate: boolean
  updateAvailable: boolean
  theme: 'light' | 'dark' | 'system'
}>()

const emit = defineEmits<{
  'toggle-theme': []
  'switch-version': [version: string]
  'refresh-versions': []
  'export-config': []
  'import-config': []
  'check-update': []
}>()

const isMac = window.desktopAPI.platform === 'darwin'
const nvmListCommand = isMac ? 'nvm ls-remote' : 'nvm list available'

const themeLabel: Record<string, string> = { light: '浅色', dark: '深色', system: '系统' }

const showDropdown = ref(false)
const showConfigMenu = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const configMenuRef = ref<HTMLElement | null>(null)

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
  if (props.refreshing || props.switching) return
  emit('refresh-versions')
}

function onClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
  if (configMenuRef.value && !configMenuRef.value.contains(e.target as Node)) {
    showConfigMenu.value = false
  }
}

function selectConfigAction(action: 'export' | 'import') {
  showConfigMenu.value = false
  if (action === 'export') emit('export-config')
  else emit('import-config')
}

async function openGithubRepo() {
  await window.desktopAPI.openExternal('https://github.com/xiaotai1/npm-launcher')
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <header data-tauri-drag-region class="flex items-center justify-between border-b border-border bg-surface relative select-none app-header glass-topbar" :class="{ 'mac-titlebar': isMac }">
    <div data-tauri-drag-region class="flex items-center header-left" :class="{ 'mac-title-area': isMac }">
      <span v-if="!isMac" class="text-[14px] font-semibold text-tsecondary app-title">NPM Launcher</span>
    </div>
    <div class="flex items-center">
      <div class="flex items-center gap-1 header-right" :class="{ 'mac-header-right': isMac }">
      <div class="relative" ref="dropdownRef">
        <button
          class="flex items-center gap-1 py-1 px-3 pr-3 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 ease-out node-badge"
          :class="{ switching, open: showDropdown }"
          @click="toggleDropdown"
          title="点击管理 Node 版本"
          :aria-expanded="showDropdown"
          aria-haspopup="listbox"
        >
          <svg class="text-success-c" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/>
            <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>
          </svg>
          <span class="text-accent font-mono text-[12.5px]">{{ switching ? '切换中...' : (nodeVersion || '...') }}</span>
          <span class="text-ttertiary text-[10px] transition-transform duration-250 ease-in-out dropdown-arrow" :class="{ open: showDropdown }">▾</span>
        </button>
        <Transition name="dropdown">
          <div v-if="showDropdown" class="absolute top-full mt-2 right-0 w-65 bg-surface border border-border rounded-xl p-1 z-100 animate-scale-in version-dropdown">
            <div class="flex items-center justify-between px-1 pt-1">
              <span class="px-2.5 pt-1.75 pb-1.25 text-[12px] font-semibold text-ttertiary tracking-[0.3px]">已安装版本</span>
              <span class="text-[11px] text-blue-500 font-medium mr-2">仅识别 nvm</span>
              <button
                class="w-7 h-7 flex items-center justify-center rounded-md text-ttertiary mr-1 refresh-btn"
                :class="{ refreshing }"
                :disabled="refreshing || switching"
                :title="refreshing ? '正在刷新版本列表' : '刷新版本列表'"
                aria-label="刷新 Node 版本列表"
                :aria-busy="refreshing"
                @click="refreshVersions"
              >
                <svg class="refresh-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                <svg v-if="ver === currentVersion" class="text-success-c animate-check-pop" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-label="当前版本"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <div v-if="availableVersions.length === 0" class="py-4 px-2.5 text-center text-xs text-ttertiary">
                暂无已安装版本
              </div>
            </div>
            <div class="px-3 py-2 text-[12px] text-ttertiary border-t border-border mt-1">使用终端输入 <code class="font-mono text-accent bg-accent-glow px-1 rounded-sm text-[11px]">{{ nvmListCommand }}</code> 查看更多版本</div>
          </div>
        </Transition>
      </div>
      <button class="w-8 h-8 flex items-center justify-center rounded-lg text-ttertiary text-sm transition-all duration-200 ease-out theme-btn" @click="emit('toggle-theme')" :title="themeLabel[theme]" :aria-label="`切换主题，当前为${themeLabel[theme]}`">
        <svg v-if="theme === 'light'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
        <svg v-else-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1z"/></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v2"/><path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715"/><path d="M16 12a4 4 0 0 0-4-4"/><path d="m19 5-1.256 1.256"/><path d="M20 12h2"/></svg>
      </button>
      <div ref="configMenuRef" class="relative">
        <button class="w-8 h-8 flex items-center justify-center rounded-lg text-ttertiary text-sm transition-all duration-200 ease-out config-btn" :class="{ open: showConfigMenu }" title="配置导入导出" aria-label="配置导入导出" :aria-expanded="showConfigMenu" aria-haspopup="menu" @click="showConfigMenu = !showConfigMenu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M3 12h9"/><path d="m9 9 3 3-3 3"/></svg>
        </button>
        <Transition name="dropdown">
          <div v-if="showConfigMenu" class="absolute top-full mt-2 right-0 w-42 bg-surface border border-border rounded-xl p-1 z-100 animate-scale-in config-menu" role="menu">
            <button class="config-menu-item" type="button" role="menuitem" @click="selectConfigAction('export')">
              <span>导出配置</span>
            </button>
            <button class="config-menu-item" type="button" role="menuitem" @click="selectConfigAction('import')">
              <span>导入配置</span>
            </button>
          </div>
        </Transition>
      </div>
      <button
        type="button"
        class="relative w-8 h-8 flex items-center justify-center rounded-lg text-ttertiary transition-all duration-200 ease-out update-btn"
        :class="{ checking: checkingUpdate, available: updateAvailable }"
        :disabled="checkingUpdate"
        :title="updateAvailable ? '有新版本可用' : checkingUpdate ? '正在检查更新' : '检查更新'"
        :aria-label="updateAvailable ? '有新版本可用，打开更新窗口' : checkingUpdate ? '正在检查更新' : '检查更新'"
        :aria-busy="checkingUpdate"
        @click="emit('check-update')"
      >
        <svg class="update-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3v12"/>
          <path d="m7 10 5 5 5-5"/>
          <path d="M5 20h14"/>
        </svg>
        <span v-if="updateAvailable" class="update-dot" aria-hidden="true"></span>
      </button>
      <a
        class="w-8 h-8 flex items-center justify-center rounded-lg text-ttertiary transition-all duration-200 ease-out github-btn"
        href="https://github.com/xiaotai1/npm-launcher"
        title="GitHub 仓库"
        aria-label="打开 GitHub 仓库"
        @click.prevent="openGithubRepo"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.27a11 11 0 00-3.48 21.46c.55.09.73-.28.73-.55v-1.85c-3.03.66-3.67-1.46-3.67-1.46-.55-1.29-1.28-1.65-1.28-1.65-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.03 11.03 0 015.8 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.41-2.69 5.38-5.25 5.66.41.35.77 1.04.77 2.1v3.1c0 .27.18.65.73.55A11 11 0 0012 1.27z"/></svg>
      </a>
      </div>
      <WindowControls v-if="!isMac" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  z-index: 50;
  height: 44px;
  min-height: 44px;
  -webkit-app-region: drag;
  overflow: visible;
  background: var(--glass-fill);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-color: var(--glass-border);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset;
}

.glass-topbar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: var(--glass-edge);
  pointer-events: none;
}

.header-left {
  flex: 1 1 auto;
  height: 100%;
  min-width: 0;
  -webkit-app-region: drag;
  padding-left: 20px;
}

.header-left.mac-title-area {
  padding-left: 88px;
}

.app-title {
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
}

.header-right {
  height: 100%;
  padding-right: 12px;
  -webkit-app-region: no-drag;
}

.header-right.mac-header-right {
  padding-right: 14px;
}

.node-badge {
  min-height: 30px;
  padding-inline: 10px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-default);
}

.node-badge:hover:not(.switching) {
  border-color: var(--accent-border);
  background: var(--bg-hover);
}

.node-badge.open {
  border-color: var(--accent-primary);
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

.refresh-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--accent-primary);
}

.refresh-btn:disabled {
  cursor: wait;
  opacity: 0.7;
}

.refresh-btn.refreshing .refresh-icon {
  animation: refresh-spin 0.8s linear infinite;
}

@keyframes refresh-spin {
  to { transform: rotate(360deg); }
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

.theme-btn:hover,
.config-btn:hover,
.config-btn.open,
.update-btn:hover:not(:disabled),
.github-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
}

.update-btn:disabled {
  cursor: wait;
  opacity: .72;
}

.update-btn.available {
  color: var(--accent-primary);
}

.update-btn.checking .update-icon {
  animation: update-spin .8s linear infinite;
}

.update-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 6px;
  height: 6px;
  border: 1.5px solid var(--bg-surface);
  border-radius: 50%;
  box-sizing: content-box;
  background: var(--accent-primary);
}

@keyframes update-spin {
  to { transform: rotate(360deg); }
}

.config-menu {
  box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent-glow);
}

.config-menu-item {
  width: 100%;
  min-height: 30px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 650;
  text-align: left;
}

.config-menu-item:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.config-menu-divider {
  background: var(--border-muted);
}

@media (prefers-reduced-motion: reduce) {
  .update-btn.checking .update-icon {
    animation-duration: 0s;
  }
}
</style>

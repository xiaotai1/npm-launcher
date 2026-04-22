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
  <header class="app-header">
    <div class="header-left" :class="{ 'mac-traffic-light': isMac }">
      <span class="logo-label">NPM Launcher</span>
    </div>
    <div class="header-right" :class="{ 'mac-header-right': isMac }">
      <div class="version-wrapper" ref="dropdownRef">
        <button
          class="node-badge"
          :class="{ switching, open: showDropdown }"
          @click="toggleDropdown"
          title="点击管理 Node 版本"
        >
          <span class="node-icon">⬢</span>
          <span class="node-version">{{ switching ? '切换中...' : (nodeVersion || '...') }}</span>
          <span class="dropdown-arrow" :class="{ open: showDropdown }">▾</span>
        </button>
        <Transition name="dropdown">
          <div v-if="showDropdown" class="version-dropdown">
            <div class="dropdown-header-row">
              <span class="dropdown-title">已安装版本</span>
              <button class="refresh-btn" @click="refreshVersions" title="刷新版本列表">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            </div>
            <div class="dropdown-list">
              <button
                v-for="ver in availableVersions"
                :key="ver"
                class="version-item"
                :class="{ active: ver === currentVersion }"
                @click="selectVersion(ver)"
                :disabled="switching"
              >
                <span class="version-name">{{ ver }}</span>
                <span v-if="ver === currentVersion" class="version-check">✓</span>
              </button>
              <div v-if="availableVersions.length === 0" class="dropdown-empty">
                暂无已安装版本
              </div>
            </div>
            <div class="dropdown-hint">使用终端输入 <code>{{ nvmListCommand }}</code> 查看更多版本</div>
          </div>
        </Transition>
      </div>
      <button class="theme-btn" @click="emit('toggle-theme')" :title="themeLabel[theme]">
        {{ themeIcon[theme] }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header{
  height: 48px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-surface);
  position: relative;
  -webkit-app-region: drag;
  user-select: none;
}

.app-header::after{
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--header-glow);
  pointer-events: none;
}

.header-left{
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.header-left.mac-traffic-light{
  padding-left: 52px;
}

.logo-label{
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: var(--text-secondary);
}

.header-right{
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 136px;
  -webkit-app-region: no-drag;
}

.header-right.mac-header-right{
  padding-right: 12px;
}

/* 版本选择器 */
.version-wrapper{
  position: relative;
}

.node-badge{
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px 4px 10px;
  background: var(--card-active-bg);
  border: 1px solid var(--accent-border);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms ease;
  box-shadow: 0 0 12px var(--accent-glow);
}

.node-badge:hover:not(.switching){
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.18);
  transform: translateY(-1px);
}

.node-badge.open{
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.18);
}

.node-badge.switching{
  opacity: 0.6;
  cursor: wait;
}

.node-icon{
  color: var(--success);
  font-size: 13px;
  text-shadow: 0 0 6px var(--success);
}

.node-version{
  color: var(--accent-primary);
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 11.5px;
}

.dropdown-arrow{
  color: var(--text-tertiary);
  font-size: 9px;
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-arrow.open{
  transform: rotate(180deg);
}

/* 下拉菜单 */
.version-dropdown{
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 260px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent-glow);
  padding: 4px;
  z-index: 100;
  animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-header-row{
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 0;
}

.dropdown-title{
  padding: 7px 10px 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.3px;
}

.refresh-btn{
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-tertiary);
  margin-right: 4px;
}

.refresh-btn:hover{
  background: var(--bg-hover);
  color: var(--accent-primary);
}

.dropdown-list{
  max-height: 280px;
  overflow-y: auto;
  padding: 2px 0;
}

.version-item{
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: left;
  transition: all 150ms ease;
}

.version-item:hover{
  background: var(--bg-hover);
  color: var(--text-primary);
}

.version-item.active{
  color: var(--success);
  font-weight: 600;
}

.version-check{
  color: var(--success);
  font-size: 13px;
  animation: checkPop 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-hint{
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-tertiary);
  border-top: 1px solid var(--border-default);
  margin-top: 4px;
}

.dropdown-hint code{
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  color: var(--accent-primary);
  background: var(--accent-glow);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10px;
}

.dropdown-empty{
  padding: 16px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 下拉动画 */
.dropdown-enter-active{
  animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.dropdown-leave-active{
  animation: scaleIn 0.15s cubic-bezier(0.4, 0, 0.2, 1) reverse;
}

.theme-btn{
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--text-tertiary);
  font-size: 14px;
  transition: all 200ms ease;
}

.theme-btn:hover{
  background: var(--bg-hover);
  color: var(--accent-primary);
  transform: rotate(15deg);
}
</style>

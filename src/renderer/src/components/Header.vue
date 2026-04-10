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
  'open-terminal': [command: string]
}>()

const themeIcon: Record<string, string> = { light: '☀', dark: '☾', system: '⊞' }
const themeLabel: Record<string, string> = { light: '浅色', dark: '深色', system: '系统' }

const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

// 远程版本视图状态
const showAvailable = ref(false)
const remoteVersions = ref<string[]>([])
const loadingAvailable = ref(false)
const ignoreNextClose = ref(false)

function toggleDropdown() {
  if (props.switching) return
  showDropdown.value = !showDropdown.value
  if (!showDropdown.value) {
    showAvailable.value = false
  }
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

async function openAvailable() {
  ignoreNextClose.value = true
  showAvailable.value = true
  loadingAvailable.value = true
  remoteVersions.value = []
  try {
    const result = await window.electronAPI.getAvailableNodeVersions()
    loadingAvailable.value = false
    if (result.error) {
      alert('获取版本列表失败: ' + result.error)
      showAvailable.value = false
      return
    }
    remoteVersions.value = result.versions
  } catch (e: any) {
    loadingAvailable.value = false
    showAvailable.value = false
    alert('请求异常: ' + (e.message || e))
  }
}

function backToInstalled() {
  showAvailable.value = false
}

function installInTerminal(version: string) {
  showDropdown.value = false
  showAvailable.value = false
  emit('open-terminal', `nvm install ${version.replace(/^v/, '')}`)
}

function isInstalled(version: string): boolean {
  return props.availableVersions.includes(version)
}

function onClickOutside(e: MouseEvent) {
  if (ignoreNextClose.value) {
    ignoreNextClose.value = false
    return
  }
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    showDropdown.value = false
    showAvailable.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
          <line x1="12" y1="2" x2="12" y2="22"/>
          <line x1="2" y1="8.5" x2="22" y2="15.5"/>
          <line x1="22" y1="8.5" x2="2" y2="15.5"/>
        </svg>
      </div>
      <h1 class="app-title">NPM Launcher</h1>
    </div>
    <div class="header-right">
      <div class="version-wrapper" ref="dropdownRef">
        <button
          class="node-badge"
          :class="{ switching }"
          @click="toggleDropdown"
          title="点击管理 Node 版本"
        >
          <span class="node-icon">⬢</span>
          <span class="node-version">{{ switching ? '切换中...' : (nodeVersion || '...') }}</span>
          <span class="dropdown-arrow" :class="{ open: showDropdown }">▾</span>
        </button>
        <Transition name="dropdown">
          <div v-if="showDropdown" class="version-dropdown">
            <!-- 已安装版本视图 -->
            <template v-if="!showAvailable">
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
              <div class="dropdown-divider"></div>
              <button class="dropdown-action" @click="openAvailable" :disabled="loadingAvailable">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                安装其他版本
              </button>
            </template>

            <!-- 远程可用版本视图 -->
            <template v-else>
              <div class="dropdown-header">
                <button class="back-btn" @click="backToInstalled">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <span class="dropdown-title">可安装版本</span>
                <span class="dropdown-hint">点击在终端中安装</span>
              </div>
              <div class="dropdown-list available-list">
                <div v-if="loadingAvailable" class="dropdown-loading">
                  <span class="loading-spinner"></span>
                  正在获取版本列表...
                </div>
                <template v-else>
                  <button
                    v-for="ver in remoteVersions"
                    :key="ver"
                    class="version-item"
                    :class="{ installed: isInstalled(ver) }"
                    :disabled="isInstalled(ver)"
                    @click="!isInstalled(ver) && installInTerminal(ver)"
                  >
                    <span class="version-name">{{ ver }}</span>
                    <span v-if="isInstalled(ver)" class="version-tag installed-tag">已安装</span>
                    <span v-else class="version-tag terminal-tag">终端安装</span>
                  </button>
                  <div v-if="remoteVersions.length === 0" class="dropdown-empty">
                    未找到可用版本
                  </div>
                </template>
              </div>
            </template>
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
  -webkit-app-region: drag;
  user-select: none;
}

.header-left{
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: no-drag;
}

.logo{
  width: 22px;
  height: 22px;
  color: var(--accent-primary);
  opacity: 0.85;
}

.logo svg{
  width: 100%;
  height: 100%;
}

.app-title{
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: var(--text-secondary);
}

.header-right{
  display: flex;
  align-items: center;
  gap: 6px;
  -webkit-app-region: no-drag;
}

/* 版本选择器 */
.version-wrapper{
  position: relative;
}

.node-badge{
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px 4px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms ease;
}

.node-badge:hover:not(.switching){
  border-color: var(--success-border);
  background: var(--success-bg);
}

.node-badge.switching{
  opacity: 0.6;
  cursor: wait;
}

.node-icon{
  color: var(--success);
  font-size: 13px;
}

.node-version{
  color: var(--text-secondary);
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 11.5px;
}

.dropdown-arrow{
  color: var(--text-tertiary);
  font-size: 9px;
  transition: transform 200ms ease;
}

.dropdown-arrow.open{
  transform: rotate(180deg);
}

/* 下拉菜单 */
.version-dropdown{
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 260px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: 100;
  animation: scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
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
  font-weight: 500;
  color: var(--text-tertiary);
  letter-spacing: 0.3px;
}

.dropdown-hint{
  font-size: 10px;
  color: var(--text-tertiary);
  opacity: 0.6;
}

.refresh-btn{
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  color: var(--text-tertiary);
  margin-right: 4px;
}

.refresh-btn:hover{
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dropdown-header{
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 0;
}

.back-btn{
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.back-btn:hover{
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dropdown-list{
  max-height: 280px;
  overflow-y: auto;
  padding: 2px 0;
}

.available-list{
  max-height: 320px;
}

.version-item{
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: left;
  transition: all 150ms ease;
}

.version-item:not(.installed):hover{
  background: var(--bg-hover);
  color: var(--text-primary);
}

.version-item.active{
  color: var(--success);
  font-weight: 600;
}

.version-item.installed{
  opacity: 0.5;
  cursor: default;
}

.version-check{
  color: var(--success);
  font-size: 13px;
}

.version-tag{
  font-size: 10px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.installed-tag{
  color: var(--text-tertiary);
  background: var(--bg-elevated);
}

.terminal-tag{
  color: var(--accent-primary);
  background: transparent;
  border: 1px solid var(--accent-primary);
}

.dropdown-divider{
  height: 1px;
  background: var(--border-default);
  margin: 4px 8px;
}

.dropdown-action{
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-primary);
  text-align: left;
  transition: all 150ms ease;
}

.dropdown-action:hover:not(:disabled){
  background: var(--accent-glow);
}

.dropdown-action:disabled{
  opacity: 0.5;
  cursor: not-allowed;
}

.dropdown-empty{
  padding: 16px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

.dropdown-loading{
  padding: 20px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.loading-spinner{
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-default);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 下拉动画 */
.dropdown-enter-active{
  animation: scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-leave-active{
  animation: scaleIn 0.1s cubic-bezier(0.16, 1, 0.3, 1) reverse;
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
  color: var(--text-primary);
}
</style>

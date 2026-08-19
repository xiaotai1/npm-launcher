import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspaceSource = readFileSync('src/renderer/src/features/workspace/components/ProjectWorkspace.vue', 'utf-8')
const logConsoleSource = readFileSync('src/renderer/src/features/terminal/components/LogConsole.vue', 'utf-8')
const appSource = readFileSync('src/renderer/src/app/App.vue', 'utf-8')

test('项目工作区标签使用独立活动指示线', () => {
  assert.match(workspaceSource, /workspace-tab-strip/)
  assert.match(workspaceSource, /\.workspace-tabs button::after[\s\S]*background: var\(--accent-primary\)/)
  assert.match(workspaceSource, /\.workspace-tabs button\.active::after\s*\{[^}]*opacity:\s*1/)
})

test('日志头作为工作区内容唯一横向分隔线', () => {
  assert.equal(logConsoleSource.includes('border-b border-border-muted'), false)
  assert.match(logConsoleSource, /\.console-header[\s\S]*border-bottom: 1px solid var\(--glass-border\)/)
})

test('每个项目独立记住自己的工作区标签页', () => {
  assert.match(appSource, /type WorkspaceTab = 'logs' \| 'terminal' \| 'info'/)
  assert.match(appSource, /projectTabs = ref<Record<string, WorkspaceTab>>\(\{\}\)/)
  assert.match(appSource, /activeProjectTab = computed/)
  assert.match(appSource, /function setActiveProjectTab\(tab: WorkspaceTab\)/)
  assert.match(appSource, /:active-tab="activeProjectTab"/)
  assert.match(appSource, /@update:active-tab="setActiveProjectTab"/)
  assert.match(appSource, /projectTabs\.value = \{ \.\.\.projectTabs\.value, \[id\]: 'info' \}/)
  assert.equal(appSource.includes("const activeTab = ref<'logs' | 'terminal' | 'info'>('logs')"), false)
  assert.equal(appSource.includes('@update:active-tab="activeTab = $event"'), false)
})

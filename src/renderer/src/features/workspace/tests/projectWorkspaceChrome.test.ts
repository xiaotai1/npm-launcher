import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspaceSource = readFileSync('src/renderer/src/features/workspace/components/ProjectWorkspace.vue', 'utf-8')
const logConsoleSource = readFileSync('src/renderer/src/features/terminal/components/LogConsole.vue', 'utf-8')

test('项目工作区标签使用分段按钮而不是下划线分隔', () => {
  assert.match(workspaceSource, /workspace-tab-strip/)
  assert.equal(/\.workspace-tabs\s*\{[^}]*border-bottom/.test(workspaceSource), false)
  assert.equal(/\.workspace-tabs button\s*\{[^}]*border-bottom/.test(workspaceSource), false)
  assert.match(workspaceSource, /\.workspace-tabs button\.active[\s\S]*background: var\(--nav-active-bg\)/)
})

test('日志头作为工作区内容唯一横向分隔线', () => {
  assert.equal(logConsoleSource.includes('border-b border-border-muted'), false)
  assert.match(logConsoleSource, /\.console-header[\s\S]*border-bottom: 1px solid var\(--border-muted\)/)
})

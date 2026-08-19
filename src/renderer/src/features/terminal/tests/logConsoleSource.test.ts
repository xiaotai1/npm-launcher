import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/renderer/src/features/terminal/components/LogConsole.vue', 'utf-8')

test('运行日志面板不再提供历史日志模式', () => {
  for (const forbidden of ['logMode', 'history-picker', 'selectedHistoryFile', 'getLogFiles', 'getLogContent', '历史']) {
    assert.equal(source.includes(forbidden), false)
  }
})

test('运行日志安装并清理共享的残留拖选保护', () => {
  assert.match(source, /installTerminalDragRecovery/)
  assert.match(source, /cleanupDragRecovery\?\.\(\)/)
})

test('运行日志重放前清除旧选区', () => {
  const replayFunction = source.match(/function replayCurrentProjectLogs\(\)[\s\S]*?\n}/)?.[0] || ''

  assert.match(replayFunction, /terminal\.clearSelection\(\)[\s\S]*terminal\.clear\(\)/)
})

test('日志筛选和搜索不叠加全局焦点外轮廓', () => {
  assert.match(source, /\.log-tools select:focus-visible,[\s\S]*\.log-tools input:focus-visible\s*\{[^}]*outline:\s*none/)
})

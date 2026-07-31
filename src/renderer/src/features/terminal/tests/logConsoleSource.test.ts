import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/renderer/src/features/terminal/components/LogConsole.vue', 'utf-8')

test('运行日志面板不再提供历史日志模式', () => {
  for (const forbidden of ['logMode', 'history-picker', 'selectedHistoryFile', 'getLogFiles', 'getLogContent', '历史']) {
    assert.equal(source.includes(forbidden), false)
  }
})

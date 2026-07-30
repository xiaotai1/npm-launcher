import assert from 'node:assert/strict'
import test from 'node:test'
import { formatLogForView, highlightLogQuery, logMatchesFilter } from '../model/logView'

const stderrLog = { type: 'stderr' as const, data: 'Error: port already in use' }
const stdoutLog = { type: 'stdout' as const, data: 'Local: http://localhost:5173' }

test('按日志类型过滤', () => {
  assert.equal(logMatchesFilter(stderrLog, 'stderr', ''), true)
  assert.equal(logMatchesFilter(stdoutLog, 'stderr', ''), false)
})

test('按关键字搜索日志内容', () => {
  assert.equal(logMatchesFilter(stderrLog, 'all', 'PORT'), true)
  assert.equal(logMatchesFilter(stderrLog, 'all', 'missing'), false)
})

test('格式化日志时保留匹配项并高亮关键字', () => {
  assert.match(highlightLogQuery('Error: port failed', 'port'), /\x1b\[43;30mport\x1b\[0m/)
  assert.equal(formatLogForView(stdoutLog, 'stderr', ''), null)
})

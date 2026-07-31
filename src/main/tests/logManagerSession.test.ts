import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeErrors, finishLogSession, recordLogLine, startLogSession } from '../logManager'

test('错误分析基于本次内存日志，不依赖历史日志文件', () => {
  startLogSession('dev-app')
  recordLogLine('dev-app', 'stderr', 'Error: listen EADDRINUSE: address already in use :::5173')

  const analysis = analyzeErrors('dev-app', 1)

  assert.equal(analysis?.matches[0]?.name, '端口占用')
  assert.match(analysis?.summary || '', /端口占用/)
  finishLogSession('dev-app', 1)
})

test('重新启动项目会清空上一轮内存日志', () => {
  startLogSession('same-app')
  recordLogLine('same-app', 'stderr', 'MODULE_NOT_FOUND')
  assert.equal(analyzeErrors('same-app', 1)?.matches[0]?.name, '依赖缺失')

  startLogSession('same-app')

  assert.equal(analyzeErrors('same-app', 1)?.matches.length, 0)
})

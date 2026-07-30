import assert from 'node:assert/strict'
import test from 'node:test'
import { appendLogEntry, clearLogHistory, getLogHistory, subscribeLogHistory } from '../model/logHistory'

function log(projectId: string, data: string) {
  return {
    projectId,
    type: 'stdout' as const,
    data,
    timestamp: Date.now()
  }
}

test('日志历史独立于日志面板组件实例保存', () => {
  const projectId = 'history-project'
  clearLogHistory(projectId)

  appendLogEntry(log(projectId, 'first line'))

  assert.deepEqual(getLogHistory(projectId).map(item => item.data), ['first line'])
})

test('订阅者只在订阅期间收到新日志', () => {
  const projectId = 'subscribe-project'
  clearLogHistory(projectId)
  const received: string[] = []

  const unsubscribe = subscribeLogHistory(entry => {
    if (entry.projectId === projectId) received.push(entry.data)
  })

  appendLogEntry(log(projectId, 'visible'))
  unsubscribe()
  appendLogEntry(log(projectId, 'hidden'))

  assert.deepEqual(received, ['visible'])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { appendSessionLogEntry, clearSessionLogs, getSessionLogs, subscribeSessionLogs } from '../model/sessionLogs'

function log(projectId: string, data: string) {
  return {
    projectId,
    type: 'stdout' as const,
    data,
    timestamp: Date.now()
  }
}

test('本次运行日志独立于日志面板组件实例保存', () => {
  const projectId = 'session-project'
  clearSessionLogs(projectId)

  appendSessionLogEntry(log(projectId, 'first line'))

  assert.deepEqual(getSessionLogs(projectId).map(item => item.data), ['first line'])
})

test('订阅者只在订阅期间收到新日志', () => {
  const projectId = 'subscribe-project'
  clearSessionLogs(projectId)
  const received: string[] = []

  const unsubscribe = subscribeSessionLogs(entry => {
    if (entry.projectId === projectId) received.push(entry.data)
  })

  appendSessionLogEntry(log(projectId, 'visible'))
  unsubscribe()
  appendSessionLogEntry(log(projectId, 'hidden'))

  assert.deepEqual(received, ['visible'])
})

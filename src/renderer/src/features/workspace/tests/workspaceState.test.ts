import assert from 'node:assert/strict'
import test from 'node:test'
import { activityFromStatus, appendActivity, getOverviewCounts } from '../model/workspaceState'

const projects = [
  { id: 'admin', name: 'Admin', path: '/admin', command: 'dev' },
  { id: 'gateway', name: 'Gateway', path: '/gateway', command: 'start' }
]

test('overview counts include only configured projects', () => {
  const counts = getOverviewCounts(projects, {
    admin: { projectId: 'admin', status: 'running' },
    ghost: { projectId: 'ghost', status: 'error' }
  })

  assert.deepEqual(counts, { total: 2, running: 1, error: 0 })
})

test('activity is created only when process status changes', () => {
  const running = { projectId: 'admin', status: 'running' as const }

  assert.deepEqual(activityFromStatus(undefined, running, 10), {
    id: 'admin-10-started',
    projectId: 'admin',
    type: 'started',
    timestamp: 10
  })
  assert.equal(activityFromStatus(running, running, 11), null)
  assert.equal(activityFromStatus(running, { projectId: 'admin', status: 'error' }, 12)?.type, 'error')
})

test('activity history keeps the newest twenty entries', () => {
  const current = Array.from({ length: 20 }, (_, index) => ({
    id: String(index),
    projectId: 'admin',
    type: 'started' as const,
    timestamp: index
  }))
  const next = appendActivity(current, {
    id: 'new',
    projectId: 'gateway',
    type: 'stopped',
    timestamp: 21
  })

  assert.equal(next.length, 20)
  assert.equal(next[0].id, 'new')
  assert.equal(next.some(item => item.id === '19'), false)
})

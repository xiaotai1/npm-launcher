import assert from 'node:assert/strict'
import test from 'node:test'
import { clearLaunchFailure, mergeLaunchFailures, setLaunchFailure } from '../model/launchFailures'

test('启动失败记录按项目保存并覆盖旧原因', () => {
  const state = setLaunchFailure({}, {
    projectId: 'admin',
    projectName: 'Admin',
    message: '项目目录不存在'
  }, 100)

  const next = setLaunchFailure(state, {
    projectId: 'admin',
    projectName: 'Admin',
    message: '启动脚本不存在'
  }, 200)

  assert.deepEqual(next, {
    admin: {
      projectId: 'admin',
      projectName: 'Admin',
      message: '启动脚本不存在',
      timestamp: 200
    }
  })
})

test('批量启动失败记录保留未涉及项目并清除成功项目', () => {
  const current = {
    admin: { projectId: 'admin', projectName: 'Admin', message: '旧错误', timestamp: 1 },
    web: { projectId: 'web', projectName: 'Web', message: '旧错误', timestamp: 1 }
  }

  const next = mergeLaunchFailures(current, [
    { projectId: 'api', projectName: 'API', message: '项目目录不存在' }
  ], ['admin', 'api'], 300)

  assert.deepEqual(next, {
    web: { projectId: 'web', projectName: 'Web', message: '旧错误', timestamp: 1 },
    api: { projectId: 'api', projectName: 'API', message: '项目目录不存在', timestamp: 300 }
  })
})

test('项目启动成功时清除对应失败记录', () => {
  const state = {
    admin: { projectId: 'admin', projectName: 'Admin', message: '旧错误', timestamp: 1 }
  }

  assert.deepEqual(clearLaunchFailure(state, 'admin'), {})
})

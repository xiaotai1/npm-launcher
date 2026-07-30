import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveProjectRunRequest } from '../projectRunRequest'

const config = {
  projects: [
    { id: 'admin', name: 'Admin', path: '/real/admin', command: 'dev', nodeVersion: 'v20.0.0' },
    { id: 'docs', name: 'Docs', path: '/real/docs', command: 'docs' }
  ],
  folders: [],
  theme: 'system' as const
}

test('启动请求只解析配置中登记的项目数据', () => {
  assert.deepEqual(resolveProjectRunRequest(config, 'admin', ['dev', 'build']), {
    id: 'admin',
    path: '/real/admin',
    command: 'dev',
    nodeVersion: 'v20.0.0'
  })
})

test('项目不存在或命令不在 package scripts 中时拒绝启动', () => {
  assert.equal(resolveProjectRunRequest(config, 'missing', ['dev']), null)
  assert.equal(resolveProjectRunRequest(config, 'admin', ['build']), null)
})

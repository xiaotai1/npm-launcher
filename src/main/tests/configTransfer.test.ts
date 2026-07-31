import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeImportedConfig } from '../configTransfer'

test('导入配置会过滤未知字段并补齐默认值', () => {
  const config = normalizeImportedConfig({
    projects: [
      {
        id: 'admin',
        name: 'Admin',
        path: '/apps/admin',
        command: 'dev',
        favorite: true,
        folderId: null,
        nodeVersion: 'v20.19.6',
        extra: 'ignored'
      }
    ],
    folders: [{ id: 'front', name: '前端', collapsed: true, extra: 'ignored' }],
    theme: 'dark',
    unknown: true
  })

  assert.deepEqual(config, {
    projects: [{
      id: 'admin',
      name: 'Admin',
      path: '/apps/admin',
      command: 'dev',
      favorite: true,
      folderId: null,
      nodeVersion: 'v20.19.6'
    }],
    folders: [{ id: 'front', name: '前端', collapsed: true }],
    theme: 'dark'
  })
})

test('无效导入配置会返回 null', () => {
  assert.equal(normalizeImportedConfig({ projects: [{ id: 'bad' }] }), null)
  assert.equal(normalizeImportedConfig({ projects: [], folders: [], theme: 'blue' }), null)
})

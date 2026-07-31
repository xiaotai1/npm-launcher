import assert from 'node:assert/strict'
import test from 'node:test'
import { createStartAllProjectsResult, recordStartFailure, recordStartSuccess } from '../projectStartResults'

test('批量启动结果记录每个失败项目的原因', () => {
  const result = createStartAllProjectsResult()

  recordStartSuccess(result)
  recordStartFailure(result, { id: 'admin', name: 'Admin' }, '启动脚本不存在')
  recordStartFailure(result, { id: 'api', name: 'API' }, '项目目录不存在')

  assert.deepEqual(result, {
    success: 1,
    failed: 2,
    failures: [
      { projectId: 'admin', projectName: 'Admin', message: '启动脚本不存在' },
      { projectId: 'api', projectName: 'API', message: '项目目录不存在' }
    ]
  })
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const preloadSource = readFileSync('src/preload/index.ts', 'utf-8')
const apiTypesSource = readFileSync('src/renderer/src/shared/types/index.ts', 'utf-8')

test('preload 不暴露缺少主进程 handler 的标题栏接口', () => {
  assert.equal(preloadSource.includes('update-titlebar'), false)
  assert.equal(preloadSource.includes('updateTitlebar'), false)
  assert.equal(apiTypesSource.includes('setTitlebarOverlay'), false)
})

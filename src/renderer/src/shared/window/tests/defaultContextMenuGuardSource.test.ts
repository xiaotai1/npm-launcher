import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync('src/renderer/src/app/App.vue', 'utf-8')

test('应用统一安装并清理默认右键菜单守卫', () => {
  assert.match(appSource, /import \{ installDefaultContextMenuGuard \}/)
  assert.match(appSource, /cleanupDefaultContextMenuGuard = installDefaultContextMenuGuard\(\)/)
  assert.match(appSource, /cleanupDefaultContextMenuGuard\?\.\(\)/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/renderer/src/features/workspace/components/ProjectContextBar.vue', 'utf8')

test('顶部栏启动脚本选择器不使用原生 select', () => {
  assert.equal(source.includes('<select'), false)
  assert.match(source, /class="command-picker"/)
})

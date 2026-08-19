import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/renderer/src/features/workspace/components/ProjectContextBar.vue', 'utf8')

test('顶部栏启动脚本选择器不使用原生 select', () => {
  assert.equal(source.includes('<select'), false)
  assert.match(source, /class="command-picker"/)
})

test('启动脚本选择器箭头靠右并与菜单保持同宽', () => {
  assert.match(source, /\.command-picker strong\s*\{[^}]*flex: 1/)
  assert.match(source, /\.command-picker svg\s*\{[^}]*margin-left: auto/)
  assert.match(source, /width: commandMenuPos\.width \+ 'px'/)
  assert.match(source, /width:\s*Math\.max\(rect\.width,\s*140\)/)
})

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
  assert.match(source, /const width = Math\.min\(Math\.max\(rect\.width,\s*220\)/)
  assert.match(source, /max-height: min\(360px, calc\(100vh - 96px\)\)/)
  assert.match(source, /class="command-option-label" :title="command"/)
})

test('项目页顶部优先显示运行时 Node 版本号', () => {
  assert.match(source, /const projectNodeVersion = computed\(\(\) => props\.status\?\.nodeVersion \|\| props\.project\.nodeVersion \|\| props\.globalNodeVersion \|\| '—'\)/)
  assert.match(source, /<span class="node-meta">Node \{\{ projectNodeVersion \}\}<\/span>/)
})

test('项目页顶部拆分为主操作层和辅助信息层', () => {
  assert.match(source, /class="project-context-top"/)
  assert.match(source, /class="project-context-bottom"/)
  assert.match(source, /class="project-context-actions primary-actions"/)
  assert.match(source, /class="project-context-actions secondary-actions"/)
})

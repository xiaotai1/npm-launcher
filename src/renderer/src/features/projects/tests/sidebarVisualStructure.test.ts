import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sidebarSource = readFileSync('src/renderer/src/features/projects/components/WorkspaceSidebar.vue', 'utf-8')
const themeSource = readFileSync('src/renderer/src/shared/styles/main.css', 'utf-8')

test('侧栏区分总览导航和项目列表层级', () => {
  assert.match(sidebarSource, /sidebar-nav-block/)
  assert.match(sidebarSource, /sidebar-list-heading/)
})

test('主题为导航选中和项目选中提供独立颜色变量', () => {
  assert.match(themeSource, /--nav-active-bg/)
  assert.match(themeSource, /--project-active-bg/)
})

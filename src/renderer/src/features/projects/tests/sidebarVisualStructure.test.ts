import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sidebarSource = readFileSync('src/renderer/src/features/projects/components/WorkspaceSidebar.vue', 'utf-8')
const appSource = readFileSync('src/renderer/src/app/App.vue', 'utf-8')
const themeSource = readFileSync('src/renderer/src/shared/styles/main.css', 'utf-8')

test('侧栏区分总览导航和项目列表层级', () => {
  assert.match(sidebarSource, /sidebar-nav-block/)
  assert.match(sidebarSource, /sidebar-list-heading/)
})

test('主题为导航选中和项目选中提供独立颜色变量', () => {
  assert.match(themeSource, /--nav-active-bg/)
  assert.match(themeSource, /--project-active-bg/)
})

test('侧栏项目副标题用端口或目录名区分同名项目', () => {
  assert.match(sidebarSource, /projectDisplayMeta/)
  assert.match(sidebarSource, /projectUrls: Record<string, string>/)
  assert.match(appSource, /:project-urls="projectUrls"/)
  assert.equal(sidebarSource.includes('npm run {{ project.command }}'), false)
})

test('侧栏项目选中态和运行态使用不同视觉语义', () => {
  assert.match(sidebarSource, /\.project-card\.active::before[\s\S]*background: var\(--accent-primary\)/)
  assert.equal(/\.project-card\.active::before[\s\S]*background: var\(--indicator\)/.test(sidebarSource), false)
})

test('侧栏项目支持同组拖拽排序并显示明确落点', () => {
  assert.equal(sidebarSource.match(/@drop\.stop="onProjectDrop\(\$event, project\.id\)"/g)?.length, 3)
  assert.equal(sidebarSource.match(/@dragover\.stop="onProjectDragOver\(\$event, project\.id\)"/g)?.length, 3)
  assert.equal(sidebarSource.match(/:draggable="!searchQuery\.trim\(\)"/g)?.length, 3)
  assert.match(sidebarSource, /drop-before/)
  assert.match(sidebarSource, /drop-after/)
  assert.match(sidebarSource, /\.project-card \.card-drag-handle\s*\{[^}]*opacity:/)
})

test('折叠侧栏使用项目首字和状态角标并提供悬浮说明', () => {
  assert.match(appSource, /getProjectInitial\(project\.name\)/)
  assert.match(appSource, /getCollapsedProjectTooltip\(project\)/)
  assert.match(appSource, /class="collapsed-project-mark"/)
  assert.match(appSource, /class="collapsed-status-dot"/)
  assert.match(appSource, /\.collapsed-project-mark\s*\{/)
  assert.match(appSource, /\.collapsed-status-dot\s*\{/)
  assert.equal(appSource.includes('class="collapsed-dot"'), false)
})

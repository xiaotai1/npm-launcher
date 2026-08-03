import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const overviewSource = readFileSync('src/renderer/src/features/projects/components/ProjectOverview.vue', 'utf-8')
const appSource = readFileSync('src/renderer/src/app/App.vue', 'utf-8')
const overviewUsage = appSource.match(/<ProjectOverview[\s\S]*?\/>/)?.[0] || ''

test('项目总览用本地页面信息替代常驻快速开始说明', () => {
  assert.match(overviewSource, /:local-url="projectUrls\[project\.id\] \|\| null"/)
  assert.equal(overviewSource.includes('快速开始'), false)
  assert.equal(overviewSource.includes('点击项目卡片进入专注工作区'), false)
})

test('项目总览右侧不重复展示状态统计', () => {
  assert.equal(overviewSource.includes('status-summary'), false)
  assert.equal(overviewSource.includes('待启动'), false)
  assert.equal(overviewSource.includes('工作概览'), false)
  assert.equal(overviewSource.includes('当前项目'), false)
})

test('项目总览不再用当前项目详情重复单个项目信息', () => {
  assert.equal(overviewSource.includes('selectedId: string | null'), false)
  assert.equal(overviewSource.includes('currentProject'), false)
  assert.equal(overviewSource.includes('project-detail-panel'), false)
  assert.equal(overviewUsage.includes(':selected-id="selectedProjectId"'), false)
  assert.equal(overviewSource.includes('workspace-guide'), false)
})

test('项目总览所有项目数量使用统一布局', () => {
  assert.match(overviewSource, /<div class="stat-grid"/)
  assert.match(overviewSource, /<div class="overview-main-grid">/)
  assert.match(overviewSource, /<div class="project-grid">/)
  assert.match(overviewSource, /<aside class="overview-side-rail"/)
  assert.equal(overviewSource.includes('isCompactOverview'), false)
  assert.equal(overviewSource.includes('compactActivityItems'), false)
  assert.equal(overviewSource.includes('v-if="!isCompactOverview"'), false)
  assert.equal(overviewSource.includes('v-if="isCompactOverview"'), false)
})

test('项目总览不再保留少项目专属布局', () => {
  assert.equal(overviewSource.includes('compact-workbench'), false)
  assert.equal(overviewSource.includes('compact-project-panel'), false)
  assert.equal(overviewSource.includes('compact-project-row'), false)
  assert.equal(overviewSource.includes('compact-session-panel'), false)
  assert.equal(overviewSource.includes('compact-project-console'), false)
  assert.equal(overviewSource.includes('compact-square-board'), false)
  assert.equal(overviewSource.includes('compact-project-grid'), false)
  assert.equal(overviewSource.includes('compact-detail-panel'), false)
  assert.equal(overviewSource.includes('compact-session-empty'), false)
})

test('项目总览最近活动收进右侧会话栏并保持轻量', () => {
  assert.equal(overviewSource.includes('overview-lower-grid'), false)
  assert.match(overviewSource, /<aside class="overview-side-rail"[\s\S]*class="activity-panel"/)
  assert.match(overviewSource, /activities\.slice\(0,\s*8\)/)
  assert.match(overviewSource, /\.overview-side-rail\s*\{[^}]*display:\s*block/)
  assert.match(overviewSource, /\.activity-empty[\s\S]*min-height:\s*112px/)
})

test('项目总览右侧会话栏展示本次摘要补足下方空间', () => {
  assert.match(overviewSource, /sessionSummary/)
  assert.match(overviewSource, /本次摘要/)
  assert.match(overviewSource, /启动次数/)
  assert.match(overviewSource, /停止次数/)
  assert.match(overviewSource, /异常次数/)
  assert.match(overviewSource, /最近操作/)
  assert.match(overviewSource, /\.session-summary\s*\{[^}]*border-top:\s*1px solid var\(--border-muted\)/)
  assert.match(overviewSource, /\.session-metric-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
})

test('项目总览右侧会话栏使用固定舒适高度，不按项目数量伸缩', () => {
  assert.equal(overviewSource.includes('projects.length < 4'), false)
  assert.equal(overviewSource.includes('overview-side-rail.compact'), false)
  assert.equal(overviewSource.includes('overview-side-rail.single'), false)
  assert.match(overviewSource, /\.overview-side-rail\s*\{[^}]*align-self:\s*start/)
  assert.match(overviewSource, /\.activity-panel\s*\{[^}]*height:\s*360px/)
  assert.match(overviewSource, /\.activity-block\s*\{[^}]*flex:\s*1/)
})

test('项目总览始终保留添加项目入口并保持同一行卡片等高', () => {
  assert.match(overviewSource, /addProjectSlots/)
  assert.match(overviewSource, /props\.projects\.length > 0 \? 1 : 0/)
  assert.match(overviewSource, /project-empty-slot/)
  assert.match(overviewSource, /v-for="index in addProjectSlots"/)
  assert.match(overviewSource, /添加项目/)
  assert.match(overviewSource, /创建新的工作区项目/)
  assert.match(overviewSource, /\.project-grid\s*\{[^}]*align-items:\s*stretch/)
  assert.match(overviewSource, /\.project-empty-slot\s*\{[^}]*height:\s*100%/)
  assert.equal(overviewSource.includes('project-grid.single'), false)
  assert.equal(overviewSource.includes('grid-column: 1 / -1'), false)
})

test('项目总览在侧栏宽度变化时保持左侧对齐', () => {
  assert.match(overviewSource, /\.overview-content\s*\{[^}]*max-width:\s*1180px[^}]*margin:\s*0 auto 0 0[^}]*padding:\s*22px 24px 32px/)
  assert.match(overviewSource, /\.overview-main-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(overviewSource, /\.project-grid\s*\{[^}]*grid-column:\s*span 2/)
  assert.equal(overviewSource.includes('margin: 0 auto; padding: 22px 24px 32px'), false)
})

test('项目总览标题不使用负字距', () => {
  assert.match(overviewSource, /\.overview-header h1\s*\{[^}]*letter-spacing:\s*0/)
  assert.equal(/\.overview-header h1\s*\{[^}]*letter-spacing:\s*-/.test(overviewSource), false)
})

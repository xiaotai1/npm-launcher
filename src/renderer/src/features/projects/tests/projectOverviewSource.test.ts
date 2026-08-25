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

test('项目总览标题不使用负字距', () => {
  assert.match(overviewSource, /\.overview-header h1\s*\{[^}]*letter-spacing:\s*0/)
  assert.equal(/\.overview-header h1\s*\{[^}]*letter-spacing:\s*-/.test(overviewSource), false)
})

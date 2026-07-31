import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const overviewSource = readFileSync('src/renderer/src/features/projects/components/ProjectOverview.vue', 'utf-8')

test('项目总览用本地页面信息替代常驻快速开始说明', () => {
  assert.match(overviewSource, /localUrlItems/)
  assert.match(overviewSource, /本地页面/)
  assert.equal(overviewSource.includes('快速开始'), false)
  assert.equal(overviewSource.includes('点击项目卡片进入专注工作区'), false)
})

test('项目总览右侧不重复展示状态统计', () => {
  assert.equal(overviewSource.includes('status-summary'), false)
  assert.equal(overviewSource.includes('待启动'), false)
  assert.equal(overviewSource.includes('工作概览'), false)
  assert.match(overviewSource, /已识别/)
})

test('项目总览底部信息面板保持紧凑高度', () => {
  assert.equal(/\.overview-lower-grid\s*\{[^}]*flex:\s*1/.test(overviewSource), false)
  assert.match(overviewSource, /height:\s*clamp\(220px,\s*28vh,\s*320px\)/)
  assert.match(overviewSource, /\.activity-empty[\s\S]*min-height:\s*112px/)
  assert.match(overviewSource, /\.local-url-empty[\s\S]*min-height:\s*112px/)
})

test('项目总览在侧栏宽度变化时保持左侧对齐', () => {
  assert.match(overviewSource, /\.overview-content\s*\{[^}]*max-width:\s*1180px[^}]*margin:\s*0 auto 0 0[^}]*padding:\s*22px 24px 32px/)
  assert.equal(overviewSource.includes('margin: 0 auto; padding: 22px 24px 32px'), false)
})

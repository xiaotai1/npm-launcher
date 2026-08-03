import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const cardSource = readFileSync('src/renderer/src/features/projects/components/ProjectCard.vue', 'utf-8')

test('项目卡片使用紧凑副标题替代常驻完整路径', () => {
  assert.match(cardSource, /projectDisplayMeta/)
  assert.match(cardSource, /project-card-meta/)
  assert.equal(cardSource.includes('project-card-path'), false)
})

test('项目卡片使用与总览一致的轻量样式组织状态和操作', () => {
  assert.match(cardSource, /project-status-inline/)
  assert.match(cardSource, /project-card-meta-line/)
  assert.match(cardSource, /project-meta-separator/)
  assert.match(cardSource, /project-local-section/)
  assert.match(cardSource, /project-meta-grid/)
  assert.match(cardSource, /进入工作区/)
  assert.match(cardSource, /prefers-reduced-motion/)
  assert.equal(cardSource.includes('project-card-rail'), false)
  assert.equal(cardSource.includes('project-status-pill'), false)
  assert.equal(cardSource.includes('project-command-chip'), false)
  assert.equal(cardSource.includes('project-context-chip'), false)
})

test('项目卡片升级为更明显的项目工作卡', () => {
  assert.match(cardSource, /\.project-overview-card\s*\{[^}]*justify-content:\s*flex-start/)
  assert.match(cardSource, /\.project-overview-card\s*\{[^}]*min-height:\s*208px/)
  assert.match(cardSource, /\.project-card-title strong\s*\{[^}]*font-size:\s*18px/)
  assert.match(cardSource, /\.project-local-button\s*\{[^}]*min-height:\s*40px/)
  assert.match(cardSource, /\.project-card-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.equal(/\.project-overview-card\s*\{[^}]*justify-content:\s*space-between/.test(cardSource), false)
})

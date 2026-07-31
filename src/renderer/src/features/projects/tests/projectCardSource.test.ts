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
  assert.match(cardSource, /card-action subtle/)
  assert.match(cardSource, /prefers-reduced-motion/)
  assert.equal(cardSource.includes('project-card-rail'), false)
  assert.equal(cardSource.includes('project-status-pill'), false)
  assert.equal(cardSource.includes('project-command-chip'), false)
  assert.equal(cardSource.includes('project-context-chip'), false)
})

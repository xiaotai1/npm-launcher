import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const headerSource = readFileSync('src/renderer/src/shared/window/AppHeader.vue', 'utf-8')
const mainSource = readFileSync('src/main/index.ts', 'utf-8')

test('mac 标题栏使用独立安全区对齐系统交通灯', () => {
  assert.match(headerSource, /mac-titlebar/)
  assert.match(headerSource, /mac-title-area/)
  assert.match(headerSource, /app-title/)
  assert.match(mainSource, /trafficLightPosition: isMac \? \{ x: 18, y: 16 \}/)
})

test('标题文字不使用负字距挤压', () => {
  assert.equal(headerSource.includes('tracking-[-'), false)
})

test('mac 标题栏不显示应用标题文字', () => {
  assert.match(headerSource, /<span\s+v-if="!isMac"[^>]*app-title[^>]*>NPM Launcher<\/span>/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const headerSource = readFileSync('src/renderer/src/shared/window/AppHeader.vue', 'utf-8')
const macConfig = readFileSync('src-tauri/tauri.macos.conf.json', 'utf-8')

test('mac 标题栏使用 Tauri 覆盖样式和独立安全区', () => {
  assert.match(headerSource, /mac-titlebar/)
  assert.match(headerSource, /mac-title-area/)
  assert.match(macConfig, /"titleBarStyle": "Overlay"/)
  assert.match(macConfig, /"hiddenTitle": true/)
  assert.match(macConfig, /"acceptFirstMouse": true/)
})

test('标题文字不使用负字距挤压', () => {
  assert.equal(headerSource.includes('tracking-[-'), false)
})

test('mac 标题栏不显示应用标题文字', () => {
  assert.match(headerSource, /<span\s+v-if="!isMac"[^>]*app-title[^>]*>NPM Launcher<\/span>/)
})

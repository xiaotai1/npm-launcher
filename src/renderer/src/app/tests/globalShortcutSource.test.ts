import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync('src/renderer/src/app/App.vue', 'utf-8')

test('模态窗口打开时不执行应用全局快捷键', () => {
  assert.match(appSource, /function hasOpenModal\(\)/)
  assert.match(appSource, /document\.querySelector\('\[role="dialog"\], \[role="alertdialog"\]'\)/)
  assert.match(appSource, /hasOpenModal\(\)/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const terminalSource = readFileSync('src/renderer/src/features/terminal/components/Terminal.vue', 'utf-8')

test('交互终端提供轻量工具条操作', () => {
  assert.match(terminalSource, /terminal-toolbar/)
  assert.match(terminalSource, /function copySelection/)
  assert.match(terminalSource, /function pasteClipboard/)
  assert.match(terminalSource, /function clearTerminal/)
  assert.match(terminalSource, /function restartTerminal/)
})

test('终端工具条按钮使用可访问名称', () => {
  assert.match(terminalSource, /aria-label="复制选中内容"/)
  assert.match(terminalSource, /aria-label="粘贴剪贴板内容"/)
  assert.match(terminalSource, /aria-label="清空终端显示"/)
  assert.match(terminalSource, /aria-label="重启交互终端"/)
})

test('终端工具条显示清晰文字并区分常用和重置操作', () => {
  assert.match(terminalSource, /terminal-primary-actions/)
  assert.match(terminalSource, /terminal-secondary-actions/)
  assert.match(terminalSource, /<span>复制<\/span>/)
  assert.match(terminalSource, /<span>粘贴<\/span>/)
  assert.match(terminalSource, /<span>清空<\/span>/)
  assert.match(terminalSource, /<span>重启<\/span>/)
})

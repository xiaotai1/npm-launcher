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

test('终端复制粘贴使用 Tauri 原生剪贴板，避免 WebView 权限菜单', () => {
  assert.match(terminalSource, /await window\.desktopAPI\.writeClipboardText\(selection\)/)
  assert.match(terminalSource, /await window\.desktopAPI\.readClipboardText\(\)/)
  assert.doesNotMatch(terminalSource, /navigator\.clipboard/)
})

test('终端复制粘贴完成后清除选区再恢复焦点', () => {
  const copyFunction = terminalSource.match(/async function copySelection\(\)[\s\S]*?\r?\n}\r?\n\r?\nasync function pasteClipboard/)?.[0] || ''
  const pasteFunction = terminalSource.match(/async function pasteClipboard\(\)[\s\S]*?\r?\n}\r?\n\r?\nfunction clearTerminal/)?.[0] || ''

  assert.match(copyFunction, /terminal\?\.clearSelection\(\)[\s\S]*terminal\?\.focus\(\)/)
  assert.match(pasteFunction, /terminal\?\.clearSelection\(\)[\s\S]*terminal\?\.focus\(\)/)
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

test('项目 Node 版本变化时重建交互终端', () => {
  assert.match(terminalSource, /watch\(\(\) => \[props\.cwd, props\.nodeVersion\]/)
  assert.match(terminalSource, /newNodeVersion !== oldNodeVersion/)
  assert.match(terminalSource, /await restartTerminal\(\)/)
})

test('终端仅在面板仍可见时恢复尺寸和焦点', () => {
  assert.match(terminalSource, /requestAnimationFrame/)
  assert.match(terminalSource, /props\.visible && generation === terminalGeneration/)
  assert.match(terminalSource, /if \(!props\.visible \|\| !terminal \|\| !fitAddon\) return/)
})

test('离开交互终端时释放焦点并清除遗留选区', () => {
  assert.match(terminalSource, /terminal\?\.clearSelection\(\)/)
  assert.match(terminalSource, /terminal\?\.blur\(\)/)
})

test('终端会恢复丢失释放事件造成的残留拖选', () => {
  assert.match(terminalSource, /installTerminalDragRecovery/)
  assert.match(terminalSource, /cleanupDragRecovery\?\.\(\)/)
})

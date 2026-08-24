import assert from 'node:assert/strict'
import test from 'node:test'
import { installDefaultContextMenuGuard } from '../defaultContextMenuGuard'

type Listener = (event: FakeContextMenuEvent) => void

class FakeElement {
  constructor(private readonly editable = false) {}

  closest(selector: string) {
    return this.editable && selector.includes('input') ? this : null
  }
}

class FakeContextMenuEvent {
  defaultPrevented = false
  preventCount = 0

  constructor(readonly target: FakeElement) {}

  preventDefault() {
    this.defaultPrevented = true
    this.preventCount += 1
  }
}

function installHarness() {
  const listeners = new Map<string, Listener>()
  const removed = new Map<string, Listener>()
  Object.assign(globalThis, {
    Element: FakeElement,
    document: {
      addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
      removeEventListener: (name: string, listener: Listener) => removed.set(name, listener)
    }
  })
  return { listeners, removed }
}

test('空白区域右键会阻止 WebView 默认开发菜单', () => {
  const { listeners } = installHarness()
  const cleanup = installDefaultContextMenuGuard()
  const event = new FakeContextMenuEvent(new FakeElement())

  listeners.get('contextmenu')?.(event)

  assert.equal(event.defaultPrevented, true)
  assert.equal(event.preventCount, 1)
  cleanup()
})

test('输入编辑区域保留系统右键菜单', () => {
  const { listeners } = installHarness()
  const cleanup = installDefaultContextMenuGuard()
  const event = new FakeContextMenuEvent(new FakeElement(true))

  listeners.get('contextmenu')?.(event)

  assert.equal(event.defaultPrevented, false)
  cleanup()
})

test('业务组件已处理的右键事件不会被重复处理', () => {
  const { listeners, removed } = installHarness()
  const cleanup = installDefaultContextMenuGuard()
  const event = new FakeContextMenuEvent(new FakeElement())
  event.preventDefault()

  listeners.get('contextmenu')?.(event)

  assert.equal(event.preventCount, 1)
  cleanup()
  assert.equal(removed.get('contextmenu'), listeners.get('contextmenu'))
})

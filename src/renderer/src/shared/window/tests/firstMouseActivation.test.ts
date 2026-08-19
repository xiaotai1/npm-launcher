import assert from 'node:assert/strict'
import test from 'node:test'
import { installFirstMouseActivation } from '../firstMouseActivation'

type Listener = (event: FakeMouseEvent) => void

class FakeElement {
  clickCount = 0

  constructor(
    private readonly kind: 'input' | 'terminal-input' | 'button' | 'immediate-button' | 'tab'
  ) {}

  matches(selector: string) {
    if (selector === ':disabled') return false
    if (selector.includes('[role="tab"]') && this.kind === 'tab') return true
    if (selector.includes('[data-first-mouse-immediate]') && this.kind === 'immediate-button') return true
    if (this.kind === 'input') return selector.includes('input:not([readonly])')
    return this.kind === 'terminal-input' && selector.includes('textarea:not([disabled])')
  }

  closest(selector: string) {
    return (this.kind === 'button' || this.kind === 'immediate-button' || this.kind === 'tab') && selector.includes('button') ? this : null
  }

  contains(element: unknown) {
    return element === this
  }

  get classList() {
    return {
      contains: (name: string) => this.kind === 'terminal-input' && name === 'xterm-helper-textarea'
    }
  }

  click() {
    this.clickCount += 1
  }
}

class FakeMouseEvent {
  readonly button = 0
  readonly detail = 1
  defaultPrevented = false

  constructor(readonly target: FakeElement) {}

  preventDefault() {
    this.defaultPrevented = true
  }

  stopImmediatePropagation() {}
}

test('xterm 只送达首次 mousedown 时也立即激活目标按钮', () => {
  const listeners = new Map<string, Listener>()
  const terminalInput = new FakeElement('terminal-input')
  const button = new FakeElement('button')

  Object.assign(globalThis, {
    Element: FakeElement,
    HTMLElement: FakeElement,
    document: {
      activeElement: terminalInput,
      addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
      removeEventListener: () => undefined
    },
    window: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setTimeout,
      clearTimeout
    }
  })

  const cleanup = installFirstMouseActivation()
  const event = new FakeMouseEvent(button)
  listeners.get('mousedown')?.(event)

  assert.equal(event.defaultPrevented, true)
  assert.equal(button.clickCount, 1)
  cleanup()
})

test('普通输入框聚焦时首次按下导航 tab 即立即激活', () => {
  const listeners = new Map<string, Listener>()
  const input = new FakeElement('input')
  const tab = new FakeElement('tab')

  Object.assign(globalThis, {
    Element: FakeElement,
    HTMLElement: FakeElement,
    document: {
      activeElement: input,
      addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
      removeEventListener: () => undefined
    },
    window: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setTimeout,
      clearTimeout
    }
  })

  const cleanup = installFirstMouseActivation()
  const event = new FakeMouseEvent(tab)
  listeners.get('mousedown')?.(event)

  assert.equal(event.defaultPrevented, true)
  assert.equal(tab.clickCount, 1)
  cleanup()
})

test('普通输入框聚焦时首次按下声明为立即操作的按钮即激活', () => {
  const listeners = new Map<string, Listener>()
  const input = new FakeElement('input')
  const button = new FakeElement('immediate-button')

  Object.assign(globalThis, {
    Element: FakeElement,
    HTMLElement: FakeElement,
    document: {
      activeElement: input,
      addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
      removeEventListener: () => undefined
    },
    window: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setTimeout,
      clearTimeout
    }
  })

  const cleanup = installFirstMouseActivation()
  const event = new FakeMouseEvent(button)
  listeners.get('mousedown')?.(event)

  assert.equal(event.defaultPrevented, true)
  assert.equal(button.clickCount, 1)
  cleanup()
})

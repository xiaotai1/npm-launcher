import assert from 'node:assert/strict'
import test from 'node:test'
import { updateThemeRoot } from './useAppTheme'

test('theme root disables transitions until the new theme has painted', () => {
  const attributes = new Map<string, string>()
  const frames: Array<() => void> = []
  const root = {
    setAttribute(name: string, value: string) {
      attributes.set(name, value)
    },
    removeAttribute(name: string) {
      attributes.delete(name)
    }
  }

  updateThemeRoot(root, 'light', callback => frames.push(callback))

  assert.equal(attributes.get('data-theme'), 'light')
  assert.equal(attributes.has('data-theme-changing'), true)
  assert.equal(frames.length, 1)

  frames.shift()?.()
  assert.equal(attributes.has('data-theme-changing'), true)
  assert.equal(frames.length, 1)

  frames.shift()?.()
  assert.equal(attributes.has('data-theme-changing'), false)
})

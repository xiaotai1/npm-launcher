import assert from 'node:assert/strict'
import test from 'node:test'
import { clampContextMenuPosition } from '../model/contextMenuPosition'

test('context menu position stays inside viewport', () => {
  assert.deepEqual(clampContextMenuPosition(
    { x: 780, y: 560 },
    { width: 800, height: 600 },
    { width: 180, height: 140 }
  ), { x: 612, y: 452 })
})

test('context menu position keeps requested point when there is enough room', () => {
  assert.deepEqual(clampContextMenuPosition(
    { x: 120, y: 90 },
    { width: 800, height: 600 },
    { width: 180, height: 140 }
  ), { x: 120, y: 90 })
})

test('context menu position keeps padding when viewport is too small', () => {
  assert.deepEqual(clampContextMenuPosition(
    { x: 10, y: 10 },
    { width: 120, height: 80 },
    { width: 180, height: 140 }
  ), { x: 8, y: 8 })
})

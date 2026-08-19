import assert from 'node:assert/strict'
import test from 'node:test'
import { createTerminalDragState } from '../terminalDragState'

test('主键释放事件丢失后，无按键移动需要恢复拖选状态', () => {
  const state = createTerminalDragState()
  state.press(0)

  assert.equal(state.move(0), true)
  assert.equal(state.move(0), false)
})

test('正常按住主键拖动时不触发恢复', () => {
  const state = createTerminalDragState()
  state.press(0)

  assert.equal(state.move(1), false)
})

test('正常释放后移动不触发恢复', () => {
  const state = createTerminalDragState()
  state.press(0)
  state.release()

  assert.equal(state.move(0), false)
})

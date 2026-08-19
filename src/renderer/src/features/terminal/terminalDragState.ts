export function createTerminalDragState() {
  let primaryPressed = false

  return {
    press(button: number) {
      if (button === 0) primaryPressed = true
    },
    release() {
      primaryPressed = false
    },
    move(buttons: number) {
      if (!primaryPressed || buttons !== 0) return false
      primaryPressed = false
      return true
    },
    reset() {
      primaryPressed = false
    }
  }
}

export function installTerminalDragRecovery(container: HTMLElement, clearSelection: () => void) {
  const state = createTerminalDragState()
  const ownerDocument = container.ownerDocument
  const onMouseDown = (event: MouseEvent) => state.press(event.button)
  const onMouseUp = () => state.release()
  const onMouseMove = (event: MouseEvent) => {
    if (!state.move(event.buttons)) return

    event.stopPropagation()
    ownerDocument.dispatchEvent(new MouseEvent('mouseup', {
      button: 0,
      buttons: 0,
      clientX: event.clientX,
      clientY: event.clientY
    }))
    clearSelection()
  }

  container.addEventListener('mousedown', onMouseDown)
  container.addEventListener('mousemove', onMouseMove)
  ownerDocument.addEventListener('mouseup', onMouseUp)

  return () => {
    container.removeEventListener('mousedown', onMouseDown)
    container.removeEventListener('mousemove', onMouseMove)
    ownerDocument.removeEventListener('mouseup', onMouseUp)
    state.reset()
  }
}

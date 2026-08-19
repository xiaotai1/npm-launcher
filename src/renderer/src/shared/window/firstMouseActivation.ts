const EDITABLE_ELEMENTS = 'input:not([readonly]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [role="textbox"]'
const FIRST_MOUSE_TARGETS = 'button, input[readonly], [role="button"], [role="tab"], [role="menuitem"], [tabindex="0"], [data-first-mouse-target]'
const IMMEDIATE_FIRST_MOUSE_TARGETS = '[role="tab"], [data-first-mouse-immediate]'

function isEditableElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.matches(EDITABLE_ELEMENTS)
}

function isTerminalInput(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.classList.contains('xterm-helper-textarea')
}

export function installFirstMouseActivation() {
  let pressedTarget: HTMLElement | null = null
  let activatedTarget: HTMLElement | null = null
  let clearTimer: number | null = null

  function clearPressedTarget() {
    pressedTarget = null
  }

  function clearActivation() {
    clearPressedTarget()
    activatedTarget = null
    if (clearTimer !== null) window.clearTimeout(clearTimer)
    clearTimer = null
  }

  function activateTarget(target: HTMLElement) {
    activatedTarget = target
    clearPressedTarget()
    if (clearTimer !== null) window.clearTimeout(clearTimer)
    clearTimer = window.setTimeout(clearActivation, 500)
    target.click()
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.button !== 0 || !(event.target instanceof Element)) return
    const activeElement = document.activeElement
    if (!isEditableElement(activeElement)) return

    const target = event.target.closest(FIRST_MOUSE_TARGETS)
    if (!(target instanceof HTMLElement) || target.matches(':disabled')) return
    if (target.contains(document.activeElement)) return

    event.preventDefault()
    if (isTerminalInput(activeElement) || target.matches(IMMEDIATE_FIRST_MOUSE_TARGETS)) {
      activateTarget(target)
      return
    }
    pressedTarget = target
  }

  function handleMouseUp(event: MouseEvent) {
    if (event.button !== 0 || !pressedTarget || !(event.target instanceof Element)) return
    const releaseTarget = event.target.closest(FIRST_MOUSE_TARGETS)
    if (releaseTarget !== pressedTarget) {
      clearPressedTarget()
      return
    }

    event.preventDefault()
    activateTarget(pressedTarget)
  }

  function handleClick(event: MouseEvent) {
    if (event.detail === 0 || !activatedTarget || !(event.target instanceof Element)) return
    if (event.target.closest(FIRST_MOUSE_TARGETS) !== activatedTarget) return

    event.preventDefault()
    event.stopImmediatePropagation()
    clearActivation()
  }

  document.addEventListener('mousedown', handleMouseDown, true)
  document.addEventListener('mouseup', handleMouseUp, true)
  document.addEventListener('click', handleClick, true)
  window.addEventListener('blur', clearActivation)

  return () => {
    document.removeEventListener('mousedown', handleMouseDown, true)
    document.removeEventListener('mouseup', handleMouseUp, true)
    document.removeEventListener('click', handleClick, true)
    window.removeEventListener('blur', clearActivation)
    clearActivation()
  }
}

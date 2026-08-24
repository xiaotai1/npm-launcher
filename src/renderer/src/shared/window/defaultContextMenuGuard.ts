const NATIVE_CONTEXT_MENU_TARGETS = 'input, textarea, [contenteditable="true"], [role="textbox"]'

export function installDefaultContextMenuGuard() {
  function handleContextMenu(event: MouseEvent) {
    if (event.defaultPrevented || !(event.target instanceof Element)) return
    if (event.target.closest(NATIVE_CONTEXT_MENU_TARGETS)) return
    event.preventDefault()
  }

  document.addEventListener('contextmenu', handleContextMenu)
  return () => document.removeEventListener('contextmenu', handleContextMenu)
}

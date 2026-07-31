export interface MenuPoint {
  x: number
  y: number
}

export interface MenuSize {
  width: number
  height: number
}

export function clampContextMenuPosition(
  point: MenuPoint,
  viewport: MenuSize,
  menu: MenuSize,
  padding = 8
): MenuPoint {
  const maxX = Math.max(padding, viewport.width - menu.width - padding)
  const maxY = Math.max(padding, viewport.height - menu.height - padding)

  return {
    x: Math.min(Math.max(point.x, padding), maxX),
    y: Math.min(Math.max(point.y, padding), maxY)
  }
}

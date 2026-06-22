import { screen, type Display } from 'electron'

export type StatusBarEdge = 'top' | 'bottom' | 'left' | 'right'

export const STATUS_BAR_LONG = 480
export const STATUS_BAR_SHORT = 44
export const STATUS_BAR_MARGIN = 8

const ADJACENT_TOLERANCE_PX = 8

export interface StatusBarPlacementOption {
  id: string
  displayId: number
  displayLabel: string
  edge: StatusBarEdge
  edgeLabel: string
  orientation: 'horizontal' | 'vertical'
  label: string
}

export interface StatusBarLayout {
  x: number
  y: number
  width: number
  height: number
  orientation: 'horizontal' | 'vertical'
  displayId: number
  edge: StatusBarEdge
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd - ADJACENT_TOLERANCE_PX && bStart < aEnd - ADJACENT_TOLERANCE_PX
}

function hasDisplayToLeft(target: Display, displays: Display[]): boolean {
  return displays.some(
    (item) =>
      item.id !== target.id &&
      Math.abs(item.bounds.x + item.bounds.width - target.bounds.x) <= ADJACENT_TOLERANCE_PX &&
      rangesOverlap(item.bounds.y, item.bounds.y + item.bounds.height, target.bounds.y, target.bounds.y + target.bounds.height)
  )
}

function hasDisplayToRight(target: Display, displays: Display[]): boolean {
  return displays.some(
    (item) =>
      item.id !== target.id &&
      Math.abs(target.bounds.x + target.bounds.width - item.bounds.x) <= ADJACENT_TOLERANCE_PX &&
      rangesOverlap(item.bounds.y, item.bounds.y + item.bounds.height, target.bounds.y, target.bounds.y + target.bounds.height)
  )
}

function hasDisplayAbove(target: Display, displays: Display[]): boolean {
  return displays.some(
    (item) =>
      item.id !== target.id &&
      Math.abs(item.bounds.y + item.bounds.height - target.bounds.y) <= ADJACENT_TOLERANCE_PX &&
      rangesOverlap(item.bounds.x, item.bounds.x + item.bounds.width, target.bounds.x, target.bounds.x + target.bounds.width)
  )
}

function hasDisplayBelow(target: Display, displays: Display[]): boolean {
  return displays.some(
    (item) =>
      item.id !== target.id &&
      Math.abs(target.bounds.y + target.bounds.height - item.bounds.y) <= ADJACENT_TOLERANCE_PX &&
      rangesOverlap(item.bounds.x, item.bounds.x + item.bounds.width, target.bounds.x, target.bounds.x + target.bounds.width)
  )
}

function isEdgeBlocked(display: Display, edge: StatusBarEdge, displays: Display[]): boolean {
  switch (edge) {
    case 'left':
      return hasDisplayToLeft(display, displays)
    case 'right':
      return hasDisplayToRight(display, displays)
    case 'top':
      return hasDisplayAbove(display, displays)
    case 'bottom':
      return hasDisplayBelow(display, displays)
    default:
      return false
  }
}

const EDGE_LABELS: Record<StatusBarEdge, string> = {
  top: '顶部',
  bottom: '底部',
  left: '左侧',
  right: '右侧'
}

function getDisplayLabel(display: Display, displays: Display[]): string {
  const primary = screen.getPrimaryDisplay()
  if (display.id === primary.id) {
    return '主显示器'
  }
  const index = displays.findIndex((item) => item.id === display.id)
  return index >= 0 ? `显示器 ${index + 1}` : `显示器 ${display.id}`
}

export function listStatusBarPlacementOptions(): StatusBarPlacementOption[] {
  const displays = screen.getAllDisplays()
  const edges: StatusBarEdge[] = ['top', 'bottom', 'left', 'right']
  const options: StatusBarPlacementOption[] = []

  for (const display of displays) {
    const displayLabel = getDisplayLabel(display, displays)
    for (const edge of edges) {
      if (isEdgeBlocked(display, edge, displays)) {
        continue
      }
      const orientation = edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal'
      const edgeLabel = EDGE_LABELS[edge]
      options.push({
        id: `${display.id}:${edge}`,
        displayId: display.id,
        displayLabel,
        edge,
        edgeLabel,
        orientation,
        label: `${displayLabel} · ${edgeLabel}`
      })
    }
  }

  return options
}

export function resolveStatusBarLayout(
  displayId: number | undefined,
  edge: StatusBarEdge | undefined
): StatusBarLayout {
  const displays = screen.getAllDisplays()
  const options = listStatusBarPlacementOptions()
  const primary = screen.getPrimaryDisplay()

  const effectiveDisplayId =
    displayId && displays.some((item) => item.id === displayId) ? displayId : primary.id
  let resolvedDisplayId = effectiveDisplayId
  let resolvedEdge: StatusBarEdge = edge ?? 'top'

  const requested = options.find(
    (item) => item.displayId === resolvedDisplayId && item.edge === resolvedEdge
  )
  if (!requested) {
    const fallback =
      options.find((item) => item.displayId === primary.id && item.edge === 'top') ??
      options[0]
    if (fallback) {
      resolvedDisplayId = fallback.displayId
      resolvedEdge = fallback.edge
    }
  }

  const display = displays.find((item) => item.id === resolvedDisplayId) ?? primary
  const orientation = resolvedEdge === 'left' || resolvedEdge === 'right' ? 'vertical' : 'horizontal'
  const width = orientation === 'horizontal' ? STATUS_BAR_LONG : STATUS_BAR_SHORT
  const height = orientation === 'horizontal' ? STATUS_BAR_SHORT : STATUS_BAR_LONG
  const { x: workX, y: workY, width: workW, height: workH } = display.workArea

  switch (resolvedEdge) {
    case 'top':
      return {
        x: workX + Math.round((workW - width) / 2),
        y: workY + STATUS_BAR_MARGIN,
        width,
        height,
        orientation,
        displayId: display.id,
        edge: resolvedEdge
      }
    case 'bottom':
      return {
        x: workX + Math.round((workW - width) / 2),
        y: workY + workH - height - STATUS_BAR_MARGIN,
        width,
        height,
        orientation,
        displayId: display.id,
        edge: resolvedEdge
      }
    case 'left':
      return {
        x: workX + STATUS_BAR_MARGIN,
        y: workY + Math.round((workH - height) / 2),
        width,
        height,
        orientation,
        displayId: display.id,
        edge: resolvedEdge
      }
    case 'right':
      return {
        x: workX + workW - width - STATUS_BAR_MARGIN,
        y: workY + Math.round((workH - height) / 2),
        width,
        height,
        orientation,
        displayId: display.id,
        edge: resolvedEdge
      }
    default:
      return {
        x: workX + Math.round((workW - width) / 2),
        y: workY + STATUS_BAR_MARGIN,
        width,
        height,
        orientation,
        displayId: display.id,
        edge: 'top'
      }
  }
}

import type { Arrow, Point } from "./types"

export type ControlBasis = {
  along: number
  side: number
}

const shift = (point: Point, dx: number, dy: number): Point => ({
  x: point.x + dx,
  y: point.y + dy,
})

export const midpoint = (start: Point, end: Point): Point => ({
  x: (start.x + end.x) / 2,
  y: (start.y + end.y) / 2,
})

export const bezierControl = (start: Point, node: Point, end: Point): Point => ({
  x: 2 * node.x - (start.x + end.x) / 2,
  y: 2 * node.y - (start.y + end.y) / 2,
})

export const relativeControl = (start: Point, end: Point, control: Point): ControlBasis => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const cx = control.x - start.x
  const cy = control.y - start.y
  return {
    along: (cx * ux + cy * uy) / length,
    side: (cx * -uy + cy * ux) / length,
  }
}

export const controlFromRelative = (start: Point, end: Point, basis: ControlBasis): Point => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  return {
    x: start.x + basis.along * dx + basis.side * length * -uy,
    y: start.y + basis.along * dy + basis.side * length * ux,
  }
}

export const arrowPath = (start: Point, end: Point, node = midpoint(start, end)) => {
  const control = bezierControl(start, node, end)
  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
}

export const translateArrow = (arrow: Arrow, dx: number, dy: number): Arrow => ({
  ...arrow,
  start: shift(arrow.start, dx, dy),
  end: shift(arrow.end, dx, dy),
  control: shift(arrow.control ?? midpoint(arrow.start, arrow.end), dx, dy),
})

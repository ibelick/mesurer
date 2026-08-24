import type { Arrow, Point } from "./types"

export type ControlBasis = {
  along: number
  side: number
}

const shift = (point: Point, dx: number, dy: number): Point => ({
  x: point.x + dx,
  y: point.y + dy,
})

const normalize = (point: Point): Point => {
  const length = Math.hypot(point.x, point.y) || 1
  return { x: point.x / length, y: point.y / length }
}

export const midpoint = (start: Point, end: Point): Point => ({
  x: (start.x + end.x) / 2,
  y: (start.y + end.y) / 2,
})

export const bezierControl = (start: Point, node: Point, end: Point): Point => ({
  x: 2 * node.x - (start.x + end.x) / 2,
  y: 2 * node.y - (start.y + end.y) / 2,
})

export const quadraticPoint = (start: Point, node: Point, end: Point, t: number): Point => {
  const control = bezierControl(start, node, end)
  const mt = 1 - t
  return {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
  }
}

export const arrowTangent = (start: Point, node: Point, end: Point): Point => {
  for (const t of [0.82, 0.65, 0.5]) {
    const from = quadraticPoint(start, node, end, t)
    const delta = { x: end.x - from.x, y: end.y - from.y }
    if (Math.hypot(delta.x, delta.y) > 2) return normalize(delta)
  }
  return normalize({ x: end.x - start.x, y: end.y - start.y })
}

export const arrowHead = (start: Point, node: Point, end: Point, width: number) => {
  const tangent = arrowTangent(start, node, end)
  const length = Math.max(12, width * 8)
  const wing = length * 0.5
  const normal = { x: -tangent.y, y: tangent.x }
  return {
    tip: end,
    left: {
      x: end.x - tangent.x * length + normal.x * wing,
      y: end.y - tangent.y * length + normal.y * wing,
    },
    right: {
      x: end.x - tangent.x * length - normal.x * wing,
      y: end.y - tangent.y * length - normal.y * wing,
    },
  }
}

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

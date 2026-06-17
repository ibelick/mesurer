import type { NormalizedRect, Point, Rect } from "./types"

export const getViewportSize = () => ({
  width: typeof window === "undefined" ? 1 : window.innerWidth || 1,
  height: typeof window === "undefined" ? 1 : window.innerHeight || 1,
})

export const normalizeRect = (
  rect: Rect,
  viewport = getViewportSize()
): NormalizedRect => ({
  left: rect.left / viewport.width,
  top: rect.top / viewport.height,
  width: rect.width / viewport.width,
  height: rect.height / viewport.height,
})

export const denormalizeRect = (
  rect: NormalizedRect,
  viewport = getViewportSize()
): Rect => ({
  left: rect.left * viewport.width,
  top: rect.top * viewport.height,
  width: rect.width * viewport.width,
  height: rect.height * viewport.height,
})

export const getRectFromPoints = (start: Point, end: Point): Rect => {
  const left = Math.min(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const width = Math.abs(start.x - end.x)
  const height = Math.abs(start.y - end.y)
  return { left, top, width, height }
}

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export const rectsOverlap = (rectA: Rect, rectB: Rect) =>
  rectA.left < rectB.left + rectB.width &&
  rectA.left + rectA.width > rectB.left &&
  rectA.top < rectB.top + rectB.height &&
  rectA.top + rectA.height > rectB.top

export const rectArea = (rect: Rect) => rect.width * rect.height

export const intersectionArea = (rectA: Rect, rectB: Rect) => {
  const x1 = Math.max(rectA.left, rectB.left)
  const y1 = Math.max(rectA.top, rectB.top)
  const x2 = Math.min(rectA.left + rectA.width, rectB.left + rectB.width)
  const y2 = Math.min(rectA.top + rectA.height, rectB.top + rectB.height)
  const width = Math.max(0, x2 - x1)
  const height = Math.max(0, y2 - y1)
  return width * height
}

export const rectAlmostEqual = (a: Rect, b: Rect, epsilon = 0.25) =>
  Math.abs(a.left - b.left) < epsilon &&
  Math.abs(a.top - b.top) < epsilon &&
  Math.abs(a.width - b.width) < epsilon &&
  Math.abs(a.height - b.height) < epsilon

export const getDistanceToRect = (point: Point, rect: Rect) => {
  const right = rect.left + rect.width
  const bottom = rect.top + rect.height
  const dx =
    point.x < rect.left
      ? rect.left - point.x
      : point.x > right
        ? point.x - right
        : 0
  const dy =
    point.y < rect.top
      ? rect.top - point.y
      : point.y > bottom
        ? point.y - bottom
        : 0
  return Math.hypot(dx, dy)
}

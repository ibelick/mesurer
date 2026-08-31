import type { Point } from "./types"
import { boxCenter, rotatePoint, type ResizeHandle } from "./text-transform"

export type TransformBounds = {
  x: number
  y: number
  width: number
  height: number
}

export const boundsFromPoints = (points: Point[]): TransformBounds => {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
  }
}

export const rotatedBounds = (bounds: TransformBounds, rotation: number): TransformBounds => {
  const center = boxCenter(bounds.x, bounds.y, bounds.width, bounds.height)
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((point) => rotatePoint(point, center, rotation))
  return boundsFromPoints(corners)
}

export type ResizeGeometry = {
  anchor: Point
  sx: number
  sy: number
  translateX: number
  translateY: number
}

export const resizeGeometry = (
  bounds: TransformBounds,
  rotation: number,
  handle: ResizeHandle,
  pointer: Point,
): ResizeGeometry => {
  const center = boxCenter(bounds.x, bounds.y, bounds.width, bounds.height)
  const localPointer = rotatePoint(pointer, center, -rotation)
  const anchor = {
    x: handle.includes("w")
      ? bounds.x + bounds.width
      : handle.includes("e")
        ? bounds.x
        : bounds.x + bounds.width / 2,
    y: handle.includes("n")
      ? bounds.y + bounds.height
      : handle.includes("s")
        ? bounds.y
        : bounds.y + bounds.height / 2,
  }
  const ratio = {
    x: handle.includes("w") ? 1 : handle.includes("e") ? 0 : 0.5,
    y: handle.includes("n") ? 1 : handle.includes("s") ? 0 : 0.5,
  }
  const startX = ratio.x === 0 ? bounds.width : ratio.x === 1 ? -bounds.width : 0
  const startY = ratio.y === 0 ? bounds.height : ratio.y === 1 ? -bounds.height : 0
  const factors = [
    startX !== 0 ? (localPointer.x - anchor.x) / startX : null,
    startY !== 0 ? (localPointer.y - anchor.y) / startY : null,
  ].filter((factor): factor is number => factor !== null)
  const factor = factors.length === 2
    ? Math.abs((factors[0] ?? 1) - 1) >= Math.abs((factors[1] ?? 1) - 1)
      ? factors[0] ?? 1
      : factors[1] ?? 1
    : factors[0] ?? 1
  const safeFactor = Math.abs(factor) < 0.01 ? (factor < 0 ? -0.01 : 0.01) : factor
  const sx = startX !== 0 ? safeFactor : 1
  const sy = startY !== 0 ? safeFactor : 1
  const nextWidth = bounds.width * sx
  const nextHeight = bounds.height * sy
  const nextCenter = {
    x: handle.includes("w")
      ? anchor.x - nextWidth / 2
      : handle.includes("e")
        ? anchor.x + nextWidth / 2
        : center.x,
    y: handle.includes("n")
      ? anchor.y - nextHeight / 2
      : handle.includes("s")
        ? anchor.y + nextHeight / 2
        : center.y,
  }
  const anchorInPage = rotatePoint(anchor, center, rotation)
  const rotatedAnchorAtNextCenter = rotatePoint(anchor, nextCenter, rotation)
  return {
    anchor,
    sx,
    sy,
    translateX: anchorInPage.x - rotatedAnchorAtNextCenter.x,
    translateY: anchorInPage.y - rotatedAnchorAtNextCenter.y,
  }
}

export const resizePoint = (point: Point, geometry: ResizeGeometry): Point => ({
  x: geometry.anchor.x + (point.x - geometry.anchor.x) * geometry.sx + geometry.translateX,
  y: geometry.anchor.y + (point.y - geometry.anchor.y) * geometry.sy + geometry.translateY,
})

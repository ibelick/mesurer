import type { PenStroke, Point } from "./types"
import { boxCenter, rotatePoint, rotationFromPointer, type ResizeHandle } from "./text-transform"
import { boundsFromPoints, resizeGeometry, resizePoint, rotatedBounds } from "./transform-geometry"

export type PenBounds = { x: number; y: number; width: number; height: number }

export const penBounds = (stroke: PenStroke): PenBounds => {
  return boundsFromPoints(stroke.points)
}

export const transformedPenBounds = (stroke: PenStroke): PenBounds => {
  return rotatedBounds(penBounds(stroke), stroke.rotation ?? 0)
}

export const movePenStroke = (stroke: PenStroke, dx: number, dy: number): PenStroke => ({
  ...stroke,
  points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
})

export const resizePenStroke = (stroke: PenStroke, handle: ResizeHandle, pointer: Point): PenStroke => {
  const box = penBounds(stroke)
  const rotation = stroke.rotation ?? 0
  const geometry = resizeGeometry(box, rotation, handle, pointer)
  return {
    ...stroke,
    points: stroke.points.map((point) => {
      return resizePoint(point, geometry)
    }),
    rotation,
  }
}

export const rotatePenStroke = (stroke: PenStroke, pointer: Point, offset: number): PenStroke => {
  const box = penBounds(stroke)
  const center = boxCenter(box.x, box.y, box.width, box.height)
  const nextRotation = rotationFromPointer(center, pointer) - offset
  return {
    ...stroke,
    rotation: nextRotation,
  }
}

export const rotatePenStrokeAround = (
  stroke: PenStroke,
  center: Point,
  degrees: number,
): PenStroke => {
  const box = penBounds(stroke)
  const strokeCenter = boxCenter(box.x, box.y, box.width, box.height)
  const rotation = stroke.rotation ?? 0
  const nextCenter = rotatePoint(strokeCenter, center, degrees)
  const nextRotation = rotation + degrees
  const rotated = stroke.points
    .map((point) => rotatePoint(point, strokeCenter, rotation))
    .map((point) => rotatePoint(point, center, degrees))
    .map((point) => rotatePoint(point, nextCenter, -nextRotation))
  return {
    ...stroke,
    points: rotated,
    rotation: nextRotation,
  }
}

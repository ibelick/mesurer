import type { Arrow, Point } from "./types"
import { arrowHead, midpoint, quadraticPoint } from "./arrows"
import { boxCenter, rotatePoint, rotationFromPointer, type ResizeHandle } from "./text-transform"
import { boundsFromPoints, resizeGeometry, resizePoint, rotatedBounds } from "./transform-geometry"

export type ArrowBounds = { x: number; y: number; width: number; height: number }

export const arrowBounds = (arrow: Arrow): ArrowBounds => {
  const control = arrow.control ?? midpoint(arrow.start, arrow.end)
  const head = arrowHead(arrow.start, control, arrow.end, arrow.width)
  const points = [arrow.start, arrow.end, control, head.left, head.right, head.tip, ...Array.from({ length: 17 }, (_, index) => quadraticPoint(arrow.start, control, arrow.end, (index + 1) / 18))]
  return boundsFromPoints(points)
}

export const transformedArrowPoints = (arrow: Arrow): Point[] => {
  const control = arrow.control ?? { x: (arrow.start.x + arrow.end.x) / 2, y: (arrow.start.y + arrow.end.y) / 2 }
  const bounds = arrowBounds(arrow)
  const center = boxCenter(bounds.x, bounds.y, bounds.width, bounds.height)
  return [arrow.start, control, arrow.end].map((point) => rotatePoint(point, center, arrow.rotation ?? 0))
}

export const transformedArrowBounds = (arrow: Arrow): ArrowBounds => {
  return rotatedBounds(arrowBounds(arrow), arrow.rotation ?? 0)
}

export const moveArrow = (arrow: Arrow, dx: number, dy: number): Arrow => ({
  ...arrow,
  start: { x: arrow.start.x + dx, y: arrow.start.y + dy },
  end: { x: arrow.end.x + dx, y: arrow.end.y + dy },
  control: arrow.control
    ? { x: arrow.control.x + dx, y: arrow.control.y + dy }
    : undefined,
})

export const resizeArrow = (arrow: Arrow, handle: ResizeHandle, pointer: Point): Arrow => {
  const box = arrowBounds(arrow)
  const rotation = arrow.rotation ?? 0
  const geometry = resizeGeometry(box, rotation, handle, pointer)
  const points = [arrow.start, arrow.control ?? { x: (arrow.start.x + arrow.end.x) / 2, y: (arrow.start.y + arrow.end.y) / 2 }, arrow.end]
  const nextPoints = points.map((point) => resizePoint(point, geometry))
  return { ...arrow, start: nextPoints[0]!, control: nextPoints[1]!, end: nextPoints[2]! }
}

export const rotateArrow = (arrow: Arrow, pointer: Point, offset: number): Arrow => {
  const bounds = arrowBounds(arrow)
  const center = boxCenter(bounds.x, bounds.y, bounds.width, bounds.height)
  return { ...arrow, rotation: rotationFromPointer(center, pointer) - offset }
}

export const rotateArrowAround = (
  arrow: Arrow,
  center: Point,
  degrees: number,
): Arrow => {
  const control = arrow.control ?? midpoint(arrow.start, arrow.end)
  const bounds = arrowBounds(arrow)
  const arrowCenter = boxCenter(bounds.x, bounds.y, bounds.width, bounds.height)
  const rotation = arrow.rotation ?? 0
  const nextCenter = rotatePoint(arrowCenter, center, degrees)
  const nextRotation = rotation + degrees
  const worldPoints = [arrow.start, control, arrow.end].map((point) =>
    rotatePoint(point, arrowCenter, rotation),
  )
  const rotated = worldPoints
    .map((point) => rotatePoint(point, center, degrees))
    .map((point) => rotatePoint(point, nextCenter, -nextRotation))
  return {
    ...arrow,
    start: rotated[0]!,
    control: rotated[1]!,
    end: rotated[2]!,
    rotation: nextRotation,
  }
}

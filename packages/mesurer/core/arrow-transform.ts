import type { Arrow, Point } from "./types"
import { arrowHead, midpoint, quadraticPoint } from "./arrows"
import { boxCenter, rotatePoint, rotationFromPointer, type ResizeHandle } from "./text-transform"

export type ArrowBounds = { x: number; y: number; width: number; height: number }

export const arrowBounds = (arrow: Arrow): ArrowBounds => {
  const control = arrow.control ?? midpoint(arrow.start, arrow.end)
  const head = arrowHead(arrow.start, control, arrow.end, arrow.width)
  const points = [arrow.start, arrow.end, control, head.left, head.right, head.tip, ...Array.from({ length: 17 }, (_, index) => quadraticPoint(arrow.start, control, arrow.end, (index + 1) / 18))]
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) }
}

export const transformedArrowPoints = (arrow: Arrow): Point[] => {
  const control = arrow.control ?? { x: (arrow.start.x + arrow.end.x) / 2, y: (arrow.start.y + arrow.end.y) / 2 }
  const bounds = arrowBounds(arrow)
  const center = boxCenter(bounds.x, bounds.y, bounds.width, bounds.height)
  return [arrow.start, control, arrow.end].map((point) => rotatePoint(point, center, arrow.rotation ?? 0))
}

export const transformedArrowBounds = (arrow: Arrow): ArrowBounds => {
  const bounds = arrowBounds(arrow)
  const center = boxCenter(bounds.x, bounds.y, bounds.width, bounds.height)
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((point) => rotatePoint(point, center, arrow.rotation ?? 0))
  const xs = corners.map((point) => point.x)
  const ys = corners.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) }
}

const anchorFor = (handle: ResizeHandle, box: ArrowBounds) => ({
  x: handle.includes("w") ? box.x + box.width : handle.includes("e") ? box.x : box.x + box.width / 2,
  y: handle.includes("n") ? box.y + box.height : handle.includes("s") ? box.y : box.y + box.height / 2,
})

const anchorRatio = (handle: ResizeHandle) => ({
  x: handle.includes("w") ? 1 : handle.includes("e") ? 0 : 0.5,
  y: handle.includes("n") ? 1 : handle.includes("s") ? 0 : 0.5,
})

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
  const center = boxCenter(box.x, box.y, box.width, box.height)
  const localPointer = rotatePoint(pointer, center, -rotation)
  const anchor = anchorFor(handle, box)
  const ratio = anchorRatio(handle)
  const startX = ratio.x === 0 ? box.width : ratio.x === 1 ? -box.width : 0
  const startY = ratio.y === 0 ? box.height : ratio.y === 1 ? -box.height : 0
  const factors = [
    startX !== 0 ? (localPointer.x - anchor.x) / startX : null,
    startY !== 0 ? (localPointer.y - anchor.y) / startY : null,
  ].filter((factor): factor is number => factor !== null)
  const factor = factors.length === 2
    ? Math.abs((factors[0] ?? 1) - 1) >= Math.abs((factors[1] ?? 1) - 1) ? factors[0] ?? 1 : factors[1] ?? 1
    : factors[0] ?? 1
  const safeFactor = Math.abs(factor) < 0.01 ? (factor < 0 ? -0.01 : 0.01) : factor
  const sx = startX !== 0 ? safeFactor : 1
  const sy = startY !== 0 ? safeFactor : 1
  const nextWidth = box.width * sx
  const nextHeight = box.height * sy
  const nextCenter = {
    x: handle.includes("w") ? anchor.x - nextWidth / 2 : handle.includes("e") ? anchor.x + nextWidth / 2 : center.x,
    y: handle.includes("n") ? anchor.y - nextHeight / 2 : handle.includes("s") ? anchor.y + nextHeight / 2 : center.y,
  }
  const anchorInPage = rotatePoint(anchor, center, rotation)
  const rotatedAnchorAtNextCenter = rotatePoint(anchor, nextCenter, rotation)
  const translateX = anchorInPage.x - rotatedAnchorAtNextCenter.x
  const translateY = anchorInPage.y - rotatedAnchorAtNextCenter.y
  const points = [arrow.start, arrow.control ?? { x: (arrow.start.x + arrow.end.x) / 2, y: (arrow.start.y + arrow.end.y) / 2 }, arrow.end]
  const nextPoints = points.map((point) => ({
    x: anchor.x + (point.x - anchor.x) * sx + translateX,
    y: anchor.y + (point.y - anchor.y) * sy + translateY,
  }))
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

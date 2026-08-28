import type { PenStroke, Point } from "./types"
import { boxCenter, rotatePoint, rotationFromPointer, type ResizeHandle } from "./text-transform"

export type PenBounds = { x: number; y: number; width: number; height: number }

export const penBounds = (stroke: PenStroke): PenBounds => {
  const xs = stroke.points.map((point) => point.x)
  const ys = stroke.points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) }
}

export const movePenStroke = (stroke: PenStroke, dx: number, dy: number): PenStroke => ({
  ...stroke,
  points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
})

const anchorFor = (handle: ResizeHandle, box: PenBounds) => {
  const x = handle.includes("w") ? box.x + box.width : handle.includes("e") ? box.x : box.x + box.width / 2
  const y = handle.includes("n") ? box.y + box.height : handle.includes("s") ? box.y : box.y + box.height / 2
  return { x, y }
}

const anchorRatio = (handle: ResizeHandle) => ({
  x: handle.includes("w") ? 1 : handle.includes("e") ? 0 : 0.5,
  y: handle.includes("n") ? 1 : handle.includes("s") ? 0 : 0.5,
})

export const resizePenStroke = (stroke: PenStroke, handle: ResizeHandle, pointer: Point): PenStroke => {
  const box = penBounds(stroke)
  const rotation = stroke.rotation ?? 0
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
    ? Math.abs((factors[0] ?? 1) - 1) >= Math.abs((factors[1] ?? 1) - 1)
      ? factors[0] ?? 1
      : factors[1] ?? 1
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
  return {
    ...stroke,
    points: stroke.points.map((point) => {
      return {
        x: anchor.x + (point.x - anchor.x) * sx + translateX,
        y: anchor.y + (point.y - anchor.y) * sy + translateY,
      }
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

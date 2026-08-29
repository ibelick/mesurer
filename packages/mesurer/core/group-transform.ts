import { rotateArrowAround } from "./arrow-transform"
import { rotatePenStrokeAround } from "./pen-transform"
import type { Arrow, PenStroke, Point, Rect, TextAnnotation } from "./types"
import { boxCenter, rotatePoint, textAnnotationBounds, type ResizeHandle } from "./text-transform"

export type GroupResizeSnapshot = {
  rect: Rect
  rotation: number
  arrows: Arrow[]
  penStrokes: PenStroke[]
  texts: Array<{
    item: TextAnnotation
    bounds: { x: number; y: number; width: number; height: number }
  }>
}

const resizeFactors = (handle: ResizeHandle, rect: Rect, rotation: number, pointer: Point) => {
  const center = boxCenter(rect.left, rect.top, rect.width, rect.height)
  const localPointer = rotatePoint(pointer, center, -rotation)
  const anchor = {
    x: handle.includes("w") ? rect.left + rect.width : handle.includes("e") ? rect.left : center.x,
    y: handle.includes("n") ? rect.top + rect.height : handle.includes("s") ? rect.top : center.y,
  }
  const ratios = [
    handle.includes("e") || handle.includes("w") ? (localPointer.x - anchor.x) / (handle.includes("e") ? rect.width : -rect.width) : null,
    handle.includes("n") || handle.includes("s") ? (localPointer.y - anchor.y) / (handle.includes("s") ? rect.height : -rect.height) : null,
  ].filter((ratio): ratio is number => ratio !== null)
  const factor = ratios.length > 1
    ? Math.abs((ratios[0] ?? 1) - 1) >= Math.abs((ratios[1] ?? 1) - 1) ? ratios[0] ?? 1 : ratios[1] ?? 1
    : ratios[0] ?? 1
  const safeFactor = Math.abs(factor) < 0.05 ? (factor < 0 ? -0.05 : 0.05) : factor
  return {
    x: safeFactor,
    y: safeFactor,
    uniform: true,
  }
}

const scalePoint = (point: Point, snapshot: GroupResizeSnapshot, handle: ResizeHandle, factors: { x: number; y: number }) => {
  const center = boxCenter(snapshot.rect.left, snapshot.rect.top, snapshot.rect.width, snapshot.rect.height)
  const local = rotatePoint(point, center, -snapshot.rotation)
  const anchor = {
    x: handle.includes("w") ? snapshot.rect.left + snapshot.rect.width : handle.includes("e") ? snapshot.rect.left : center.x,
    y: handle.includes("n") ? snapshot.rect.top + snapshot.rect.height : handle.includes("s") ? snapshot.rect.top : center.y,
  }
  return rotatePoint({ x: anchor.x + (local.x - anchor.x) * factors.x, y: anchor.y + (local.y - anchor.y) * factors.y }, center, snapshot.rotation)
}

export const applyGroupResize = (snapshot: GroupResizeSnapshot, handle: ResizeHandle, pointer: Point) => {
  const factors = resizeFactors(handle, snapshot.rect, snapshot.rotation, pointer)
  const transform = (point: Point) => scalePoint(point, snapshot, handle, factors)
  const center = boxCenter(snapshot.rect.left, snapshot.rect.top, snapshot.rect.width, snapshot.rect.height)
  const anchor = {
    x: handle.includes("w") ? snapshot.rect.left + snapshot.rect.width : handle.includes("e") ? snapshot.rect.left : center.x,
    y: handle.includes("n") ? snapshot.rect.top + snapshot.rect.height : handle.includes("s") ? snapshot.rect.top : center.y,
  }
  const nextCenter = rotatePoint({
    x: anchor.x + (center.x - anchor.x) * factors.x,
    y: anchor.y + (center.y - anchor.y) * factors.y,
  }, center, snapshot.rotation)
  return {
    rect: {
      left: nextCenter.x - snapshot.rect.width * Math.abs(factors.x) / 2,
      top: nextCenter.y - snapshot.rect.height * Math.abs(factors.y) / 2,
      width: snapshot.rect.width * Math.abs(factors.x),
      height: snapshot.rect.height * Math.abs(factors.y),
    },
    arrows: new Map(snapshot.arrows.map((arrow) => [arrow.id, {
      ...arrow,
      start: transform(arrow.start),
      end: transform(arrow.end),
      control: arrow.control ? transform(arrow.control) : undefined,
      width: Math.max(1, arrow.width * (factors.uniform ? Math.abs(factors.x) : 1)),
    }])),
    penStrokes: new Map(snapshot.penStrokes.map((stroke) => [stroke.id, {
      ...stroke,
      points: stroke.points.map(transform),
      width: Math.max(1, stroke.width * (factors.uniform ? Math.abs(factors.x) : 1)),
    }])),
    texts: new Map(snapshot.texts.map(({ item, bounds }) => {
      const next = transform({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 })
      const absoluteX = Math.abs(factors.x)
      const absoluteY = Math.abs(factors.y)
      return [item.id, { ...item, x: next.x - bounds.width * absoluteX / 2, y: next.y - bounds.height * absoluteY / 2, scale: (item.scale ?? 1) * (factors.uniform ? absoluteX : 1), boxWidth: item.boxWidth ? item.boxWidth * absoluteX : undefined }]
    })),
  }
}

export type GroupRotateSnapshot = {
  center: Point
  startAngle: number
  rect: Rect
  arrows: Arrow[]
  penStrokes: PenStroke[]
  texts: Array<{
    item: TextAnnotation
    bounds: { x: number; y: number; width: number; height: number }
  }>
  initialRotation?: number
}

export const groupRotationDegrees = (
  snapshot: GroupRotateSnapshot,
  pointerAngle: number,
) => pointerAngle - snapshot.startAngle

export const rotateTextAround = (
  item: TextAnnotation,
  bounds: { x: number; y: number; width: number; height: number },
  center: Point,
  degrees: number,
): TextAnnotation => {
  const itemCenter = boxCenter(bounds.x, bounds.y, bounds.width, bounds.height)
  const nextCenter = rotatePoint(itemCenter, center, degrees)
  return {
    ...item,
    x: nextCenter.x - bounds.width / 2,
    y: nextCenter.y - bounds.height / 2,
    rotation: (item.rotation ?? 0) + degrees,
  }
}

export const applyGroupRotation = (
  snapshot: GroupRotateSnapshot,
  pointerAngle: number,
) => {
  const degrees = groupRotationDegrees(snapshot, pointerAngle)
  const { center } = snapshot

  return {
    degrees,
    arrows: new Map(
      snapshot.arrows.map((arrow) => [
        arrow.id,
        rotateArrowAround(arrow, center, degrees),
      ]),
    ),
    penStrokes: new Map(
      snapshot.penStrokes.map((stroke) => [
        stroke.id,
        rotatePenStrokeAround(stroke, center, degrees),
      ]),
    ),
    texts: new Map(
      snapshot.texts.map(({ item, bounds }) => [
        item.id,
        rotateTextAround(item, bounds, center, degrees),
      ]),
    ),
  }
}

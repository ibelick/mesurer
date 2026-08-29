import type { Point, TextAnnotation } from "./types"

export const textAnnotationBounds = (
  item: Pick<TextAnnotation, "x" | "y" | "text" | "boxWidth">,
) => ({
  x: item.x,
  y: item.y,
  width:
    item.boxWidth ??
    Math.max(
      32,
      item.text.split("\n").reduce((longest, line) => Math.max(longest, line.length), 0) * 9,
    ),
  height: 24 * Math.max(1, item.text.split("\n").length),
})

export type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"

export const BASE_FONT_SIZE = 16
export const BASE_LINE_HEIGHT = 24
export const MIN_SCALE = 0.35
export const MIN_BOX_WIDTH = 48

export const RESIZE_HANDLES: ResizeHandle[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"]

export const isWidthHandle = (handle: ResizeHandle): handle is "e" | "w" =>
  handle === "e" || handle === "w"

const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
  nw: "nwse-resize",
}

const ANCHOR: Record<ResizeHandle, { ax: number; ay: number }> = {
  n: { ax: 0.5, ay: 1 },
  ne: { ax: 0, ay: 1 },
  e: { ax: 0, ay: 0.5 },
  se: { ax: 0, ay: 0 },
  s: { ax: 0.5, ay: 0 },
  sw: { ax: 1, ay: 0 },
  w: { ax: 1, ay: 0.5 },
  nw: { ax: 1, ay: 1 },
}

export const boxCenter = (x: number, y: number, width: number, height: number): Point => ({
  x: x + width / 2,
  y: y + height / 2,
})

export const rotatePoint = (point: Point, center: Point, degrees: number): Point => {
  const rad = (degrees * Math.PI) / 180
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

export const resizeCursor = (handle: ResizeHandle, rotation: number) => {
  const shift = Math.round(((rotation % 360) + 360) / 45) % 8
  const index = (RESIZE_HANDLES.indexOf(handle) + shift) % 8
  return HANDLE_CURSOR[RESIZE_HANDLES[index] ?? handle]
}

export const rotationFromPointer = (center: Point, pointer: Point) =>
  (Math.atan2(pointer.x - center.x, center.y - pointer.y) * 180) / Math.PI

export const scaledFont = (scale: number) => ({
  fontSize: `${BASE_FONT_SIZE * scale}px`,
  lineHeight: `${BASE_LINE_HEIGHT * scale}px`,
})

export const scaleBox = (
  box: {
    x: number
    y: number
    width: number
    height: number
    rotation: number
    scale: number
    boxWidth?: number
  },
  handle: ResizeHandle,
  pointer: Point,
) => {
  const { x, y, width, height, rotation, scale, boxWidth } = box
  const center = boxCenter(x, y, width, height)
  const localPointer = rotatePoint(pointer, center, -rotation)
  const { ax, ay } = ANCHOR[handle]
  const anchor = { x: x + ax * width, y: y + ay * height }
  const startX = ax === 0 ? width : ax === 1 ? -width : 0
  const startY = ay === 0 ? height : ay === 1 ? -height : 0
  const nextX = localPointer.x - anchor.x
  const nextY = localPointer.y - anchor.y
  const factors: number[] = []
  if (startX !== 0) factors.push(nextX / startX)
  if (startY !== 0) factors.push(nextY / startY)
  const factor = factors.length === 2
    ? Math.abs((factors[0] ?? 1) - 1) >= Math.abs((factors[1] ?? 1) - 1)
      ? (factors[0] ?? 1)
      : (factors[1] ?? 1)
    : (factors[0] ?? 1)
  const nextScale = Math.max(MIN_SCALE, scale * factor)
  const applied = nextScale / scale
  const nextWidth = width * applied
  const nextHeight = height * applied
  const nextLeft = ax === 0 ? x : ax === 1 ? anchor.x - nextWidth : anchor.x - nextWidth / 2
  const nextTop = ay === 0 ? y : ay === 1 ? anchor.y - nextHeight : anchor.y - nextHeight / 2
  const nextCenter = rotatePoint(
    { x: nextLeft + nextWidth / 2, y: nextTop + nextHeight / 2 },
    center,
    rotation,
  )
  return {
    x: nextCenter.x - nextWidth / 2,
    y: nextCenter.y - nextHeight / 2,
    scale: nextScale,
    ...(typeof boxWidth === "number"
      ? { boxWidth: Math.max(MIN_BOX_WIDTH, boxWidth * applied) }
      : {}),
  }
}

export const resizeWidthBox = (
  box: { x: number; y: number; width: number; height: number; rotation: number },
  handle: "e" | "w",
  pointer: Point,
) => {
  const { x, y, width, height, rotation } = box
  const center = boxCenter(x, y, width, height)
  const localPointer = rotatePoint(pointer, center, -rotation)
  const { ax } = ANCHOR[handle]
  const anchorX = x + ax * width
  const nextWidth = Math.max(
    MIN_BOX_WIDTH,
    ax === 0 ? localPointer.x - x : anchorX - localPointer.x,
  )
  const nextLeft = ax === 0 ? x : anchorX - nextWidth
  const nextCenter = rotatePoint(
    { x: nextLeft + nextWidth / 2, y: y + height / 2 },
    center,
    rotation,
  )
  return {
    x: nextCenter.x - nextWidth / 2,
    y: nextCenter.y - height / 2,
    boxWidth: nextWidth,
  }
}

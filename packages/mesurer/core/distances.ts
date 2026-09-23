import { getRectFromDom } from "./dom"
import {
  clamp,
  denormalizeRect,
  getViewportSize,
  normalizeRect,
  rectContainsPoint,
} from "./geometry"
import { getElementBetweenGuides } from "./guides"
import type { DistanceOverlay, Point, Rect } from "./types"
import { createId } from "./utils"

export const isElementRect = (rect: Rect) => rect.width >= 1 && rect.height >= 1

export const getPinnedLabelPoint = (distance: DistanceOverlay): Point | null => {
  if (distance.pinTargetRect && distance.pinCursorOffset) {
    return {
      x: distance.pinTargetRect.left + distance.pinCursorOffset.x,
      y: distance.pinTargetRect.top + distance.pinCursorOffset.y,
    }
  }
  return distance.pinCursor ?? null
}

export const applyPinCursor = (distance: DistanceOverlay): DistanceOverlay => {
  const point = getPinnedLabelPoint(distance)
  if (!point) return distance
  return {
    ...distance,
    horizontal: distance.horizontal
      ? { ...distance.horizontal, y: point.y }
      : null,
    vertical: distance.vertical
      ? { ...distance.vertical, x: point.x }
      : null,
  }
}

export const withPin = (
  updated: DistanceOverlay,
  source: DistanceOverlay,
): DistanceOverlay =>
  applyPinCursor({
    ...updated,
    id: source.id,
    pinTargetRef: source.pinTargetRef,
    pinTargetRect: source.pinTargetRect,
    pinCursor: source.pinCursor,
    pinCursorOffset: source.pinCursorOffset,
    guideIds: source.guideIds,
  })

export const attachPinnedGuideTarget = (params: {
  distance: DistanceOverlay
  document: Document
  overlayNode: HTMLElement | null
  pointer: Point | null
}): DistanceOverlay => {
  const { distance, pointer } = params
  const candidates = [
    isElementRect(distance.rectA)
      ? { ref: distance.elementRefA, rect: distance.rectA }
      : null,
    isElementRect(distance.rectB)
      ? { ref: distance.elementRefB, rect: distance.rectB }
      : null,
  ].filter((candidate) => candidate !== null)

  let pinTargetRef: Element | undefined

  if (candidates.length > 0) {
    const underPointer = pointer
      ? candidates.find((candidate) => rectContainsPoint(candidate.rect, pointer))
      : undefined
    pinTargetRef =
      (underPointer ?? candidates[candidates.length - 1]).ref ?? undefined
  } else if (pointer) {
    // Both sides are guides: pin to the element the pair wraps under the cursor.
    const verticalGuides = distance.rectA.width < 1 && distance.rectB.width < 1
    const horizontalGuides = distance.rectA.height < 1 && distance.rectB.height < 1
    if (verticalGuides || horizontalGuides) {
      pinTargetRef =
        getElementBetweenGuides({
          document: params.document,
          overlayNode: params.overlayNode,
          orientation: verticalGuides ? "vertical" : "horizontal",
          start: verticalGuides ? distance.rectA.left : distance.rectA.top,
          end: verticalGuides ? distance.rectB.left : distance.rectB.top,
          pointer,
        }) ?? undefined
    }
  }

  const pinTargetRect = pinTargetRef ? getRectFromDom(pinTargetRef) : undefined

  return applyPinCursor({
    ...distance,
    id: createId(),
    pinTargetRef,
    pinTargetRect,
    pinCursor: pointer ?? undefined,
    pinCursorOffset:
      pointer && pinTargetRect
        ? { x: pointer.x - pinTargetRect.left, y: pointer.y - pinTargetRect.top }
        : undefined,
  })
}

const lineOrientation = (rect: Rect): "vertical" | "horizontal" | null => {
  if (rect.width < 1 && rect.height >= 1) return "vertical"
  if (rect.height < 1 && rect.width >= 1) return "horizontal"
  return null
}

const measureLineToBox = (line: Rect, box: Rect, orientation: "vertical" | "horizontal") => {
  const boxRight = box.left + box.width
  const boxBottom = box.top + box.height
  let horizontal: DistanceOverlay["horizontal"] = null
  let vertical: DistanceOverlay["vertical"] = null
  const extraHorizontals: NonNullable<DistanceOverlay["extraHorizontals"]> = []
  const extraVerticals: NonNullable<DistanceOverlay["extraVerticals"]> = []

  if (orientation === "vertical") {
    const x = line.left
    const y = box.top + box.height / 2
    if (x <= box.left) {
      horizontal = { x1: x, x2: box.left, y, value: box.left - x }
    } else if (x >= boxRight) {
      horizontal = { x1: boxRight, x2: x, y, value: x - boxRight }
    } else {
      const toLeft = x - box.left
      const toRight = boxRight - x
      if (toLeft > 0.5) horizontal = { x1: box.left, x2: x, y, value: toLeft }
      if (toRight > 0.5) {
        const right = { x1: x, x2: boxRight, y, value: toRight }
        if (horizontal) extraHorizontals.push(right)
        else horizontal = right
      }
    }
  } else {
    const y = line.top
    const x = box.left + box.width / 2
    if (y <= box.top) {
      vertical = { y1: y, y2: box.top, x, value: box.top - y }
    } else if (y >= boxBottom) {
      vertical = { y1: boxBottom, y2: y, x, value: y - boxBottom }
    } else {
      const toTop = y - box.top
      const toBottom = boxBottom - y
      if (toTop > 0.5) vertical = { y1: box.top, y2: y, x, value: toTop }
      if (toBottom > 0.5) {
        const bottom = { y1: y, y2: boxBottom, x, value: toBottom }
        if (vertical) extraVerticals.push(bottom)
        else vertical = bottom
      }
    }
  }

  return { horizontal, vertical, extraHorizontals, extraVerticals }
}

export const getDistanceOverlay = (
  rectA: Rect,
  rectB: Rect,
  elementRefA?: Element | null,
  elementRefB?: Element | null,
  ownerWindow: Window = window,
): DistanceOverlay => {
  const viewport = getViewportSize(ownerWindow)
  const normalizedRectA = normalizeRect(rectA, viewport)
  const normalizedRectB = normalizeRect(rectB, viewport)
  const rightA = rectA.left + rectA.width
  const bottomA = rectA.top + rectA.height
  const rightB = rectB.left + rectB.width
  const bottomB = rectB.top + rectB.height
  const centerAX = rectA.left + rectA.width / 2
  const centerAY = rectA.top + rectA.height / 2
  const horizontalAnchor =
    Math.max(rectA.top, rectB.top) <= Math.min(bottomA, bottomB)
      ? (Math.max(rectA.top, rectB.top) + Math.min(bottomA, bottomB)) / 2
      : centerAY
  const verticalAnchor =
    Math.max(rectA.left, rectB.left) <= Math.min(rightA, rightB)
      ? (Math.max(rectA.left, rectB.left) + Math.min(rightA, rightB)) / 2
      : centerAX

  let horizontal: DistanceOverlay["horizontal"] = null
  let vertical: DistanceOverlay["vertical"] = null
  let extraHorizontals: DistanceOverlay["extraHorizontals"]
  let extraVerticals: DistanceOverlay["extraVerticals"]
  const connectors: DistanceOverlay["connectors"] = []

  const lineA = lineOrientation(rectA)
  const lineB = lineOrientation(rectB)
  if (Boolean(lineA) !== Boolean(lineB)) {
    const orientation = lineA ?? lineB
    const line = lineA ? rectA : rectB
    const box = lineA ? rectB : rectA
    if (orientation) {
      const measured = measureLineToBox(line, box, orientation)
      horizontal = measured.horizontal
      vertical = measured.vertical
      extraHorizontals = measured.extraHorizontals.length > 0 ? measured.extraHorizontals : undefined
      extraVerticals = measured.extraVerticals.length > 0 ? measured.extraVerticals : undefined
    }
  } else {
    const separatedX = rightA <= rectB.left || rightB <= rectA.left
    const separatedY = bottomA <= rectB.top || bottomB <= rectA.top

    if (separatedX) {
      const aIsLeft = rightA <= rectB.left
      const x1 = aIsLeft ? rightA : rightB
      const x2 = aIsLeft ? rectB.left : rectA.left
      const y = horizontalAnchor
      horizontal = { x1, x2, y, value: Math.abs(x2 - x1) }

      const edgeBX = aIsLeft ? rectB.left : rightB
      if (y < rectB.top) {
        connectors.push({ x1: edgeBX, y1: y, x2: edgeBX, y2: rectB.top })
      } else if (y > bottomB) {
        connectors.push({ x1: edgeBX, y1: y, x2: edgeBX, y2: bottomB })
      }
    }

    if (separatedY) {
      const aIsTop = bottomA <= rectB.top
      const y1 = aIsTop ? bottomA : bottomB
      const y2 = aIsTop ? rectB.top : rectA.top
      const x = verticalAnchor
      vertical = { y1, y2, x, value: Math.abs(y2 - y1) }

      const edgeBY = aIsTop ? rectB.top : bottomB
      if (x < rectB.left) {
        connectors.push({ x1: x, y1: edgeBY, x2: rectB.left, y2: edgeBY })
      } else if (x > rightB) {
        connectors.push({ x1: x, y1: edgeBY, x2: rightB, y2: edgeBY })
      }
    }
  }

  const normalizedConnectors = connectors
    .map((segment) => ({
      x1: clamp(segment.x1, 0, ownerWindow.innerWidth),
      y1: clamp(segment.y1, 0, ownerWindow.innerHeight),
      x2: clamp(segment.x2, 0, ownerWindow.innerWidth),
      y2: clamp(segment.y2, 0, ownerWindow.innerHeight),
    }))
    .filter(
      (segment) =>
        Math.abs(segment.x1 - segment.x2) > 0.5 ||
        Math.abs(segment.y1 - segment.y2) > 0.5
    )

  return {
    id: createId(),
    rectA,
    rectB,
    normalizedRectA,
    normalizedRectB,
    elementRefA,
    elementRefB,
    horizontal,
    extraHorizontals,
    vertical,
    extraVerticals,
    connectors: normalizedConnectors,
  }
}

export const updateDistanceForResize = (
  distance: DistanceOverlay,
  viewport = getViewportSize(),
  ownerDocument: Document = document,
  ownerWindow: Window = window,
): DistanceOverlay => {
  const normalizedRectA =
    distance.normalizedRectA ?? normalizeRect(distance.rectA, viewport)
  const normalizedRectB =
    distance.normalizedRectB ?? normalizeRect(distance.rectB, viewport)

  let rectA = distance.rectA
  let rectB = distance.rectB

  if (distance.elementRefA && ownerDocument.contains(distance.elementRefA)) {
    rectA = distance.elementRefA.getBoundingClientRect()
  } else {
    rectA = denormalizeRect(normalizedRectA, viewport)
  }

  if (distance.elementRefB && ownerDocument.contains(distance.elementRefB)) {
    rectB = distance.elementRefB.getBoundingClientRect()
  } else {
    rectB = denormalizeRect(normalizedRectB, viewport)
  }

  const updated = getDistanceOverlay(
    rectA,
    rectB,
    distance.elementRefA,
    distance.elementRefB,
    ownerWindow
  )

  return withPin(updated, distance)
}

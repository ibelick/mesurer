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

  let horizontal: DistanceOverlay["horizontal"] = null
  let vertical: DistanceOverlay["vertical"] = null
  const connectors: DistanceOverlay["connectors"] = []

  const separatedX = rightA <= rectB.left || rightB <= rectA.left
  const separatedY = bottomA <= rectB.top || bottomB <= rectA.top

  if (separatedX) {
    const aIsLeft = rightA <= rectB.left
    const x1 = aIsLeft ? rightA : rightB
    const x2 = aIsLeft ? rectB.left : rectA.left
    const y = centerAY
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
    const x = centerAX
    vertical = { y1, y2, x, value: Math.abs(y2 - y1) }

    const edgeBY = aIsTop ? rectB.top : bottomB
    if (x < rectB.left) {
      connectors.push({ x1: x, y1: edgeBY, x2: rectB.left, y2: edgeBY })
    } else if (x > rightB) {
      connectors.push({ x1: x, y1: edgeBY, x2: rightB, y2: edgeBY })
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
    vertical,
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

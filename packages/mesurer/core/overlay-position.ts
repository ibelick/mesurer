export type OverlayPosition = {
  left: number
  top: number
}

export type OverlayAvoidRect = {
  left: number
  top: number
  width: number
  height: number
}

export type OverlayAvoidAxis = "horizontal" | "vertical"

export const clampOverlayPosition = ({
  left,
  top,
  width,
  height,
  viewportWidth,
  viewportHeight,
  padding = 8,
}: OverlayPosition & {
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
  padding?: number
}): OverlayPosition => ({
  left: Math.min(Math.max(left, padding), Math.max(padding, viewportWidth - width - padding)),
  top: Math.min(Math.max(top, padding), Math.max(padding, viewportHeight - height - padding)),
})

const overlaps = (position: OverlayPosition, width: number, height: number, avoidRect: OverlayAvoidRect) =>
  position.left < avoidRect.left + avoidRect.width &&
  position.left + width > avoidRect.left &&
  position.top < avoidRect.top + avoidRect.height &&
  position.top + height > avoidRect.top

const fitsViewport = (
  position: OverlayPosition,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  padding: number,
) =>
  position.left >= padding &&
  position.top >= padding &&
  position.left + width <= viewportWidth - padding &&
  position.top + height <= viewportHeight - padding

export const placeOverlayPosition = ({
  position,
  width,
  height,
  viewportWidth,
  viewportHeight,
  avoidRect,
  avoidAxis,
  gap = 16,
  padding = 8,
}: {
  position: OverlayPosition
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
  avoidRect?: OverlayAvoidRect
  avoidAxis?: OverlayAvoidAxis
  gap?: number
  padding?: number
}): OverlayPosition => {
  if (!avoidRect) {
    return clampOverlayPosition({
      ...position,
      width,
      height,
      viewportWidth,
      viewportHeight,
      padding,
    })
  }

  const candidates = avoidAxis === "vertical"
    ? [
        { left: position.left, top: avoidRect.top + avoidRect.height + gap },
        { left: position.left, top: avoidRect.top - height - gap },
        position,
      ]
    : avoidAxis === "horizontal"
      ? [
          { left: avoidRect.left + avoidRect.width + gap, top: position.top },
          { left: avoidRect.left - width - gap, top: position.top },
          position,
        ]
      : [
          { left: avoidRect.left + avoidRect.width + gap, top: position.top },
          { left: avoidRect.left - width - gap, top: position.top },
          { left: position.left, top: avoidRect.top + avoidRect.height + gap },
          { left: position.left, top: avoidRect.top - height - gap },
        position,
      ]
  const horizontalSide = avoidAxis === "horizontal"
    ? candidates.slice(0, 2).find(
        (candidate) =>
          candidate.left >= padding &&
          candidate.left + width <= viewportWidth - padding,
      )
    : undefined
  if (horizontalSide) {
    return clampOverlayPosition({
      ...horizontalSide,
      width,
      height,
      viewportWidth,
      viewportHeight,
      padding,
    })
  }
  const valid = candidates.find(
    (candidate) =>
      fitsViewport(candidate, width, height, viewportWidth, viewportHeight, padding) &&
      !overlaps(candidate, width, height, avoidRect),
  )
  return clampOverlayPosition({
    ...(valid ?? position),
    width,
    height,
    viewportWidth,
    viewportHeight,
    padding,
  })
}

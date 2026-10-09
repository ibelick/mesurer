import type { ScreenshotRect } from "./screenshot"

export type CaptureViewportMetrics = {
  width: number
  height: number
}

/** Selection and tab capture both use the layout viewport (same mapping as screenshots). */
export function getCaptureViewportMetrics(ownerWindow: Window): CaptureViewportMetrics {
  return {
    width: ownerWindow.innerWidth,
    height: ownerWindow.innerHeight,
  }
}

export type VideoCropRect = {
  sx: number
  sy: number
  sw: number
  sh: number
}

export type PlacedVideoCrop = VideoCropRect & {
  dx: number
  dy: number
  dw: number
  dh: number
}

const CAPTURE_ASPECT_TOLERANCE = 0.01

/**
 * Tab-capture frames often don't share the viewport aspect ratio.
 * Width scale matches the page; leftover height is centered so the crop
 * doesn't sit above the selection.
 */
export function tabCaptureRectToVideoCrop(
  rect: ScreenshotRect,
  videoWidth: number,
  videoHeight: number,
  viewport: { width: number; height: number },
): VideoCropRect {
  const scale = videoWidth / viewport.width
  const padTop = Math.max(0, (videoHeight - viewport.height * scale) / 2)
  const sx = Math.max(0, Math.min(videoWidth - 1, Math.round(rect.left * scale)))
  const sy = Math.max(0, Math.min(videoHeight - 1, Math.round(padTop + rect.top * scale)))
  const sw = Math.max(1, Math.min(videoWidth - sx, Math.round(rect.width * scale)))
  const sh = Math.max(1, Math.min(videoHeight - sy, Math.round(rect.height * scale)))
  return { sx, sy, sw, sh }
}

/**
 * Map a layout-viewport selection into a display-media frame.
 *
 * While the window is resized, Chrome often keeps the tab capture in a frame
 * whose aspect ratio no longer matches the viewport and letterboxes the page.
 * Independent axis scales then sample the wrong region. When the scales diverge,
 * fit the viewport uniformly and center it. Destination fractions keep a
 * selection that falls outside the viewport from being stretched to fill the clip.
 */
export function placeScreenshotRectInVideo(
  rect: ScreenshotRect,
  videoWidth: number,
  videoHeight: number,
  viewport: { width: number; height: number },
): PlacedVideoCrop {
  const viewportWidth = Math.max(1, viewport.width)
  const viewportHeight = Math.max(1, viewport.height)
  const scaleX = videoWidth / viewportWidth
  const scaleY = videoHeight / viewportHeight
  const scalesMatch =
    Math.abs(scaleX - scaleY) <= CAPTURE_ASPECT_TOLERANCE * Math.max(scaleX, scaleY)
  const scale = scalesMatch ? scaleX : Math.min(scaleX, scaleY)
  const padX = scalesMatch ? 0 : (videoWidth - viewportWidth * scale) / 2
  const padY = scalesMatch ? 0 : (videoHeight - viewportHeight * scale) / 2
  const mapX = scalesMatch ? scaleX : scale
  const mapY = scalesMatch ? scaleY : scale
  const rawLeft = padX + rect.left * mapX
  const rawTop = padY + rect.top * mapY
  const rawRight = padX + (rect.left + rect.width) * mapX
  const rawBottom = padY + (rect.top + rect.height) * mapY
  const rawWidth = Math.max(rawRight - rawLeft, 1e-6)
  const rawHeight = Math.max(rawBottom - rawTop, 1e-6)
  const left = Math.max(0, Math.min(videoWidth, rawLeft))
  const top = Math.max(0, Math.min(videoHeight, rawTop))
  const right = Math.max(0, Math.min(videoWidth, rawRight))
  const bottom = Math.max(0, Math.min(videoHeight, rawBottom))
  const sx = Math.max(0, Math.round(left))
  const sy = Math.max(0, Math.round(top))
  const ex = Math.min(videoWidth, Math.round(right))
  const ey = Math.min(videoHeight, Math.round(bottom))
  return {
    sx,
    sy,
    sw: Math.max(1, ex - sx),
    sh: Math.max(1, ey - sy),
    dx: (left - rawLeft) / rawWidth,
    dy: (top - rawTop) / rawHeight,
    dw: Math.max(0, right - left) / rawWidth,
    dh: Math.max(0, bottom - top) / rawHeight,
  }
}

export type VisibleSelectionSlice = {
  dx: number
  dy: number
  dw: number
  dh: number
  visible: boolean
}

/** Portion of a viewport-fixed selection that is still inside the window. */
export function visibleSelectionSlice(
  rect: { left: number; top: number; width: number; height: number },
  viewport: { width: number; height: number },
): VisibleSelectionSlice {
  if (rect.width <= 0 || rect.height <= 0) {
    return { dx: 0, dy: 0, dw: 0, dh: 0, visible: false }
  }
  const left = Math.max(rect.left, 0)
  const top = Math.max(rect.top, 0)
  const right = Math.min(rect.left + rect.width, viewport.width)
  const bottom = Math.min(rect.top + rect.height, viewport.height)
  const width = right - left
  const height = bottom - top
  if (width <= 0 || height <= 0) {
    return { dx: 0, dy: 0, dw: 0, dh: 0, visible: false }
  }
  return {
    dx: (left - rect.left) / rect.width,
    dy: (top - rect.top) / rect.height,
    dw: width / rect.width,
    dh: height / rect.height,
    visible: true,
  }
}

export function screenshotRectToVideoCrop(
  rect: ScreenshotRect,
  videoWidth: number,
  videoHeight: number,
  ownerWindow: Window,
): VideoCropRect {
  const { sx, sy, sw, sh } = placeScreenshotRectInVideo(
    rect,
    videoWidth,
    videoHeight,
    getCaptureViewportMetrics(ownerWindow),
  )
  return { sx, sy, sw, sh }
}

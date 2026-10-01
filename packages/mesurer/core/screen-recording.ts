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

type RegionCropTrack = MediaStreamTrack & {
  cropTo?: (cropTarget: unknown) => Promise<void>
}

type CropTargetFactory = {
  fromElement: (element: Element) => Promise<unknown>
}

/** Invisible element whose box is the recorded region. Chrome follows it across resizes. */
export function createRecordingCropTarget(
  ownerDocument: Document,
  rect: ScreenshotRect,
): HTMLElement {
  const target = ownerDocument.createElement("div")
  target.setAttribute("data-mesurer-recording-crop", "")
  target.setAttribute("aria-hidden", "true")
  target.style.position = "fixed"
  target.style.left = `${rect.left}px`
  target.style.top = `${rect.top}px`
  target.style.width = `${rect.width}px`
  target.style.height = `${rect.height}px`
  target.style.margin = "0"
  target.style.padding = "0"
  target.style.border = "0"
  target.style.pointerEvents = "none"
  target.style.background = "transparent"
  target.style.opacity = "0"
  ownerDocument.body.append(target)
  return target
}

/**
 * Ask Chrome to crop the current-tab capture to `element`.
 * The crop tracks the element when the window is resized, so the recorded
 * zone stays on the selection without remapping the capture frame.
 */
export async function cropTrackToElement(track: MediaStreamTrack, element: Element): Promise<boolean> {
  const cropTo = (track as RegionCropTrack).cropTo
  const CropTarget = (globalThis as { CropTarget?: CropTargetFactory }).CropTarget
  if (!cropTo || !CropTarget) return false
  const cropTarget = await CropTarget.fromElement(element)
  await cropTo.call(track, cropTarget)
  return true
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

export function resolveRecordingDuration(mediaDuration: number, elapsedSeconds: number): number {
  const media = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : 0
  const elapsed = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0
  if (media <= 0 && elapsed <= 0) return 0.1
  if (media <= 0) return Math.max(elapsed, 0.1)
  if (elapsed <= 0) return media
  return Math.min(media, Math.max(elapsed, 0.1))
}

export function isFullClipExport(
  startTime: number,
  endTime: number,
  duration: number,
  tolerance = 0.05,
): boolean {
  return startTime <= tolerance && endTime >= duration - tolerance
}

export async function readBlobVideoDuration(blob: Blob, ownerDocument: Document): Promise<number> {
  const url = URL.createObjectURL(blob)
  const video = ownerDocument.createElement("video")
  video.preload = "metadata"
  video.muted = true
  try {
    return await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => {
        resolve(video.duration)
      }
      video.onerror = () => reject(new Error("Could not read recording"))
      video.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
    video.removeAttribute("src")
  }
}

export async function seekVideoElement(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.max(0, time)
  if (target <= 0 && video.readyState >= 1) {
    video.currentTime = 0
    return
  }
  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => resolve()
    const onError = () => reject(new Error("Could not seek recording"))
    video.addEventListener("seeked", onSeeked, { once: true })
    video.addEventListener("error", onError, { once: true })
    if (video.readyState < 1) {
      video.addEventListener(
        "loadedmetadata",
        () => {
          video.currentTime = target
        },
        { once: true },
      )
    } else {
      video.currentTime = target
    }
  })
}

/** Prefer current-tab capture on Chromium; fall back to standard display media elsewhere. */
export async function requestDisplayMediaStream(ownerWindow: Window): Promise<MediaStream> {
  const fallback: DisplayMediaStreamOptions = {
    audio: false,
    video: true,
  }
  const chromium: DisplayMediaStreamOptions = {
    audio: false,
    video: { displaySurface: "browser" },
    preferCurrentTab: true,
    selfBrowserSurface: "include",
  } as DisplayMediaStreamOptions

  try {
    return await ownerWindow.navigator.mediaDevices.getDisplayMedia(chromium)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return await ownerWindow.navigator.mediaDevices.getDisplayMedia(fallback)
  }
}

export async function reencodeVideoClip(
  ownerDocument: Document,
  ownerWindow: Window,
  sourceUrl: string,
  startTime: number,
  endTime: number,
  scale: number,
  mimeType: string | undefined,
): Promise<Blob> {
  const source = ownerDocument.createElement("video")
  source.muted = true
  source.playsInline = true
  source.src = sourceUrl
  source.preload = "auto"

  await new Promise<void>((resolve, reject) => {
    source.onloadedmetadata = () => resolve()
    source.onerror = () => reject(new Error("Could not trim recording"))
  })
  await seekVideoElement(source, startTime)

  const canvas = ownerDocument.createElement("canvas")
  canvas.width = Math.max(1, Math.round(source.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(source.videoHeight * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Could not trim recording")

  const stream = canvas.captureStream(30)
  const captureTrack = stream.getVideoTracks()[0]
  const requestFrame =
    captureTrack && "requestFrame" in captureTrack
      ? (captureTrack as MediaStreamTrack & { requestFrame?: () => void }).requestFrame
      : undefined

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []

  return await new Promise<Blob>((resolve, reject) => {
    let stopped = false
    const onTimeUpdate = () => {
      if (source.currentTime >= endTime - 0.04) finish()
    }
    const finish = () => {
      if (stopped) return
      stopped = true
      source.removeEventListener("timeupdate", onTimeUpdate)
      source.pause()
      try {
        recorder.stop()
      } catch {
        reject(new Error("Could not trim recording"))
      }
    }

    const drawFrame = () => {
      if (stopped) return
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      requestFrame?.call(captureTrack)
      if (source.currentTime >= endTime || source.ended) {
        finish()
        return
      }
      if (typeof source.requestVideoFrameCallback === "function") {
        source.requestVideoFrameCallback(() => drawFrame())
      } else {
        ownerWindow.requestAnimationFrame(drawFrame)
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" }))
    }
    recorder.onerror = () => reject(new Error("Could not trim recording"))

    source.addEventListener("timeupdate", onTimeUpdate)

    recorder.start(100)
    void source.play().then(
      () => drawFrame(),
      () => {
        source.removeEventListener("timeupdate", onTimeUpdate)
        reject(new Error("Could not trim recording"))
      },
    )
  })
}

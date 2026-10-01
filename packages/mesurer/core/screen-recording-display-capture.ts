import type { ScreenshotRect } from "./screenshot"
import {
  createRecordingCropTarget,
  cropTrackToElement,
  placeScreenshotRectInVideo,
  visibleSelectionSlice,
  type CaptureViewportMetrics,
} from "./screen-recording-crop"
import { requestDisplayMediaStream } from "./screen-recording-export"

const HIDDEN_MEDIA_STYLE =
  "position:fixed;left:0;top:0;width:1px;height:1px;margin:0;padding:0;border:0;overflow:hidden;opacity:0;visibility:hidden;pointer-events:none"

export type DisplayRecordingCapture = {
  stream: MediaStream
  track: MediaStreamTrack
  source: HTMLVideoElement
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  cropTarget: HTMLElement | null
  regionLocked: boolean
  captureTrack: MediaStreamTrack
  captureStream: MediaStream
}

export const waitForRegionCropDimensions = (
  video: HTMLVideoElement,
  rect: ScreenshotRect,
  ownerWindow: Window,
) =>
  new Promise<void>((resolve) => {
    const ratio = ownerWindow.devicePixelRatio || 1
    const expectedWidth = Math.max(1, Math.round(rect.width * ratio))
    const expectedHeight = Math.max(1, Math.round(rect.height * ratio))
    const ready = () =>
      Math.abs(video.videoWidth - expectedWidth) <= Math.max(4, expectedWidth * 0.08) &&
      Math.abs(video.videoHeight - expectedHeight) <= Math.max(4, expectedHeight * 0.08)
    if (ready()) {
      resolve()
      return
    }
    const finish = () => {
      video.removeEventListener("resize", onResize)
      ownerWindow.clearTimeout(timer)
      resolve()
    }
    const onResize = () => {
      if (ready()) finish()
    }
    video.addEventListener("resize", onResize)
    const timer = ownerWindow.setTimeout(finish, 400)
  })

export async function openDisplayRecordingCapture(
  ownerDocument: Document,
  ownerWindow: Window,
  rect: ScreenshotRect,
  getViewport: () => CaptureViewportMetrics,
): Promise<DisplayRecordingCapture> {
  const stream = await requestDisplayMediaStream(ownerWindow)
  const track = stream.getVideoTracks()[0]
  if (!track) throw new Error("No video track was selected")
  if (track.getSettings().displaySurface && track.getSettings().displaySurface !== "browser") {
    track.stop()
    throw new Error("Select the browser tab to record")
  }
  const source = ownerDocument.createElement("video")
  source.autoplay = true
  source.muted = true
  source.playsInline = true
  source.srcObject = stream
  source.setAttribute("playsinline", "")
  source.setAttribute("aria-hidden", "true")
  source.style.cssText = HIDDEN_MEDIA_STYLE
  ownerDocument.body.append(source)
  await source.play()
  if (source.videoWidth <= 0 || source.videoHeight <= 0) {
    await new Promise<void>((resolve, reject) => {
      source.onloadeddata = () => resolve()
      source.onerror = () => reject(new Error("No video track was selected"))
    })
  }

  const cropTarget = createRecordingCropTarget(ownerDocument, rect)
  let regionLocked = false
  try {
    regionLocked = await cropTrackToElement(track, cropTarget)
  } catch {
    regionLocked = false
  }
  if (!regionLocked) {
    cropTarget.remove()
  } else {
    await waitForRegionCropDimensions(source, rect, ownerWindow)
  }

  const pixelRatio = ownerWindow.devicePixelRatio || 1
  const initialCrop = placeScreenshotRectInVideo(
    rect,
    source.videoWidth,
    source.videoHeight,
    getViewport(),
  )
  const canvas = ownerDocument.createElement("canvas")
  canvas.width = regionLocked
    ? Math.max(1, Math.round(rect.width * pixelRatio))
    : initialCrop.sw
  canvas.height = regionLocked
    ? Math.max(1, Math.round(rect.height * pixelRatio))
    : initialCrop.sh
  canvas.setAttribute("aria-hidden", "true")
  canvas.style.cssText = HIDDEN_MEDIA_STYLE
  ownerDocument.body.append(canvas)
  const context = canvas.getContext("2d", { alpha: false })
  if (!context) throw new Error("Video recording is unavailable")

  const capture = canvas.captureStream(30)
  const captureTrack = capture.getVideoTracks()[0]
  if (!captureTrack) throw new Error("Video recording is unavailable")

  return {
    stream,
    track,
    source,
    canvas,
    context,
    cropTarget: regionLocked ? cropTarget : null,
    regionLocked,
    captureTrack,
    captureStream: capture,
  }
}

export function paintDisplayRecordingFrame(
  capture: DisplayRecordingCapture,
  rect: ScreenshotRect,
  getViewport: () => CaptureViewportMetrics,
) {
  const { source, canvas, context, regionLocked, cropTarget, captureTrack } = capture
  if (source.videoWidth <= 0 || source.videoHeight <= 0) return

  if (regionLocked && cropTarget) {
    const box = cropTarget.getBoundingClientRect()
    const slice = visibleSelectionSlice(box, getViewport())
    if (!slice.visible) {
      context.fillStyle = "#000"
      context.fillRect(0, 0, canvas.width, canvas.height)
    } else if (slice.dw >= 0.999 && slice.dh >= 0.999) {
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
    } else {
      context.fillStyle = "#000"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(
        source,
        0,
        0,
        source.videoWidth,
        source.videoHeight,
        slice.dx * canvas.width,
        slice.dy * canvas.height,
        slice.dw * canvas.width,
        slice.dh * canvas.height,
      )
    }
  } else {
    const placed = placeScreenshotRectInVideo(
      rect,
      source.videoWidth,
      source.videoHeight,
      getViewport(),
    )
    const coversFrame =
      placed.dx <= 0.001 &&
      placed.dy <= 0.001 &&
      placed.dw >= 0.999 &&
      placed.dh >= 0.999
    const destX = coversFrame ? 0 : placed.dx * canvas.width
    const destY = coversFrame ? 0 : placed.dy * canvas.height
    const destW = coversFrame ? canvas.width : placed.dw * canvas.width
    const destH = coversFrame ? canvas.height : placed.dh * canvas.height
    if (!coversFrame) {
      context.fillStyle = "#000"
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    if (destW >= 1 && destH >= 1 && placed.dw > 0 && placed.dh > 0) {
      context.drawImage(
        source,
        placed.sx,
        placed.sy,
        placed.sw,
        placed.sh,
        destX,
        destY,
        destW,
        destH,
      )
    }
  }

  const requestFrame =
    captureTrack && "requestFrame" in captureTrack
      ? (captureTrack as MediaStreamTrack & { requestFrame?: () => void }).requestFrame
      : undefined
  requestFrame?.call(captureTrack)
}

export function runDisplayRecordingDrawLoop(
  ownerWindow: Window,
  capture: DisplayRecordingCapture,
  rect: ScreenshotRect,
  getViewport: () => CaptureViewportMetrics,
  drawFrameRef: { current: number | null },
) {
  const draw = () => {
    paintDisplayRecordingFrame(capture, rect, getViewport)
    drawFrameRef.current = ownerWindow.requestAnimationFrame(draw)
  }
  draw()
}

import type { ScreenshotRect } from "./screenshot"
import {
  placeScreenshotRectInVideo,
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
  captureTrack: MediaStreamTrack
  captureStream: MediaStream
}

export const nextPresentedVideoFrame = (video: HTMLVideoElement, ownerWindow: Window) =>
  new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      ownerWindow.clearTimeout(timer)
      resolve()
    }
    const timer = ownerWindow.setTimeout(finish, 250)
    const withFrameCallback = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number
    }
    if (withFrameCallback.requestVideoFrameCallback) {
      withFrameCallback.requestVideoFrameCallback(() => finish())
      return
    }
    ownerWindow.requestAnimationFrame(() => finish())
  })

export const openCanvasCaptureStream = (canvas: HTMLCanvasElement) => {
  const capture = canvas.captureStream(30)
  const captureTrack = capture.getVideoTracks()[0]
  if (!captureTrack) throw new Error("Video recording is unavailable")
  return { capture, captureTrack }
}

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

  // Crop the captured pixels, not the browser surface. Chrome's cropTo() can
  // change the live page's rendering scale and reflow text when capture starts.
  const initialCrop = placeScreenshotRectInVideo(
    rect,
    source.videoWidth,
    source.videoHeight,
    getViewport(),
  )
  const canvas = ownerDocument.createElement("canvas")
  canvas.width = initialCrop.sw
  canvas.height = initialCrop.sh
  canvas.setAttribute("aria-hidden", "true")
  canvas.style.cssText = HIDDEN_MEDIA_STYLE
  ownerDocument.body.append(canvas)
  const context = canvas.getContext("2d", { alpha: false })
  if (!context) throw new Error("Video recording is unavailable")

  const prepared: DisplayRecordingCapture = {
    stream,
    track,
    source,
    canvas,
    context,
    captureTrack: null as unknown as MediaStreamTrack,
    captureStream: null as unknown as MediaStream,
  }
  await nextPresentedVideoFrame(source, ownerWindow)
  paintDisplayRecordingFrame(prepared, rect, getViewport)
  const { capture, captureTrack } = openCanvasCaptureStream(canvas)
  prepared.captureTrack = captureTrack
  prepared.captureStream = capture
  const requestFrame = (captureTrack as MediaStreamTrack & { requestFrame?: () => void }).requestFrame
  requestFrame?.call(captureTrack)
  await new Promise<void>((resolve) => ownerWindow.requestAnimationFrame(() => resolve()))

  return prepared
}

export function paintDisplayRecordingFrame(
  capture: DisplayRecordingCapture,
  rect: ScreenshotRect,
  getViewport: () => CaptureViewportMetrics,
) {
  const { source, canvas, context, captureTrack } = capture
  if (source.videoWidth <= 0 || source.videoHeight <= 0) return

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

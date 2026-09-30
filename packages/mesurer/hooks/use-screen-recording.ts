import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useCaptureErrorToast } from "./use-capture-error-toast"
import {
  isFullClipExport,
  getCaptureViewportMetrics,
  readBlobVideoDuration,
  reencodeVideoClip,
  requestDisplayMediaStream,
  resolveRecordingDuration,
  screenshotRectToVideoCrop,
} from "../core/screen-recording"
import {
  MIN_SCREENSHOT_SELECTION,
  clampScreenshotRect,
  moveScreenshotRect,
  normalizeScreenshotRect,
  pointInScreenshotRect,
  resizeScreenshotRect,
  type ScreenshotRect,
} from "../core/screenshot"
import { eventView, listenPointerDrag } from "../core/pointer-drag"
import type { ResizeHandle } from "../core/text-transform"

const MAX_RECORDING_MS = 60_000

const supportedMimeType = () => ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
  .find((type) => MediaRecorder.isTypeSupported(type))

const createFilename = (extension: string, now = new Date()) =>
  `mesurer-recording-${now.toISOString().replace(/[:.]/g, "-")}.${extension}`

export type RecordingExportFormat = "webm" | "mp4"

export type RecordingExportOptions = {
  format?: RecordingExportFormat
  scale?: number
}

export type RecordingExportResult = {
  blob: Blob
  filename: string
}

const mp4MimeType = () =>
  ["video/mp4;codecs=avc1.42E01E", "video/mp4"].find((type) => MediaRecorder.isTypeSupported(type))

export const supportedRecordingFormats = (): RecordingExportFormat[] => {
  const formats: RecordingExportFormat[] = ["webm"]
  if (typeof MediaRecorder !== "undefined" && mp4MimeType()) formats.push("mp4")
  return formats
}

const extensionFor = (format: RecordingExportFormat) => format

type UseScreenRecordingOptions = {
  ownerDocument: Document
  ownerWindow: Window
  onPrepare: () => void
}

export const useScreenRecording = ({ ownerDocument, ownerWindow, onPrepare }: UseScreenRecordingOptions) => {
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const drawFrameRef = useRef<number | null>(null)
  const elapsedFrameRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const urlRef = useRef<string | null>(null)
  const elapsedRef = useRef(0)
  const captureNodesRef = useRef<{ source: HTMLVideoElement; canvas: HTMLCanvasElement } | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [rect, setRect] = useState<ScreenshotRect | null>(null)
  const rectRef = useRef<ScreenshotRect | null>(null)
  rectRef.current = rect
  const [recordingRect, setRecordingRect] = useState<ScreenshotRect | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [video, setVideo] = useState<{ url: string; duration: number; filename: string } | null>(null)
  const { error, flashError, dismissError } = useCaptureErrorToast(ownerWindow)

  const release = useCallback(() => {
    if (drawFrameRef.current !== null) ownerWindow.cancelAnimationFrame(drawFrameRef.current)
    if (elapsedFrameRef.current !== null) ownerWindow.cancelAnimationFrame(elapsedFrameRef.current)
    if (timeoutRef.current !== null) ownerWindow.clearTimeout(timeoutRef.current)
    drawFrameRef.current = null
    elapsedFrameRef.current = null
    timeoutRef.current = null
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    const nodes = captureNodesRef.current
    captureNodesRef.current = null
    if (nodes) {
      nodes.source.pause()
      nodes.source.srcObject = null
      nodes.source.remove()
      nodes.canvas.remove()
    }
    setRecording(false)
    setRecordingRect(null)
    elapsedRef.current = 0
    setElapsed(0)
  }, [ownerWindow])

  useEffect(() => () => {
    release()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [release])

  const cancelSelection = useCallback(() => {
    originRef.current = null
    setSelecting(false)
    setAdjusting(false)
    setRect(null)
    dismissError()
  }, [dismissError])

  const viewport = useCallback(
    () => getCaptureViewportMetrics(ownerWindow),
    [ownerWindow],
  )

  const discard = useCallback(() => {
    release()
    setVideo((current) => {
      if (current) URL.revokeObjectURL(current.url)
      urlRef.current = null
      return null
    })
  }, [release])

  const stop = useCallback(() => recorderRef.current?.state === "recording" && recorderRef.current.stop(), [])

  const start = useCallback(async (nextRect: ScreenshotRect) => {
    dismissError()
    try {
      setRecordingRect(nextRect)
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
      source.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;margin:0;padding:0;border:0;overflow:hidden;opacity:0;visibility:hidden;pointer-events:none"
      ownerDocument.body.append(source)
      await source.play()
      if (source.videoWidth <= 0 || source.videoHeight <= 0) {
        await new Promise<void>((resolve, reject) => {
          source.onloadeddata = () => resolve()
          source.onerror = () => reject(new Error("No video track was selected"))
        })
      }
      const { sx, sy, sw, sh } = screenshotRectToVideoCrop(
        nextRect,
        source.videoWidth,
        source.videoHeight,
        ownerWindow,
      )
      const canvas = ownerDocument.createElement("canvas")
      canvas.width = sw
      canvas.height = sh
      canvas.setAttribute("aria-hidden", "true")
      canvas.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;margin:0;padding:0;border:0;overflow:hidden;opacity:0;visibility:hidden;pointer-events:none"
      ownerDocument.body.append(canvas)
      const context = canvas.getContext("2d", { alpha: false })
      if (!context) throw new Error("Video recording is unavailable")
      captureNodesRef.current = { source, canvas }
      const capture = canvas.captureStream(30)
      const captureTrack = capture.getVideoTracks()[0]
      const draw = () => {
        context.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
        const requestFrame = captureTrack && "requestFrame" in captureTrack
          ? (captureTrack as MediaStreamTrack & { requestFrame?: () => void }).requestFrame
          : undefined
        requestFrame?.call(captureTrack)
        drawFrameRef.current = ownerWindow.requestAnimationFrame(draw)
      }
      draw()
      const mimeType = supportedMimeType()
      const recorder = new MediaRecorder(capture, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data)
      recorder.onstop = () => {
        const elapsedSeconds = elapsedRef.current
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" })
        release()
        void (async () => {
          if (!blob.size) {
            flashError()
            return
          }
          let duration = resolveRecordingDuration(0, elapsedSeconds)
          try {
            const mediaDuration = await readBlobVideoDuration(blob, ownerDocument)
            duration = resolveRecordingDuration(mediaDuration, elapsedSeconds)
          } catch {
            duration = resolveRecordingDuration(0, elapsedSeconds)
          }
          const url = URL.createObjectURL(blob)
          if (urlRef.current) URL.revokeObjectURL(urlRef.current)
          urlRef.current = url
          setVideo({ url, duration, filename: createFilename("webm") })
        })()
      }
      track.addEventListener("ended", stop, { once: true })
      streamRef.current = stream
      recorderRef.current = recorder
      recorder.start(250)
      setRecording(true)
      const startedAt = ownerWindow.performance.now()
      elapsedRef.current = 0
      const tick = () => {
        const next = (ownerWindow.performance.now() - startedAt) / 1000
        elapsedRef.current = next
        setElapsed(next)
        if (recorder.state === "recording") elapsedFrameRef.current = ownerWindow.requestAnimationFrame(tick)
      }
      elapsedFrameRef.current = ownerWindow.requestAnimationFrame(tick)
      timeoutRef.current = ownerWindow.setTimeout(stop, MAX_RECORDING_MS)
    } catch (caught) {
      release()
      if (!(caught instanceof DOMException && caught.name === "AbortError")) flashError()
    }
  }, [dismissError, flashError, ownerDocument, ownerWindow, release, stop])

  const toggleSelection = useCallback(() => {
    if (selecting) return cancelSelection()
    dismissError()
    discard()
    onPrepare()
    setAdjusting(false)
    setRect(null)
    setSelecting(true)
  }, [cancelSelection, discard, dismissError, onPrepare, selecting])

  const confirmRecording = useCallback(() => {
    const nextRect = rectRef.current
    if (!nextRect || nextRect.width < MIN_SCREENSHOT_SELECTION || nextRect.height < MIN_SCREENSHOT_SELECTION) return
    cancelSelection()
    void start(nextRect)
  }, [cancelSelection, start])

  useEffect(() => {
    if (!selecting) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        cancelSelection()
        return
      }
      if (adjusting && event.key === "Enter") {
        event.preventDefault()
        confirmRecording()
      }
    }
    ownerWindow.addEventListener("keydown", onKeyDown)
    return () => ownerWindow.removeEventListener("keydown", onKeyDown)
  }, [adjusting, cancelSelection, confirmRecording, ownerWindow, selecting])

  const beginDraw = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    setAdjusting(false)
    originRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    setRect(normalizeScreenshotRect(originRef.current, originRef.current, viewport()))
  }, [viewport])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (adjusting && rectRef.current && pointInScreenshotRect(rectRef.current, { x: event.clientX, y: event.clientY })) {
      return
    }
    beginDraw(event)
  }, [adjusting, beginDraw])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!originRef.current) return
    setRect(normalizeScreenshotRect(originRef.current, { x: event.clientX, y: event.clientY }, viewport()))
  }, [viewport])

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const startPoint = originRef.current
    originRef.current = null
    if (!startPoint) return
    const nextRect = normalizeScreenshotRect(startPoint, { x: event.clientX, y: event.clientY }, viewport())
    if (nextRect.width < MIN_SCREENSHOT_SELECTION || nextRect.height < MIN_SCREENSHOT_SELECTION) {
      setRect(null)
      setAdjusting(false)
      return
    }
    setRect(nextRect)
    setAdjusting(true)
  }, [viewport])

  const onMoveStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const current = rectRef.current
    const view = eventView(event)
    if (!current || !view) return
    const startRect = current
    listenPointerDrag(event.pointerId, view, { x: event.clientX, y: event.clientY }, {
      onMove: (dx, dy) => setRect(moveScreenshotRect(startRect, dx, dy, viewport())),
      onEnd: () => {},
    })
  }, [viewport])

  const setRectSize = useCallback((width: number, height: number) => {
    setRect((current) =>
      current ? clampScreenshotRect({ ...current, width, height }, viewport()) : current,
    )
  }, [viewport])

  const setRectPosition = useCallback((left: number, top: number) => {
    setRect((current) =>
      current ? clampScreenshotRect({ ...current, left, top }, viewport()) : current,
    )
  }, [viewport])

  const onResizeStart = useCallback((handle: ResizeHandle, event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = rectRef.current
    const view = eventView(event)
    if (!current || !view) return
    const startRect = current
    listenPointerDrag(event.pointerId, view, { x: event.clientX, y: event.clientY }, {
      onMove: (_dx, _dy, pointer) => {
        setRect(resizeScreenshotRect(startRect, handle, { x: pointer.clientX, y: pointer.clientY }, viewport()))
      },
      onEnd: () => {},
    })
  }, [viewport])

  const exportClip = useCallback(async (
    startTime: number,
    endTime: number,
    options: RecordingExportOptions = {},
  ): Promise<RecordingExportResult> => {
    if (!video || endTime <= startTime) throw new Error("Invalid trim range")
    const format = options.format ?? "webm"
    const scale = Math.min(3, Math.max(1, options.scale ?? 1))
    const filename = createFilename(extensionFor(format))
    if (format === "webm" && scale === 1 && isFullClipExport(startTime, endTime, video.duration)) {
      const blob = await fetch(video.url).then((response) => response.blob())
      return { blob, filename }
    }
    const mimeType = format === "mp4" ? mp4MimeType() : supportedMimeType()
    if (format === "mp4" && !mimeType) throw new Error("MP4 export is unavailable")
    const blob = await reencodeVideoClip(
      ownerDocument,
      ownerWindow,
      video.url,
      startTime,
      endTime,
      scale,
      mimeType,
    )
    return { blob, filename }
  }, [ownerDocument, ownerWindow, video])

  return {
    selecting,
    adjusting,
    rect,
    recordingRect,
    recording,
    elapsed,
    video,
    error,
    toggleSelection,
    confirmRecording,
    cancelSelection,
    stop,
    discard,
    exportClip,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: cancelSelection,
    onMoveStart,
    onResizeStart,
    setRectSize,
    setRectPosition,
    viewportSize: viewport,
  }
}

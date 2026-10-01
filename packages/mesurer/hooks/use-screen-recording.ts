import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useCaptureErrorToast } from "./use-capture-error-toast"
import {
  isFullClipExport,
  getCaptureViewportMetrics,
  readBlobVideoDuration,
  reencodeVideoClip,
  requestDisplayMediaStream,
  resolveRecordingDuration,
  createRecordingCropTarget,
  cropTrackToElement,
  placeScreenshotRectInVideo,
  visibleSelectionSlice,
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
import type { ExtensionRecordingSession } from "../mesurer-client"

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

const waitForRegionFrame = (
  video: HTMLVideoElement,
  rect: ScreenshotRect,
  ownerWindow: Window,
) => new Promise<void>((resolve) => {
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

type UseScreenRecordingOptions = {
  ownerDocument: Document
  ownerWindow: Window
  onPrepare: () => void
  extensionRecording?: ExtensionRecordingSession
  extensionRecordingPlayer?: string
}

export const useScreenRecording = ({ ownerDocument, ownerWindow, onPrepare, extensionRecording, extensionRecordingPlayer }: UseScreenRecordingOptions) => {
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const drawFrameRef = useRef<number | null>(null)
  const elapsedFrameRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const urlRef = useRef<string | null>(null)
  const elapsedRef = useRef(0)
  const captureNodesRef = useRef<{
    source: HTMLVideoElement
    canvas: HTMLCanvasElement | null
    cropTarget: HTMLElement | null
  } | null>(null)
  const extensionRecordingActiveRef = useRef(false)
  const extensionRecordingPreparingRef = useRef(false)
  const [selecting, setSelecting] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [rect, setRect] = useState<ScreenshotRect | null>(null)
  const rectRef = useRef<ScreenshotRect | null>(null)
  rectRef.current = rect
  const [recordingRect, setRecordingRect] = useState<ScreenshotRect | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [video, setVideo] = useState<{ url: string; duration: number; filename: string; playerUrl?: string } | null>(null)
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
      nodes.canvas?.remove()
      nodes.cropTarget?.remove()
    }
    extensionRecording?.abort()
    extensionRecordingActiveRef.current = false
    setRecording(false)
    setRecordingRect(null)
    elapsedRef.current = 0
    setElapsed(0)
  }, [extensionRecording, ownerWindow])

  useEffect(() => () => {
    release()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    extensionRecording?.dispose?.()
  }, [extensionRecording, release])

  const cancelSelection = useCallback(() => {
    originRef.current = null
    setSelecting(false)
    setAdjusting(false)
    setRect(null)
    extensionRecordingPreparingRef.current = false
    if (extensionRecordingActiveRef.current || recorderRef.current?.state === "recording") {
      release()
      dismissError()
      return
    }
    extensionRecording?.abort()
    dismissError()
  }, [dismissError, extensionRecording, release])

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

  const stop = useCallback(() => {
    if (extensionRecording) {
      if (!extensionRecordingActiveRef.current) return
      extensionRecordingActiveRef.current = false
      void extensionRecording.stop().then(({ id, duration }) => {
        setRecording(false)
        setRecordingRect(null)
        setVideo({
          url: "",
          duration,
          filename: createFilename("webm"),
          playerUrl: `${extensionRecordingPlayer}?id=${encodeURIComponent(id)}&duration=${encodeURIComponent(duration)}`,
        })
      }).catch(() => {
        release()
        flashError()
      })
      return
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop()
  }, [extensionRecording, extensionRecordingPlayer, flashError, release])

  const start = useCallback(async (nextRect: ScreenshotRect) => {
    dismissError()
    try {
      setRecordingRect(nextRect)
      if (extensionRecording) {
        await extensionRecording.start({ rect: nextRect, viewport: viewport() })
        extensionRecordingActiveRef.current = true
        setRecording(true)
        elapsedRef.current = 0
        const startedAt = ownerWindow.performance.now()
        const tick = () => {
          const next = (ownerWindow.performance.now() - startedAt) / 1000
          elapsedRef.current = next
          setElapsed(next)
          if (extensionRecordingActiveRef.current) elapsedFrameRef.current = ownerWindow.requestAnimationFrame(tick)
        }
        elapsedFrameRef.current = ownerWindow.requestAnimationFrame(tick)
        timeoutRef.current = ownerWindow.setTimeout(stop, MAX_RECORDING_MS)
        return
      }
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
      const cropTarget = createRecordingCropTarget(ownerDocument, nextRect)
      captureNodesRef.current = { source, canvas: null, cropTarget }
      let regionLocked = false
      try {
        regionLocked = await cropTrackToElement(track, cropTarget)
      } catch {
        regionLocked = false
      }
      if (!regionLocked) {
        cropTarget.remove()
        if (captureNodesRef.current) captureNodesRef.current.cropTarget = null
      } else {
        await waitForRegionFrame(source, nextRect, ownerWindow)
      }
      if (captureNodesRef.current?.source !== source) return
      const pixelRatio = ownerWindow.devicePixelRatio || 1
      const initialCrop = placeScreenshotRectInVideo(
        nextRect,
        source.videoWidth,
        source.videoHeight,
        viewport(),
      )
      const canvas = ownerDocument.createElement("canvas")
      canvas.width = regionLocked
        ? Math.max(1, Math.round(nextRect.width * pixelRatio))
        : initialCrop.sw
      canvas.height = regionLocked
        ? Math.max(1, Math.round(nextRect.height * pixelRatio))
        : initialCrop.sh
      canvas.setAttribute("aria-hidden", "true")
      canvas.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;margin:0;padding:0;border:0;overflow:hidden;opacity:0;visibility:hidden;pointer-events:none"
      ownerDocument.body.append(canvas)
      const context = canvas.getContext("2d", { alpha: false })
      if (!context) throw new Error("Video recording is unavailable")
      captureNodesRef.current = { source, canvas, cropTarget: regionLocked ? cropTarget : null }
      const capture = canvas.captureStream(30)
      const captureTrack = capture.getVideoTracks()[0]
      const draw = () => {
        if (source.videoWidth <= 0 || source.videoHeight <= 0) {
          drawFrameRef.current = ownerWindow.requestAnimationFrame(draw)
          return
        }
        if (regionLocked) {
          const box = cropTarget.getBoundingClientRect()
          const slice = visibleSelectionSlice(box, viewport())
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
            nextRect,
            source.videoWidth,
            source.videoHeight,
            viewport(),
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
  }, [dismissError, extensionRecording, flashError, ownerDocument, ownerWindow, release, stop, viewport])

  const toggleSelection = useCallback(() => {
    if (selecting) return cancelSelection()
    if (extensionRecordingPreparingRef.current) return
    dismissError()
    discard()
    onPrepare()
    setAdjusting(false)
    setRect(null)
    if (extensionRecording) {
      extensionRecordingPreparingRef.current = true
      void extensionRecording.prepare().then(() => {
        extensionRecordingPreparingRef.current = false
        setSelecting(true)
      }).catch(() => {
        extensionRecordingPreparingRef.current = false
        release()
        flashError()
      })
      return
    }
    setSelecting(true)
  }, [cancelSelection, discard, dismissError, extensionRecording, flashError, onPrepare, release, selecting])

  const confirmRecording = useCallback(() => {
    const nextRect = rectRef.current
    if (!nextRect || nextRect.width < MIN_SCREENSHOT_SELECTION || nextRect.height < MIN_SCREENSHOT_SELECTION) return
    originRef.current = null
    setSelecting(false)
    setAdjusting(false)
    setRect(null)
    void start(nextRect)
  }, [start])

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

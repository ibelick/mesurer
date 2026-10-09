import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useCaptureErrorToast } from "./use-capture-error-toast"
import {
  correctWebmDuration,
  encodeGifClip,
  getCaptureViewportMetrics,
  isFullClipExport,
  openDisplayRecordingCapture,
  readBlobVideoDuration,
  reencodeVideoClip,
  resolveRecordingDuration,
  runDisplayRecordingDrawLoop,
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
import {
  type RecordingExportFormat,
  type RecordingExportOptions,
  type RecordingExportResult,
  supportedRecordingFormats,
  supportedWebmMimeType,
} from "./screen-recording-export"
import { encodeMp4Clip } from "../core/screen-recording-mp4"
import { usePageListener } from "./use-page-listener"

export type { RecordingExportFormat, RecordingExportOptions, RecordingExportResult }
export { supportedRecordingFormats }

const MAX_RECORDING_MS = 60_000

const createFilename = (extension: string, now = new Date()) =>
  `mesurer-recording-${now.toISOString().replace(/[:.]/g, "-")}.${extension}`

const extensionFor = (format: RecordingExportFormat) => format

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
    setVideo((current) => {
      if (current) URL.revokeObjectURL(current.url)
      urlRef.current = null
      return null
    })
  }, [])

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

      const displayCapture = await openDisplayRecordingCapture(
        ownerDocument,
        ownerWindow,
        nextRect,
        viewport,
      )
      captureNodesRef.current = {
        source: displayCapture.source,
        canvas: displayCapture.canvas,
      }
      runDisplayRecordingDrawLoop(ownerWindow, displayCapture, nextRect, viewport, drawFrameRef)

      const mimeType = supportedWebmMimeType()
      const recorder = new MediaRecorder(
        displayCapture.captureStream,
        mimeType ? { mimeType } : undefined,
      )
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data)
      recorder.onstop = () => {
        const elapsedSeconds = elapsedRef.current
        void (async () => {
          const blob = await correctWebmDuration(
            new Blob(chunks, { type: recorder.mimeType || "video/webm" }),
            elapsedSeconds,
          )
          release()
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
      displayCapture.track.addEventListener("ended", stop, { once: true })
      streamRef.current = displayCapture.stream
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

  // While a region is being chosen, Escape cancels and Enter confirms the one being adjusted.
  usePageListener({
    active: selecting,
    view: ownerWindow,
    types: "keydown",
    phase: "bubble",
    onEvent: (event) => {
      const { key } = event as KeyboardEvent
      if (key === "Escape") {
        event.preventDefault()
        cancelSelection()
        return
      }
      if (adjusting && key === "Enter") {
        event.preventDefault()
        confirmRecording()
      }
    },
  })

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
    if (format === "gif") {
      return {
        blob: await encodeGifClip(ownerDocument, video.url, startTime, endTime, scale),
        filename,
      }
    }
    if (format === "mp4") {
      return { blob: await encodeMp4Clip(ownerDocument, ownerWindow, video.url, startTime, endTime, scale), filename }
    }
    const mimeType = supportedWebmMimeType()
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

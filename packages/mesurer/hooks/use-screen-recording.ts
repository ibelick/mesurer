import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { MIN_SCREENSHOT_SELECTION, normalizeScreenshotRect, type ScreenshotRect } from "../core/screenshot"

const MAX_RECORDING_MS = 60_000

const supportedMimeType = () => ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
  .find((type) => MediaRecorder.isTypeSupported(type))

const createFilename = (now = new Date()) =>
  `mesurer-recording-${now.toISOString().replace(/[:.]/g, "-")}.webm`

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
  const [selecting, setSelecting] = useState(false)
  const [rect, setRect] = useState<ScreenshotRect | null>(null)
  const [recordingRect, setRecordingRect] = useState<ScreenshotRect | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [video, setVideo] = useState<{ url: string; duration: number; filename: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    setRecording(false)
    setRecordingRect(null)
    setElapsed(0)
  }, [ownerWindow])

  useEffect(() => () => {
    release()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [release])

  const cancelSelection = useCallback(() => {
    originRef.current = null
    setSelecting(false)
    setRect(null)
  }, [])

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
    setError(null)
    try {
      setRecordingRect(nextRect)
      const stream = await ownerWindow.navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: { displaySurface: "browser" },
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions)
      const track = stream.getVideoTracks()[0]
      if (!track) throw new Error("No video track was selected")
      const source = ownerDocument.createElement("video")
      source.autoplay = true
      source.muted = true
      source.playsInline = true
      source.srcObject = stream
      await source.play()
      const canvas = ownerDocument.createElement("canvas")
      const scaleX = source.videoWidth / ownerWindow.innerWidth
      const scaleY = source.videoHeight / ownerWindow.innerHeight
      canvas.width = Math.max(1, Math.round(nextRect.width * scaleX))
      canvas.height = Math.max(1, Math.round(nextRect.height * scaleY))
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Video recording is unavailable")
      const draw = () => {
        context.drawImage(source, nextRect.left * scaleX, nextRect.top * scaleY, nextRect.width * scaleX, nextRect.height * scaleY, 0, 0, canvas.width, canvas.height)
        drawFrameRef.current = ownerWindow.requestAnimationFrame(draw)
      }
      draw()
      const mimeType = supportedMimeType()
      const recorder = new MediaRecorder(canvas.captureStream(30), mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data)
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" })
        release()
        if (!blob.size) return
        const url = URL.createObjectURL(blob)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        const preview = ownerDocument.createElement("video")
        preview.preload = "metadata"
        preview.src = url
        const finishPreview = () => {
          if (!Number.isFinite(preview.duration) || preview.duration <= 0) return
          setVideo({ url, duration: preview.duration, filename: createFilename() })
        }
        preview.onloadedmetadata = () => {
          if (Number.isFinite(preview.duration)) {
            finishPreview()
            return
          }
          preview.currentTime = 1e101
          preview.onseeked = finishPreview
        }
      }
      track.addEventListener("ended", stop, { once: true })
      streamRef.current = stream
      recorderRef.current = recorder
      recorder.start(250)
      setRecording(true)
      const startedAt = ownerWindow.performance.now()
      const tick = () => {
        setElapsed((ownerWindow.performance.now() - startedAt) / 1000)
        if (recorder.state === "recording") elapsedFrameRef.current = ownerWindow.requestAnimationFrame(tick)
      }
      elapsedFrameRef.current = ownerWindow.requestAnimationFrame(tick)
      timeoutRef.current = ownerWindow.setTimeout(stop, MAX_RECORDING_MS)
    } catch (caught) {
      release()
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError("Screen recording was unavailable.")
    }
  }, [ownerDocument, ownerWindow, release, stop])

  const toggleSelection = useCallback(() => {
    if (selecting) return cancelSelection()
    discard()
    onPrepare()
    setSelecting(true)
  }, [cancelSelection, discard, onPrepare, selecting])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    originRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    setRect(normalizeScreenshotRect(originRef.current, originRef.current, { width: ownerWindow.innerWidth, height: ownerWindow.innerHeight }))
  }, [ownerWindow])
  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!originRef.current) return
    setRect(normalizeScreenshotRect(originRef.current, { x: event.clientX, y: event.clientY }, { width: ownerWindow.innerWidth, height: ownerWindow.innerHeight }))
  }, [ownerWindow])
  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const startPoint = originRef.current
    originRef.current = null
    if (!startPoint) return
    const nextRect = normalizeScreenshotRect(startPoint, { x: event.clientX, y: event.clientY }, { width: ownerWindow.innerWidth, height: ownerWindow.innerHeight })
    cancelSelection()
    if (nextRect.width >= MIN_SCREENSHOT_SELECTION && nextRect.height >= MIN_SCREENSHOT_SELECTION) void start(nextRect)
  }, [cancelSelection, ownerWindow, start])

  const exportClip = useCallback(async (startTime: number, endTime: number) => {
    if (!video || endTime <= startTime) throw new Error("Invalid trim range")
    const source = ownerDocument.createElement("video")
    source.muted = true
    source.playsInline = true
    source.src = video.url
    await new Promise<void>((resolve, reject) => {
      source.onloadedmetadata = () => {
        if (startTime <= 0) resolve()
        else source.currentTime = startTime
      }
      source.onseeked = () => resolve()
      source.onerror = () => reject(new Error("Could not trim recording"))
    })
    const canvas = ownerDocument.createElement("canvas")
    canvas.width = source.videoWidth
    canvas.height = source.videoHeight
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Could not trim recording")
    const mimeType = supportedMimeType()
    const recorder = new MediaRecorder(canvas.captureStream(30), mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    return new Promise<Blob>((resolve, reject) => {
      const draw = () => {
        context.drawImage(source, 0, 0, canvas.width, canvas.height)
        if (source.currentTime >= endTime || source.ended) recorder.stop()
        else ownerWindow.requestAnimationFrame(draw)
      }
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data)
      recorder.onstop = () => {
        source.pause()
        resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }))
      }
      recorder.onerror = () => reject(new Error("Could not trim recording"))
      recorder.start()
      void source.play().then(draw, reject)
    })
  }, [ownerDocument, ownerWindow, video])

  return { selecting, rect, recordingRect, recording, elapsed, video, error, toggleSelection, stop, discard, exportClip, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancelSelection }
}

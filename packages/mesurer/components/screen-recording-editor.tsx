import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { addMesurerCaptureListener } from "../core/keyboard-gate"
import { listenPointerDrag } from "../core/pointer-drag"
import { cn, formatValue } from "../core/utils"
import { useToolbarTooltip } from "../hooks/use-toolbar-tooltip"
import type { RecordingExportFormat, RecordingExportOptions, RecordingExportResult } from "../hooks/screen-recording-export"
import { supportedRecordingFormats } from "../hooks/screen-recording-export"
import { CloseIcon } from "./icons"
import { CheckIcon } from "./icons/menu-icons"
import { MenuItem, MenuSurface } from "./menu"
import { SettingsButton } from "./settings-button"
import { StatusEllipsis } from "./status-ellipsis"
import { clampOverlayPosition } from "../core/overlay-position"
import { OverlayPortal, Tooltip, TooltipLayerContext } from "./tooltip"

type ScreenRecordingEditorProps = {
  url: string
  playerUrl?: string
  duration: number
  onDiscard: () => void
  onExport: (start: number, end: number, options?: RecordingExportOptions) => Promise<RecordingExportResult>
  ownerDocument: Document
  fillFrame?: boolean
}

type DragKind = "start" | "end" | "playhead"

const MIN_CLIP_SECONDS = 0.1

const TIMELINE_BAR_MOTION = "msr:transition-[height] msr:duration-300 msr:ease-[cubic-bezier(0.22,1,0.36,1)]"

const SCALE_OPTIONS = [1, 2, 3] as const

const FORMAT_LABEL: Record<RecordingExportFormat, string> = {
  webm: "WebM",
  mp4: "MP4",
}

const scaleLabel = (scale: number, size: { width: number; height: number } | null) => {
  if (!size) return `${scale}×`
  return `${scale}× (${formatValue(size.width * scale)} × ${formatValue(size.height * scale)})`
}

const exportMenuRowClass = (selected: boolean) =>
  cn(
    "msr:gap-2 msr:rounded-[4px] msr:px-2 msr:py-1 msr:text-[11px] msr:leading-4 msr:text-ink-700",
    selected ? "msr:bg-ink-50" : "msr:hover:bg-ink-100",
  )

const timestamp = (value: number) => {
  const seconds = Math.max(0, Math.floor(value))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

const PlayIcon = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true" className="msr:block">
    <path d="M1.4.6v6.8L7.2 4z" />
  </svg>
)

const PauseIcon = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true" className="msr:block">
    <rect x="1.4" y="1" width="1.8" height="6" rx="0.2" />
    <rect x="4.8" y="1" width="1.8" height="6" rx="0.2" />
  </svg>
)

const ExpandIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="msr:block">
    <path d="M1.5 3.5V1.5H3.5M6.5 1.5H8.5V3.5M8.5 6.5V8.5H6.5M3.5 8.5H1.5V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
  </svg>
)

const CollapseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="msr:block">
    <path d="M3.5 1.5V3.5H1.5M8.5 3.5H6.5V1.5M6.5 8.5V6.5H8.5M1.5 6.5H3.5V8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="msr:block">
    <path d="M5 1.5v5M2.5 4.75 5 7.25 7.5 4.75M1.75 8.5h6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
  </svg>
)

function PlayerIconButton({
  label,
  tooltipId,
  tooltip,
  pressed,
  disabled,
  onClick,
  onPointerDown,
  children,
}: {
  label: string
  tooltipId?: string
  tooltip: ReturnType<typeof useToolbarTooltip>
  pressed?: boolean
  disabled?: boolean
  onClick?: () => void
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  children: ReactNode
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const showTooltip = Boolean(tooltipId)

  return (
    <div
      ref={anchorRef}
      className="msr:relative msr:flex msr:size-5 msr:shrink-0 msr:items-center msr:justify-center"
      onMouseEnter={() => {
        if (tooltipId) tooltip.onTooltipEnter(tooltipId)
      }}
      onMouseLeave={() => {
        if (tooltipId) tooltip.onTooltipLeave(tooltipId)
      }}
      onFocus={() => {
        if (tooltipId) tooltip.onTooltipEnter(tooltipId)
      }}
      onBlur={() => {
        if (tooltipId) tooltip.onTooltipLeave(tooltipId)
      }}
    >
      <SettingsButton
        shape="icon"
        variant="ghost"
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        {children}
      </SettingsButton>
      {showTooltip && tooltipId ? (
        <Tooltip
          label={label}
          visible={tooltip.visibleTooltipId === tooltipId}
          instant={tooltip.tooltipInstant}
          side="top"
          anchorRef={anchorRef}
        />
      ) : null}
    </div>
  )
}

function TrimHandle({
  label,
  value,
  min,
  max,
  active,
  style,
  onPointerDown,
  onNudge,
}: {
  label: string
  value: number
  min: number
  max: number
  active: boolean
  style: { left: string }
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onNudge: (next: number) => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "msr:group msr:absolute msr:top-0 msr:z-20 msr:flex msr:h-full msr:-translate-x-1/2 msr:cursor-ew-resize msr:items-center msr:justify-center msr:border-0 msr:bg-transparent msr:px-1 msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--color-ink-700)]",
        !active && "msr:transition-[left] msr:duration-300 msr:ease-[cubic-bezier(0.22,1,0.36,1)]",
      )}
      style={style}
      aria-label={label}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={timestamp(value)}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          onNudge(value - 0.1)
        }
        if (event.key === "ArrowRight") {
          event.preventDefault()
          onNudge(value + 0.1)
        }
      }}
    >
      <span
        className={cn(
          "mesurer-recording-trim-bar msr:block msr:h-2 msr:w-0.5 msr:rounded-full msr:bg-ink-900",
          TIMELINE_BAR_MOTION,
          active ? "msr:h-3" : "msr:group-hover:h-3 msr:group-focus-visible:h-3",
        )}
      />
    </button>
  )
}

export function ScreenRecordingEditor(props: ScreenRecordingEditorProps) {
  if (props.playerUrl) {
    return <ExtensionRecordingFrame {...props} />
  }

  return <StandardScreenRecordingEditor {...props} />
}

const RECORDING_FRAME_WIDTH = 22 * 16

const recordingTheme = () => {
  const theme = document.querySelector("[data-mesurer-root]")?.getAttribute("data-theme")
  return theme === "light" || theme === "dark" || theme === "system" ? theme : "system"
}

function ExtensionRecordingFrame({ playerUrl, onDiscard }: ScreenRecordingEditorProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [frameSize, setFrameSize] = useState({ width: RECORDING_FRAME_WIDTH, height: 280, menuExtra: 0 })
  const [anchorSide, setAnchorSide] = useState<"top" | "bottom">("top")
  const src = useMemo(() => {
    const url = new URL(playerUrl)
    url.searchParams.set("theme", recordingTheme())
    return url.toString()
  }, [playerUrl])
  const postFrameState = useCallback(() => {
    const frame = frameRef.current
    const panel = frame?.parentElement?.parentElement
    const side = panel?.style.bottom ? "bottom" : "top"
    setAnchorSide(side)
    frame?.contentWindow?.postMessage({ type: "mesurer:recording-theme", theme: recordingTheme() }, "*")
    frame?.contentWindow?.postMessage({ type: "mesurer:recording-anchor", side }, "*")
  }, [])
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return
      if (event.data?.type === "mesurer:recording-discard") onDiscard()
      if (
        event.data?.type === "mesurer:recording-frame-size" &&
        typeof event.data.width === "number" &&
        typeof event.data.height === "number" &&
        event.data.width >= 32 &&
        event.data.height >= 32
      ) {
        setFrameSize({
          width: event.data.width,
          height: event.data.height,
          menuExtra: typeof event.data.menuExtra === "number" ? event.data.menuExtra : 0,
        })
      }
    }
    window.addEventListener("message", onMessage)
    const root = frameRef.current?.closest("[data-mesurer-root]")
    const panel = frameRef.current?.parentElement?.parentElement
    const observer = new MutationObserver(postFrameState)
    if (root) observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] })
    if (panel) observer.observe(panel, { attributes: true, attributeFilter: ["style"] })
    return () => {
      window.removeEventListener("message", onMessage)
      observer.disconnect()
    }
  }, [onDiscard, postFrameState])
  const menuAbove = anchorSide === "bottom"
  return (
    <div
      className="msr:relative msr:max-w-[calc(100vw-16px)] msr:rounded-wide-card"
      style={{ width: frameSize.width, height: frameSize.height, boxShadow: "var(--msr-shadow-floating)" }}
    >
      <iframe
        ref={frameRef}
        title="Recording preview"
        src={src}
        onLoad={postFrameState}
        className="msr:absolute msr:left-0 msr:border-0 msr:bg-transparent"
        style={{
          width: frameSize.width,
          height: frameSize.height + frameSize.menuExtra,
          top: menuAbove ? -frameSize.menuExtra : 0,
        }}
      />
    </div>
  )
}

function StandardScreenRecordingEditor({ url, duration, onDiscard, onExport, ownerDocument, fillFrame }: ScreenRecordingEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const trackWidthRef = useRef(0)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const exportMenuSurfaceRef = useRef<HTMLDivElement>(null)
  const exportScaleAnchorRef = useRef<HTMLDivElement>(null)
  const startRef = useRef(0)
  const endRef = useRef(duration)
  const playClockRef = useRef<{ at: number; time: number } | null>(null)
  const tooltip = useToolbarTooltip()
  const overlayLayer = useContext(TooltipLayerContext)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(duration)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const formats = useMemo(() => supportedRecordingFormats(), [])
  const [format, setFormat] = useState<RecordingExportFormat>(formats[0] ?? "webm")
  const [scale, setScale] = useState(1)
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [trimActive, setTrimActive] = useState<DragKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const closeAnchorRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const togglePlaybackRef = useRef<() => void>(() => {})
  const [exportMenuBox, setExportMenuBox] = useState<{ left: number; top: number; ready: boolean } | null>(null)
  startRef.current = start
  endRef.current = end

  useEffect(() => {
    setStart(0)
    setEnd(duration)
    setCurrentTime(0)
  }, [duration, url])

  useEffect(() => {
    const view = ownerDocument.defaultView
    if (!view) return
    const closeIfOutside = (event: Event) => {
      if (!exportMenuOpen) return
      const path = event.composedPath()
      if (exportMenuRef.current && path.includes(exportMenuRef.current)) return
      if (exportMenuSurfaceRef.current && path.includes(exportMenuSurfaceRef.current)) return
      setExportMenuOpen(false)
    }
    const onKeyDown = (event: Event) => {
      if (!("key" in event)) return
      const keyEvent = event as KeyboardEvent
      if (keyEvent.key === "Escape") {
        keyEvent.preventDefault()
        if (exportMenuOpen) {
          setExportMenuOpen(false)
          return
        }
        onDiscard()
        return
      }
      if (keyEvent.repeat || (keyEvent.key !== " " && keyEvent.code !== "Space")) return
      const card = cardRef.current
      if (!card || !keyEvent.composedPath().includes(card)) return
      const target = keyEvent.target
      if (
        target instanceof Element &&
        target.closest("button, [role='menu'], [role='menuitem'], [role='slider']")
      ) {
        return
      }
      keyEvent.preventDefault()
      togglePlaybackRef.current()
    }
    const detachWindow = exportMenuOpen
      ? addMesurerCaptureListener(view, view, "pointerdown", closeIfOutside)
      : () => {}
    const detachDocument = exportMenuOpen
      ? addMesurerCaptureListener(view, ownerDocument, "pointerdown", closeIfOutside)
      : () => {}
    const detachKeys = addMesurerCaptureListener(view, view, "keydown", onKeyDown)
    return () => {
      detachWindow()
      detachDocument()
      detachKeys()
    }
  }, [exportMenuOpen, onDiscard, ownerDocument])

  useLayoutEffect(() => {
    if (!exportMenuOpen || !overlayLayer) return
    const update = () => {
      const anchor = exportScaleAnchorRef.current
      const menu = exportMenuSurfaceRef.current
      if (!anchor || !menu) return
      const rect = anchor.getBoundingClientRect()
      const origin = overlayLayer.getBoundingClientRect()
      const width = menu.offsetWidth
      const height = menu.offsetHeight
      const gap = 4
      const padding = 8
      const spaceAbove = rect.top - origin.top - padding
      const spaceBelow = origin.bottom - rect.bottom - padding
      const anchorSide = ownerDocument.getElementById("root")?.getAttribute("data-anchor")
      const openAbove = anchorSide === "bottom" ? true : anchorSide === "top" ? false : spaceAbove >= height || spaceAbove >= spaceBelow
      const preferredTop = openAbove
        ? rect.top - origin.top - height - gap
        : rect.bottom - origin.top + gap
      const placed = clampOverlayPosition({
        left: rect.right - origin.left - width,
        top: preferredTop,
        width,
        height,
        viewportWidth: origin.width,
        viewportHeight: origin.height,
        padding,
      })
      const ready = anchorSide ? (openAbove ? spaceAbove >= height : spaceBelow >= height) : true
      setExportMenuBox({ left: placed.left, top: anchorSide ? preferredTop : placed.top, ready })
    }
    update()
    const view = ownerDocument.defaultView
    view?.addEventListener("resize", update)
    view?.addEventListener("scroll", update, true)
    const observer = new ResizeObserver(update)
    observer.observe(overlayLayer)
    return () => {
      observer.disconnect()
      view?.removeEventListener("resize", update)
      view?.removeEventListener("scroll", update, true)
    }
  }, [exportMenuOpen, expanded, format, frameSize, overlayLayer, ownerDocument, scale])

  const syncPlayClock = (time: number) => {
    const view = ownerDocument.defaultView
    if (!view) return
    playClockRef.current = { at: view.performance.now(), time }
  }

  const ratio = (value: number) => (duration <= 0 ? 0 : Math.min(1, Math.max(0, value / duration)))

  const updatePlayheadPosition = useCallback(
    (time: number) => {
      const el = playheadRef.current
      const width = trackWidthRef.current
      if (!el || width <= 0 || duration <= 0) return
      const x = ratio(time) * width
      el.style.transform = `translate3d(${x}px, -50%, 0) translateX(-50%)`
    },
    [duration],
  )

  useEffect(() => {
    if (!playing) return
    const view = ownerDocument.defaultView
    if (!view) return
    let frame = 0
    const tick = () => {
      const video = videoRef.current
      const clock = playClockRef.current
      if (video && !video.paused && clock) {
        const clipStart = startRef.current
        const clipEnd = endRef.current
        let next = clock.time + (view.performance.now() - clock.at) / 1000
        if (Number.isFinite(clipEnd) && clipEnd > MIN_CLIP_SECONDS && next >= clipEnd) {
          video.pause()
          video.currentTime = clipStart
          updatePlayheadPosition(clipStart)
          setCurrentTime(clipStart)
          playClockRef.current = null
          return
        }
        next = Math.min(clipEnd, Math.max(clipStart, next))
        updatePlayheadPosition(next)
        setCurrentTime(next)
        if (Math.abs(video.currentTime - next) > 0.04) {
          try {
            video.currentTime = next
          } catch {
            /* seek while decoding */
          }
        }
      }
      if (videoRef.current && !videoRef.current.paused) {
        frame = view.requestAnimationFrame(tick)
      }
    }
    frame = view.requestAnimationFrame(tick)
    return () => view.cancelAnimationFrame(frame)
  }, [ownerDocument, playing, updatePlayheadPosition])

  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const syncFromMedia = () => {
      const mediaDuration = el.duration
      if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) return
      // A short container duration must not trim off the rest of the recording.
      if (mediaDuration + 0.05 < duration) return
      if (Math.abs(mediaDuration - duration) < 0.05) return
      setEnd(mediaDuration)
      setStart((value) => Math.min(value, Math.max(0, mediaDuration - MIN_CLIP_SECONDS)))
      const nextTime = Math.min(currentTimeRef.current, mediaDuration)
      setCurrentTime(nextTime)
      updatePlayheadPosition(nextTime)
    }
    el.addEventListener("loadedmetadata", syncFromMedia)
    if (el.readyState >= 1) syncFromMedia()
    return () => el.removeEventListener("loadedmetadata", syncFromMedia)
  }, [duration, updatePlayheadPosition, url])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => {
      trackWidthRef.current = track.getBoundingClientRect().width
      updatePlayheadPosition(currentTimeRef.current)
    }
    measure()
    const view = ownerDocument.defaultView
    if (!view) return
    const observer = new view.ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [duration, ownerDocument, updatePlayheadPosition, url])

  useEffect(() => {
    if (!playing) updatePlayheadPosition(currentTime)
  }, [currentTime, playing, updatePlayheadPosition])

  const timeAtTrack = (clientX: number) => {
    const track = trackRef.current
    if (!track || duration <= 0) return 0
    const bounds = track.getBoundingClientRect()
    if (bounds.width <= 0) return 0
    return Math.min(duration, Math.max(0, ((clientX - bounds.left) / bounds.width) * duration))
  }

  const seekToClipTime = (target: number, pause = false) => {
    const video = videoRef.current
    if (pause && video && !video.paused) {
      video.pause()
      playClockRef.current = null
    }
    if (video && Math.abs(video.currentTime - target) > 0.001) {
      video.currentTime = target
    }
    setCurrentTime(target)
    updatePlayheadPosition(target)
    if (video && !video.paused) syncPlayClock(target)
  }

  const seek = (value: number) => {
    const next = Math.min(endRef.current, Math.max(startRef.current, value))
    seekToClipTime(next, true)
  }

  const updateStart = (value: number, options?: { previewEdge?: boolean }) => {
    const clipEnd = endRef.current
    const next = Math.min(Math.max(0, value), clipEnd - MIN_CLIP_SECONDS)
    setStart(next)
    const current = videoRef.current?.currentTime ?? next
    const target = options?.previewEdge ? next : Math.min(clipEnd, Math.max(next, current))
    seekToClipTime(target, Boolean(options?.previewEdge))
  }

  const updateEnd = (value: number, options?: { previewEdge?: boolean }) => {
    const clipStart = startRef.current
    const next = Math.max(Math.min(duration, value), clipStart + MIN_CLIP_SECONDS)
    setEnd(next)
    const current = videoRef.current?.currentTime ?? clipStart
    const pastEnd = current > next
    const target = options?.previewEdge
      ? next
      : pastEnd
        ? clipStart
        : Math.min(next, Math.max(clipStart, current))
    seekToClipTime(target, Boolean(options?.previewEdge || pastEnd))
  }

  const beginDrag = (kind: DragKind, event: ReactPointerEvent<HTMLElement>, timeFromClientX: (clientX: number) => number) => {
    event.preventDefault()
    event.stopPropagation()
    const view = event.nativeEvent.view ?? ownerDocument.defaultView
    if (!view) return
    const apply = (clientX: number) => {
      const time = timeFromClientX(clientX)
      if (kind === "start") updateStart(time, { previewEdge: true })
      else if (kind === "end") updateEnd(time, { previewEdge: true })
      else seek(time)
    }
    apply(event.clientX)
    setTrimActive(kind)
    listenPointerDrag(event.pointerId, view, { x: event.clientX, y: event.clientY }, {
      onMove: (_dx, _dy, pointer) => apply(pointer.clientX),
      onEnd: () => setTrimActive(null),
    })
  }

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current
    if (!video || exporting) return
    if (!video.paused) {
      video.pause()
      playClockRef.current = null
      return
    }
    video.muted = true
    const clipStart = startRef.current
    const clipEnd = endRef.current
    const from =
      video.currentTime < clipStart || video.currentTime >= clipEnd
        ? clipStart
        : video.currentTime
    video.currentTime = from
    setCurrentTime(from)
    updatePlayheadPosition(from)
    const beginPlay = () => {
      syncPlayClock(video.currentTime)
      void video.play().catch((error: unknown) => {
        if (!video.paused) return
        playClockRef.current = null
        if (error instanceof DOMException && error.name === "AbortError") return
        setError("Could not play the recording.")
      })
    }
    if (video.seeking) {
      video.addEventListener("seeked", beginPlay, { once: true })
    } else {
      beginPlay()
    }
  }, [exporting, updatePlayheadPosition])

  const downloadRecording = async () => {
    if (exporting) return
    setExporting(true)
    setError(null)
    try {
      const exported = await onExport(start, end, { format, scale })
      const objectUrl = URL.createObjectURL(exported.blob)
      const link = ownerDocument.createElement("a")
      link.href = objectUrl
      link.download = exported.filename
      link.style.position = "fixed"
      link.style.left = "-9999px"
      ownerDocument.body.append(link)
      link.click()
      link.remove()
      ownerDocument.defaultView?.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } catch {
      setError("Could not export the recording.")
    } finally {
      setExporting(false)
    }
  }

  togglePlaybackRef.current = () => {
    void togglePlayback()
  }

  useLayoutEffect(() => {
    cardRef.current?.focus({ preventScroll: true })
  }, [url])

  const startPct = `${ratio(start) * 100}%`
  const endPct = `${ratio(end) * 100}%`
  const hoverPct = hoverTime === null ? null : `${ratio(hoverTime) * 100}%`
  const previewAspect =
    frameSize && frameSize.width > 0 && frameSize.height > 0
      ? `${frameSize.width} / ${frameSize.height}`
      : "16 / 9"

  return (
    <section
      ref={cardRef}
      tabIndex={0}
      aria-keyshortcuts="Space"
      data-mesurer-recording-card
      data-expanded={expanded ? "true" : "false"}
      className={cn(
        "mesurer-menu-surface msr:relative msr:box-border msr:overflow-visible msr:rounded-wide-card msr:bg-white msr:shadow-floating msr:outline-none",
        fillFrame
          ? "msr:w-full msr:max-w-none"
          : "msr:w-[22rem] msr:max-w-[calc(100vw-24px)] msr:transition-[width] msr:duration-200 msr:ease-[ease] msr:motion-reduce:transition-none",
        !fillFrame && expanded && "msr:w-[36rem]",
      )}
      aria-label="Screen recording editor"
      aria-busy={exporting}
      onMouseLeave={tooltip.onToolbarLeave}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button, [role='slider']")) return
        cardRef.current?.focus({ preventScroll: true })
      }}
    >
      <div className="msr:relative msr:p-2">
        <div className="msr:relative msr:flex msr:w-full msr:justify-center">
          <div
            className="msr:group/video msr:relative msr:flex msr:w-full msr:cursor-default msr:justify-center msr:overflow-hidden msr:rounded-control msr:bg-ink-100"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("button")) return
              void togglePlayback()
            }}
          >
            <div
              className={cn(
                "msr:mx-auto msr:w-full msr:max-w-full msr:min-h-[4.5rem] msr:max-h-36",
                "msr:transition-[max-height] msr:duration-200 msr:ease-[ease] msr:motion-reduce:transition-none",
                expanded && "msr:max-h-[28rem]",
              )}
              style={{ aspectRatio: previewAspect }}
            >
            <video
            ref={videoRef}
            className="msr:block msr:size-full msr:max-h-full msr:max-w-full msr:object-contain"
            src={url}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                setFrameSize({ width: video.videoWidth, height: video.videoHeight })
              }
            }}
            onPlay={() => {
              setPlaying(true)
              const video = videoRef.current
              if (video && !playClockRef.current) syncPlayClock(video.currentTime)
            }}
            onPause={() => {
              playClockRef.current = null
              setPlaying(false)
            }}
            onTimeUpdate={(event) => {
              const video = event.currentTarget
              if (video.paused) {
                setCurrentTime(video.currentTime)
                return
              }
              const clipStart = startRef.current
              const clipEnd = endRef.current
              if (video.currentTime >= clipEnd - 0.02) {
                video.pause()
                video.currentTime = clipStart
                setCurrentTime(clipStart)
                updatePlayheadPosition(clipStart)
                playClockRef.current = null
                return
              }
              if (video.currentTime < clipStart) {
                video.currentTime = clipStart
                setCurrentTime(clipStart)
                syncPlayClock(clipStart)
              }
            }}
            onEnded={() => {
              const clipStart = startRef.current
              const video = videoRef.current
              if (video) video.currentTime = clipStart
              setCurrentTime(clipStart)
              updatePlayheadPosition(clipStart)
            }}
            />
            </div>
            {exporting ? (
              <div className="msr:absolute msr:inset-0 msr:z-30 msr:flex msr:items-center msr:justify-center msr:bg-ink-900/45 msr:text-[11px] msr:text-white">
                <StatusEllipsis label="Exporting" />
              </div>
            ) : null}
            <div
              ref={closeAnchorRef}
              className="msr:pointer-events-none msr:absolute msr:top-1.5 msr:right-1.5 msr:z-40 msr:opacity-0 msr:group-hover/video:pointer-events-auto msr:group-hover/video:opacity-100 msr:focus-within:pointer-events-auto msr:focus-within:opacity-100"
              onMouseEnter={() => tooltip.onTooltipEnter("recording-close")}
              onMouseLeave={() => tooltip.onTooltipLeave("recording-close")}
              onFocus={() => tooltip.onTooltipEnter("recording-close")}
              onBlur={() => tooltip.onTooltipLeave("recording-close")}
            >
              <SettingsButton
                shape="icon"
                variant="overlay"
                type="button"
                aria-label="Close"
                onClick={(event) => {
                  event.stopPropagation()
                  onDiscard()
                }}
              >
                <CloseIcon size={12} />
              </SettingsButton>
              <Tooltip
                label="Close"
                visible={tooltip.visibleTooltipId === "recording-close"}
                instant={tooltip.tooltipInstant}
                side="top"
                anchorRef={closeAnchorRef}
              />
            </div>
          </div>
        </div>
        <div className="msr:mt-2 msr:flex msr:h-5 msr:items-center msr:gap-1.5">
          <PlayerIconButton
            label={playing ? "Pause" : "Play"}
            tooltip={tooltip}
            pressed={playing}
            onClick={() => void togglePlayback()}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </PlayerIconButton>
          <span className="msr:flex msr:h-5 msr:w-8 msr:shrink-0 msr:items-center msr:font-mono msr:text-[10px] msr:leading-none msr:tabular-nums msr:text-ink-500">
            {timestamp(currentTime)}
          </span>
          <div
            ref={trackRef}
            data-mesurer-recording-timeline
            className="msr:relative msr:h-5 msr:min-w-0 msr:flex-1 msr:select-none"
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest("button")) return
              beginDrag("playhead", event, timeAtTrack)
            }}
            onPointerMove={(event) => {
              setHoverTime(timeAtTrack(event.clientX))
            }}
            onPointerLeave={() => setHoverTime(null)}
          >
            <div className="mesurer-recording-track-rail msr:absolute msr:inset-x-0 msr:top-1/2 msr:h-[3px] msr:-translate-y-1/2 msr:rounded-full msr:bg-ink-200" />
            <div
              className="mesurer-recording-track-clip msr:absolute msr:top-1/2 msr:h-[3px] msr:-translate-y-1/2 msr:rounded-full msr:bg-ink-300"
              style={{ left: startPct, width: `calc(${endPct} - ${startPct})` }}
            />
            {hoverPct ? (
              <div
                className="msr:pointer-events-none msr:absolute msr:top-1/2 msr:z-[2] msr:h-2.5 msr:w-0.5 msr:-translate-x-1/2 msr:-translate-y-1/2 msr:rounded-full msr:bg-ink-500/50"
                style={{ left: hoverPct }}
              />
            ) : null}
            <div
              ref={playheadRef}
              className={cn(
                "mesurer-recording-playhead msr:pointer-events-none msr:absolute msr:top-1/2 msr:left-0 msr:z-[25] msr:w-0.5 msr:rounded-full msr:bg-ink-900 msr:will-change-transform",
                TIMELINE_BAR_MOTION,
                playing || trimActive === "playhead" ? "msr:h-2" : "msr:h-1.5",
              )}
            />
            <TrimHandle
              label="Trim start"
              value={start}
              min={0}
              max={Math.max(0, end - MIN_CLIP_SECONDS)}
              active={trimActive === "start"}
              style={{ left: startPct }}
              onPointerDown={(event) => beginDrag("start", event, timeAtTrack)}
              onNudge={(value) => updateStart(value, { previewEdge: true })}
            />
            <TrimHandle
              label="Trim end"
              value={end}
              min={Math.min(duration, start + MIN_CLIP_SECONDS)}
              max={duration}
              active={trimActive === "end"}
              style={{ left: endPct }}
              onPointerDown={(event) => beginDrag("end", event, timeAtTrack)}
              onNudge={(value) => updateEnd(value, { previewEdge: true })}
            />
          </div>
          <span className="msr:flex msr:h-5 msr:w-8 msr:shrink-0 msr:items-center msr:justify-end msr:font-mono msr:text-[10px] msr:leading-none msr:tabular-nums msr:text-ink-500">
            {timestamp(duration)}
          </span>
          <div ref={exportMenuRef} className="msr:relative msr:flex msr:h-5 msr:items-center">
            <div
              ref={exportScaleAnchorRef}
              className="msr:relative msr:flex msr:h-5 msr:shrink-0 msr:items-center msr:justify-center"
              onMouseEnter={() => tooltip.onTooltipEnter("recording-export")}
              onMouseLeave={() => tooltip.onTooltipLeave("recording-export")}
              onFocus={() => tooltip.onTooltipEnter("recording-export")}
              onBlur={() => tooltip.onTooltipLeave("recording-export")}
            >
              <SettingsButton
                variant="ghost"
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                aria-label="Export options"
                className="msr:px-1 msr:font-mono msr:text-[10px] msr:leading-none"
                style={{ height: 20 }}
                onClick={() => setExportMenuOpen((open) => !open)}
              >
                {scale}×
              </SettingsButton>
              <Tooltip
                label="Export options"
                visible={!exportMenuOpen && tooltip.visibleTooltipId === "recording-export"}
                instant={tooltip.tooltipInstant}
                side="top"
                anchorRef={exportScaleAnchorRef}
              />
            </div>
            {exportMenuOpen ? (
              <OverlayPortal>
                <div
                  ref={exportMenuSurfaceRef}
                  className="msr:pointer-events-auto msr:absolute"
                  style={
                    exportMenuBox?.ready
                      ? { left: exportMenuBox.left, top: exportMenuBox.top }
                      : { left: exportMenuBox?.left ?? 0, top: exportMenuBox?.top ?? 0, visibility: "hidden" }
                  }
                >
                  <MenuSurface className="msr:w-max msr:min-w-44">
                    <p className="msr:px-2 msr:py-1 msr:text-[10px] msr:font-medium msr:text-ink-500">Format</p>
                    {formats.map((item) => {
                      const selected = item === format
                      return (
                        <MenuItem
                          key={item}
                          variant="neutral"
                          className={exportMenuRowClass(selected)}
                          aria-checked={selected}
                          onClick={() => setFormat(item)}
                        >
                          <CheckIcon
                            size={12}
                            className={cn("msr:shrink-0", selected ? "msr:opacity-100" : "msr:opacity-0")}
                          />
                          <span className="msr:flex-1">{FORMAT_LABEL[item]}</span>
                        </MenuItem>
                      )
                    })}
                    <p className="msr:px-2 msr:pt-1.5 msr:pb-1 msr:text-[10px] msr:font-medium msr:text-ink-500">Size</p>
                    {SCALE_OPTIONS.map((item) => {
                      const selected = item === scale
                      return (
                        <MenuItem
                          key={item}
                          variant="neutral"
                          className={exportMenuRowClass(selected)}
                          aria-checked={selected}
                          onClick={() => setScale(item)}
                        >
                          <CheckIcon
                            size={12}
                            className={cn("msr:shrink-0", selected ? "msr:opacity-100" : "msr:opacity-0")}
                          />
                          <span className="msr:flex-1">{scaleLabel(item, frameSize)}</span>
                        </MenuItem>
                      )
                    })}
                  </MenuSurface>
                </div>
              </OverlayPortal>
            ) : null}
          </div>
          <PlayerIconButton
            label="Download"
            tooltipId="recording-download"
            tooltip={tooltip}
            disabled={exporting}
            onClick={() => void downloadRecording()}
          >
            <DownloadIcon />
          </PlayerIconButton>
          <PlayerIconButton
            label={expanded ? "Shrink preview" : "Grow preview"}
            tooltipId="recording-resize"
            tooltip={tooltip}
            pressed={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </PlayerIconButton>
        </div>
        {error ? (
          <p className="msr:mt-2 msr:text-[11px] msr:leading-4 msr:text-[var(--msr-danger-text)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}

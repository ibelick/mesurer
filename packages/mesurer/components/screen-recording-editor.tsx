import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { addMesurerCaptureListener } from "../core/keyboard-gate"
import { listenPointerDrag } from "../core/pointer-drag"
import { cn, formatValue } from "../core/utils"
import { useToolbarTooltip } from "../hooks/use-toolbar-tooltip"
import type { RecordingExportFormat, RecordingExportOptions, RecordingExportResult } from "../hooks/use-screen-recording"
import { supportedRecordingFormats } from "../hooks/use-screen-recording"
import { CloseIcon } from "./icons"
import { CheckIcon } from "./icons/menu-icons"
import { MenuItem, MenuSurface } from "./menu"
import { SettingsButton } from "./settings-button"
import { StatusEllipsis } from "./status-ellipsis"
import { Tooltip } from "./tooltip"

type ScreenRecordingEditorProps = {
  url: string
  duration: number
  onDiscard: () => void
  onExport: (start: number, end: number, options?: RecordingExportOptions) => Promise<RecordingExportResult>
  ownerDocument: Document
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
        "group msr:absolute msr:top-0 msr:z-20 msr:flex msr:h-full msr:-translate-x-1/2 msr:cursor-ew-resize msr:items-center msr:justify-center msr:border-0 msr:bg-transparent msr:px-1 msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--color-ink-700)]",
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

export function ScreenRecordingEditor({ url, duration, onDiscard, onExport, ownerDocument }: ScreenRecordingEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const trackWidthRef = useRef(0)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const exportScaleAnchorRef = useRef<HTMLDivElement>(null)
  const startRef = useRef(0)
  const endRef = useRef(duration)
  const playClockRef = useRef<{ at: number; time: number } | null>(null)
  const tooltip = useToolbarTooltip()
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
      setExportMenuOpen(false)
    }
    const closeOnEscape = (event: Event) => {
      if (!("key" in event) || (event as KeyboardEvent).key !== "Escape") return
      event.preventDefault()
      if (exportMenuOpen) {
        setExportMenuOpen(false)
        return
      }
      onDiscard()
    }
    const detachWindow = exportMenuOpen
      ? addMesurerCaptureListener(view, view, "pointerdown", closeIfOutside)
      : () => {}
    const detachDocument = exportMenuOpen
      ? addMesurerCaptureListener(view, ownerDocument, "pointerdown", closeIfOutside)
      : () => {}
    const detachEscape = addMesurerCaptureListener(view, view, "keydown", closeOnEscape)
    return () => {
      detachWindow()
      detachDocument()
      detachEscape()
    }
  }, [exportMenuOpen, onDiscard, ownerDocument])

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
    if (!playing) {
      playClockRef.current = null
      return
    }
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

  const seek = (value: number) => {
    const next = Math.min(endRef.current, Math.max(startRef.current, value))
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = next
    }
    playClockRef.current = null
    setCurrentTime(next)
    updatePlayheadPosition(next)
  }

  const updateStart = (value: number) => {
    const next = Math.min(Math.max(0, value), endRef.current - MIN_CLIP_SECONDS)
    setStart(next)
    const video = videoRef.current
    if (video && video.currentTime < next) {
      video.currentTime = next
      setCurrentTime(next)
    }
  }

  const updateEnd = (value: number) => {
    const next = Math.max(Math.min(duration, value), startRef.current + MIN_CLIP_SECONDS)
    setEnd(next)
    if (videoRef.current && videoRef.current.currentTime > next) {
      videoRef.current.pause()
      videoRef.current.currentTime = startRef.current
      setCurrentTime(startRef.current)
    }
  }

  const beginDrag = (kind: DragKind, event: ReactPointerEvent<HTMLElement>, timeFromClientX: (clientX: number) => number) => {
    event.preventDefault()
    event.stopPropagation()
    const view = event.nativeEvent.view ?? ownerDocument.defaultView
    if (!view) return
    const apply = (clientX: number) => {
      const time = timeFromClientX(clientX)
      if (kind === "start") updateStart(time)
      else if (kind === "end") updateEnd(time)
      else seek(time)
    }
    apply(event.clientX)
    setTrimActive(kind)
    listenPointerDrag(event.pointerId, view, { x: event.clientX, y: event.clientY }, {
      onMove: (_dx, _dy, pointer) => apply(pointer.clientX),
      onEnd: () => setTrimActive(null),
    })
  }

  const togglePlayback = async () => {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) {
      video.pause()
      return
    }
    video.muted = true
    const from =
      video.currentTime < start || video.currentTime >= end ? start : video.currentTime
    video.currentTime = from
    setCurrentTime(from)
    syncPlayClock(from)
    try {
      await video.play()
    } catch {
      playClockRef.current = null
      setError("Could not play the recording.")
    }
  }

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

  const startPct = `${ratio(start) * 100}%`
  const endPct = `${ratio(end) * 100}%`
  const hoverPct = hoverTime === null ? null : `${ratio(hoverTime) * 100}%`

  return (
    <section
      className={cn(
        "mesurer-menu-surface msr:overflow-hidden msr:rounded-wide-card msr:bg-white msr:shadow-floating",
        expanded ? "msr:w-[min(36rem,calc(100vw-24px))]" : "msr:w-[min(22rem,calc(100vw-24px))]",
      )}
      aria-label="Screen recording editor"
      aria-busy={exporting}
      onMouseLeave={tooltip.onToolbarLeave}
    >
      <div className="msr:relative msr:p-2">
        <div className="msr:relative msr:flex msr:w-full msr:justify-center msr:overflow-hidden msr:rounded-control msr:bg-ink-100">
          <div className="msr:absolute msr:top-1.5 msr:right-1.5 msr:z-10">
            <PlayerIconButton
              label="Close"
              tooltipId="recording-close"
              tooltip={tooltip}
              onClick={onDiscard}
            >
              <CloseIcon size={12} />
            </PlayerIconButton>
          </div>
          <video
            ref={videoRef}
            className={expanded
              ? "msr:block msr:h-auto msr:max-h-[min(28rem,calc(100vh-12rem))] msr:w-auto msr:max-w-full msr:object-contain"
              : "msr:block msr:h-auto msr:max-h-36 msr:w-auto msr:max-w-full msr:object-contain"}
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
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => {
              if (!event.currentTarget.paused) return
              setCurrentTime(event.currentTarget.currentTime)
            }}
            onEnded={() => setCurrentTime(start)}
          />
          {exporting ? (
            <div className="msr:absolute msr:inset-0 msr:z-30 msr:flex msr:items-center msr:justify-center msr:bg-ink-900/45 msr:text-[11px] msr:text-white">
              <StatusEllipsis label="Exporting" />
            </div>
          ) : null}
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
                playing || trimActive === "playhead" ? "msr:h-3" : "msr:h-2.5",
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
              onNudge={updateStart}
            />
            <TrimHandle
              label="Trim end"
              value={end}
              min={Math.min(duration, start + MIN_CLIP_SECONDS)}
              max={duration}
              active={trimActive === "end"}
              style={{ left: endPct }}
              onPointerDown={(event) => beginDrag("end", event, timeAtTrack)}
              onNudge={updateEnd}
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
                visible={tooltip.visibleTooltipId === "recording-export"}
                instant={tooltip.tooltipInstant}
                side="top"
                anchorRef={exportScaleAnchorRef}
              />
            </div>
            {exportMenuOpen ? (
              <div className="msr:absolute msr:right-0 msr:bottom-full msr:z-30 msr:mb-1">
                <MenuSurface className="msr:w-max msr:min-w-44">
                  <p className="msr:px-2 msr:py-1 msr:text-[10px] msr:font-medium msr:text-ink-500">Format</p>
                  {formats.map((item) => (
                    <MenuItem
                      key={item}
                      variant="neutral"
                      className="msr:gap-2"
                      onClick={() => {
                        setFormat(item)
                        setExportMenuOpen(false)
                      }}
                    >
                      <CheckIcon
                        size={10}
                        className={item === format ? "msr:opacity-100" : "msr:opacity-0"}
                      />
                      {FORMAT_LABEL[item]}
                    </MenuItem>
                  ))}
                  <p className="msr:px-2 msr:pt-1.5 msr:pb-1 msr:text-[10px] msr:font-medium msr:text-ink-500">Size</p>
                  {SCALE_OPTIONS.map((item) => (
                    <MenuItem
                      key={item}
                      variant="neutral"
                      className="msr:gap-2"
                      onClick={() => {
                        setScale(item)
                        setExportMenuOpen(false)
                      }}
                    >
                      <CheckIcon
                        size={10}
                        className={item === scale ? "msr:opacity-100" : "msr:opacity-0"}
                      />
                      {scaleLabel(item, frameSize)}
                    </MenuItem>
                  ))}
                </MenuSurface>
              </div>
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

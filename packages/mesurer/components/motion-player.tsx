import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { controlMotion, formatMotionTime, motionDuration, readMotionDetails, scrubMotion, type MotionDetails } from "../core/motion"
import { useFloatingSurfacePlacement } from "../hooks/use-floating-surface-placement"
import { useToolbarTooltip } from "../hooks/use-toolbar-tooltip"
import { FloatingSurface } from "./menu"
import { SettingsButton } from "./settings-button"
import { Tooltip, useTooltip } from "./tooltip"
import { GearIcon } from "./icons"
import { SettingsSwitch } from "./settings-panel"
import { InspectDetailRow } from "./inspect-detail-row"

const PlayIcon = () => <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><path d="M1.4.6v6.8L7.2 4z" /></svg>
const PauseIcon = () => <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><rect x="1.4" y="1" width="1.8" height="6" rx="0.2" /><rect x="4.8" y="1" width="1.8" height="6" rx="0.2" /></svg>

const timestamp = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function MotionSettingsCard({ motions, ownerWindow, showCssCard, onShowCssCard }: {
  motions: MotionDetails[]
  ownerWindow: Window
  showCssCard: boolean
  onShowCssCard: (show: boolean) => void
}) {
  const tooltip = useTooltip()
  const copyValue = (value: string) => {
    void ownerWindow.navigator.clipboard?.writeText(value)
  }
  const detailRow = (label: string, value: string, id: string) => (
    <InspectDetailRow label={label} value={value} id={id} onCopy={() => copyValue(value)} tooltip={tooltip} />
  )

  return (
    <div className="msr:w-60 msr:max-w-[min(100vw-16px,15rem)] msr:py-2 msr:text-[10px] msr:text-ink-900">
      <div className="msr:px-3">
        <SettingsSwitch label="Show CSS card" checked={showCssCard} onChange={onShowCssCard} />
      </div>
      <div className="msr:mt-2 msr:px-2">
        <div className="msr:mb-1 msr:font-semibold msr:text-ink-500">Motion</div>
        {motions.map((motion, index) => (
          <div key={`${motion.kind}-${motion.name}-${index}`} className="msr:flex msr:flex-col msr:gap-0.5 msr:pb-2 last:pb-0">
            {detailRow("Name", motion.name, `${index}-name`)}
            {detailRow("Type", motion.kind, `${index}-type`)}
            {detailRow("Duration", formatMotionTime(motion.duration), `${index}-duration`)}
            {detailRow("Delay", formatMotionTime(motion.delay), `${index}-delay`)}
            {detailRow("Easing", motion.easing, `${index}-easing`)}
            {detailRow("Iterations", motion.iterationCount, `${index}-iterations`)}
            {detailRow("Direction", motion.direction, `${index}-direction`)}
            {detailRow("Fill", motion.fillMode, `${index}-fill`)}
            {detailRow("Properties", motion.properties.join(", ") || "unknown", `${index}-properties`)}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MotionPlayer({ element, ownerWindow, showCssCard, onShowCssCard, refreshKey }: { element: Element | null | undefined; ownerWindow: Window | null; showCssCard: boolean; onShowCssCard: (show: boolean) => void; refreshKey: string }) {
  const playerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const playAnchorRef = useRef<HTMLDivElement>(null)
  const speedAnchorRef = useRef<HTMLDivElement>(null)
  const settingsAnchorRef = useRef<HTMLDivElement>(null)
  const tooltip = useToolbarTooltip()
  const [duration, setDuration] = useState(0)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [motions, setMotions] = useState<MotionDetails[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { surfaceRef: settingsRef, placement: settingsPlacement } = useFloatingSurfacePlacement({
    anchorRef: playerRef,
    eventTarget: ownerWindow ?? window,
    open: settingsOpen,
    align: "left",
    gap: 4,
    side: "bottom",
    refreshKey,
  })

  useEffect(() => {
    setProgress(0)
    setPlaying(false)
    if (!element || !ownerWindow) {
      setReady(false)
      setDuration(0)
      setMotions([])
      setSettingsOpen(false)
      return
    }
    const refresh = () => {
      const motions = readMotionDetails(element, ownerWindow)
      const nextDuration = Math.max(0, ...motions.map(motionDuration))
      setReady(motions.length > 0 && nextDuration > 0)
      setDuration(nextDuration)
      setMotions(motions)
    }
    refresh()
    const frame = ownerWindow.requestAnimationFrame(refresh)
    return () => ownerWindow.cancelAnimationFrame(frame)
  }, [element, ownerWindow])

  useEffect(() => {
    if (!element || !ownerWindow || !ready) return
    let frame = 0
    const update = () => {
      const animation = element.getAnimations()[0]
      const currentTime = animation?.currentTime
      if (typeof currentTime === "number" && duration > 0) {
        setProgress(Math.max(0, Math.min(1, currentTime / duration)))
        setPlaying(animation.playState === "running")
      }
      frame = ownerWindow.requestAnimationFrame(update)
    }
    frame = ownerWindow.requestAnimationFrame(update)
    return () => ownerWindow.cancelAnimationFrame(frame)
  }, [duration, element, ownerWindow, ready])

  if (!element || !ownerWindow || !ready) return null
  const scrubAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    const next = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    setProgress(next)
    scrubMotion(element, next, duration)
  }

  const togglePlay = () => {
    const action = playing ? "pause" : "play"
    controlMotion(element, action, speed)
    setPlaying(action === "play")
  }

  const playLabel = playing ? "Pause" : "Play"

  const bindTooltip = (id: string) => ({
    onMouseEnter: () => tooltip.onTooltipEnter(id),
    onMouseLeave: () => tooltip.onTooltipLeave(id),
    onFocus: () => tooltip.onTooltipEnter(id),
    onBlur: () => tooltip.onTooltipLeave(id),
  })

  return (
    <div
      ref={playerRef}
      data-mesurer-motion-player
      aria-label="Motion playback"
      className="msr:flex msr:h-9 msr:w-72 msr:max-w-[calc(100vw-16px)] msr:items-center msr:gap-1.5 msr:px-2"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onMouseLeave={tooltip.onToolbarLeave}
    >
      <div ref={playAnchorRef} className="msr:relative msr:flex msr:size-5 msr:shrink-0 msr:items-center msr:justify-center" {...bindTooltip("motion-play")}>
        <SettingsButton shape="icon" variant="ghost" type="button" aria-label={playLabel} aria-pressed={playing} className="msr:size-5" onClick={togglePlay}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </SettingsButton>
        <Tooltip label={playLabel} visible={tooltip.visibleTooltipId === "motion-play"} instant={tooltip.tooltipInstant} side="top" anchorRef={playAnchorRef} />
      </div>
      <span className="msr:flex msr:h-5 msr:w-8 msr:shrink-0 msr:items-center msr:font-mono msr:text-[10px] msr:leading-none msr:tabular-nums msr:text-ink-500">{timestamp(progress * duration)}</span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Scrub motion timeline"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={progress * duration}
        className="mesurer-recording-timeline msr:relative msr:h-5 msr:min-w-0 msr:flex-1 msr:select-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          scrubAt(event.clientX)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) scrubAt(event.clientX)
        }}
        onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
          event.preventDefault()
          scrubAt((trackRef.current?.getBoundingClientRect().left ?? 0) + (progress + (event.key === "ArrowRight" ? 0.02 : -0.02)) * (trackRef.current?.getBoundingClientRect().width ?? 0))
        }}
      >
        <div className="mesurer-recording-track-rail msr:absolute msr:inset-x-0 msr:top-1/2 msr:h-[3px] msr:-translate-y-1/2 msr:rounded-full msr:bg-ink-200" />
        <div className="mesurer-recording-playhead msr:pointer-events-none msr:absolute msr:left-0 msr:top-1/2 msr:z-[2] msr:h-2 msr:w-0.5 msr:-translate-y-1/2 msr:rounded-full msr:bg-ink-900" style={{ left: `${progress * 100}%` }} />
      </div>
      <span className="msr:flex msr:h-5 msr:w-8 msr:shrink-0 msr:items-center msr:justify-end msr:font-mono msr:text-[10px] msr:leading-none msr:tabular-nums msr:text-ink-500">{timestamp(duration)}</span>
      <div ref={speedAnchorRef} className="msr:relative msr:flex msr:h-5 msr:shrink-0 msr:items-center" {...bindTooltip("motion-speed")}>
        <select
          aria-label="Playback speed"
          value={speed}
          onChange={(event) => {
            const next = Number(event.target.value)
            setSpeed(next)
            controlMotion(element, playing ? "play" : "pause", next)
          }}
          className="msr:h-5 msr:rounded msr:border-0 msr:bg-transparent msr:px-0.5 msr:font-mono msr:text-[10px] msr:text-ink-500 msr:outline-none msr:focus-visible:shadow-[0_0_0_1px_var(--msr-color-ink-700)]"
        >
          {[0.25, 0.5, 1].map((value) => <option key={value} value={value}>{value}x</option>)}
        </select>
        <Tooltip label="Speed" visible={tooltip.visibleTooltipId === "motion-speed"} instant={tooltip.tooltipInstant} side="top" anchorRef={speedAnchorRef} />
      </div>
      <div ref={settingsAnchorRef} className="msr:relative msr:flex msr:size-5 msr:shrink-0 msr:items-center msr:justify-center" {...bindTooltip("motion-settings")}>
        <SettingsButton shape="icon" variant="ghost" type="button" aria-label="Motion settings" aria-expanded={settingsOpen} className="msr:size-5" onClick={() => setSettingsOpen((open) => !open)}>
          <GearIcon size={10} strokePx={1.25} />
        </SettingsButton>
        <Tooltip label="Motion settings" visible={tooltip.visibleTooltipId === "motion-settings"} instant={tooltip.tooltipInstant} side="top" anchorRef={settingsAnchorRef} />
      </div>
      {settingsOpen
        ? createPortal(
            <FloatingSurface
              ref={settingsRef}
              className="msr:pointer-events-auto msr:fixed msr:z-[120]"
              style={{ top: settingsPlacement.top, bottom: settingsPlacement.bottom, left: settingsPlacement.left, right: settingsPlacement.right, zIndex: 120 }}
              aria-label="Motion settings"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <MotionSettingsCard motions={motions} ownerWindow={ownerWindow} showCssCard={showCssCard} onShowCssCard={onShowCssCard} />
            </FloatingSurface>,
            playerRef.current?.closest("[data-mesurer-root]") ?? ownerWindow.document.body,
          )
        : null}
    </div>
  )
}

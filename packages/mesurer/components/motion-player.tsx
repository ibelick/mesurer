import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { controlMotion, formatMotionTime, motionDuration, motionPlaybackProgress, readMotionDetails, scrubMotion, type MotionDetails } from "../core/motion"
import { useToolbarTooltip } from "../hooks/use-toolbar-tooltip"
import { Tooltip, useTooltip } from "./tooltip"
import { FloatingSurface } from "./menu"
import { SliderControl } from "./slider-control"
import { InspectDetailRow } from "./inspect-detail-row"
import { MotionPreview } from "./motion-preview"
import { PlayerIconButton, PlayIcon, PauseIcon } from "./screen-recording-editor"
import { playerCardClassName, playerPreviewClassName, playerControlsClassName } from "./player-layout"
import { addMesurerCaptureListener } from "../core/keyboard-gate"
import { CloseIcon } from "./icons"
import { SettingsButton } from "./settings-button"


const SPEED_PRESETS = [0.25, 0.5, 1]

const timestamp = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function MotionValues({ motions, ownerWindow, element }: {
  motions: MotionDetails[]
  ownerWindow: Window
  element: Element
}) {
  const tooltip = useTooltip()
  const style = ownerWindow.getComputedStyle(element)
  const copyValue = (value: string) => {
    void ownerWindow.navigator.clipboard?.writeText(value).catch(() => {})
  }

  return (
    <div className="msr:w-full msr:pt-2 msr:text-[10px] msr:text-ink-900">
      <div className="msr:flex msr:flex-col msr:gap-0.5 msr:px-2">
        {motions.map((motion, index) => (
          <div key={`${motion.kind}-${motion.name}-${index}`} className="msr:flex msr:flex-col msr:gap-0.5">
            {[
              [motion.kind === "animation" ? "animation-name" : "transition-property", motion.name],
              [`${motion.kind}-duration`, formatMotionTime(motion.duration)],
              [`${motion.kind}-delay`, formatMotionTime(motion.delay)],
              [`${motion.kind}-timing-function`, motion.easing],
              ...(motion.kind === "animation" ? [
                ["animation-iteration-count", motion.iterationCount],
                ["animation-direction", motion.direction],
                ["animation-fill-mode", motion.fillMode],
                ["animation-play-state", motion.animation?.playState === "paused" ? "paused" : style.animationPlayState],
                ["animated properties", motion.properties.map((property) => property.startsWith("--") ? property : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)).join(", ") || "unknown"],
              ] : []),
              ...((motion.kind === "animation" ? ["animation-composition", "animation-timeline", "animation-range-start", "animation-range-end"] : ["transition-behavior"])
                .map((property) => [property, style.getPropertyValue(property)])
                .filter(([, value]) => value)),
            ].map(([label, value]) => (
              <InspectDetailRow key={label} label={label} value={value} id={`${index}-${label}`} onCopy={() => copyValue(value)} tooltip={tooltip} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MotionPlayer({ element, ownerWindow, inspectDetails }: { element: Element | null | undefined; ownerWindow: Window | null; inspectDetails?: (motionDetails: ReactNode) => ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const speedAnchorRef = useRef<HTMLDivElement>(null)
  const customSpeedRef = useRef<HTMLDivElement>(null)
  const customSpeedId = useId()
  const inspectId = useId()
  const tooltip = useToolbarTooltip()
  const [duration, setDuration] = useState(0)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [customSpeedOpen, setCustomSpeedOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [motions, setMotions] = useState<MotionDetails[]>([])
  const [inspectOpen, setInspectOpen] = useState(false)

  useEffect(() => {
    setProgress(0)
    setPlaying(false)
    setInspectOpen(false)
    setCustomSpeedOpen(false)
    if (!element || !ownerWindow) {
      setReady(false)
      setDuration(0)
      setMotions([])
      return
    }
    setSpeed(element.getAnimations()[0]?.playbackRate ?? 1)
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
    if (!customSpeedOpen) return
    const view = speedAnchorRef.current?.ownerDocument.defaultView
    if (!view) return
    const input = customSpeedRef.current?.querySelector("input")
    input?.focus({ preventScroll: true })
    input?.select()
    const dismiss = (event: Event) => {
      if (event.type === "keydown") {
        if ((event as KeyboardEvent).key !== "Escape") return
        event.preventDefault()
        event.stopPropagation()
        speedAnchorRef.current?.querySelector("select")?.focus({ preventScroll: true })
      } else if (event.composedPath().includes(speedAnchorRef.current as EventTarget)) return
      setCustomSpeedOpen(false)
    }
    const events = ["pointerdown", "focusin", "keydown"]
    const detach = events.map((type) => addMesurerCaptureListener(view, view, type, dismiss))
    return () => {
      detach.forEach((remove) => remove())
    }
  }, [customSpeedOpen])

  useEffect(() => {
    if (!element || !ownerWindow || !ready) return
    let frame = 0
    const update = () => {
      const animation = element.getAnimations()[0]
      if (animation) setProgress(motionPlaybackProgress(animation, duration))
      setPlaying(animation?.playState === "running")
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
  const changeSpeed = (next: number) => {
    setSpeed(next)
    controlMotion(element, playing ? "play" : "pause", next)
  }

  const bindTooltip = (id: string) => ({
    onMouseEnter: () => tooltip.onTooltipEnter(id),
    onMouseLeave: () => tooltip.onTooltipLeave(id),
    onFocus: () => tooltip.onTooltipEnter(id),
    onBlur: () => tooltip.onTooltipLeave(id),
  })

  return (
    <div
      data-mesurer-motion-player
      aria-label="Motion playback"
      className={`${playerCardClassName} msr:w-full`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onMouseLeave={tooltip.onToolbarLeave}
    >
      <div className="msr:relative msr:p-2">
        <div className={playerPreviewClassName} onClick={togglePlay}>
          <MotionPreview element={element} ownerWindow={ownerWindow} />
        </div>
        <div className={playerControlsClassName}>
        <PlayerIconButton label={playLabel} tooltipId="motion-play" tooltip={tooltip} pressed={playing} onClick={togglePlay}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </PlayerIconButton>
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
          aria-controls={customSpeedOpen ? customSpeedId : undefined}
          value={speed}
          onChange={(event) => {
            if (event.target.value === "custom") {
              tooltip.onToolbarLeave()
              setCustomSpeedOpen(true)
              return
            }
            setCustomSpeedOpen(false)
            changeSpeed(Number(event.target.value))
          }}
          className="msr:h-5 msr:w-[5ch] msr:appearance-none msr:rounded msr:border-0 msr:bg-transparent msr:p-0 msr:text-center msr:font-mono msr:text-[10px] msr:tabular-nums msr:text-ink-500 msr:outline-none msr:focus:outline-none msr:focus-visible:outline-none msr:focus-visible:shadow-none"
        >
          {SPEED_PRESETS.map((value) => <option key={value} value={value}>{value}x</option>)}
          {!SPEED_PRESETS.includes(speed) ? <option value={speed}>{speed}x</option> : null}
          <option value="custom">Custom</option>
        </select>
        <Tooltip label="Speed" visible={!customSpeedOpen && tooltip.visibleTooltipId === "motion-speed"} instant={tooltip.tooltipInstant} side="top" anchorRef={speedAnchorRef} />
        {customSpeedOpen ? (
          <FloatingSurface
            ref={customSpeedRef}
            id={customSpeedId}
            role="dialog"
            aria-label="Custom playback speed"
            className="msr:absolute msr:right-0 msr:top-full msr:z-[120] msr:mt-1 msr:flex msr:w-[208px] msr:max-w-[calc(100vw-16px)] msr:items-center msr:gap-1 msr:p-1"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="msr:min-w-0 msr:flex-1">
              <SliderControl label="Speed" showLabel={false} min={0.1} max={4} step={0.05} value={speed} onChange={changeSpeed} formatValue={(value) => `${value}x`} parseInput={(input) => Number.parseFloat(input)} />
            </div>
            <SettingsButton shape="icon" variant="ghost" type="button" aria-label="Close custom speed" onClick={() => {
              setCustomSpeedOpen(false)
              speedAnchorRef.current?.querySelector("select")?.focus({ preventScroll: true })
            }}>
              <CloseIcon size={10} />
            </SettingsButton>
          </FloatingSurface>
        ) : null}
      </div>
        <PlayerIconButton label={inspectOpen ? "Hide Inspect" : "Show Inspect"} tooltipId="motion-inspect" tooltip={tooltip} expanded={inspectOpen} controls={inspectId} onClick={() => setInspectOpen((open) => !open)}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M3.25 2.5.75 5l2.5 2.5m3.5-5L9.25 5l-2.5 2.5M5.75 1.5l-1.5 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </PlayerIconButton>
        </div>
      </div>
      <div id={inspectId} hidden={!inspectOpen}>
        {inspectOpen ? (
          <div className="mesurer-thin-scrollbar msr:max-h-[50vh] msr:overflow-y-auto">
            {inspectDetails
              ? inspectDetails(<MotionValues motions={motions} ownerWindow={ownerWindow} element={element} />)
              : <MotionValues motions={motions} ownerWindow={ownerWindow} element={element} />}
          </div>
        ) : null}
      </div>
    </div>
  )
}

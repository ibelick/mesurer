import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"
import { controlMotion, getMotionAnimations, motionCssProperty, motionDuration, motionPlaybackState, readMotionDetails, readMotionKeyframes, scrubMotion, type MotionDetails } from "../core/motion"
import { useToolbarTooltip } from "../hooks/use-toolbar-tooltip"
import { Tooltip, useTooltip } from "./tooltip"
import { FloatingSurface } from "./menu"
import { SliderControl } from "./slider-control"
import { MotionPreview } from "./motion-preview"
import { PlayerIconButton, PlayIcon, PauseIcon } from "./screen-recording-editor"
import { playerCardClassName, playerPreviewClassName, playerControlsClassName } from "./player-layout"
import { addMesurerCaptureListener } from "../core/keyboard-gate"
import { CloseIcon } from "./icons"
import { SettingsButton } from "./settings-button"
import { InspectDetailRow } from "./inspect-detail-row"
import { CopyableValue } from "./copyable-value"
import type { ObservedMotionTarget } from "../core/observed-motion"


const SPEED_PRESETS = [0.25, 0.5, 1]

const timestamp = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function MotionValues({ motions, ownerWindow, element, observedProperties }: {
  motions: MotionDetails[]
  ownerWindow: Window
  element: Element
  observedProperties: string[]
}) {
  const tooltip = useTooltip()
  const [keyframesExpanded, setKeyframesExpanded] = useState(false)
  const keyframesId = useId()
  const keyframes = useMemo(() => motions.filter((motion) => motion.kind !== "transition")
    .map((motion) => ({ name: motion.name, cssName: motion.kind === "web-animation" ? CSS.escape(motion.name) : motion.name, frames: readMotionKeyframes(motion.animation, motion.easing) }))
    .filter(({ frames }) => frames.length > 0), [motions])
  const frameGroups = useMemo(() => keyframes.map(({ name, frames }) => {
    const groups = new Map<string, { offsets: string[]; displayValue: string }>()
    for (const { offset, value, displayValue } of frames) {
      const group = groups.get(value)
      if (group) group.offsets.push(offset)
      else groups.set(value, { offsets: [offset], displayValue })
    }
    return { name, frames: [...groups].map(([value, group]) => ({ value, ...group })) }
  }), [keyframes])
  const keyframeBlocks = keyframes.map(({ cssName, frames }) => `@keyframes ${cssName} {\n${frames.map(({ offset, value }) => `  ${offset} { ${value} }`).join("\n")}\n}`)
  const keyframesCss = keyframeBlocks.join("\n\n")
  const style = ownerWindow.getComputedStyle(element)
  const copyValue = (value: string) => {
    void ownerWindow.navigator.clipboard?.writeText(value).catch(() => {})
  }
  const animations = motions.filter((motion) => motion.kind === "animation")
  const transitions = motions.filter((motion) => motion.kind === "transition")
  const webAnimations = motions.filter((motion) => motion.kind === "web-animation")
  const time = (milliseconds: number) => `${milliseconds / 1000}s`
  const shorthands = [animations, transitions, webAnimations].map((group, groupIndex) => [
    ["animation", "transition", "web animation"][groupIndex],
    group.map((motion) => [
      motion.name, time(motion.duration), motion.easing, motion.delay ? time(motion.delay) : "",
      ...(motion.kind !== "transition" ? [
        motion.iterationCount !== "1" ? motion.iterationCount : "",
        motion.direction !== "normal" ? motion.direction : "",
        motion.fillMode !== "none" ? motion.fillMode : "",
        motion.animation?.playState === "paused" ? "paused" : "",
      ] : []),
    ].filter(Boolean).join(" ")).join(",\n"),
  ])
  const properties = [...new Set(motions.flatMap((motion) => motion.properties))]
    .map(motionCssProperty)
    .join(", ")
  const extras = [
    "animation-composition", "animation-timeline", "animation-range-start", "animation-range-end", "transition-behavior",
    ...(properties.includes("transform") ? ["transform-origin"] : []),
    ...(style.perspective !== "none" ? ["perspective", "perspective-origin"] : []),
  ].map((label) => [label, style.getPropertyValue(label).trim()])
    .filter(([, value]) => value && !/^(auto|normal|replace)(,\s*\1)*$/.test(value))

  return (
    <div className="msr:w-full msr:pt-2 msr:text-[10px] msr:text-ink-900">
      <div className="msr:flex msr:flex-col msr:gap-0.5 msr:px-2">
        {[...shorthands, ["animated properties", properties], ...(observedProperties.length ? [["observed motion", observedProperties.join(", ")], ["playback", "Observed motion is read-only"]] : []), ...extras].filter(([, value]) => value).map(([label, value]) => (
          <InspectDetailRow key={label} label={label} value={value} id={`motion-${label}`} onCopy={() => copyValue(label === "animation" || label === "transition" || extras.some(([property]) => property === label) ? `${label}: ${value};` : value)} tooltip={tooltip} valueClassName="msr:min-w-0 msr:whitespace-pre-wrap msr:break-words msr:text-right msr:tabular-nums msr:text-ink-900 msr:hover:underline" />
        ))}
        {keyframes.length > 0 ? <>
          {!keyframesExpanded ? keyframes.map(({ name, frames }, index) => (
            <div key={`${name}-${index}`} className="msr:grid msr:grid-cols-[3.5rem_minmax(0,1fr)] msr:items-baseline msr:gap-2">
              <span className="msr:text-ink-500">{index === 0 ? "keyframes" : ""}</span>
              <CopyableValue id={`motion-keyframes-${index}`} value={`${name}: ${frames.map(({ offset }) => offset).join(", ")}`} onCopy={() => copyValue(keyframesCss)} tooltip={tooltip} className="msr:w-full msr:min-w-0 msr:whitespace-pre-wrap msr:break-words msr:text-right msr:tabular-nums msr:text-ink-900 msr:hover:underline" />
            </div>
          )) : null}
          <div id={keyframesId} hidden={!keyframesExpanded}>
            {keyframesExpanded ? frameGroups.map(({ name, frames }, index) => (
              <div key={`${name}-${index}`} className="msr:mt-1 msr:flex msr:flex-col msr:gap-1">
                <div className="msr:grid msr:grid-cols-[auto_minmax(0,1fr)] msr:items-baseline msr:gap-2">
                  <span className="msr:text-ink-500">{index === 0 ? "keyframes" : ""}</span>
                  <CopyableValue id={`keyframe-name-${index}`} value={name} onCopy={() => copyValue(keyframeBlocks[index])} tooltip={tooltip} className="msr:w-full msr:min-w-0 msr:truncate msr:text-right msr:text-ink-900 msr:hover:underline" />
                </div>
                {frames.map(({ offsets, value, displayValue }, frameIndex) => (
                  <div key={frameIndex} className="msr:grid msr:grid-cols-[3.5rem_minmax(0,1fr)] msr:items-baseline msr:gap-2">
                    <span className="msr:text-ink-500 msr:tabular-nums">{offsets.join(", ")}</span>
                    <CopyableValue id={`keyframe-${index}-${frameIndex}`} value={displayValue || "underlying style"} onCopy={() => copyValue(`${offsets.join(", ")} { ${value} }`)} tooltip={tooltip} className="msr:w-full msr:min-w-0 msr:whitespace-pre-wrap msr:break-words msr:text-right msr:tabular-nums msr:text-ink-900 msr:hover:underline" />
                  </div>
                ))}
              </div>
            )) : null}
          </div>
          <SettingsButton variant="ghost" className="msr:self-end msr:text-[10px] msr:hover:bg-transparent msr:focus-visible:outline-auto" style={{ padding: 0, border: 0, height: "auto", background: "transparent", textDecoration: "underline", textUnderlineOffset: "2px" }} aria-expanded={keyframesExpanded} aria-controls={keyframesId} onClick={() => setKeyframesExpanded((expanded) => !expanded)}>
            {keyframesExpanded ? "Hide keyframes" : "Show keyframes"}
          </SettingsButton>
        </> : null}
      </div>
    </div>
  )
}

export function MotionPlayer({ element, ownerWindow, observedProperties, observedTargets, inspectDetails }: { element: Element | null | undefined; ownerWindow: Window | null; observedProperties: string[]; observedTargets: ObservedMotionTarget[]; inspectDetails?: (motionDetails: ReactNode) => ReactNode }) {
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
  const controllable = duration > 0 && motions.some((motion) => motion.animation)
  const observedOnly = observedProperties.length > 0 && !controllable

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
    setSpeed(getMotionAnimations(element)[0]?.playbackRate ?? 1)
    const refresh = () => {
      const motions = readMotionDetails(element, ownerWindow)
      const nextDuration = Math.max(0, ...motions.map(motionDuration))
      setReady(motions.length > 0)
      setDuration(nextDuration)
      setMotions(motions)
    }
    refresh()
    const interval = ownerWindow.setInterval(refresh, 250)
    return () => ownerWindow.clearInterval(interval)
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
    let timer = 0
    const update = () => {
      const playback = motionPlaybackState(getMotionAnimations(element), duration)
      setProgress(playback.progress)
      setPlaying(playback.playing)
      timer = ownerWindow.setTimeout(update, playback.playing ? 1000 / 30 : 250)
    }
    update()
    return () => ownerWindow.clearTimeout(timer)
  }, [duration, element, ownerWindow, ready])

  if (!element || !ownerWindow || (!ready && observedProperties.length === 0)) return null
  const scrubAt = (clientX: number) => {
    if (!controllable) return
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    const next = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    setProgress(next)
    scrubMotion(element, next, duration)
  }

  const togglePlay = () => {
    if (!controllable) return
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
        <div className={playerPreviewClassName} onClick={controllable ? togglePlay : undefined}>
          <MotionPreview element={element} ownerWindow={ownerWindow} observedTargets={observedTargets} />
        </div>
        <div className={playerControlsClassName}>
         {observedOnly ? (
          <div
            role="status"
            aria-label="JavaScript animation. Controls unavailable."
            className="msr:flex msr:h-5 msr:min-w-0 msr:flex-1 msr:items-center msr:truncate msr:font-mono msr:text-[10px] msr:leading-none msr:text-ink-500"
          >
           JavaScript animation. Controls unavailable.
          </div>
         ) : null}
         {!observedOnly ? <>
          <PlayerIconButton label={playLabel} tooltipId="motion-play" tooltip={tooltip} pressed={playing} disabled={!controllable} onClick={togglePlay}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </PlayerIconButton>
      <span className="msr:flex msr:h-5 msr:w-8 msr:shrink-0 msr:items-center msr:font-mono msr:text-[10px] msr:leading-none msr:tabular-nums msr:text-ink-500">{controllable ? timestamp(progress * duration) : "—"}</span>
      <div
        ref={trackRef}
        role="slider"
         tabIndex={controllable ? 0 : -1}
         aria-disabled={!controllable}
        aria-label="Scrub motion timeline"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={progress * duration}
        aria-valuetext={controllable ? `${Math.round(progress * 100)}%` : "Playback unavailable"}
        className="mesurer-recording-timeline msr:relative msr:h-5 msr:min-w-0 msr:flex-1 msr:select-none"
         onPointerDown={(event) => {
           if (!controllable) return
          event.currentTarget.setPointerCapture(event.pointerId)
          scrubAt(event.clientX)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) scrubAt(event.clientX)
        }}
        onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
        onKeyDown={(event) => {
          if (event.key === "Home" || event.key === "End") {
            event.preventDefault()
            if (controllable) scrubMotion(element, event.key === "Home" ? 0 : 1, duration)
            return
          }
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
          event.preventDefault()
          scrubAt((trackRef.current?.getBoundingClientRect().left ?? 0) + (progress + (event.key === "ArrowRight" ? 0.02 : -0.02)) * (trackRef.current?.getBoundingClientRect().width ?? 0))
        }}
      >
        <div className="mesurer-recording-track-rail msr:absolute msr:inset-x-0 msr:top-1/2 msr:h-[3px] msr:-translate-y-1/2 msr:rounded-full msr:bg-ink-200" />
        <div className="mesurer-recording-playhead msr:pointer-events-none msr:absolute msr:left-0 msr:top-1/2 msr:z-[2] msr:h-2 msr:w-0.5 msr:-translate-y-1/2 msr:rounded-full msr:bg-ink-900" style={{ left: `${progress * 100}%` }} />
          </div>
       <span className="msr:flex msr:h-5 msr:w-8 msr:shrink-0 msr:items-center msr:justify-end msr:font-mono msr:text-[10px] msr:leading-none msr:tabular-nums msr:text-ink-500">{controllable ? timestamp(duration) : "—"}</span>
      <div ref={speedAnchorRef} className="msr:relative msr:flex msr:h-5 msr:shrink-0 msr:items-center" {...bindTooltip("motion-speed")}>
        <select
         aria-label="Playback speed"
          disabled={!controllable}
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
          className="mesurer-settings-button-ghost msr:h-5 msr:w-[5ch] msr:appearance-none msr:rounded-control msr:border msr:border-transparent msr:bg-transparent msr:p-0 msr:text-center msr:font-mono msr:text-[10px] msr:tabular-nums msr:text-ink-500 msr:hover:bg-black/4 msr:hover:text-ink-900 msr:focus-visible:bg-black/4 msr:outline-none msr:focus:outline-none msr:focus-visible:outline-none msr:focus:shadow-none msr:focus-visible:shadow-none"
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
         </> : null}
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
              ? inspectDetails(<MotionValues motions={motions} ownerWindow={ownerWindow} element={element} observedProperties={observedProperties} />)
              : <MotionValues motions={motions} ownerWindow={ownerWindow} element={element} observedProperties={observedProperties} />}
          </div>
        ) : null}
      </div>
    </div>
  )
}

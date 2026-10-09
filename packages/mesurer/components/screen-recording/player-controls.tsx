import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { cn } from "../../core/utils"
import { useToolbarTooltip } from "../../hooks/use-toolbar-tooltip"
import { SettingsButton } from "../settings-button"
import { Tooltip } from "../tooltip"

export type DragKind = "start" | "end" | "playhead"

export const TIMELINE_BAR_MOTION = "msr:transition-[height] msr:duration-300 msr:ease-[cubic-bezier(0.22,1,0.36,1)]"

export const timestamp = (value: number) => {
  const seconds = Math.max(0, Math.floor(value))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

export const PlayIcon = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true" className="msr:block">
    <path d="M1.4.6v6.8L7.2 4z" />
  </svg>
)

export const PauseIcon = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true" className="msr:block">
    <rect x="1.4" y="1" width="1.8" height="6" rx="0.2" />
    <rect x="4.8" y="1" width="1.8" height="6" rx="0.2" />
  </svg>
)

export const ExpandIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="msr:block">
    <path d="M1.5 3.5V1.5H3.5M6.5 1.5H8.5V3.5M8.5 6.5V8.5H6.5M3.5 8.5H1.5V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
  </svg>
)

export const CollapseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="msr:block">
    <path d="M3.5 1.5V3.5H1.5M8.5 3.5H6.5V1.5M6.5 8.5V6.5H8.5M1.5 6.5H3.5V8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
  </svg>
)

export const DownloadIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="msr:block">
    <path d="M5 1.5v5M2.5 4.75 5 7.25 7.5 4.75M1.75 8.5h6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
  </svg>
)

export function PlayerIconButton({
  label,
  tooltipId,
  tooltip,
  pressed,
  expanded,
  controls,
  disabled,
  onClick,
  onPointerDown,
  children,
}: {
  label: string
  tooltipId?: string
  tooltip: ReturnType<typeof useToolbarTooltip>
  pressed?: boolean
  expanded?: boolean
  controls?: string
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
        aria-expanded={expanded}
        aria-controls={controls}
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

export function TrimHandle({
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

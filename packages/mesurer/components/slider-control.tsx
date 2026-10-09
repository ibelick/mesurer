import { useState, type PointerEvent as ReactPointerEvent } from "react"
import { ControlShell, SETTINGS_COLUMNS } from "./control-field"

const roundToTwo = (value: number) => Number(value.toFixed(2))

export function SliderControl({
  label, min, max, step, value, onChange, inputMin = min, showLabel = true,
  formatValue = (currentValue) => String(currentValue),
  parseInput = (input) => Number(input),
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  inputMin?: number
  showLabel?: boolean
  formatValue?: (value: number) => string
  parseInput?: (input: string) => number
}) {
  const thumbSize = 12
  const thumbInset = 8
  const sliderValue = Math.min(max, Math.max(min, value))
  const percentage = ((sliderValue - min) / (max - min)) * 100
  const [draftValue, setDraftValue] = useState(formatValue(value))
  const [editing, setEditing] = useState(false)
  const clampValue = (next: number) => roundToTwo(Math.min(max, Math.max(inputMin, next)))
  const updateValue = (next: number) => {
    setDraftValue(formatValue(next))
    onChange(next)
  }
  const nudge = (direction: number) => updateValue(clampValue(sliderValue + direction * step))
  const commitDraft = () => {
    const parsed = parseInput(draftValue)
    const next = Number.isFinite(parsed) ? clampValue(parsed) : value
    if (Number.isFinite(parsed)) onChange(next)
    setDraftValue(formatValue(next))
    setEditing(false)
  }
  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const usableWidth = Math.max(1, rect.width - thumbInset * 2)
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left - thumbInset) / usableWidth))
    const rawValue = min + ratio * (max - min)
    const steppedValue = Math.round((rawValue - min) / step) * step + min
    updateValue(clampValue(steppedValue))
  }

  return (
    <div className={`msr:col-span-2 msr:grid msr:h-8 msr:w-full msr:min-w-0 ${showLabel ? SETTINGS_COLUMNS : "msr:grid-cols-[minmax(0,1fr)]"} msr:items-center msr:gap-0`}>
      {showLabel ? <span className="msr:text-[11px] msr:font-medium msr:text-ink-700">{label}</span> : null}
      <ControlShell
        left={
          <div
            className="msr:relative msr:min-w-0 msr:flex-1 msr:touch-none msr:select-none msr:px-2"
            style={{ height: 20 }}
            data-slider-container="true"
            onPointerDown={(event) => {
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              updateFromPointer(event)
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event)
            }}
            onPointerUp={(event) => {
              event.stopPropagation()
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={(event) => {
              event.stopPropagation()
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="msr:absolute msr:left-[8px] msr:right-[8px] msr:rounded-full" style={{ top: 8, height: 4, backgroundColor: "var(--msr-slider-track)" }} aria-hidden="true" />
            <div className="msr:absolute msr:left-[8px] msr:rounded-full" style={{ top: 8, width: `calc(${percentage}% - ${percentage * thumbInset * 2 / 100}px)`, height: 4, backgroundColor: "var(--msr-accent)" }} aria-hidden="true" />
            <div
              className="mesurer-control-thumb msr:absolute msr:rounded-control msr:bg-surface msr:shadow-[0_1px_2px_rgb(0_0_0_/_0.06)] msr:transition-shadow msr:outline-none msr:focus-visible:ring-1 msr:focus-visible:ring-[var(--msr-accent)]/25"
              style={{ left: `calc(8px + (100% - 16px) * ${percentage / 100})`, top: 4, width: thumbSize, height: thumbSize, border: "0", transform: "translateX(-50%)" }}
              role="slider"
              tabIndex={0}
              aria-label={label}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={sliderValue}
              aria-valuetext={formatValue(sliderValue)}
              aria-orientation="horizontal"
              onKeyDown={(event) => {
                const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0
                if (event.key === "Home") updateValue(min)
                else if (event.key === "End") updateValue(max)
                else if (direction) nudge(direction)
                else return
                event.stopPropagation()
                event.preventDefault()
              }}
            />
          </div>
        }
        right={
          <input
            type="text"
            aria-label={`${label} value`}
            className="msr:h-full msr:w-full msr:shrink-0 msr:border-0 msr:bg-transparent msr:px-1 msr:text-left msr:font-mono msr:text-[12px] msr:font-medium msr:tabular-nums msr:text-ink-700 msr:outline-none"
            style={{ boxSizing: "border-box", borderRadius: "0 5px 5px 0", lineHeight: "1rem" }}
            value={editing ? draftValue : formatValue(value)}
            onFocus={() => {
              setDraftValue(formatValue(value))
              setEditing(true)
            }}
            onChange={(event) => {
              const nextDraft = event.target.value
              setDraftValue(nextDraft)
              const next = parseInput(nextDraft)
              if (Number.isFinite(next)) onChange(clampValue(next))
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.stopPropagation()
                event.preventDefault()
                const direction = event.key === "ArrowUp" ? 1 : -1
                nudge(direction)
              } else if (event.key === "Enter") {
                event.stopPropagation()
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
          />
        }
      />
    </div>
  )
}

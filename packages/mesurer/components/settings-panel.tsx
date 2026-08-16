"use client"

import { useEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction } from "react"
import type { ColorPickerFormat } from "../core/colors"
import { colorToHex, parseCssColor } from "../core/colors"
import { cn } from "../core/utils"
import { Tooltip, useTooltip } from "./tooltip"
import type { GuideStyle } from "../core/persistence"

type SettingsPanelProps = {
  ownerWindow: Window
  highlightColor: string
  setHighlightColor: Dispatch<SetStateAction<string>>
  guideColor: string
  setGuideColor: Dispatch<SetStateAction<string>>
  hoverHighlight: boolean
  setHoverHighlight: Dispatch<SetStateAction<boolean>>
  persistOnReload: boolean
  setPersistOnReload: Dispatch<SetStateAction<boolean>>
  colorFormats: ColorPickerFormat[]
  setColorFormats: Dispatch<SetStateAction<ColorPickerFormat[]>>
  colorClickFormat: ColorPickerFormat
  setColorClickFormat: Dispatch<SetStateAction<ColorPickerFormat>>
  snapEnabled: boolean
  setSnapEnabled: Dispatch<SetStateAction<boolean>>
  snapGuidesEnabled: boolean
  setSnapGuidesEnabled: Dispatch<SetStateAction<boolean>>
  multiMeasureEnabled: boolean
  setMultiMeasureEnabled: Dispatch<SetStateAction<boolean>>
  guideStyle: GuideStyle
  setGuideStyle: Dispatch<SetStateAction<GuideStyle>>
}

const COLOR_FORMATS: ColorPickerFormat[] = ["hex", "rgb", "hsl", "oklch"]
type SettingsTab = "guides" | "colors" | "interaction"
const GUIDE_PATTERNS: Array<{ value: GuideStyle["pattern"]; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
]

function ControlShell({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div
      className="msr:flex msr:h-6 msr:min-w-0 msr:items-center msr:overflow-hidden msr:rounded-[5px] msr:border msr:border-ink-200 msr:bg-ink-50 msr:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.03)]"
    >
      <div className="msr:flex msr:h-full msr:min-w-0 msr:flex-1 msr:items-center msr:focus-within:rounded-l-[5px] msr:focus-within:outline msr:focus-within:outline-1 msr:focus-within:outline-[#0d99ff] msr:focus-within:outline-offset-[-1px]">{left}</div>
      <div className="msr:flex msr:h-full msr:w-12 msr:shrink-0 msr:items-center msr:border-l msr:border-ink-200 msr:focus-within:rounded-r-[5px] msr:focus-within:outline msr:focus-within:outline-1 msr:focus-within:outline-[#0d99ff] msr:focus-within:outline-offset-[-1px]">{right}</div>
    </div>
  )
}

function SettingsSwitch({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="msr:col-span-2 msr:flex msr:w-full msr:items-center msr:justify-between msr:gap-3 msr:text-left msr:text-[12px] msr:leading-none msr:text-ink-700 msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]"
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "msr:relative msr:block msr:h-[14px] msr:w-[26px] msr:shrink-0 msr:rounded-full msr:border msr:transition-colors",
          checked ? "msr:border-[#0d99ff] msr:bg-[#0d99ff]" : "msr:border-ink-200 msr:bg-ink-50",
        )}
      >
        <span
          className="msr:absolute msr:left-0 msr:top-1/2 msr:size-[10px] msr:rounded-full msr:bg-white msr:shadow-sm msr:transition-transform"
          style={{ transform: `translate(${checked ? 14 : 2}px, -50%)` }}
        />
      </span>
    </button>
  )
}

function SliderControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
  formatValue = (currentValue) => String(currentValue),
  parseInput = (input) => Number(input),
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
  parseInput?: (input: string) => number
}) {
  const thumbSize = 14
  const thumbRadius = thumbSize / 2
  const percentage = ((value - min) / (max - min)) * 100
  const [draftValue, setDraftValue] = useState(formatValue(value))
  const editingRef = useRef(false)
  useEffect(() => {
    if (!editingRef.current) setDraftValue(formatValue(value))
  }, [formatValue, value])
  const commitDraft = () => {
    const parsed = parseInput(draftValue)
    if (Number.isFinite(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)))
    }
    setDraftValue(formatValue(Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value))
  }
  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const usableWidth = Math.max(1, rect.width - thumbSize)
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left - thumbRadius) / usableWidth))
    const rawValue = min + ratio * (max - min)
    const steppedValue = Math.round((rawValue - min) / step) * step + min
    onChange(Number(steppedValue.toFixed(4)))
  }

  return (
    <div className="msr:col-span-2 msr:mt-2 msr:grid msr:grid-cols-[64px_minmax(0,1fr)] msr:items-center msr:gap-3">
      <span className="msr:text-[11px] msr:font-medium msr:text-ink-700">{label}</span>
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
          <div
            className="msr:absolute msr:left-3 msr:right-3 msr:rounded-full"
            style={{ top: 8, height: 4, backgroundColor: "rgba(15, 23, 42, 0.16)" }}
            aria-hidden="true"
          />
          <div
            className="msr:absolute msr:left-3 msr:rounded-full"
            style={{ top: 8, width: `calc(${percentage}% - ${percentage * thumbSize / 100}px)`, height: 4, backgroundColor: "#0d99ff" }}
            aria-hidden="true"
          />
          <div
            className="msr:absolute msr:rounded-full msr:bg-white msr:shadow-sm msr:transition-shadow msr:focus-visible:outline-none msr:focus-visible:ring-1 msr:focus-visible:ring-[#0d99ff]/25"
            style={{
              left: `calc(7px + (100% - 14px) * ${percentage / 100})`,
              top: 3,
              width: 14,
              height: 14,
              border: "0",
              transform: "translateX(-50%)",
            }}
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-orientation="horizontal"
            onKeyDown={(event) => {
              event.stopPropagation()
              const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0
              if (event.key === "Home") onChange(min)
              else if (event.key === "End") onChange(max)
              else if (direction) {
                event.preventDefault()
                onChange(Number(Math.min(max, Math.max(min, value + direction * step)).toFixed(4)))
              } else return
              event.preventDefault()
            }}
          />
        </div>
        }
        right={
          <input
          type="text"
          aria-label={`${label} value`}
          className="msr:h-full msr:w-full msr:shrink-0 msr:border-0 msr:bg-transparent msr:px-2 msr:text-center msr:font-mono msr:text-[12px] msr:font-medium msr:tabular-nums msr:text-ink-700 msr:outline-none"
          style={{ boxSizing: "border-box", borderRadius: "0 5px 5px 0", lineHeight: "1rem" }}
          value={draftValue}
          onFocus={() => {
            editingRef.current = true
          }}
          onChange={(event) => {
            const nextDraft = event.target.value
            setDraftValue(nextDraft)
            const next = parseInput(nextDraft)
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onBlur={() => {
            editingRef.current = false
            commitDraft()
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault()
              const current = parseInput(event.currentTarget.value)
              const direction = event.key === "ArrowUp" ? 1 : -1
              const next = Number(
                Math.min(max, Math.max(min, (Number.isFinite(current) ? current : value) + direction * step)).toFixed(4),
              )
              setDraftValue(formatValue(next))
              onChange(next)
              return
            }
            if (event.key === "Enter") {
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

function ColorField({ label, value, fallback, ownerWindow, onChange }: {
  label: string
  value: string
  fallback: string
  ownerWindow: Window
  onChange: (value: string) => void
}) {
  const parsed = parseCssColor(value)
  const canvas = ownerWindow.document.createElement("canvas")
  const context = canvas.getContext("2d")
  if (context) context.fillStyle = value
  const serialized = typeof context?.fillStyle === "string" ? context.fillStyle : ""
  const converted = serialized ? parseCssColor(serialized) : null
  const inputValue = (parsed ?? converted) ? colorToHex(parsed ?? converted!).slice(0, 7) : fallback
  const sample = parsed ?? converted ?? parseCssColor(fallback)
  const hexValue = sample ? colorToHex({ ...sample, alpha: 1 }).slice(1).toUpperCase() : "000000"
  const alphaValue = sample ? Math.round(sample.alpha * 100) : 100
  const [hexDraft, setHexDraft] = useState(hexValue)
  const [alphaDraft, setAlphaDraft] = useState(String(alphaValue))
  useEffect(() => {
    setHexDraft(hexValue)
    setAlphaDraft(String(alphaValue))
  }, [alphaValue, hexValue])
  const updateColor = (nextHex: string, nextAlpha: number) => {
    if (!/^[\da-f]{6}$/i.test(nextHex)) return
    const nextSample = parseCssColor(`#${nextHex}`)
    if (!nextSample) return
    onChange(colorToHex({ ...nextSample, alpha: Math.min(100, Math.max(0, nextAlpha)) / 100 }))
  }
  const swatchColor =
    (ownerWindow as Window & { CSS?: { supports: (property: string, value: string) => boolean } }).CSS?.supports("color", value)
      ? value
      : fallback
  return (
    <div className="msr:col-span-2 msr:grid msr:grid-cols-[64px_minmax(0,1fr)] msr:items-center msr:gap-3 msr:text-[12px] msr:text-ink-700">
      <span>{label}</span>
      <ControlShell
        left={
          <>
            <span
              className="msr:relative msr:ml-1 msr:block msr:size-4 msr:shrink-0 msr:overflow-hidden msr:rounded-[3px] msr:border msr:border-black/10"
              style={{ backgroundColor: swatchColor }}
            >
              <input
                type="color"
                aria-label={`${label} color picker`}
                value={inputValue}
                className="msr:absolute msr:inset-0 msr:size-full msr:cursor-pointer msr:opacity-0"
                onChange={(event) => onChange(event.target.value)}
              />
            </span>
            <input
              aria-label={`${label} hex value`}
              type="text"
              value={hexDraft}
              maxLength={6}
              className="msr:min-w-0 msr:flex-1 msr:bg-transparent msr:px-2 msr:font-mono msr:text-[12px] msr:tabular-nums msr:text-ink-700 msr:outline-none"
              onChange={(event) => {
                const next = event.target.value.replace(/[^\da-f]/gi, "").slice(0, 6).toUpperCase()
                setHexDraft(next)
                updateColor(next, Number(alphaDraft))
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            />
          </>
        }
        right={
          <input
            aria-label={`${label} opacity value`}
            type="text"
            inputMode="numeric"
            value={alphaDraft ? `${alphaDraft}%` : ""}
            maxLength={4}
            className="msr:h-full msr:w-full msr:bg-transparent msr:px-1 msr:text-center msr:font-mono msr:text-[12px] msr:tabular-nums msr:text-ink-700 msr:outline-none"
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, "").slice(0, 3)
              setAlphaDraft(next)
              updateColor(hexDraft, Number(next))
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
              event.preventDefault()
              event.stopPropagation()
              const current = Number.parseInt(alphaDraft, 10)
              const direction = event.key === "ArrowUp" ? 1 : -1
              const next = Math.min(100, Math.max(0, (Number.isFinite(current) ? current : 0) + direction))
              setAlphaDraft(String(next))
              updateColor(hexDraft, next)
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          />
        }
      />
    </div>
  )
}

export function SettingsPanel({
  ownerWindow,
  highlightColor,
  setHighlightColor,
  guideColor,
  setGuideColor,
  hoverHighlight,
  setHoverHighlight,
  persistOnReload,
  setPersistOnReload,
  colorFormats,
  setColorFormats,
  colorClickFormat,
  setColorClickFormat,
  snapEnabled,
  setSnapEnabled,
  snapGuidesEnabled,
  setSnapGuidesEnabled,
  multiMeasureEnabled,
  setMultiMeasureEnabled,
  guideStyle,
  setGuideStyle,
}: SettingsPanelProps) {
  const toggleFormat = (format: ColorPickerFormat) => {
    setColorFormats((previous) => {
      if (previous.includes(format)) {
        if (previous.length === 1) return previous
        return previous.filter((item) => item !== format)
      }
      return [...previous, format]
    })
  }

  const [activeTab, setActiveTab] = useState<SettingsTab>("guides")
  const patternTooltip = useTooltip()

  return (
    <div className="msr:flex msr:max-h-[min(70vh,34rem)] msr:flex-col msr:gap-3 msr:overflow-y-auto">
      <div
        className="msr:flex msr:select-none msr:items-stretch msr:gap-0 msr:rounded-[5px] msr:bg-ink-50"
        style={{ height: 24, padding: 1 }}
        role="tablist"
        aria-label="Settings sections"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {(["guides", "colors", "interaction"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={cn(
              "msr:relative msr:flex msr:flex-1 msr:appearance-none msr:items-center msr:justify-center msr:px-2 msr:py-0 msr:text-[11px] msr:font-medium msr:transition-colors msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]",
              activeTab === tab
                ? "msr:rounded-[5px] msr:bg-white msr:text-ink-900 msr:shadow-[0_0_0_1px_rgba(15,23,42,0.12)]"
                : "msr:rounded-[5px] msr:text-ink-500 msr:hover:text-ink-700",
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "guides" ? "Guides" : tab === "colors" ? "Colors" : "Interaction"}
          </button>
        ))}
      </div>

      {activeTab === "guides" ? (
        <section className="msr:grid msr:grid-cols-[64px_minmax(0,1fr)] msr:items-center msr:gap-x-3 msr:gap-y-1" role="tabpanel" aria-label="Guides settings">
          <h2 className="msr:col-span-2 msr:text-[12px] msr:font-medium msr:text-ink-700">Guide</h2>
          <ColorField label="Color" value={guideColor} fallback="#f97316" ownerWindow={ownerWindow} onChange={setGuideColor} />
          <SliderControl label="Weight" min={1} max={4} step={1} value={guideStyle.width} formatValue={(value) => `${value}px`} parseInput={(input) => Number.parseFloat(input)} onChange={(value) => setGuideStyle((style) => ({ ...style, width: value }))} />
          <div className="msr:col-span-2 msr:mt-2 msr:grid msr:grid-cols-[64px_minmax(0,1fr)] msr:items-center msr:gap-3">
            <span className="msr:text-[12px] msr:text-ink-700">Pattern</span>
            <div
              className="msr:flex msr:gap-1"
              role="radiogroup"
              aria-label="Guide pattern"
              onMouseLeave={patternTooltip.onTooltipContainerLeave}
            >
              {GUIDE_PATTERNS.map(({ value, label }) => {
                const selected = guideStyle.pattern === value
                const tooltipId = `guide-pattern-${value}`
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-label={`${label} guide pattern`}
                    aria-checked={selected}
                    className={cn(
                      "msr:group msr:relative msr:flex msr:h-6 msr:min-w-0 msr:flex-1 msr:items-center msr:justify-center msr:rounded-[5px] msr:border msr:px-1 msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]",
                      selected
                        ? "msr:border-[#0d99ff] msr:bg-[#0d99ff]/10"
                        : "msr:border-ink-200 msr:bg-ink-50 msr:hover:bg-ink-100",
                    )}
                    onClick={() => setGuideStyle((style) => ({ ...style, pattern: value }))}
                    onMouseEnter={() => patternTooltip.onTooltipEnter(tooltipId)}
                    onFocus={() => patternTooltip.onTooltipEnter(tooltipId)}
                    onBlur={patternTooltip.onTooltipLeave}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "msr:block msr:w-full msr:border-t-2 msr:border-ink-700",
                        value === "dashed" ? "msr:border-dashed" : value === "dotted" ? "msr:border-dotted" : "msr:border-solid",
                      )}
                    />
                    <Tooltip
                      label={label}
                      visible={patternTooltip.visibleTooltipId === tooltipId}
                      instant={patternTooltip.tooltipInstant}
                      className="msr:z-10"
                    />
                  </button>
                )
              })}
            </div>
          </div>
          {guideStyle.pattern !== "solid" ? (
            <>
              <SliderControl label="Dash length" min={2} max={24} step={1} value={guideStyle.dashLength} formatValue={(value) => `${value}px`} parseInput={(input) => Number.parseFloat(input)} onChange={(value) => setGuideStyle((style) => ({ ...style, dashLength: value }))} />
              <SliderControl label="Dash gap" min={0} max={24} step={1} value={guideStyle.gap} formatValue={(value) => `${value}px`} parseInput={(input) => Number.parseFloat(input)} onChange={(value) => setGuideStyle((style) => ({ ...style, gap: value }))} />
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === "colors" ? (
        <section className="msr:grid msr:grid-cols-[64px_minmax(0,1fr)] msr:items-center msr:gap-x-3 msr:gap-y-1" role="tabpanel" aria-label="Colors settings">
          <h2 className="msr:col-span-2 msr:text-[12px] msr:font-medium msr:text-ink-700">Color</h2>
          <div className="msr:col-span-2 msr:mt-2 msr:flex msr:flex-wrap msr:gap-1">
            {COLOR_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                aria-pressed={colorFormats.includes(format)}
                className={cn(
                  "msr:rounded-[5px] msr:border msr:px-1.5 msr:py-0.5 msr:text-[11px] msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]",
                  colorFormats.includes(format)
                    ? "msr:border-[#0d99ff] msr:bg-[#0d99ff] msr:text-white"
                    : "msr:border-ink-200 msr:text-ink-500 msr:hover:bg-ink-50",
                )}
                onClick={() => toggleFormat(format)}
              >
                {format}
              </button>
            ))}
          </div>
          <label className="msr:mt-2 msr:flex msr:items-center msr:justify-between msr:gap-3 msr:text-[12px] msr:text-ink-700">
            Copy as
            <select
              value={colorClickFormat}
              className="msr:rounded-[5px] msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:py-1 msr:text-[11px] msr:outline-none msr:focus:shadow-[inset_0_0_0_1px_#0d99ff]"
              onChange={(event) => setColorClickFormat(event.target.value as ColorPickerFormat)}
            >
              {COLOR_FORMATS.map((format) => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </label>
          <div className="msr:col-span-2 msr:mt-4"><h2 className="msr:text-[12px] msr:font-medium msr:text-ink-700">Appearance</h2></div>
          <ColorField label="Highlight color" value={highlightColor} fallback="#0d99ff" ownerWindow={ownerWindow} onChange={setHighlightColor} />
        </section>
      ) : null}

      {activeTab === "interaction" ? (
        <section className="msr:grid msr:grid-cols-[64px_minmax(0,1fr)] msr:items-center msr:gap-x-3 msr:gap-y-1" role="tabpanel" aria-label="Interaction settings">
          <h2 className="msr:col-span-2 msr:text-[12px] msr:font-medium msr:text-ink-700">Interaction</h2>
          <div className="msr:mt-2"><SettingsSwitch label="Hover" checked={hoverHighlight} onChange={setHoverHighlight} /></div>
          <div className="msr:mt-2"><SettingsSwitch label="Snap to elements" checked={snapEnabled} onChange={setSnapEnabled} /></div>
          <div className="msr:mt-2"><SettingsSwitch label="Snap to guides" checked={snapGuidesEnabled} onChange={setSnapGuidesEnabled} /></div>
          <div className="msr:mt-2"><SettingsSwitch label="Multi-measure" checked={multiMeasureEnabled} onChange={setMultiMeasureEnabled} /></div>
          <div className="msr:mt-2"><SettingsSwitch label="Persist on reload" checked={persistOnReload} onChange={setPersistOnReload} /></div>
        </section>
      ) : null}
    </div>
  )
}

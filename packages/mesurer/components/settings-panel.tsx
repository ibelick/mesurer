"use client"

import { useState, type Dispatch, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction } from "react"
import packageManifest from "../package.json"
import type { ColorPickerFormat } from "../core/colors"
import { colorToHex, parseCssColor } from "../core/colors"
import { cn } from "../core/utils"
import { Tooltip, useTooltip } from "./tooltip"
import type { GuideStyle, RulerSettings } from "../core/persistence"

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
  selectNewGuideEnabled: boolean
  setSelectNewGuideEnabled: Dispatch<SetStateAction<boolean>>
  multiMeasureEnabled: boolean
  setMultiMeasureEnabled: Dispatch<SetStateAction<boolean>>
  guideStyle: GuideStyle
  setGuideStyle: Dispatch<SetStateAction<GuideStyle>>
  rulerSettings: RulerSettings
  setRulerSettings: Dispatch<SetStateAction<RulerSettings>>
  initialTab: SettingsTab
  onResetSettings: () => void
  onClearWorkspace: () => void
}

const COLOR_FORMATS: ColorPickerFormat[] = ["hex", "rgb", "hsl", "oklch"]
export type SettingsTab = "guides" | "select" | "color-picker" | "rulers" | "general"
const GUIDE_PATTERNS: Array<{ value: GuideStyle["pattern"]; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
]
function ControlShell({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div
      className="msr:group msr:flex msr:h-6 msr:w-full msr:min-w-0 msr:items-center msr:overflow-hidden msr:rounded-[5px] msr:border msr:border-transparent msr:bg-ink-50 msr:hover:border-ink-200"
    >
      <div className="msr:flex msr:h-full msr:min-w-0 msr:flex-1 msr:items-center msr:focus-within:rounded-l-[5px] msr:focus-within:outline msr:focus-within:outline-1 msr:focus-within:outline-[#0d99ff] msr:focus-within:outline-offset-[-1px]">{left}</div>
      <div className="msr:box-border msr:flex msr:h-full msr:w-12 msr:shrink-0 msr:items-center msr:border-l msr:border-transparent msr:group-hover:border-ink-200 msr:focus-within:rounded-r-[5px] msr:focus-within:outline msr:focus-within:outline-1 msr:focus-within:outline-[#0d99ff] msr:focus-within:outline-offset-[-1px]">{right}</div>
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
      className="msr:col-span-2 msr:grid msr:h-6 msr:w-full msr:grid-cols-[78px_156px] msr:items-center msr:gap-3 msr:text-left msr:text-[12px] msr:leading-none msr:text-ink-700"
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        style={{ justifySelf: "end" }}
        className={cn(
          "msr:flex msr:h-[14px] msr:w-[26px] msr:shrink-0 msr:items-center msr:rounded-full msr:border msr:p-px msr:transition-colors",
          checked ? "msr:border-[#0d99ff] msr:bg-[#0d99ff]" : "msr:border-ink-200 msr:bg-ink-50",
        )}
      >
        <span
          className="msr:block msr:size-[10px] msr:shrink-0 msr:rounded-full msr:bg-white msr:shadow-sm msr:transition-transform"
          style={{ transform: `translateX(${checked ? 12 : 0}px)` }}
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
  const thumbSize = 12
  const thumbInset = 8
  const percentage = ((value - min) / (max - min)) * 100
  const [draftValue, setDraftValue] = useState(formatValue(value))
  const [editing, setEditing] = useState(false)
  const commitDraft = () => {
    const parsed = parseInput(draftValue)
    if (Number.isFinite(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)))
    }
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value
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
    onChange(Number(steppedValue.toFixed(4)))
  }

  return (
    <div className="msr:col-span-2 msr:grid msr:w-full msr:grid-cols-[78px_156px] msr:items-center msr:gap-3">
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
             className="msr:absolute msr:left-[8px] msr:right-[8px] msr:rounded-full"
            style={{ top: 8, height: 4, backgroundColor: "rgba(15, 23, 42, 0.16)" }}
            aria-hidden="true"
          />
          <div
             className="msr:absolute msr:left-[8px] msr:rounded-full"
             style={{ top: 8, width: `calc(${percentage}% - ${percentage * thumbInset * 2 / 100}px)`, height: 4, backgroundColor: "#0d99ff" }}
            aria-hidden="true"
          />
          <div
            className="msr:absolute msr:rounded-[5px] msr:bg-white msr:shadow-sm msr:transition-shadow msr:outline-none msr:focus-visible:ring-1 msr:focus-visible:ring-[#0d99ff]/25"
            style={{
               left: `calc(8px + (100% - 16px) * ${percentage / 100})`,
               top: 4,
               width: thumbSize,
               height: thumbSize,
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
          value={editing ? draftValue : formatValue(value)}
          onFocus={() => {
            setDraftValue(formatValue(value))
            setEditing(true)
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
  const [hexFocused, setHexFocused] = useState(false)
  const [alphaFocused, setAlphaFocused] = useState(false)
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
    <div className="msr:col-span-2 msr:grid msr:w-full msr:grid-cols-[78px_156px] msr:items-center msr:gap-3 msr:text-[12px] msr:text-ink-700">
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
              value={hexFocused ? hexDraft : hexValue}
              maxLength={6}
              className="msr:min-w-0 msr:flex-1 msr:bg-transparent msr:px-2 msr:font-mono msr:text-[12px] msr:tabular-nums msr:text-ink-700 msr:outline-none"
              onFocus={() => {
                setHexDraft(hexValue)
                setHexFocused(true)
              }}
              onBlur={() => setHexFocused(false)}
              onChange={(event) => {
                const next = event.target.value.replace(/[^\da-f]/gi, "").slice(0, 6).toUpperCase()
                setHexDraft(next)
                updateColor(next, alphaFocused ? Number(alphaDraft) : alphaValue)
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
            value={alphaFocused ? (alphaDraft ? `${alphaDraft}%` : "") : `${alphaValue}%`}
            maxLength={4}
            className="msr:h-full msr:w-full msr:bg-transparent msr:px-1 msr:text-center msr:font-mono msr:text-[12px] msr:tabular-nums msr:text-ink-700 msr:outline-none"
            onFocus={() => {
              setAlphaDraft(String(alphaValue))
              setAlphaFocused(true)
            }}
            onBlur={() => setAlphaFocused(false)}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, "").slice(0, 3)
              setAlphaDraft(next)
              updateColor(hexFocused ? hexDraft : hexValue, Number(next))
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
              event.preventDefault()
              event.stopPropagation()
              const current = Number.parseInt(alphaFocused ? alphaDraft : String(alphaValue), 10)
              const direction = event.key === "ArrowUp" ? 1 : -1
              const next = Math.min(100, Math.max(0, (Number.isFinite(current) ? current : 0) + direction))
              setAlphaDraft(String(next))
              updateColor(hexFocused ? hexDraft : hexValue, next)
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
  selectNewGuideEnabled,
  setSelectNewGuideEnabled,
  multiMeasureEnabled,
  setMultiMeasureEnabled,
  guideStyle,
  setGuideStyle,
  rulerSettings,
  setRulerSettings,
  initialTab,
  onResetSettings,
  onClearWorkspace,
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

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const patternTooltip = useTooltip()

  return (
    <div className="msr:flex msr:max-h-[min(70vh,34rem)] msr:flex-col msr:gap-2 msr:overflow-y-auto" onPointerDown={(event) => event.stopPropagation()}>
      <div className="msr:flex msr:h-6 msr:shrink-0 msr:select-none msr:items-stretch msr:gap-0 msr:rounded-[5px] msr:bg-ink-50 msr:p-px" role="tablist" aria-label="Settings sections">
        {([
          ["guides", "Guides"],
          ["select", "Select"],
          ["color-picker", "Color"],
          ["rulers", "Rulers"],
          ["general", "General"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activeTab === value}
            className={cn(
              "msr:relative msr:flex msr:min-w-0 msr:flex-1 msr:appearance-none msr:items-center msr:justify-center msr:whitespace-nowrap msr:px-1.5 msr:py-0 msr:text-[10px] msr:font-medium msr:transition-colors msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]",
              activeTab === value
                ? "msr:rounded-[5px] msr:bg-white msr:text-ink-900 msr:shadow-[0_0_0_1px_rgba(15,23,42,0.12)]"
                : "msr:rounded-[5px] msr:text-ink-500 msr:hover:text-ink-700",
            )}
            onClick={() => setActiveTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "guides" ? <section className="msr:grid msr:grid-cols-[78px_156px] msr:items-center msr:gap-x-3 msr:gap-y-1" aria-label="Guide settings">
        <ColorField label="Color" value={guideColor} fallback="#f97316" ownerWindow={ownerWindow} onChange={setGuideColor} />
        <SliderControl label="Weight" min={1} max={4} step={1} value={guideStyle.width} formatValue={(value) => `${value}px`} parseInput={(input) => Number.parseFloat(input)} onChange={(value) => setGuideStyle((style) => ({ ...style, width: value }))} />
        <div className="msr:col-span-2 msr:grid msr:grid-cols-[78px_156px] msr:items-center msr:gap-3">
          <span className="msr:text-[12px] msr:text-ink-700">Pattern</span>
          <div className="msr:flex msr:gap-1" role="radiogroup" aria-label="Guide pattern" onMouseLeave={patternTooltip.onTooltipContainerLeave}>
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
                    "msr:relative msr:flex msr:h-6 msr:min-w-0 msr:flex-1 msr:items-center msr:justify-center msr:rounded-[5px] msr:border msr:px-1 msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]",
                    selected ? "msr:border-[#0d99ff] msr:bg-[#0d99ff]/10" : "msr:border-ink-200 msr:bg-ink-50 msr:hover:bg-ink-100",
                  )}
                  onClick={() => setGuideStyle((style) => ({ ...style, pattern: value }))}
                  onMouseEnter={() => patternTooltip.onTooltipEnter(tooltipId)}
                  onFocus={() => patternTooltip.onTooltipEnter(tooltipId)}
                  onBlur={patternTooltip.onTooltipLeave}
                >
                  <span aria-hidden="true" className={cn("msr:block msr:w-full msr:border-t-2 msr:border-ink-700", value === "dashed" ? "msr:border-dashed" : value === "dotted" ? "msr:border-dotted" : "msr:border-solid")} />
                  <Tooltip label={label} visible={patternTooltip.visibleTooltipId === tooltipId} instant={patternTooltip.tooltipInstant} className="msr:z-10" />
                </button>
              )
            })}
          </div>
        </div>
        {guideStyle.pattern !== "solid" ? (
          <>
            <SliderControl label="Length" min={2} max={24} step={1} value={guideStyle.dashLength} formatValue={(value) => `${value}px`} parseInput={(input) => Number.parseFloat(input)} onChange={(value) => setGuideStyle((style) => ({ ...style, dashLength: value }))} />
            <SliderControl label="Gap" min={0} max={24} step={1} value={guideStyle.gap} formatValue={(value) => `${value}px`} parseInput={(input) => Number.parseFloat(input)} onChange={(value) => setGuideStyle((style) => ({ ...style, gap: value }))} />
          </>
        ) : null}
        <div className="msr:col-span-2"><SettingsSwitch label="Snap" checked={snapGuidesEnabled} onChange={setSnapGuidesEnabled} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Highlight" checked={selectNewGuideEnabled} onChange={setSelectNewGuideEnabled} /></div>
      </section> : null}

      {activeTab === "select" ? <section className="msr:grid msr:grid-cols-[78px_156px] msr:items-center msr:gap-x-3 msr:gap-y-1" aria-label="Selection settings">
        <ColorField label="Color" value={highlightColor} fallback="#0d99ff" ownerWindow={ownerWindow} onChange={setHighlightColor} />
        <div className="msr:col-span-2"><SettingsSwitch label="Hover" checked={hoverHighlight} onChange={setHoverHighlight} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Element snap" checked={snapEnabled} onChange={setSnapEnabled} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Stack" checked={multiMeasureEnabled} onChange={setMultiMeasureEnabled} /></div>
      </section> : null}

      {activeTab === "color-picker" ? <section className="msr:grid msr:grid-cols-[78px_156px] msr:items-center msr:gap-x-3 msr:gap-y-1" aria-label="Color settings">
        <div className="msr:col-span-2 msr:grid msr:grid-cols-[78px_156px] msr:items-center msr:gap-3">
          <span className="msr:text-[12px] msr:text-ink-700">Format</span>
          <div className="msr:flex msr:min-w-0 msr:gap-1">
            {COLOR_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                aria-pressed={colorFormats.includes(format)}
                className={cn(
                  "msr:h-6 msr:min-w-0 msr:flex-1 msr:rounded-[5px] msr:border msr:px-1 msr:text-[11px] msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]",
                  colorFormats.includes(format) ? "msr:border-[#0d99ff] msr:bg-[#0d99ff] msr:text-white" : "msr:border-ink-200 msr:text-ink-500 msr:hover:bg-ink-50",
                )}
                onClick={() => toggleFormat(format)}
              >
                {format}
              </button>
            ))}
          </div>
        </div>
        <label className="msr:col-span-2 msr:flex msr:items-center msr:justify-between msr:gap-3 msr:text-[12px] msr:text-ink-700">
          Copy
          <select value={colorClickFormat} className="msr:rounded-[5px] msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:py-1 msr:text-[11px] msr:outline-none msr:focus:shadow-[inset_0_0_0_1px_#0d99ff]" onChange={(event) => setColorClickFormat(event.target.value as ColorPickerFormat)}>
            {COLOR_FORMATS.map((format) => <option key={format} value={format}>{format}</option>)}
          </select>
        </label>
      </section> : null}

      {activeTab === "rulers" ? <section className="msr:grid msr:grid-cols-[78px_156px] msr:items-center msr:gap-x-3 msr:gap-y-1" aria-label="Ruler settings">
        <SliderControl label="Opacity" min={0.2} max={1} step={0.05} value={rulerSettings.opacity} formatValue={(value) => `${Math.round(value * 100)}%`} parseInput={(input) => Number.parseFloat(input) / 100} onChange={(value) => setRulerSettings((settings) => ({ ...settings, opacity: value }))} />
        <div className="msr:col-span-2"><SettingsSwitch label="Edge reveal" checked={rulerSettings.edgeReveal} onChange={(edgeReveal) => setRulerSettings((settings) => ({ ...settings, edgeReveal }))} /></div>
      </section> : null}

      {activeTab === "general" ? <section className="msr:grid msr:grid-cols-[78px_156px] msr:items-center msr:gap-x-3 msr:gap-y-1" aria-label="General settings">
        <div className="msr:col-span-2"><SettingsSwitch label="Persist" checked={persistOnReload} onChange={setPersistOnReload} /></div>
        <div className="msr:col-span-2 msr:grid msr:h-6 msr:grid-cols-[78px_156px] msr:items-center msr:gap-3 msr:text-[12px] msr:text-ink-700">
          <span>Version</span>
          <span className="msr:justify-self-end msr:font-mono msr:text-[11px] msr:tabular-nums msr:text-ink-700">{packageManifest.version}</span>
        </div>
        <div className="msr:col-span-2 msr:flex msr:justify-end msr:gap-1">
          <button
            type="button"
            aria-label="Reset settings to defaults"
            className="msr:rounded-[5px] msr:border msr:border-ink-200 msr:px-2 msr:py-1 msr:text-[11px] msr:text-ink-700 msr:hover:bg-ink-50 msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]"
            onClick={onResetSettings}
          >
            Use defaults
          </button>
          <button
            type="button"
            aria-label="Clear workspace"
            className="msr:rounded-[5px] msr:border msr:border-red-200 msr:px-2 msr:py-1 msr:text-[11px] msr:text-red-600 msr:hover:bg-red-50 msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#ef4444]"
            onClick={onClearWorkspace}
          >
            Clear workspace
          </button>
        </div>
      </section> : null}
    </div>
  )
}

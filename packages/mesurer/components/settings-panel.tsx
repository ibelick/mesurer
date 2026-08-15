"use client"

import { useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react"
import type { ColorPickerFormat } from "../core/colors"
import { colorToHex, parseCssColor } from "../core/colors"
import { cn } from "../core/utils"
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
type SettingsTab = "guides" | "colors" | "behavior"

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
      className="msr:flex msr:w-full msr:items-center msr:justify-between msr:gap-3 msr:text-left msr:text-[12px] msr:leading-none msr:text-ink-700"
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
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
}) {
  const thumbSize = 14
  const thumbRadius = thumbSize / 2
  const percentage = ((value - min) / (max - min)) * 100
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
    <div className="msr:mt-2">
      <div className="msr:flex msr:items-center msr:justify-between msr:text-[11px] msr:font-medium msr:text-ink-700">
        <span>{label}</span>
        <span className="msr:font-mono msr:text-[10px] msr:font-normal msr:tabular-nums msr:text-ink-400">{formatValue(value)}</span>
      </div>
      <div
        className="msr:relative msr:mt-1 msr:w-full msr:touch-none msr:select-none"
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
          className="msr:absolute msr:left-0 msr:right-0 msr:rounded-full"
          style={{ left: thumbRadius, right: thumbRadius, top: 8, height: 4, backgroundColor: "rgba(15, 23, 42, 0.16)" }}
          aria-hidden="true"
        />
        <div
          className="msr:absolute msr:left-0 msr:rounded-full"
          style={{ left: thumbRadius, top: 8, width: `calc(${percentage}% - ${percentage * thumbSize / 100}px)`, height: 4, backgroundColor: "#0d99ff" }}
          aria-hidden="true"
        />
        <div
          className="msr:absolute msr:rounded-full msr:bg-white msr:shadow-sm msr:transition-shadow msr:focus-visible:outline-none msr:focus-visible:ring-1 msr:focus-visible:ring-[#0d99ff]/25"
          style={{
            left: `calc(${thumbRadius}px + (100% - ${thumbSize}px) * ${percentage / 100})`,
            top: 3,
            width: 14,
            height: 14,
            border: "2px solid #0d99ff",
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
  const swatchColor =
    (ownerWindow as Window & { CSS?: { supports: (property: string, value: string) => boolean } }).CSS?.supports("color", value)
      ? value
      : fallback
  return (
    <label className="msr:flex msr:items-center msr:justify-between msr:gap-3 msr:text-[12px] msr:text-ink-700">
      <span>{label}</span>
      <span
        className="msr:relative msr:block msr:size-4 msr:overflow-hidden msr:cursor-pointer msr:rounded-[4px]"
        style={{
          backgroundColor: swatchColor,
          boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.14)",
        }}
      >
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={inputValue}
          className="msr:absolute msr:inset-0 msr:size-full msr:cursor-pointer msr:opacity-0"
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
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

  return (
    <div className="msr:flex msr:max-h-[min(70vh,34rem)] msr:flex-col msr:gap-3 msr:overflow-y-auto">
      <div
        className="msr:flex msr:select-none msr:items-stretch msr:gap-0 msr:rounded-md msr:bg-ink-50"
        style={{ height: 24, padding: 1 }}
        role="tablist"
        aria-label="Settings sections"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {(["guides", "colors", "behavior"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={cn(
              "msr:relative msr:flex msr:flex-1 msr:appearance-none msr:items-center msr:justify-center msr:px-2 msr:py-0 msr:text-[11px] msr:font-medium msr:transition-colors",
              activeTab === tab
                ? "msr:rounded-[5px] msr:bg-white msr:text-ink-900 msr:shadow-[0_0_0_1px_rgba(15,23,42,0.12)]"
                : "msr:rounded-[5px] msr:text-ink-500 msr:hover:text-ink-700",
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "guides" ? "Guides" : tab === "colors" ? "Colors" : "Behavior"}
          </button>
        ))}
      </div>

      {activeTab === "guides" ? (
        <section role="tabpanel" aria-label="Guides settings">
          <h2 className="msr:text-[12px] msr:font-medium msr:text-ink-700">Guide appearance</h2>
          <div className="msr:mt-2"><ColorField label="Guide color" value={guideColor} fallback="#f97316" ownerWindow={ownerWindow} onChange={setGuideColor} /></div>
          <SliderControl label="Guide opacity" min={0.2} max={1} step={0.05} value={guideStyle.opacity} formatValue={(value) => `${Math.round(value * 100)}%`} onChange={(value) => setGuideStyle((style) => ({ ...style, opacity: value }))} />
          <SliderControl label="Guide weight" min={1} max={4} step={1} value={guideStyle.width} formatValue={(value) => `${value}px`} onChange={(value) => setGuideStyle((style) => ({ ...style, width: value }))} />
          <label className="msr:mt-2 msr:flex msr:items-center msr:justify-between msr:text-[12px] msr:text-ink-700">
            Guide pattern
            <select className="msr:rounded-md msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:py-1 msr:text-[11px]" value={guideStyle.pattern} onChange={(event) => setGuideStyle((style) => ({ ...style, pattern: event.target.value as GuideStyle["pattern"] }))}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </label>
          {guideStyle.pattern !== "solid" ? (
            <>
              <SliderControl label="Dash length" min={2} max={24} step={1} value={guideStyle.dashLength} formatValue={(value) => `${value}px`} onChange={(value) => setGuideStyle((style) => ({ ...style, dashLength: value }))} />
              <SliderControl label="Dash gap" min={0} max={24} step={1} value={guideStyle.gap} formatValue={(value) => `${value}px`} onChange={(value) => setGuideStyle((style) => ({ ...style, gap: value }))} />
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === "colors" ? (
        <section role="tabpanel" aria-label="Colors settings">
          <h2 className="msr:text-[12px] msr:font-medium msr:text-ink-700">Color picker</h2>
          <div className="msr:mt-2 msr:flex msr:flex-wrap msr:gap-1">
            {COLOR_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                aria-pressed={colorFormats.includes(format)}
                className={cn(
                  "msr:rounded-md msr:border msr:px-1.5 msr:py-0.5 msr:text-[11px]",
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
            Copy format
            <select
              value={colorClickFormat}
              className="msr:rounded-md msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:py-1 msr:text-[11px]"
              onChange={(event) => setColorClickFormat(event.target.value as ColorPickerFormat)}
            >
              {COLOR_FORMATS.map((format) => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </label>
          <div className="msr:mt-4"><h2 className="msr:text-[12px] msr:font-medium msr:text-ink-700">Appearance</h2></div>
          <div className="msr:mt-2"><ColorField label="Highlight color" value={highlightColor} fallback="#0d99ff" ownerWindow={ownerWindow} onChange={setHighlightColor} /></div>
        </section>
      ) : null}

      {activeTab === "behavior" ? (
        <section role="tabpanel" aria-label="Behavior settings">
          <h2 className="msr:text-[12px] msr:font-medium msr:text-ink-700">Behavior</h2>
          <div className="msr:mt-2"><SettingsSwitch label="Hover highlight" checked={hoverHighlight} onChange={setHoverHighlight} /></div>
          <div className="msr:mt-2"><SettingsSwitch label="Snap to elements" checked={snapEnabled} onChange={setSnapEnabled} /></div>
          <div className="msr:mt-2"><SettingsSwitch label="Snap to guides" checked={snapGuidesEnabled} onChange={setSnapGuidesEnabled} /></div>
          <div className="msr:mt-2"><SettingsSwitch label="Multi-measure mode" checked={multiMeasureEnabled} onChange={setMultiMeasureEnabled} /></div>
          <div className="msr:mt-2"><SettingsSwitch label="Persist state on reload" checked={persistOnReload} onChange={setPersistOnReload} /></div>
        </section>
      ) : null}
    </div>
  )
}

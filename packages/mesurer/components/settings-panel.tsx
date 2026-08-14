"use client"

import type { Dispatch, SetStateAction } from "react"
import type { ColorPickerFormat } from "../core/colors"
import { colorToHex, parseCssColor } from "../core/colors"
import { cn } from "../core/utils"

type SettingsPanelProps = {
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
}

const COLOR_FORMATS: ColorPickerFormat[] = ["hex", "rgb", "hsl", "oklch"]

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

function ColorField({ label, value, fallback, onChange }: {
  label: string
  value: string
  fallback: string
  onChange: (value: string) => void
}) {
  const parsed = parseCssColor(value)
  const inputValue = parsed ? colorToHex(parsed).slice(0, 7) : fallback
  return (
    <label className="msr:flex msr:items-center msr:justify-between msr:gap-3 msr:text-[12px] msr:text-ink-700">
      <span>{label}</span>
      <span
        className="msr:relative msr:block msr:size-4 msr:overflow-hidden msr:cursor-pointer msr:rounded-[4px]"
        style={{
          backgroundColor: inputValue,
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

  return (
    <div className="msr:flex msr:max-h-[min(70vh,34rem)] msr:flex-col msr:gap-4 msr:overflow-y-auto">
      <section>
        <h2 className="msr:text-[12px] msr:font-medium msr:text-ink-700">General</h2>
        <div className="msr:mt-2"><SettingsSwitch label="Hover highlight" checked={hoverHighlight} onChange={setHoverHighlight} /></div>
        <div className="msr:mt-2"><SettingsSwitch label="Snap to elements" checked={snapEnabled} onChange={setSnapEnabled} /></div>
        <div className="msr:mt-2"><SettingsSwitch label="Snap to guides" checked={snapGuidesEnabled} onChange={setSnapGuidesEnabled} /></div>
        <div className="msr:mt-2"><SettingsSwitch label="Multi-measure mode" checked={multiMeasureEnabled} onChange={setMultiMeasureEnabled} /></div>
        <div className="msr:mt-2"><SettingsSwitch label="Persist state on reload" checked={persistOnReload} onChange={setPersistOnReload} /></div>
      </section>

      <section>
        <h2 className="msr:text-[12px] msr:font-medium msr:text-ink-700">
          Color picker
        </h2>
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
      </section>

      <section>
        <h2 className="msr:text-[12px] msr:font-medium msr:text-ink-700">Appearance</h2>
        <div className="msr:mt-2"><ColorField label="Highlight color" value={highlightColor} fallback="#0d99ff" onChange={setHighlightColor} /></div>
        <div className="msr:mt-2"><ColorField label="Guide color" value={guideColor} fallback="#f97316" onChange={setGuideColor} /></div>
      </section>
    </div>
  )
}

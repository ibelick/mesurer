"use client"

import { useId, useLayoutEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction } from "react"
import packageManifest from "../package.json"
import type { ColorPickerFormat } from "../core/colors"
import { colorToHex, parseCssColor } from "../core/colors"
import { cn } from "../core/utils"
import { CheckIcon } from "./icons"
import { Tooltip, useTooltip } from "./tooltip"
import type { GuideStyle, RulerSettings, ScreenshotSettings } from "../core/persistence"
import { TEXT_FONT_OPTIONS, type TextFont, type TextStyleSettings } from "../core/text-style"
import type { ToolMode } from "../core/types"

export type SettingsFocusSection =
  | "guides"
  | "arrows"
  | "text"
  | "selection"
  | "color"
  | "screenshot"
  | "rulers"

export const settingsFocusSection = (
  toolMode: ToolMode,
  options: { colorPicker?: boolean; screenshot?: boolean; rulersVisible?: boolean } = {},
): SettingsFocusSection | undefined => {
  if (options.screenshot) return "screenshot"
  if (options.colorPicker) return "color"
  if (toolMode === "guides") return "guides"
  if (toolMode === "arrows") return "arrows"
  if (toolMode === "text") return "text"
  if (toolMode === "select" || toolMode === "selection") return "selection"
  if (toolMode === "rulers" || (options.rulersVisible && toolMode === "none")) return "rulers"
  return undefined
}

type SettingsSelectProps = {
  highlightColor: string
  setHighlightColor: Dispatch<SetStateAction<string>>
  hoverHighlight: boolean
  setHoverHighlight: Dispatch<SetStateAction<boolean>>
  layoutDetailsEnabled: boolean
  setLayoutDetailsEnabled: Dispatch<SetStateAction<boolean>>
  snapEnabled: boolean
  setSnapEnabled: Dispatch<SetStateAction<boolean>>
  multiMeasureEnabled: boolean
  setMultiMeasureEnabled: Dispatch<SetStateAction<boolean>>
}

type SettingsGuidesProps = {
  guideColor: string
  setGuideColor: Dispatch<SetStateAction<string>>
  guideStyle: GuideStyle
  setGuideStyle: Dispatch<SetStateAction<GuideStyle>>
  snapGuidesEnabled: boolean
  setSnapGuidesEnabled: Dispatch<SetStateAction<boolean>>
  guideHighlightEnabled: boolean
  setGuideHighlightEnabled: Dispatch<SetStateAction<boolean>>
  selectNewGuideEnabled: boolean
  setSelectNewGuideEnabled: Dispatch<SetStateAction<boolean>>
}

type SettingsColorProps = {
  colorFormats: ColorPickerFormat[]
  setColorFormats: Dispatch<SetStateAction<ColorPickerFormat[]>>
  colorClickFormat: ColorPickerFormat
  setColorClickFormat: Dispatch<SetStateAction<ColorPickerFormat>>
}

type SettingsPanelProps = {
  ownerWindow: Window
  select: SettingsSelectProps
  guides: SettingsGuidesProps
  color: SettingsColorProps
  camera: {
    settings: ScreenshotSettings
    setSettings: Dispatch<SetStateAction<ScreenshotSettings>>
  }
  rulers: {
    settings: RulerSettings
    setSettings: Dispatch<SetStateAction<RulerSettings>>
  }
  text: {
    settings: TextStyleSettings
    setSettings: Dispatch<SetStateAction<TextStyleSettings>>
  }
  arrows: {
    color: string
    setColor: Dispatch<SetStateAction<string>>
    snapArrowsEnabled: boolean
    setSnapArrowsEnabled: Dispatch<SetStateAction<boolean>>
    arrowClickToPlace: boolean
    setArrowClickToPlace: Dispatch<SetStateAction<boolean>>
  }
  focusSection?: SettingsFocusSection
  general: {
    persistOnReload: boolean
    setPersistOnReload: Dispatch<SetStateAction<boolean>>
    onResetSettings: () => void
    onClearWorkspace: () => void
  }
}

const COLOR_FORMATS: ColorPickerFormat[] = ["hex", "rgb", "hsl", "oklch"]
const SETTINGS_COLUMNS = "msr:grid-cols-[78px_150px]"
const GUIDE_PATTERNS: Array<{ value: GuideStyle["pattern"]; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
]

const roundToTwo = (value: number) => Number(value.toFixed(2))

function ControlShell({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div
      className="mesurer-control-shell msr:group msr:flex msr:h-6 msr:w-full msr:min-w-0 msr:items-center msr:overflow-hidden msr:rounded-[5px] msr:border msr:border-transparent msr:bg-ink-50 msr:hover:border-ink-200"
    >
      <div className="mesurer-control-focus msr:flex msr:h-full msr:min-w-0 msr:flex-1 msr:items-center msr:focus-within:rounded-l-[5px] msr:focus-within:outline msr:focus-within:outline-1 msr:focus-within:outline-[#0d99ff] msr:focus-within:outline-offset-[-1px]">{left}</div>
      <div className="mesurer-control-focus msr:box-border msr:flex msr:h-full msr:w-12 msr:shrink-0 msr:items-center msr:border-l msr:border-ink-200 msr:focus-within:rounded-r-[5px] msr:focus-within:outline msr:focus-within:outline-1 msr:focus-within:outline-[#0d99ff] msr:focus-within:outline-offset-[-1px]">{right}</div>
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
      className={`msr:col-span-2 msr:grid msr:h-8 msr:w-full msr:appearance-none ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:text-left msr:text-[12px] msr:leading-none msr:text-ink-700`}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        style={{ justifySelf: "end" }}
        data-checked={checked ? "true" : undefined}
        className={cn(
          "mesurer-switch-track msr:flex msr:h-[14px] msr:w-[26px] msr:shrink-0 msr:items-center msr:rounded-full msr:border msr:p-px msr:transition-colors",
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
  inputMin = min,
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
  formatValue?: (value: number) => string
  parseInput?: (input: string) => number
}) {
  const thumbSize = 12
  const thumbInset = 8
  const sliderValue = Math.min(max, Math.max(min, value))
  const percentage = ((sliderValue - min) / (max - min)) * 100
  const [draftValue, setDraftValue] = useState(formatValue(value))
  const [editing, setEditing] = useState(false)
  const commitDraft = () => {
    const parsed = parseInput(draftValue)
    if (Number.isFinite(parsed)) {
      onChange(roundToTwo(Math.min(max, Math.max(inputMin, parsed))))
    }
    const next = Number.isFinite(parsed)
      ? roundToTwo(Math.min(max, Math.max(inputMin, parsed)))
      : value
    setDraftValue(formatValue(next))
    setEditing(false)
  }
  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const usableWidth = Math.max(1, rect.width - thumbInset * 2)
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left - thumbInset) / usableWidth))
    const rawValue = min + ratio * (max - min)
    const steppedValue =
      step === 1
        ? Math.round(rawValue)
        : Math.round((rawValue - min) / step) * step + min
    onChange(roundToTwo(Math.min(max, Math.max(min, steppedValue))))
  }

  return (
      <div className={`msr:col-span-2 msr:grid msr:h-8 msr:w-full ${SETTINGS_COLUMNS} msr:items-center msr:gap-0`}>
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
            aria-valuenow={sliderValue}
            aria-orientation="horizontal"
            onKeyDown={(event) => {
              event.stopPropagation()
              const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0
              if (event.key === "Home") onChange(min)
              else if (event.key === "End") onChange(max)
              else if (direction) {
                event.preventDefault()
               onChange(roundToTwo(Math.min(max, Math.max(inputMin, sliderValue + direction * step))))
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
             if (Number.isFinite(next)) onChange(roundToTwo(Math.min(max, Math.max(inputMin, next))))
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
                roundToTwo(Math.min(max, Math.max(inputMin, sliderValue + direction * step))),
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
    <div className={`msr:col-span-2 msr:grid msr:h-8 msr:w-full ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
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
             className="msr:h-full msr:w-full msr:bg-transparent msr:px-1 msr:text-left msr:font-mono msr:text-[12px] msr:tabular-nums msr:text-ink-700 msr:outline-none"
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

function SectionDivider() {
  return (
    <div
      aria-hidden="true"
      className="msr:h-px msr:w-full msr:shrink-0 msr:bg-[#e6e6e6]"
    />
  )
}

function SettingsSection({
  id,
  title,
  ariaLabel,
  focused = false,
  children,
}: {
  id: string
  title: string
  ariaLabel: string
  focused?: boolean
  children: ReactNode
}) {
  return (
    <section
      data-mesurer-settings-section={id}
      data-focused={focused ? "true" : undefined}
      className={`msr:grid msr:w-full ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:px-3 msr:py-2 msr:outline-none`}
      aria-label={ariaLabel}
    >
      <h2 className="msr:col-span-2 msr:flex msr:h-8 msr:items-center msr:text-[11px] msr:font-semibold msr:text-ink-500">
        {title}
      </h2>
      {children}
    </section>
  )
}

function FormatMultiSelect({
  ownerWindow,
  formats,
  selectedFormats,
  onChange,
}: {
  ownerWindow: Window
  formats: ColorPickerFormat[]
  selectedFormats: ColorPickerFormat[]
  onChange: (formats: ColorPickerFormat[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = `${useId()}-color-formats`

  useLayoutEffect(() => {
    const handlePointerDown = (event: Event) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    ownerWindow.document.addEventListener("pointerdown", handlePointerDown)
    return () => ownerWindow.document.removeEventListener("pointerdown", handlePointerDown)
  }, [ownerWindow])

  const toggleFormat = (format: ColorPickerFormat) => {
    if (selectedFormats.includes(format)) {
      if (selectedFormats.length === 1) return
      onChange(selectedFormats.filter((item) => item !== format))
      return
    }
    onChange([...selectedFormats, format])
  }

  const openMenu = () => {
    const selectedIndex = formats.findIndex((format) => selectedFormats.includes(format))
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0
    setActiveIndex(nextIndex)
    setOpen(true)
    return nextIndex
  }

  return (
    <div ref={containerRef} className="msr:relative msr:w-full">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label="Color formats"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        className="msr:relative msr:h-6 msr:w-full msr:rounded-[5px] msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:pr-6 msr:text-left msr:text-[11px] msr:text-ink-700 msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            event.stopPropagation()
            const nextIndex = open ? activeIndex : openMenu()
            setOpen(true)
            ownerWindow.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus())
          }
          if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
          }
        }}
      >
        {selectedFormats.join(", ")}
        <span aria-hidden="true" className="msr:pointer-events-none msr:absolute msr:right-2 msr:top-1/2 msr:size-1.5 msr:-translate-y-1/2 msr:rotate-45 msr:border-r msr:border-b msr:border-ink-500" />
      </button>
      {open ? (
        <div
          role="listbox"
          id={listboxId}
          aria-label="Color formats"
          aria-multiselectable="true"
          className="msr:absolute msr:left-0 msr:right-0 msr:top-full msr:z-10 msr:mt-1 msr:rounded-[5px] msr:border msr:border-ink-200 msr:bg-white msr:p-1 msr:shadow-md"
        >
          {formats.map((format, formatIndex) => {
            const selected = selectedFormats.includes(format)
            return (
              <button
                key={format}
                ref={(element) => { optionRefs.current[formatIndex] = element }}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={formatIndex === activeIndex ? 0 : -1}
                className={cn(
                  "msr:flex msr:h-6 msr:w-full msr:items-center msr:justify-between msr:rounded-[3px] msr:px-1.5 msr:text-left msr:text-[11px] msr:text-ink-700 msr:outline-none msr:hover:bg-ink-50 msr:focus-visible:bg-ink-50",
                )}
                onClick={() => toggleFormat(format)}
                onFocus={() => setActiveIndex(formatIndex)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault()
                    const direction = event.key === "ArrowDown" ? 1 : -1
                    const nextIndex = Math.min(formats.length - 1, Math.max(0, formatIndex + direction))
                    setActiveIndex(nextIndex)
                    optionRefs.current[nextIndex]?.focus()
                  }
                  if (event.key === "Home" || event.key === "End") {
                    event.preventDefault()
                    const nextIndex = event.key === "Home" ? 0 : formats.length - 1
                    setActiveIndex(nextIndex)
                    optionRefs.current[nextIndex]?.focus()
                  }
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault()
                    event.stopPropagation()
                    toggleFormat(format)
                  }
                  if (event.key === "Escape") {
                    event.preventDefault()
                    event.stopPropagation()
                    setOpen(false)
                    triggerRef.current?.focus()
                  }
                }}
              >
                <span>{format}</span>
                {selected ? <CheckIcon size={10} aria-hidden="true" className="msr:ml-auto msr:shrink-0 msr:text-ink-700" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function SettingsPanel({
  ownerWindow,
  select,
  guides,
  color,
  camera,
  rulers,
  text,
  arrows,
  focusSection,
  general,
}: SettingsPanelProps) {
  const { persistOnReload, setPersistOnReload, onResetSettings, onClearWorkspace } = general
  const { settings: screenshotSettings, setSettings: setScreenshotSettings } = camera
  const { settings: rulerSettings, setSettings: setRulerSettings } = rulers
  const { settings: textSettings, setSettings: setTextSettings } = text
  const {
    color: arrowColor,
    setColor: setArrowColor,
    snapArrowsEnabled,
    setSnapArrowsEnabled,
    arrowClickToPlace,
    setArrowClickToPlace,
  } = arrows
  const {
    highlightColor,
    setHighlightColor,
    hoverHighlight,
    setHoverHighlight,
    layoutDetailsEnabled,
    setLayoutDetailsEnabled,
    snapEnabled,
    setSnapEnabled,
    multiMeasureEnabled,
    setMultiMeasureEnabled,
  } = select
  const {
    guideColor,
    setGuideColor,
    guideStyle,
    setGuideStyle,
    snapGuidesEnabled,
    setSnapGuidesEnabled,
    guideHighlightEnabled,
    setGuideHighlightEnabled,
    selectNewGuideEnabled,
    setSelectNewGuideEnabled,
  } = guides
  const {
    colorFormats,
    setColorFormats,
    colorClickFormat,
    setColorClickFormat,
  } = color
  const patternTooltip = useTooltip()
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const view = panel.ownerDocument.defaultView

    const align = () => {
      panel.style.paddingBottom = "0px"
      if (!focusSection) {
        panel.scrollTop = 0
        return
      }
      const section = panel.querySelector<HTMLElement>(
        `[data-mesurer-settings-section="${focusSection}"]`,
      )
      if (!section) return
      const sectionTop = section.offsetTop
      const maxScrollWithoutPadding = Math.max(0, panel.scrollHeight - panel.clientHeight)
      const extraPadding = Math.max(0, sectionTop - maxScrollWithoutPadding)
      if (extraPadding > 0) {
        panel.style.paddingBottom = `${extraPadding}px`
      }
      const maxScroll = Math.max(0, panel.scrollHeight - panel.clientHeight)
      panel.scrollTop = Math.min(sectionTop, maxScroll)
    }

    align()
    let followUpFrame = 0
    const frame = view?.requestAnimationFrame(() => {
      align()
      followUpFrame = view.requestAnimationFrame(align)
    })
    const observer = new ResizeObserver(align)
    observer.observe(panel)
    return () => {
      observer.disconnect()
      if (frame) view?.cancelAnimationFrame(frame)
      if (followUpFrame) view?.cancelAnimationFrame(followUpFrame)
    }
  }, [focusSection])

  return (
    <div
      ref={panelRef}
      className="mesurer-settings-panel msr:relative msr:flex msr:h-full msr:w-full msr:min-w-0 msr:flex-col msr:gap-0 msr:overflow-y-auto"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <SettingsSection id="guides" title="Guides" ariaLabel="Guide settings" focused={focusSection === "guides"}>
        <ColorField label="Color" value={guideColor} fallback="#f97316" ownerWindow={ownerWindow} onChange={setGuideColor} />
        <SliderControl label="Weight" min={1} inputMin={0.01} max={4} step={1} value={guideStyle.width} formatValue={(value) => `${value}px`} parseInput={(input) => Number.parseFloat(input)} onChange={(value) => setGuideStyle((style) => ({ ...style, width: value }))} />
      <div className="msr:col-span-2 msr:grid msr:grid-cols-[78px_minmax(0,1fr)] msr:items-center msr:gap-0">
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
        <div className="msr:col-span-2"><SettingsSwitch label="Highlight" checked={guideHighlightEnabled} onChange={setGuideHighlightEnabled} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Select" checked={selectNewGuideEnabled} onChange={setSelectNewGuideEnabled} /></div>
      </SettingsSection>

      <SectionDivider />
      <SettingsSection id="arrows" title="Arrows" ariaLabel="Arrow settings" focused={focusSection === "arrows"}>
        <ColorField label="Color" value={arrowColor} fallback="#f97316" ownerWindow={ownerWindow} onChange={setArrowColor} />
        <div className="msr:col-span-2"><SettingsSwitch label="Snap" checked={snapArrowsEnabled} onChange={setSnapArrowsEnabled} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Click to place" checked={arrowClickToPlace} onChange={setArrowClickToPlace} /></div>
      </SettingsSection>

      <SectionDivider />
      <SettingsSection id="text" title="Text" ariaLabel="Text settings" focused={focusSection === "text"}>
        <ColorField label="Color" value={textSettings.color} fallback="#000000" ownerWindow={ownerWindow} onChange={(color) => setTextSettings((style) => ({ ...style, color }))} />
        <label className={`msr:col-span-2 msr:grid msr:h-8 ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
          <span>Font</span>
          <span className="msr:relative msr:block msr:w-full">
            <select
              aria-label="Font"
              value={textSettings.font}
              className="msr:h-6 msr:w-full msr:appearance-none msr:rounded-[5px] msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:pr-6 msr:text-[11px] msr:outline-none msr:focus:shadow-[inset_0_0_0_1px_#0d99ff]"
              onChange={(event) =>
                setTextSettings((style) => ({ ...style, font: event.target.value as TextFont }))
              }
            >
              {TEXT_FONT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <span aria-hidden="true" className="msr:pointer-events-none msr:absolute msr:right-2 msr:top-1/2 msr:size-1.5 msr:-translate-y-1/2 msr:rotate-45 msr:border-r msr:border-b msr:border-ink-500" />
          </span>
        </label>
      </SettingsSection>

      <SectionDivider />
      <SettingsSection id="selection" title="Selection" ariaLabel="Selection settings" focused={focusSection === "selection"}>
        <ColorField label="Color" value={highlightColor} fallback="#0d99ff" ownerWindow={ownerWindow} onChange={setHighlightColor} />
        <div className="msr:col-span-2"><SettingsSwitch label="Hover" checked={hoverHighlight} onChange={setHoverHighlight} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Spacing" checked={layoutDetailsEnabled} onChange={setLayoutDetailsEnabled} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Element snap" checked={snapEnabled} onChange={setSnapEnabled} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Stack" checked={multiMeasureEnabled} onChange={setMultiMeasureEnabled} /></div>
      </SettingsSection>

      <SectionDivider />
      <SettingsSection id="color" title="Color picker" ariaLabel="Color settings" focused={focusSection === "color"}>
        <div className={`msr:col-span-2 msr:grid msr:min-h-8 ${SETTINGS_COLUMNS} msr:items-start msr:gap-0`}>
          <span className="msr:flex msr:h-8 msr:items-center msr:text-[12px] msr:text-ink-700">Format</span>
          <FormatMultiSelect ownerWindow={ownerWindow} formats={COLOR_FORMATS} selectedFormats={colorFormats} onChange={setColorFormats} />
        </div>
        <label className={`msr:col-span-2 msr:grid msr:h-8 ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
          <span>Copy</span>
          <span className="msr:relative msr:block msr:w-full">
            <select value={colorClickFormat} className="msr:h-6 msr:w-full msr:appearance-none msr:rounded-[5px] msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:pr-6 msr:text-[11px] msr:outline-none msr:focus:shadow-[inset_0_0_0_1px_#0d99ff]" onChange={(event) => setColorClickFormat(event.target.value as ColorPickerFormat)}>
              {COLOR_FORMATS.map((format) => <option key={format} value={format}>{format}</option>)}
            </select>
            <span aria-hidden="true" className="msr:pointer-events-none msr:absolute msr:right-2 msr:top-1/2 msr:size-1.5 msr:-translate-y-1/2 msr:rotate-45 msr:border-r msr:border-b msr:border-ink-500" />
          </span>
        </label>
      </SettingsSection>

      <SectionDivider />
      <SettingsSection id="screenshot" title="Screenshot" ariaLabel="Screenshot settings" focused={focusSection === "screenshot"}>
        <div className="msr:col-span-2">
          <SettingsSwitch
            label="Copy"
            checked={screenshotSettings.copy}
            onChange={(copy) =>
              setScreenshotSettings((settings) => ({
                copy,
                download: copy ? settings.download : true,
              }))
            }
          />
        </div>
        <div className="msr:col-span-2">
          <SettingsSwitch
            label="Download"
            checked={screenshotSettings.download}
            onChange={(download) =>
              setScreenshotSettings((settings) => ({
                download,
                copy: download ? settings.copy : true,
              }))
            }
          />
        </div>
      </SettingsSection>

      <SectionDivider />
      <SettingsSection id="rulers" title="Rulers" ariaLabel="Ruler settings" focused={focusSection === "rulers"}>
        <SliderControl label="Opacity" min={0.2} max={1} step={0.05} value={rulerSettings.opacity} formatValue={(value) => `${Math.round(value * 100)}%`} parseInput={(input) => Number.parseFloat(input) / 100} onChange={(value) => setRulerSettings((settings) => ({ ...settings, opacity: value }))} />
        <div className="msr:col-span-2"><SettingsSwitch label="Edge reveal" checked={rulerSettings.edgeReveal} onChange={(edgeReveal) => setRulerSettings((settings) => ({ ...settings, edgeReveal }))} /></div>
      </SettingsSection>

      <SectionDivider />
      <SettingsSection id="general" title="General" ariaLabel="General settings">
        <div className="msr:col-span-2"><SettingsSwitch label="Persist" checked={persistOnReload} onChange={setPersistOnReload} /></div>
        <div className={`msr:col-span-2 msr:grid msr:h-8 ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
          <span>Version</span>
          <span className="msr:justify-self-end msr:font-mono msr:text-[11px] msr:tabular-nums msr:text-ink-700">{packageManifest.version}</span>
        </div>
        <div className="msr:col-span-2 msr:flex msr:h-8 msr:w-full msr:justify-end msr:gap-1">
          <button
            type="button"
            aria-label="Reset settings to defaults"
            className="msr:h-6 msr:rounded-[5px] msr:border msr:border-ink-200 msr:px-2 msr:text-[11px] msr:text-ink-700 msr:hover:bg-ink-50 msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]"
            onClick={onResetSettings}
          >
            Use defaults
          </button>
          <button
            type="button"
            aria-label="Clear workspace"
            className="msr:h-6 msr:rounded-[5px] msr:border msr:border-red-200 msr:px-2 msr:text-[11px] msr:text-red-600 msr:hover:bg-red-50 msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_#ef4444]"
            onClick={onClearWorkspace}
          >
            Clear workspace
          </button>
        </div>
      </SettingsSection>
    </div>
  )
}

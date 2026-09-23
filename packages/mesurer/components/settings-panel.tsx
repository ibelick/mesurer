"use client"

import { useId, useLayoutEffect, useRef, useState, type Dispatch, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction } from "react"
import packageManifest from "../package.json"
import type { ColorPickerFormat } from "../core/colors"
import { cn } from "../core/utils"
import { ColorField, ControlShell, SETTINGS_COLUMNS } from "./control-field"
import { CheckIcon } from "./icons"
import { SettingsButton } from "./settings-button"
import { Tooltip, useTooltip } from "./tooltip"
import type { GuideStyle, InfoCardMode, RulerSettings, ScreenshotSettings, ThemeMode } from "../core/persistence"
import { TEXT_FONT_OPTIONS, type TextFont, type TextStyleSettings } from "../core/text-style"
import type { ToolMode } from "../core/types"
import { getReleaseChannel } from "../core/extension-install"

export type SettingsFocusSection =
  | "guides"
  | "arrows"
  | "text"
  | "inspect"
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
  if (toolMode === "select" || toolMode === "selection") return "inspect"
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
  infoCardMode: InfoCardMode
  setInfoCardMode: Dispatch<SetStateAction<InfoCardMode>>
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
    shortcutsEnabled: boolean
    setShortcutsEnabled: Dispatch<SetStateAction<boolean>>
    theme: ThemeMode
    setTheme: Dispatch<SetStateAction<ThemeMode>>
    onMinimize: () => void
    onResetSettings: () => void
    onClearWorkspace: () => void
  }
}

const COLOR_FORMATS: ColorPickerFormat[] = ["hex", "rgb", "hsl", "oklch"]
const GUIDE_PATTERNS: Array<{ value: GuideStyle["pattern"]; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
]

const roundToTwo = (value: number) => Number(value.toFixed(2))

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
         data-checked={checked ? "true" : "false"}
        className={cn(
          "mesurer-switch-track msr:flex msr:h-[14px] msr:w-[26px] msr:shrink-0 msr:items-center msr:rounded-full msr:border msr:p-px msr:transition-colors",
          checked ? "msr:border-[#0d99ff] msr:bg-[#0d99ff]" : "msr:border-ink-200 msr:bg-ink-50",
        )}
      >
        <span
           className={cn(
             "mesurer-control-thumb msr:block msr:size-[10px] msr:shrink-0 msr:rounded-full msr:transition-transform",
             "mesurer-switch-thumb msr:bg-white",
           )}
           data-checked={checked ? "true" : "false"}
           style={{
             transform: `translateX(${checked ? 12 : 0}px)`,
           }}
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
             style={{ top: 8, height: 4, backgroundColor: "var(--msr-slider-track)" }}
            aria-hidden="true"
          />
          <div
             className="msr:absolute msr:left-[8px] msr:rounded-full"
             style={{ top: 8, width: `calc(${percentage}% - ${percentage * thumbInset * 2 / 100}px)`, height: 4, backgroundColor: "var(--msr-accent)" }}
            aria-hidden="true"
          />
          <div
             className="mesurer-control-thumb msr:absolute msr:rounded-control msr:bg-white msr:shadow-[0_1px_2px_rgb(0_0_0_/_0.06)] msr:transition-shadow msr:outline-none msr:focus-visible:ring-1 msr:focus-visible:ring-[var(--msr-accent)]/25"
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

function SectionDivider() {
  return (
    <div
      aria-hidden="true"
      className="mesurer-section-divider msr:h-px msr:w-full msr:shrink-0"
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
  closeRef,
}: {
  ownerWindow: Window
  formats: ColorPickerFormat[]
  selectedFormats: ColorPickerFormat[]
  onChange: (formats: ColorPickerFormat[]) => void
  closeRef: MutableRefObject<(() => void) | null>
}) {
  const [open, setOpen] = useState(false)
  const [menuSide, setMenuSide] = useState<"top" | "bottom">("bottom")
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = `${useId()}-color-formats`

  useLayoutEffect(() => {
    closeRef.current = () => setOpen(false)
    return () => {
      closeRef.current = null
    }
  }, [closeRef])

  useLayoutEffect(() => {
    const handlePointerDown = (event: Event) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    ownerWindow.document.addEventListener("pointerdown", handlePointerDown, true)
    ownerWindow.document.addEventListener("click", handlePointerDown, true)
    return () => {
      ownerWindow.document.removeEventListener("pointerdown", handlePointerDown, true)
      ownerWindow.document.removeEventListener("click", handlePointerDown, true)
    }
  }, [ownerWindow])

  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const listbox = listboxRef.current
    if (!trigger || !listbox) return

    const updatePlacement = () => {
      const triggerRect = trigger.getBoundingClientRect()
      const listboxHeight = listbox.getBoundingClientRect().height
      const edgePadding = 8
      const belowFits = triggerRect.bottom + 4 + listboxHeight <= ownerWindow.innerHeight - edgePadding
      const aboveFits = triggerRect.top - 4 - listboxHeight >= edgePadding
      setMenuSide(belowFits || !aboveFits ? "bottom" : "top")
    }

    updatePlacement()
    ownerWindow.addEventListener("resize", updatePlacement)
    ownerWindow.addEventListener("scroll", updatePlacement, true)
    const resizeObserver = new ResizeObserver(updatePlacement)
    resizeObserver.observe(listbox)
    return () => {
      ownerWindow.removeEventListener("resize", updatePlacement)
      ownerWindow.removeEventListener("scroll", updatePlacement, true)
      resizeObserver.disconnect()
    }
  }, [open, ownerWindow])

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
    <div ref={containerRef} data-mesurer-format-select="true" className="msr:relative msr:w-full">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label="Color formats"
        aria-expanded={open}
         aria-haspopup="listbox"
         aria-controls={listboxId}
         onBlur={(event) => {
           if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
         }}
         className="mesurer-settings-select msr:relative msr:h-6 msr:w-full msr:rounded-control msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:pr-6 msr:text-left msr:text-[11px] msr:text-ink-700 msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)]"
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
          ref={listboxRef}
          role="listbox"
          id={listboxId}
          aria-label="Color formats"
          aria-multiselectable="true"
            className={`mesurer-settings-select-menu msr:absolute msr:left-0 msr:right-0 msr:z-10 msr:rounded-control msr:bg-white msr:p-1 msr:shadow-floating ${menuSide === "bottom" ? "msr:top-full msr:mt-1" : "msr:bottom-full msr:mb-1"}`}
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
                   "msr:flex msr:h-6 msr:w-full msr:items-center msr:justify-between msr:rounded-[3px] msr:px-1.5 msr:text-left msr:text-[11px] msr:text-ink-700 msr:outline-none msr:hover:bg-ink-100 msr:focus-visible:bg-ink-100",
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
  const releaseChannel = getReleaseChannel()
  const formatMenuCloseRef = useRef<(() => void) | null>(null)
  const {
    persistOnReload,
    setPersistOnReload,
    shortcutsEnabled,
    setShortcutsEnabled,
    theme,
    setTheme,
    onMinimize,
    onResetSettings,
    onClearWorkspace,
  } = general
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
    infoCardMode,
    setInfoCardMode,
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
      className="mesurer-settings-panel mesurer-thin-scrollbar msr:relative msr:flex msr:h-full msr:w-full msr:min-w-0 msr:flex-col msr:gap-0 msr:overflow-y-auto"
      onPointerDownCapture={(event) => {
        const target = event.target as Element | null
        if (formatMenuCloseRef.current && !target?.closest("[data-mesurer-format-select]")) {
          formatMenuCloseRef.current()
        }
      }}
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
                     "msr:relative msr:flex msr:h-6 msr:min-w-0 msr:flex-1 msr:items-center msr:justify-center msr:rounded-control msr:border msr:px-1 msr:focus-visible:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)]",
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
              className="msr:h-6 msr:w-full msr:appearance-none msr:rounded-control msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:pr-6 msr:text-[11px] msr:outline-none msr:focus:shadow-[inset_0_0_0_1px_var(--msr-accent)]"
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
      <SettingsSection id="inspect" title="Inspect" ariaLabel="Inspect settings" focused={focusSection === "inspect"}>
        <ColorField label="Color" value={highlightColor} fallback="#0d99ff" ownerWindow={ownerWindow} onChange={setHighlightColor} />
        <div className="msr:col-span-2"><SettingsSwitch label="Hover" checked={hoverHighlight} onChange={setHoverHighlight} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Spacing" checked={layoutDetailsEnabled} onChange={setLayoutDetailsEnabled} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Element snap" checked={snapEnabled} onChange={setSnapEnabled} /></div>
        <div className="msr:col-span-2"><SettingsSwitch label="Stack" checked={multiMeasureEnabled} onChange={setMultiMeasureEnabled} /></div>
        <label className={`msr:col-span-2 msr:grid msr:h-8 ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
          <span>Info card</span>
          <select
            aria-label="Info card mode"
            value={infoCardMode}
            className="msr:h-6 msr:w-full msr:rounded-control msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:text-[11px] msr:outline-none msr:focus:shadow-[inset_0_0_0_1px_var(--msr-accent)]"
            onChange={(event) => setInfoCardMode(event.target.value as InfoCardMode)}
          >
            <option value="click">Click</option>
            <option value="hover">Hover</option>
          </select>
        </label>
      </SettingsSection>

      <SectionDivider />
      <SettingsSection id="color" title="Color picker" ariaLabel="Color settings" focused={focusSection === "color"}>
        <div className={`msr:col-span-2 msr:grid msr:min-h-8 ${SETTINGS_COLUMNS} msr:items-start msr:gap-0`}>
          <span className="msr:flex msr:h-8 msr:items-center msr:text-[12px] msr:text-ink-700">Format</span>
           <FormatMultiSelect closeRef={formatMenuCloseRef} ownerWindow={ownerWindow} formats={COLOR_FORMATS} selectedFormats={colorFormats} onChange={setColorFormats} />
        </div>
        <label className={`msr:col-span-2 msr:grid msr:h-8 ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
          <span>Copy</span>
          <span className="msr:relative msr:block msr:w-full">
            <select value={colorClickFormat} className="msr:h-6 msr:w-full msr:appearance-none msr:rounded-control msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:pr-6 msr:text-[11px] msr:outline-none msr:focus:shadow-[inset_0_0_0_1px_var(--msr-accent)]" onChange={(event) => setColorClickFormat(event.target.value as ColorPickerFormat)}>
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
        <div className="msr:col-span-2"><SettingsSwitch label="Shortcuts" checked={shortcutsEnabled} onChange={setShortcutsEnabled} /></div>
        <label className={`msr:col-span-2 msr:grid msr:h-8 ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
          <span>Appearance</span>
          <select aria-label="Appearance" value={theme} className="msr:h-6 msr:w-full msr:appearance-none msr:rounded-control msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:text-[11px] msr:outline-none msr:focus:shadow-[inset_0_0_0_1px_var(--msr-accent)]" onChange={(event) => setTheme(event.target.value as ThemeMode)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <div className={`msr:col-span-2 msr:grid msr:h-8 ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
          <span>Toolbar</span>
          <SettingsButton
            aria-label="Minimize toolbar"
            className="msr:justify-self-end"
            onClick={onMinimize}
          >
            Minimize
          </SettingsButton>
        </div>
        <div className={`msr:col-span-2 msr:grid msr:h-8 ${SETTINGS_COLUMNS} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
          <span>Version</span>
          <span className="msr:justify-self-end msr:font-mono msr:text-[11px] msr:tabular-nums msr:text-ink-700">
            {releaseChannel ? `${releaseChannel} ${packageManifest.version}` : packageManifest.version}
          </span>
        </div>
        <div className="msr:col-span-2 msr:flex msr:h-8 msr:w-full msr:items-center msr:justify-end msr:gap-1">
          <SettingsButton
            aria-label="Reset settings to defaults"
            onClick={onResetSettings}
          >
            Use defaults
          </SettingsButton>
          <SettingsButton
            aria-label="Clear workspace"
            variant="danger"
            onClick={onClearWorkspace}
          >
            Clear workspace
          </SettingsButton>
        </div>
      </SettingsSection>
    </div>
  )
}

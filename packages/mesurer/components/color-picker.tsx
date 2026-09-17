"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { ColorPickerFormat, ColorSample } from "../core/colors"
import { colorToHex, formatColor } from "../core/colors"
import { cn } from "../core/utils"
import { clampOverlayPosition } from "../core/overlay-position"
import { CopyableValue } from "./copyable-value"
import { useTooltip } from "./tooltip"

type ColorPickerProps = {
  active: boolean
  sample: ColorSample | null
  unsupported: boolean
  formats: ColorPickerFormat[]
  favoriteFormat: ColorPickerFormat
  ownerWindow: Window
  onClose: () => void
}

export function ColorPicker({
  active,
  sample,
  unsupported,
  formats,
  favoriteFormat,
  ownerWindow,
  onClose,
}: ColorPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState<"top" | "bottom">("bottom")
  const tooltip = useTooltip()

  const copyValue = useCallback(
    (value: string) => {
      const clipboardWrite = ownerWindow.navigator.clipboard?.writeText(value)
      void clipboardWrite?.catch(() => undefined)
      tooltip.onTooltipLeave()
    },
    [ownerWindow, tooltip],
  )

  useEffect(() => {
    if (!active) return
    let closeTimer: number | null = null
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const panel = panelRef.current
      if (panel && event.composedPath().includes(panel)) return
      closeTimer = ownerWindow.setTimeout(onClose, 0)
    }
    ownerWindow.addEventListener("pointerdown", closeOnOutsidePointerDown)
    return () => {
      if (closeTimer !== null) ownerWindow.clearTimeout(closeTimer)
      ownerWindow.removeEventListener("pointerdown", closeOnOutsidePointerDown)
    }
  }, [active, onClose, ownerWindow])

  useLayoutEffect(() => {
    if (!active) return
    const panel = panelRef.current
    const origin = panel?.offsetParent
    if (!panel || !(origin instanceof HTMLElement)) return

    let frame = 0
    let scheduled = false
    const updatePosition = () => {
      scheduled = false
      const panel = panelRef.current
      const origin = panel?.offsetParent
      if (!panel || !(origin instanceof HTMLElement)) return
      const originRect = origin.getBoundingClientRect()
      const button = origin.querySelector("[data-tool-id='color-picker']")
      const buttonRect = button?.getBoundingClientRect() ?? originRect
      const panelWidth = panel.offsetWidth
      const panelHeight = panel.offsetHeight
       const position = clampOverlayPosition({
         left: buttonRect.left,
         top: originRect.bottom + 8,
         width: panelWidth,
         height: panelHeight,
         viewportWidth: ownerWindow.innerWidth,
         viewportHeight: ownerWindow.innerHeight,
       })
       panel.style.left = `${position.left - originRect.left}px`
      const belowFits =
        originRect.bottom + 8 + panelHeight <= ownerWindow.innerHeight - 8
      setSide(belowFits ? "bottom" : "top")
    }
    const schedulePosition = () => {
      if (scheduled) return
      scheduled = true
      frame = ownerWindow.requestAnimationFrame(updatePosition)
    }

    schedulePosition()
    ownerWindow.addEventListener("resize", schedulePosition)
    ownerWindow.addEventListener("scroll", schedulePosition, true)
    const resizeObserver = new ResizeObserver(schedulePosition)
    resizeObserver.observe(origin)
    resizeObserver.observe(panel)
    return () => {
      if (scheduled) ownerWindow.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      ownerWindow.removeEventListener("resize", schedulePosition)
      ownerWindow.removeEventListener("scroll", schedulePosition, true)
    }
  }, [active, ownerWindow, sample, unsupported])

  if (!active || (!sample && !unsupported)) return null

  const headerFormat = formats.includes(favoriteFormat)
    ? favoriteFormat
    : formats[0]
  const secondaryFormats = headerFormat
    ? formats.filter((format) => format !== headerFormat)
    : []

  return (
    <div
      ref={panelRef}
      className={cn(
        "mesurer-color-picker msr:pointer-events-auto msr:absolute msr:left-0 msr:z-[100] msr:w-max msr:min-w-36 msr:cursor-default msr:rounded-lg msr:border msr:border-black/10 msr:bg-white msr:px-2 msr:py-2 msr:font-mono msr:text-[10px] msr:leading-4 msr:shadow-floating",
        side === "bottom" ? "msr:top-full msr:mt-2" : "msr:bottom-full msr:mb-2",
      )}
      role="dialog"
      aria-label="Selected color values"
      onMouseLeave={tooltip.onTooltipContainerLeave}
    >
      {unsupported ? (
        <div className="msr:flex msr:items-start msr:gap-2">
          <span className="msr:text-black/60">Screen color picker unavailable.</span>
          <button
            type="button"
            className="msr:text-black/45 msr:hover:text-black"
            aria-label="Close color picker message"
            onClick={onClose}
          >
            x
          </button>
        </div>
      ) : sample ? (
        <>
          {headerFormat ? (
            <div
              className={
                secondaryFormats.length > 0
                  ? "msr:mb-1 msr:flex msr:items-center msr:gap-1.5 msr:border-b msr:border-black/8 msr:pb-1"
                  : "msr:flex msr:items-center msr:gap-1.5"
              }
            >
              <span
                className="msr:size-3 msr:shrink-0 msr:rounded-full msr:border msr:border-black/15"
                style={{ backgroundColor: colorToHex(sample) }}
                aria-hidden="true"
              />
              <CopyableValue
                id={headerFormat}
                value={formatColor(sample, headerFormat)}
                onCopy={() =>
                  copyValue(formatColor(sample, headerFormat))
                }
                tooltip={tooltip}
                className="msr:cursor-default msr:font-medium msr:tabular-nums msr:text-black msr:hover:underline"
              />
            </div>
          ) : (
            <div className="msr:flex msr:items-center">
              <span
                className="msr:size-3 msr:shrink-0 msr:rounded-full msr:border msr:border-black/15"
                style={{ backgroundColor: colorToHex(sample) }}
                aria-hidden="true"
              />
            </div>
          )}
          {secondaryFormats.map((format) => {
            const value = formatColor(sample, format)
            return (
              <div key={format} className="msr:flex msr:items-center msr:gap-2">
                <span className="msr:w-9 msr:text-black/45">
                  {format}
                </span>
                <CopyableValue
                  id={format}
                  value={value}
                  onCopy={() => copyValue(value)}
                  tooltip={tooltip}
                  className="msr:cursor-default msr:tabular-nums msr:text-black msr:hover:underline"
                />
              </div>
            )
          })}
        </>
      ) : null}
    </div>
  )
}

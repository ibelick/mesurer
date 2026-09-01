"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import type { ColorPickerFormat, ColorSample } from "../core/colors"
import { colorToHex, formatColor } from "../core/colors"
import { cn } from "../core/utils"
import { Tooltip, useTooltip } from "./tooltip"

type ColorPickerProps = {
  active: boolean
  sample: ColorSample | null
  unsupported: boolean
  formats: ColorPickerFormat[]
  favoriteFormat: ColorPickerFormat
  ownerWindow: Window
  onClose: () => void
}

type CopyableColorValueProps = {
  id: string
  value: string
  copiedId: string | null
  onCopy: () => void
  onTooltipEnter: (id: string) => void
  tooltip: ReturnType<typeof useTooltip>
  className?: string
}

function CopyableColorValue({
  id,
  value,
  copiedId,
  onCopy,
  onTooltipEnter,
  tooltip,
  className,
}: CopyableColorValueProps) {
  const copied = copiedId === id
  const showTooltip =
    tooltip.visibleTooltipId === id ||
    (copied && tooltip.visibleTooltipId === null)

  return (
    <span
      className="msr:relative msr:inline-flex"
      onMouseLeave={tooltip.onTooltipLeave}
    >
      <button
        type="button"
        className={className}
        onMouseEnter={() => onTooltipEnter(id)}
        onFocus={() => onTooltipEnter(id)}
        onBlur={tooltip.onTooltipLeave}
        onClick={onCopy}
      >
        {value}
      </button>
      <Tooltip
        label={copied ? "Copied!" : "Click to copy"}
        visible={showTooltip}
        instant={copied || tooltip.tooltipInstant}
        side="bottom"
        className="msr:z-10"
      />
    </span>
  )
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
  const copyTimeoutRef = useRef<number | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [side, setSide] = useState<"top" | "bottom">("bottom")
  const tooltip = useTooltip()

  const copyValue = useCallback(
    (id: string, value: string) => {
      const clipboardWrite = ownerWindow.navigator.clipboard?.writeText(value)
      void clipboardWrite?.catch(() => undefined)
      tooltip.onTooltipLeave()
      setCopiedId(id)
      if (copyTimeoutRef.current !== null) {
        ownerWindow.clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = ownerWindow.setTimeout(() => {
        copyTimeoutRef.current = null
        setCopiedId(null)
      }, 1500)
    },
    [ownerWindow, tooltip],
  )

  const handleTooltipEnter = useCallback(
    (id: string) => {
      if (copiedId !== null && copiedId !== id) {
        if (copyTimeoutRef.current !== null) {
          ownerWindow.clearTimeout(copyTimeoutRef.current)
          copyTimeoutRef.current = null
        }
        setCopiedId(null)
      }
      tooltip.onTooltipEnter(id)
    },
    [copiedId, ownerWindow, tooltip],
  )

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
      const minLeft = 8 - originRect.left
      const maxLeft = ownerWindow.innerWidth - 8 - panelWidth - originRect.left
      let left = buttonRect.left - originRect.left
      left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft))
      panel.style.left = `${left}px`
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
      if (copyTimeoutRef.current !== null) {
        ownerWindow.clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = null
      }
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
        "mesurer-color-picker msr:pointer-events-auto msr:absolute msr:left-0 msr:z-[100] msr:w-max msr:min-w-36 msr:rounded-lg msr:border msr:border-black/10 msr:bg-white msr:px-2 msr:py-2 msr:font-mono msr:text-[10px] msr:leading-4 msr:shadow-lg",
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
              <CopyableColorValue
                id={headerFormat}
                value={formatColor(sample, headerFormat)}
                copiedId={copiedId}
                onCopy={() =>
                  copyValue(headerFormat, formatColor(sample, headerFormat))
                }
                onTooltipEnter={handleTooltipEnter}
                tooltip={tooltip}
                className="msr:font-medium msr:tabular-nums msr:text-black msr:hover:underline"
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
                <CopyableColorValue
                  id={format}
                  value={value}
                  copiedId={copiedId}
                  onCopy={() => copyValue(format, value)}
                  onTooltipEnter={handleTooltipEnter}
                  tooltip={tooltip}
                  className="msr:tabular-nums msr:text-black msr:hover:underline"
                />
              </div>
            )
          })}
        </>
      ) : null}
    </div>
  )
}

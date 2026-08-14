"use client"

import type { MutableRefObject } from "react"
import { useLayoutEffect, useRef } from "react"
import type { ColorPickerFormat, ColorSample } from "../core/colors"
import { colorToHex, formatColor } from "../core/colors"

type ColorPickerProps = {
  active: boolean
  sample: ColorSample | null
  unsupported: boolean
  formats: ColorPickerFormat[]
  ownerWindow: Window
  toolbarRef: MutableRefObject<HTMLDivElement | null>
  onClose: () => void
}

export function ColorPicker({
  active,
  sample,
  unsupported,
  formats,
  ownerWindow,
  toolbarRef,
  onClose,
}: ColorPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!active) return
    const panel = panelRef.current
    const toolbar = toolbarRef.current
    if (!panel || !toolbar) return

    let frame = 0
    const updatePosition = () => {
      const toolbarRect = toolbar.getBoundingClientRect()
      const panelRect = panel.getBoundingClientRect()
      const left = Math.min(
        Math.max(8, toolbarRect.left),
        ownerWindow.innerWidth - panelRect.width - 8,
      )
      const belowTop = toolbarRect.bottom + 8
      const aboveTop = toolbarRect.top - panelRect.height - 8
      const top = belowTop + panelRect.height <= ownerWindow.innerHeight
        ? belowTop
        : Math.max(8, aboveTop)
      panel.style.left = `${left}px`
      panel.style.top = `${top}px`
      frame = ownerWindow.requestAnimationFrame(updatePosition)
    }

    frame = ownerWindow.requestAnimationFrame(updatePosition)
    return () => ownerWindow.cancelAnimationFrame(frame)
  }, [active, ownerWindow, toolbarRef, formats, sample, unsupported])

  if (!active || (!sample && !unsupported)) return null

  return (
    <div
      ref={panelRef}
      className="mesurer-color-picker msr:pointer-events-auto msr:fixed msr:z-[80] msr:min-w-44 msr:rounded-lg msr:border msr:border-black/10 msr:bg-white msr:px-3 msr:py-2.5 msr:font-mono msr:text-[11px] msr:leading-5 msr:shadow-lg"
      role="dialog"
      aria-label="Selected color values"
    >
      {unsupported ? (
        <div className="msr:flex msr:items-start msr:gap-2">
          <span className="msr:text-black/60">Color picker is not supported in this browser.</span>
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
          <div className="msr:mb-1.5 msr:flex msr:items-center msr:gap-2 msr:border-b msr:border-black/8 msr:pb-1.5">
            <span
              className="msr:size-4 msr:rounded-full msr:border msr:border-black/15"
              style={{ backgroundColor: colorToHex(sample) }}
              aria-hidden="true"
            />
            <span className="msr:font-medium msr:text-black">{colorToHex(sample)}</span>
          </div>
          {formats.map((format) => (
            <div key={format} className="msr:flex msr:items-center msr:gap-2">
              <span className="msr:w-10 msr:text-[10px] msr:uppercase msr:text-black/45">
                {format.toUpperCase()}
              </span>
              <button
                type="button"
                className="msr:select-text msr:tabular-nums msr:text-black msr:hover:underline"
                onClick={() => {
                  const clipboardWrite = ownerWindow.navigator.clipboard?.writeText(
                    formatColor(sample, format),
                  )
                  void clipboardWrite?.catch(() => undefined)
                }}
              >
                {formatColor(sample, format)}
              </button>
            </div>
          ))}
        </>
      ) : null}
    </div>
  )
}

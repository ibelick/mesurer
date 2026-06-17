"use client"

import { memo } from "react"
import type { EdgeVisibility } from "../core/edge-visibility"
import { MeasureTag } from "./measure-tag"

type Rect = {
  left: number
  top: number
  width: number
  height: number
}

type SelectedMeasurement = {
  rect: Rect
  paddingRect: Rect
  marginRect: Rect
  originRect?: Rect
}

type SelectedMeasurementBoxProps = {
  measurement: SelectedMeasurement
  transitionMs: number
  labelOffset: number
  edgeVisibility?: EdgeVisibility
}

const formatValue = (value: number) => Math.round(value)

export const SelectedMeasurementBox = memo(function SelectedMeasurementBox({
  measurement,
  transitionMs,
  labelOffset,
  edgeVisibility,
}: SelectedMeasurementBoxProps) {
  const edges =
    edgeVisibility ??
    ({ top: true, right: true, bottom: true, left: true } as EdgeVisibility)
  const displayRect = measurement.rect
  const outlineColor =
    "color-mix(in oklch, oklch(0.62 0.18 255) 80%, transparent)"
  const fillColor = "color-mix(in oklch, oklch(0.62 0.18 255) 8%, transparent)"

  return (
    <div className="msr:pointer-events-none">
      <div
        className="msr:absolute"
        style={{
          left: displayRect.left,
          top: displayRect.top,
          width: displayRect.width,
          height: displayRect.height,
          backgroundColor: fillColor,
          transition: `left ${transitionMs}ms ease, top ${transitionMs}ms ease, width ${transitionMs}ms ease, height ${transitionMs}ms ease`,
        }}
      >
        {edges.top ? (
          <div
            className="msr:absolute msr:left-0 msr:top-0 msr:h-px msr:w-full"
            style={{ backgroundColor: outlineColor }}
          />
        ) : null}
        {edges.right ? (
          <div
            className="msr:absolute msr:right-0 msr:top-0 msr:h-full msr:w-px"
            style={{ backgroundColor: outlineColor }}
          />
        ) : null}
        {edges.bottom ? (
          <div
            className="msr:absolute msr:bottom-0 msr:left-0 msr:h-px msr:w-full"
            style={{ backgroundColor: outlineColor }}
          />
        ) : null}
        {edges.left ? (
          <div
            className="msr:absolute msr:left-0 msr:top-0 msr:h-full msr:w-px"
            style={{ backgroundColor: outlineColor }}
          />
        ) : null}
      </div>
      <MeasureTag
        className="msr:-translate-x-1/2 msr:bg-ink-900/90"
        style={{
          left: displayRect.left + displayRect.width / 2,
          top: displayRect.top + displayRect.height + labelOffset,
          transition: `left ${transitionMs}ms ease, top ${transitionMs}ms ease`,
        }}
      >
        {formatValue(displayRect.width)} x {formatValue(displayRect.height)}
      </MeasureTag>
    </div>
  )
})

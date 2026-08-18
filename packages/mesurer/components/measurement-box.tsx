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

type MeasurementBoxMeasurement = {
  rect: Rect
  originRect?: Rect
}

type MeasurementBoxProps = {
  measurement: MeasurementBoxMeasurement
  transitionMs: number
  labelOffset: number
  edgeVisibility?: EdgeVisibility
  outlineColor: string
  fillColor: string
}

const formatValue = (value: number) => Math.round(value)

export const MeasurementBox = memo(function MeasurementBox({
  measurement,
  transitionMs,
  labelOffset,
  edgeVisibility,
  outlineColor,
  fillColor,
}: MeasurementBoxProps) {
  const edges =
    edgeVisibility ??
    ({ top: true, right: true, bottom: true, left: true } as EdgeVisibility)
  const displayRect = measurement.rect
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

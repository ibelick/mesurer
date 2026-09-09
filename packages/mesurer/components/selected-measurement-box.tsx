"use client"

import { memo } from "react"
import type { EdgeVisibility } from "../core/edge-visibility"
import type { InspectMeasurement } from "../core/types"

type SelectedMeasurementBoxProps = {
  measurement: InspectMeasurement
  transitionMs: number
  edgeVisibility?: EdgeVisibility
  outlineColor: string
  fillColor: string
}

export const SelectedMeasurementBox = memo(function SelectedMeasurementBox({
  measurement,
  transitionMs,
  edgeVisibility,
  outlineColor,
  fillColor,
}: SelectedMeasurementBoxProps) {
  const edges =
    edgeVisibility ??
    ({ top: true, right: true, bottom: true, left: true } as EdgeVisibility)
  const displayRect = measurement.rect
  return (
    <div className="msr:pointer-events-none" data-mesurer-selected-measurement="true">
      <div
        className="msr:absolute"
        style={{
          left: displayRect.left,
          top: displayRect.top,
          width: displayRect.width,
          height: displayRect.height,
          backgroundColor: fillColor,
          transition: measurement.originRect
            ? `left ${transitionMs}ms ease, top ${transitionMs}ms ease, width ${transitionMs}ms ease, height ${transitionMs}ms ease`
            : "none",
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
    </div>
  )
})

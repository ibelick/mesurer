"use client"

import { memo } from "react"
import type { EdgeVisibility } from "../core/edge-visibility"
import { formatLayoutDetailParts } from "../core/layout-details"
import type { InspectMeasurement } from "../core/types"
import { MeasureTag } from "./measure-tag"

type SelectedMeasurementBoxProps = {
  measurement: InspectMeasurement
  transitionMs: number
  labelOffset: number
  edgeVisibility?: EdgeVisibility
  outlineColor: string
  fillColor: string
  layoutDetailsEnabled: boolean
}

const formatValue = (value: number) => Math.round(value)

export const SelectedMeasurementBox = memo(function SelectedMeasurementBox({
  measurement,
  transitionMs,
  labelOffset,
  edgeVisibility,
  outlineColor,
  fillColor,
  layoutDetailsEnabled,
}: SelectedMeasurementBoxProps) {
  const edges =
    edgeVisibility ??
    ({ top: true, right: true, bottom: true, left: true } as EdgeVisibility)
  const displayRect = measurement.rect
  const layoutDetails = layoutDetailsEnabled
    ? formatLayoutDetailParts({
        padding: measurement.padding,
        gap: measurement.gap,
      })
    : []

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
        <div className="msr:text-center">
          <div>
            {formatValue(displayRect.width)} x {formatValue(displayRect.height)}
          </div>
          {layoutDetails.length > 0 ? (
            <div
              className="msr:flex msr:justify-center msr:gap-2.5 msr:text-[10px] msr:leading-3"
              data-mesurer-layout-details="true"
            >
              {layoutDetails.map((part) => (
                <span
                  key={part.label}
                  className="msr:inline-flex msr:items-baseline msr:gap-1"
                >
                  <span className="msr:text-ink-200">{part.label}</span>
                  <span className="msr:text-ink-50">{part.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </MeasureTag>
    </div>
  )
})

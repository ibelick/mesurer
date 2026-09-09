import { getElementSelector } from "../core/selector"
import type { InspectMeasurement, Rect } from "../core/types"
import { formatLayoutDetailParts } from "../core/layout-details"
import { useOverlayPosition } from "../hooks/use-overlay-position"
import { CheckIcon } from "./icons"

type InspectInfoCardProps = {
  ownerWindow: Window | null
  rect: Rect
  element?: Element | null
  measurement?: InspectMeasurement | null
  layoutDetailsEnabled: boolean
  copied: boolean
}

const formatValue = (value: number) => Math.round(value)

export function InspectInfoCard({
  ownerWindow,
  rect,
  element,
  measurement,
  layoutDetailsEnabled,
  copied,
}: InspectInfoCardProps) {
  const overlay = useOverlayPosition({
    ownerWindow,
    position: {
      left: rect.left + rect.width / 2 - 120,
      top: rect.top + rect.height + 4,
    },
    avoidRect: rect,
    avoidAxis: "vertical",
    gap: 4,
  })
  const selector = element ? getElementSelector(element) : null
  const displayRect = measurement?.rect ?? rect
  const layoutDetails = measurement && layoutDetailsEnabled
    ? formatLayoutDetailParts({ padding: measurement.padding, gap: measurement.gap })
    : []

  return (
    <div
      ref={overlay.overlayRef}
      data-mesurer-inspect-info-card
      className="msr:pointer-events-none msr:absolute msr:z-10 msr:w-60 msr:rounded msr:bg-ink-900 msr:px-1.5 msr:py-1 msr:text-[10px] msr:text-ink-50 msr:select-none"
      title={selector ?? undefined}
    >
      <div className="msr:flex msr:items-center msr:justify-between msr:gap-2">
        {selector ? (
          <div data-mesurer-inspect-selector className="msr:flex msr:min-w-0 msr:flex-1 msr:items-center msr:gap-1 msr:font-mono msr:font-medium">
            <span className="msr:truncate">{selector}</span>
            {copied ? <span data-mesurer-selector-copied aria-label="Selector copied" className="msr:shrink-0"><CheckIcon size={10} className="msr:text-ink-50" /></span> : null}
          </div>
        ) : <span />}
        <div className="msr:shrink-0 msr:whitespace-nowrap msr:tabular-nums">
          {formatValue(displayRect.width)} x {formatValue(displayRect.height)}
        </div>
      </div>
      {layoutDetails.length > 0 ? (
        <div className="msr:mt-1 msr:flex msr:flex-col msr:gap-0.5" data-mesurer-layout-details="true">
          {layoutDetails.map((part) => (
            <div key={part.label} className="msr:flex msr:w-full msr:items-baseline msr:justify-between">
              <span className="msr:text-ink-300">{part.label}</span>
              <span className="msr:tabular-nums msr:text-ink-50">{part.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

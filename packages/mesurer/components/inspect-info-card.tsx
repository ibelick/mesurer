import { getElementSelector } from "../core/selector"
import type { InspectMeasurement, Rect } from "../core/types"
import { formatLayoutDetailParts } from "../core/layout-details"
import { useOverlayPosition } from "../hooks/use-overlay-position"
import { CheckIcon } from "./icons"
import type { TypographyInfo } from "../runtime/text-inspector-typography"
import { CopyableValue } from "./copyable-value"
import { useTooltip } from "./tooltip"

type InspectInfoCardProps = {
  ownerWindow: Window | null
  rect: Rect
  element?: Element | null
  measurement?: InspectMeasurement | null
  layoutDetailsEnabled: boolean
  copied: boolean
  typography?: TypographyInfo | null
}

const formatValue = (value: number) => Math.round(value)

export function InspectInfoCard({
  ownerWindow,
  rect,
  element,
  measurement,
  layoutDetailsEnabled,
  copied,
  typography,
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
  const tooltip = useTooltip()
  const layoutDetails = measurement && layoutDetailsEnabled
    ? formatLayoutDetailParts({ padding: measurement.padding, gap: measurement.gap })
    : []

  const copyValue = async (value: string) => {
    try {
      const clipboardWrite = ownerWindow?.navigator.clipboard?.writeText(value)
      if (!clipboardWrite) return
      await clipboardWrite
      tooltip.onTooltipLeave()
    } catch {
      // Clipboard access can be unavailable outside a user gesture or secure context.
    }
  }

  return (
    <div
      ref={overlay.overlayRef}
      data-mesurer-inspect-info-card
      className="msr:pointer-events-auto msr:absolute msr:z-50 msr:w-60 msr:rounded-lg msr:bg-white msr:px-2 msr:py-2 msr:text-[10px] msr:text-ink-900 msr:shadow-floating msr:select-text"
      style={{ pointerEvents: "auto", userSelect: "text", WebkitUserSelect: "text", touchAction: "auto", zIndex: 50 }}
      title={selector ?? undefined}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseMove={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="msr:flex msr:items-center msr:justify-between msr:gap-2">
        {selector ? (
          <div data-mesurer-inspect-selector className="msr:flex msr:min-w-0 msr:flex-1 msr:items-center msr:gap-1 msr:font-mono msr:font-medium">
            <CopyableValue
              id="selector"
              value={selector}
              onCopy={() => copyValue(selector)}
              tooltip={tooltip}
              className="msr:min-w-0 msr:truncate msr:font-mono msr:font-medium msr:hover:underline"
            />
            {copied ? <span data-mesurer-selector-copied aria-label="Selector copied" className="msr:shrink-0"><CheckIcon size={10} className="msr:text-ink-900" /></span> : null}
          </div>
        ) : <span />}
        <CopyableValue
          id="dimensions"
          value={`${formatValue(displayRect.width)} x ${formatValue(displayRect.height)}`}
          onCopy={() => copyValue(`${formatValue(displayRect.width)} x ${formatValue(displayRect.height)}`)}
          tooltip={tooltip}
          className="msr:shrink-0 msr:whitespace-nowrap msr:tabular-nums msr:hover:underline"
        />
      </div>
      {layoutDetails.length > 0 ? (
        <div className="msr:mt-1 msr:flex msr:flex-col msr:gap-0.5" data-mesurer-layout-details="true">
          {layoutDetails.map((part) => (
            <div key={part.label} className="msr:flex msr:w-full msr:items-baseline msr:justify-between">
              <span className="msr:text-ink-500">{part.label}</span>
              <CopyableValue id={`layout-${part.label}`} value={part.value} onCopy={() => copyValue(part.value)} tooltip={tooltip} className="msr:tabular-nums msr:text-ink-900 msr:hover:underline" />
            </div>
          ))}
        </div>
      ) : null}
      {typography ? (
        <div className="msr:mt-1 msr:flex msr:flex-col msr:gap-0.5" data-mesurer-typography-details="true">
          {typography.rows.map((row) => (
            <div key={row.label} className="msr:flex msr:w-full msr:items-baseline msr:justify-between msr:gap-2">
              <span className="msr:text-ink-500">{row.label}</span>
              <CopyableValue id={`typography-${row.label}`} value={row.value} onCopy={() => copyValue(row.value)} tooltip={tooltip} className="msr:truncate msr:text-right msr:text-ink-900 msr:hover:underline" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

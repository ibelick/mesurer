import { useCallback, useEffect, useMemo, useState } from "react"
import { getElementSelector } from "../core/selector"
import type { InspectMeasurement, Rect } from "../core/types"
import {
  formatInspectCssParts,
  INSPECT_CSS_VISIBLE_ROWS,
  visibleInspectCssParts,
} from "../core/inspect-css"
import { useOverlayPosition } from "../hooks/use-overlay-position"
import { CheckIcon } from "./icons"
import type { TypographyInfo } from "../runtime/text-inspector-typography"
import { CopyableValue } from "./copyable-value"
import { SettingsButton } from "./settings-button"
import { TooltipLayerContext, useTooltip } from "./tooltip"

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

const DetailRow = ({
  label,
  value,
  id,
  onCopy,
  tooltip,
  valueClassName = "msr:min-w-0 msr:truncate msr:text-right msr:tabular-nums msr:text-ink-900 msr:hover:underline",
}: {
  label: string
  value: string
  id: string
  onCopy: () => void
  tooltip: ReturnType<typeof useTooltip>
  valueClassName?: string
}) => (
  <div className="msr:flex msr:w-full msr:items-baseline msr:justify-between msr:gap-2">
    <span className="msr:shrink-0 msr:text-ink-500">{label}</span>
    <CopyableValue id={id} value={value} onCopy={onCopy} tooltip={tooltip} className={valueClassName} />
  </div>
)

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
  const [tooltipLayer, setTooltipLayer] = useState<HTMLElement | null>(null)
  const [cssExpanded, setCssExpanded] = useState(false)
  const setCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      overlay.overlayRef.current = node
      setTooltipLayer(node)
    },
    [overlay.overlayRef],
  )
  const cssParts = useMemo(() => {
    if (!layoutDetailsEnabled || !measurement || !element || !ownerWindow) return []
    const style = ownerWindow.getComputedStyle(element)
    return formatInspectCssParts(measurement, style)
  }, [element, layoutDetailsEnabled, measurement, ownerWindow])
  const { visible: visibleCssParts, hiddenCount } = visibleInspectCssParts(
    cssParts,
    cssExpanded,
    INSPECT_CSS_VISIBLE_ROWS,
  )
  const cssCollapsedWithMore = hiddenCount > 0 && !cssExpanded
  const showCssToggle = cssParts.length > INSPECT_CSS_VISIBLE_ROWS || cssExpanded
  const hasBodyContent =
    visibleCssParts.length > 0 ||
    (!cssCollapsedWithMore && Boolean(typography?.textSnippet || typography))

  useEffect(() => {
    setCssExpanded(false)
  }, [element, measurement?.id])

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
    <TooltipLayerContext.Provider value={tooltipLayer}>
    <div
      ref={setCardRef}
      data-mesurer-inspect-info-card
      className="msr:pointer-events-auto msr:absolute msr:z-50 msr:flex msr:w-60 msr:max-w-[min(100vw-16px,15rem)] msr:flex-col msr:overflow-visible msr:rounded-lg msr:bg-white msr:px-2 msr:py-2 msr:text-[10px] msr:text-ink-900 msr:shadow-floating msr:select-text"
      style={{ pointerEvents: "auto", userSelect: "text", WebkitUserSelect: "text", touchAction: "auto", zIndex: 50 }}
      title={selector ?? undefined}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseMove={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div>
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
      </div>

      <div className={`msr:min-h-0 msr:max-h-56 msr:overflow-y-auto${hasBodyContent ? " msr:mt-2" : ""}`}>
        {visibleCssParts.length > 0 ? (
          <div className="msr:flex msr:flex-col msr:gap-0.5" data-mesurer-layout-details="true">
            {visibleCssParts.map((part) => (
              <DetailRow
                key={part.label}
                label={part.label}
                value={part.value}
                id={`layout-${part.label}`}
                onCopy={() => copyValue(part.value)}
                tooltip={tooltip}
              />
            ))}
          </div>
        ) : null}
        {!cssCollapsedWithMore && typography?.textSnippet ? (
          <div className="msr:mt-1" data-mesurer-text-snippet="true">
            <DetailRow
              label="Text"
              value={typography.textSnippet}
              id="text-snippet"
              onCopy={() => copyValue(typography.textSnippet)}
              tooltip={tooltip}
            />
          </div>
        ) : null}
        {!cssCollapsedWithMore && typography ? (
          <div className="msr:mt-1 msr:flex msr:flex-col msr:gap-0.5" data-mesurer-typography-details="true">
            {typography.rows.map((row) => (
              <DetailRow
                key={row.label}
                label={row.label}
                value={row.value}
                id={`typography-${row.label}`}
                onCopy={() => copyValue(row.value)}
                tooltip={tooltip}
              />
            ))}
          </div>
        ) : null}
      </div>

      {showCssToggle ? (
        <div className="msr:mt-2">
          <SettingsButton
            type="button"
            variant="ghost"
            className="mesurer-inspect-info-card-toggle msr:h-auto msr:min-h-0 msr:w-full msr:justify-center msr:border-0 msr:px-1 msr:py-0.5 msr:text-[10px] msr:text-ink-500 msr:hover:bg-transparent msr:hover:text-ink-900"
            onClick={() => setCssExpanded((open) => !open)}
          >
            {cssExpanded ? "Show less" : `Show ${hiddenCount} more`}
          </SettingsButton>
        </div>
      ) : null}
    </div>
    </TooltipLayerContext.Provider>
  )
}

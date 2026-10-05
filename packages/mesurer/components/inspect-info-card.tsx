import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { isConnectedElement, readInspectBoxSpacing, resolveInspectLayoutElement } from "../core/dom"
import type { LayoutDetailPart } from "../core/layout-details"
import { getElementSelector } from "../core/selector"
import type { InspectMeasurement, Rect } from "../core/types"
import { cn } from "../core/utils"
import {
  formatInspectCssParts,
  INSPECT_CSS_VISIBLE_ROWS,
  visibleInspectCssParts,
} from "../core/inspect-css"
import { useOverlayPosition } from "../hooks/use-overlay-position"
import { CheckIcon } from "./icons"
import type { TypographyInfo } from "../runtime/text-inspector-typography"
import { CopyableValue } from "./copyable-value"
import { InspectDetailRow } from "./inspect-detail-row"
import { InspectCardToggle } from "./inspect-card-toggle"
import { TooltipLayerContext, useTooltip } from "./tooltip"

type InspectInfoCardProps = {
  ownerWindow: Window | null
  rect: Rect
  element?: Element | null
  measurement?: InspectMeasurement | null
  layoutDetailsEnabled: boolean
  copied: boolean
  typography?: TypographyInfo | null
  embedded?: boolean
  motionDetails?: ReactNode
}

const formatValue = (value: number) => Math.round(value)

const InspectCardBody = ({
  typography,
  cssParts,
  onCopy,
  tooltip,
}: {
  typography: TypographyInfo | null | undefined
  cssParts: LayoutDetailPart[]
  onCopy: (value: string) => void
  tooltip: ReturnType<typeof useTooltip>
}) => {
  const typographyRows: LayoutDetailPart[] = []
  if (typography?.textSnippet) typographyRows.push({ label: "Text", value: typography.textSnippet })
  if (typography) typographyRows.push(...typography.rows)
  if (typographyRows.length === 0 && cssParts.length === 0) return null

  return (
    <div className="msr:flex msr:flex-col msr:gap-0.5 msr:px-2" data-mesurer-inspect-details="true">
      {typographyRows.map((row) => (
        <InspectDetailRow
          key={`type-${row.label}`}
          label={row.label}
          value={row.value}
          id={`inspect-${row.label}`}
          onCopy={() => onCopy(row.value)}
          tooltip={tooltip}
        />
      ))}
      {cssParts.map((row) => (
        <InspectDetailRow
          key={`css-${row.label}`}
          label={row.label}
          value={row.value}
          id={`inspect-${row.label}`}
          layoutDetail
          onCopy={() => onCopy(row.value)}
          tooltip={tooltip}
        />
      ))}
    </div>
  )
}

export function InspectInfoCard({
  ownerWindow,
  rect,
  element,
  measurement,
  layoutDetailsEnabled,
  copied,
  typography,
  embedded = false,
  motionDetails,
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
  const inheritedTooltipLayer = useContext(TooltipLayerContext)
  const [tooltipLayer, setTooltipLayer] = useState<HTMLElement | null>(null)
  const [cssExpanded, setCssExpanded] = useState(false)
  const setCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      overlay.overlayRef.current = embedded ? null : node
      setTooltipLayer(node)
    },
    [overlay.overlayRef, embedded],
  )
  const cssParts = useMemo(() => {
    if ((!embedded && !layoutDetailsEnabled) || !measurement || !element || !ownerWindow) return []
    const layoutElement =
      measurement.layoutSpacingElementRef && isConnectedElement(measurement.layoutSpacingElementRef)
        ? measurement.layoutSpacingElementRef
        : resolveInspectLayoutElement(element, ownerWindow, measurement.textAnchor)
    const spacing = readInspectBoxSpacing(layoutElement, ownerWindow)
    const style = ownerWindow.getComputedStyle(layoutElement)
    return formatInspectCssParts({ ...measurement, ...spacing }, style)
  }, [element, embedded, layoutDetailsEnabled, measurement, ownerWindow])
  const { visible: visibleCssParts, hiddenCount } = visibleInspectCssParts(
    cssParts,
    embedded || cssExpanded,
    INSPECT_CSS_VISIBLE_ROWS,
  )
  const showCssToggle = !embedded && (cssParts.length > INSPECT_CSS_VISIBLE_ROWS || cssExpanded)
  const hasBodyContent = visibleCssParts.length > 0 || Boolean(typography)

  useEffect(() => {
    setCssExpanded(false)
  }, [element, measurement?.id])

  const dimensions = `${formatValue(displayRect.width)} x ${formatValue(displayRect.height)}`
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
    <TooltipLayerContext.Provider value={embedded ? inheritedTooltipLayer : tooltipLayer}>
      <div
        ref={setCardRef}
        data-mesurer-inspect-info-card
        className={cn("msr:pointer-events-auto msr:flex msr:flex-col msr:overflow-visible msr:py-2 msr:text-[10px] msr:text-ink-900 msr:select-text", embedded ? "msr:relative msr:w-full" : "msr:absolute msr:z-50 msr:w-60 msr:max-w-[min(100vw-16px,15rem)] msr:rounded-lg msr:bg-white msr:shadow-floating")}
        style={{ pointerEvents: "auto", userSelect: "text", WebkitUserSelect: "text", touchAction: "auto", zIndex: embedded ? undefined : 50 }}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseMove={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="msr:px-2">
          <div className="msr:flex msr:items-center msr:justify-between msr:gap-2">
            {selector ? (
              <div
                data-mesurer-inspect-selector
                title={selector ?? undefined}
                className="msr:flex msr:min-w-0 msr:flex-1 msr:items-center msr:gap-1 msr:font-mono msr:font-medium"
              >
                <CopyableValue
                  id="selector"
                  value={selector}
                  onCopy={() => copyValue(selector)}
                  tooltip={tooltip}
                   className="msr:min-w-0 msr:truncate msr:font-mono msr:font-medium msr:hover:underline"
                />
                {copied ? (
                  <span data-mesurer-selector-copied aria-label="Selector copied" className="msr:shrink-0">
                    <CheckIcon size={10} className="msr:text-ink-900" />
                  </span>
                ) : null}
              </div>
            ) : (
              <span />
            )}
            <CopyableValue
              id="dimensions"
              value={dimensions}
              onCopy={() => copyValue(dimensions)}
              tooltip={tooltip}
              className="msr:shrink-0 msr:whitespace-nowrap msr:tabular-nums msr:hover:underline"
            />
          </div>
        </div>

        {motionDetails}
        <div
          className={cn(
            "msr:min-h-0",
             hasBodyContent && (motionDetails ? "msr:mt-0.5" : "msr:mt-2"),
            cssExpanded && "mesurer-thin-scrollbar msr:overflow-y-auto",
          )}
          style={cssExpanded ? { maxHeight: "min(70vh, 32rem)" } : undefined}
        >
          <InspectCardBody
            typography={typography}
            cssParts={visibleCssParts}
            onCopy={copyValue}
            tooltip={tooltip}
          />
        </div>

        {showCssToggle ? (
          <div className="msr:mt-2 msr:px-2">
            <InspectCardToggle
              aria-expanded={cssExpanded}
              onClick={() => setCssExpanded((open) => !open)}
            >
              {cssExpanded ? "Show less" : `Show ${hiddenCount} more`}
            </InspectCardToggle>
          </div>
        ) : null}
      </div>
    </TooltipLayerContext.Provider>
  )
}

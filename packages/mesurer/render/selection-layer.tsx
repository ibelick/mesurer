import { SelectedMeasurementBox } from "../components/selected-measurement-box"
import { MEASURE_TRANSITION_MS } from "../core/constants"
import type { EdgeVisibility } from "../core/edge-visibility"
import type { InspectMeasurement, Rect } from "../core/types"
import { ActiveSelectionRect } from "./active-selection-rect"
import { HoverRect } from "./hover-rect"
import { InspectInfoCard } from "../components/inspect-info-card"
import type { TypographyInfo } from "../runtime/text-inspector-typography"

type SelectionLayerProps = {
  visible: boolean
  dragging: boolean
  fillColor: string
  outlineColor: string
  active: { rect: Rect | null; width: number; height: number }
  hoverRect: Rect | null
  hoverEdges: EdgeVisibility | null
  selected: InspectMeasurement[]
  selectedEdges: EdgeVisibility[]
  layoutDetailsEnabled: boolean
  selectorPreview: { element: Element; rect: Rect; copied: boolean } | null
  ownerWindow: Window | null
  highlightColor: string
  selectedSelectorCopied: boolean
  selectedTypography: TypographyInfo | null
  hideInfoCard: boolean
}

export function SelectionLayer({
  visible,
  dragging,
  fillColor,
  outlineColor,
  active,
  hoverRect,
  hoverEdges,
  selected,
  selectedEdges,
  layoutDetailsEnabled,
  selectorPreview,
  ownerWindow,
  highlightColor,
  selectedSelectorCopied,
  selectedTypography,
  hideInfoCard,
}: SelectionLayerProps) {
  if (!visible) return null
  const transitionMs = dragging ? 0 : MEASURE_TRANSITION_MS
  const selectedMeasurement = selected[0] ?? null
  const isFullPageRect = (rect: Rect) => Boolean(
    ownerWindow &&
      rect.width >= ownerWindow.innerWidth * 0.98 &&
      rect.height >= ownerWindow.innerHeight * 0.98,
  )
  const hoveringDifferentElement = Boolean(
    selectedMeasurement &&
    selectorPreview &&
    selectorPreview.element !== selectedMeasurement.elementRef,
  )
  const showHoverRect = Boolean(hoverRect && (!selectedMeasurement || hoveringDifferentElement))
  const fullPageHover = Boolean(hoverRect && isFullPageRect(hoverRect))
  const fullPageSelection = Boolean(
    selectedMeasurement && isFullPageRect(selectedMeasurement.rect),
  )
  const fullPageFillColor = `color-mix(in oklch, ${highlightColor} 3%, transparent)`
  const fullPageOutlineColor = `color-mix(in oklch, ${highlightColor} 60%, transparent)`
  const hoverFillColor = fullPageHover
    ? fullPageFillColor
    : fillColor
  const hoverOutlineColor = fullPageHover
    ? fullPageOutlineColor
    : outlineColor

  return (
    <>
      {active.rect && dragging ? (
        <ActiveSelectionRect
          left={active.rect.left}
          top={active.rect.top}
          width={active.rect.width}
          height={active.rect.height}
          labelWidth={active.width}
          labelHeight={active.height}
          fillColor={fillColor}
          outlineColor={outlineColor}
        />
      ) : null}

      {showHoverRect && hoverRect ? (
        <HoverRect
          rect={hoverRect}
          fillColor={hoverFillColor}
          outlineColor={hoverOutlineColor}
          edges={hoverEdges}
        />
      ) : null}

      {selected.map((measurement, index) => (
        <SelectedMeasurementBox
          key={measurement.id}
          measurement={measurement}
          transitionMs={transitionMs}
          edgeVisibility={selectedEdges[index]}
          outlineColor={fullPageSelection ? fullPageOutlineColor : outlineColor}
          fillColor={fullPageSelection ? fullPageFillColor : fillColor}
        />
      ))}
      {!hideInfoCard && selectedMeasurement ? (
        <InspectInfoCard
          ownerWindow={ownerWindow}
          rect={selectedMeasurement.rect}
          element={selectedMeasurement.elementRef}
          measurement={selectedMeasurement}
          layoutDetailsEnabled={layoutDetailsEnabled}
          copied={selectedSelectorCopied}
          typography={selectedTypography}
        />
      ) : !hideInfoCard && selectorPreview ? (
        <InspectInfoCard ownerWindow={ownerWindow} rect={selectorPreview.rect} element={selectorPreview.element} layoutDetailsEnabled={layoutDetailsEnabled} copied={selectorPreview.copied} />
      ) : null}
    </>
  )
}

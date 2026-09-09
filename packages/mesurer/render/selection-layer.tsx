import { SelectedMeasurementBox } from "../components/selected-measurement-box"
import { MEASURE_TRANSITION_MS } from "../core/constants"
import type { EdgeVisibility } from "../core/edge-visibility"
import type { InspectMeasurement, Rect } from "../core/types"
import { ActiveSelectionRect } from "./active-selection-rect"
import { HoverRect } from "./hover-rect"
import { InspectInfoCard } from "../components/inspect-info-card"

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
  selectedSelectorCopied: boolean
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
  selectedSelectorCopied,
}: SelectionLayerProps) {
  if (!visible) return null
  const transitionMs = dragging ? 0 : MEASURE_TRANSITION_MS
  const selectedMeasurement = selected[0] ?? null
  const hoveringDifferentElement = Boolean(
    selectedMeasurement &&
      selectorPreview &&
      selectorPreview.element !== selectedMeasurement.elementRef,
  )

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

      {hoverRect ? (
        <HoverRect
          rect={hoverRect}
          fillColor={fillColor}
          outlineColor={outlineColor}
          edges={hoverEdges}
        />
      ) : null}

      {selected.map((measurement, index) => (
        <SelectedMeasurementBox
          key={measurement.id}
          measurement={measurement}
          transitionMs={transitionMs}
          edgeVisibility={selectedEdges[index]}
          outlineColor={outlineColor}
          fillColor={fillColor}
        />
      ))}
      {selectedMeasurement && !hoveringDifferentElement ? (
        <InspectInfoCard
          ownerWindow={ownerWindow}
          rect={selectedMeasurement.rect}
          element={selectedMeasurement.elementRef}
          measurement={selectedMeasurement}
          layoutDetailsEnabled={layoutDetailsEnabled}
          copied={selectedSelectorCopied}
        />
      ) : selectorPreview ? (
        <InspectInfoCard ownerWindow={ownerWindow} rect={selectorPreview.rect} element={selectorPreview.element} layoutDetailsEnabled={layoutDetailsEnabled} copied={selectorPreview.copied} />
      ) : null}
    </>
  )
}

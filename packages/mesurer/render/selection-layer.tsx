import { MeasurementBox } from "../components/measurement-box"
import { SelectedMeasurementBox } from "../components/selected-measurement-box"
import {
  MEASURE_LABEL_OFFSET,
  MEASURE_TRANSITION_MS,
} from "../core/constants"
import type { EdgeVisibility } from "../core/edge-visibility"
import type { InspectMeasurement, Measurement, Rect } from "../core/types"
import { ActiveSelectionRect } from "./active-selection-rect"
import { HoverRect } from "./hover-rect"

type SelectionLayerProps = {
  visible: boolean
  dragging: boolean
  fillColor: string
  outlineColor: string
  measurements: Measurement[]
  measurementEdges: EdgeVisibility[]
  active: { rect: Rect | null; width: number; height: number }
  hoverRect: Rect | null
  hoverEdges: EdgeVisibility | null
  selected: InspectMeasurement[]
  selectedEdges: EdgeVisibility[]
  layoutDetailsEnabled: boolean
}

export function SelectionLayer({
  visible,
  dragging,
  fillColor,
  outlineColor,
  measurements,
  measurementEdges,
  active,
  hoverRect,
  hoverEdges,
  selected,
  selectedEdges,
  layoutDetailsEnabled,
}: SelectionLayerProps) {
  if (!visible) return null

  return (
    <>
      {measurements.map((measurement, index) => (
        <MeasurementBox
          key={measurement.id}
          measurement={measurement}
          transitionMs={MEASURE_TRANSITION_MS}
          labelOffset={MEASURE_LABEL_OFFSET}
          edgeVisibility={measurementEdges[index]}
          outlineColor={outlineColor}
          fillColor={fillColor}
        />
      ))}

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
          transitionMs={MEASURE_TRANSITION_MS}
          labelOffset={MEASURE_LABEL_OFFSET}
          edgeVisibility={selectedEdges[index]}
          outlineColor={outlineColor}
          fillColor={fillColor}
          layoutDetailsEnabled={layoutDetailsEnabled}
        />
      ))}
    </>
  )
}

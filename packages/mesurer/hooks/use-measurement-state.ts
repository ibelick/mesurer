import { useState } from "react"
import type {
  DistanceOverlay,
  InspectMeasurement,
  Measurement,
  Rect,
} from "../core/types"

type MeasurementStateOptions = {
  initialActiveMeasurement?: Measurement | null
  initialMeasurements?: Measurement[]
  initialHeldDistances?: DistanceOverlay[]
}

export const useMeasurementState = (options: MeasurementStateOptions = {}) => {
  const [activeMeasurement, setActiveMeasurement] =
    useState<Measurement | null>(options.initialActiveMeasurement ?? null)
  const [measurements, setMeasurements] = useState<Measurement[]>(
    options.initialMeasurements ?? []
  )
  const [selectedMeasurement, setSelectedMeasurement] =
    useState<InspectMeasurement | null>(null)
  const [selectedMeasurements, setSelectedMeasurements] = useState<
    InspectMeasurement[]
  >([])
  const [hoverRect, setHoverRect] = useState<Rect | null>(null)
  const [heldDistances, setHeldDistances] = useState<DistanceOverlay[]>(
    options.initialHeldDistances ?? []
  )

  return {
    activeMeasurement,
    setActiveMeasurement,
    measurements,
    setMeasurements,
    selectedMeasurement,
    setSelectedMeasurement,
    selectedMeasurements,
    setSelectedMeasurements,
    hoverRect,
    setHoverRect,
    heldDistances,
    setHeldDistances,
  }
}

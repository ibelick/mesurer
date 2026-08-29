import { useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import { MEASURE_TRANSITION_MS } from "../core/constants"
import type { InspectMeasurement, Rect } from "../core/types"

type UseSelectionAnimationCleanupOptions = {
  ownerWindow: Window
  selectionOriginRect: Rect | null
  selectedMeasurement: InspectMeasurement | null
  selectedMeasurements: InspectMeasurement[]
  setSelectionOriginRect: Dispatch<SetStateAction<Rect | null>>
  setSelectedMeasurement: Dispatch<SetStateAction<InspectMeasurement | null>>
  setSelectedMeasurements: Dispatch<SetStateAction<InspectMeasurement[]>>
}

export const useSelectionAnimationCleanup = ({
  ownerWindow,
  selectionOriginRect,
  selectedMeasurement,
  selectedMeasurements,
  setSelectionOriginRect,
  setSelectedMeasurement,
  setSelectedMeasurements,
}: UseSelectionAnimationCleanupOptions) => {
  const timeoutRef = useRef<number | null>(null)
  const keyRef = useRef<string>("")
  const hasSelectionAnimationState =
    !!selectionOriginRect ||
    !!selectedMeasurement?.originRect ||
    selectedMeasurements.some((measurement) => !!measurement.originRect)
  const key = hasSelectionAnimationState
    ? [
        selectionOriginRect ? "origin" : "",
        selectedMeasurement?.originRect ? selectedMeasurement.id : "",
        selectedMeasurements
          .map((measurement) =>
            measurement.originRect ? measurement.id : "",
          )
          .join(","),
      ].join("|")
    : ""

  useEffect(() => {
    if (keyRef.current === key) return
    keyRef.current = key
    if (timeoutRef.current !== null) {
      ownerWindow.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (hasSelectionAnimationState) {
      timeoutRef.current = ownerWindow.setTimeout(() => {
        timeoutRef.current = null
        setSelectionOriginRect((prev) => (prev ? null : prev))
        setSelectedMeasurement((prev) => {
          if (!prev?.originRect) return prev
          const { originRect: _originRect, ...next } = prev
          return next
        })
        setSelectedMeasurements((prev) => {
          let changed = false
          const next = prev.map((measurement) => {
            if (!measurement.originRect) return measurement
            changed = true
            const { originRect: _originRect, ...rest } = measurement
            return rest
          })
          return changed ? next : prev
        })
      }, MEASURE_TRANSITION_MS)
    }
    return () => {
      if (timeoutRef.current !== null) {
        ownerWindow.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [hasSelectionAnimationState, key, ownerWindow, setSelectedMeasurement, setSelectedMeasurements, setSelectionOriginRect])
}

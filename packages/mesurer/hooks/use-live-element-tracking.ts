import type { Dispatch, RefObject, SetStateAction } from "react"
import { useEffect, useRef } from "react"
import { getDistanceOverlay } from "../core/distances"
import { getInspectMeasurement, getRectFromDom } from "../core/dom"
import { normalizeRect, rectAlmostEqual } from "../core/geometry"
import type {
  DistanceOverlay,
  InspectMeasurement,
  Measurement,
  Rect,
} from "../core/types"

type LiveParams = {
  enabled: boolean
  selectedElementRef: RefObject<HTMLElement | null>
  hoverElementRef: RefObject<HTMLElement | null>
  setSelectedMeasurement: Dispatch<SetStateAction<InspectMeasurement | null>>
  setSelectedMeasurements: Dispatch<SetStateAction<InspectMeasurement[]>>
  setHoverRect: Dispatch<SetStateAction<Rect | null>>
  setMeasurements: Dispatch<SetStateAction<Measurement[]>>
  setActiveMeasurement: Dispatch<SetStateAction<Measurement | null>>
  setHeldDistances: Dispatch<SetStateAction<DistanceOverlay[]>>
}

export const useLiveElementTracking = (params: LiveParams) => {
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!params.enabled) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
      frameRef.current = null
      return
    }

    const tick = () => {
      params.setMeasurements((prev) =>
        prev.map((measurement) => {
          if (
            !measurement.elementRef ||
            !document.contains(measurement.elementRef)
          ) {
            return measurement
          }

          const rect = getRectFromDom(measurement.elementRef)
          if (rectAlmostEqual(rect, measurement.rect)) return measurement

          return {
            ...measurement,
            rect,
            normalizedRect: normalizeRect(rect),
            originRect: undefined,
          }
        })
      )

      params.setActiveMeasurement((prev) => {
        if (!prev?.elementRef || !document.contains(prev.elementRef))
          return prev
        const rect = getRectFromDom(prev.elementRef)
        if (rectAlmostEqual(rect, prev.rect)) return prev
        return {
          ...prev,
          rect,
          normalizedRect: normalizeRect(rect),
          originRect: undefined,
        }
      })

      params.setHeldDistances((prev) =>
        prev.map((distance) => {
          const canTrackA =
            distance.elementRefA && document.contains(distance.elementRefA)
          const canTrackB =
            distance.elementRefB && document.contains(distance.elementRefB)
          if (!canTrackA && !canTrackB) return distance

          const rectA = canTrackA
            ? getRectFromDom(distance.elementRefA!)
            : distance.rectA
          const rectB = canTrackB
            ? getRectFromDom(distance.elementRefB!)
            : distance.rectB
          if (
            rectAlmostEqual(rectA, distance.rectA) &&
            rectAlmostEqual(rectB, distance.rectB)
          ) {
            return distance
          }

          const updated = getDistanceOverlay(
            rectA,
            rectB,
            distance.elementRefA,
            distance.elementRefB
          )

          return {
            ...updated,
            id: distance.id,
          }
        })
      )

      const selected = params.selectedElementRef.current
      if (selected && document.contains(selected)) {
        params.setSelectedMeasurement((prev) => {
          const next = getInspectMeasurement(selected)
          if (prev && rectAlmostEqual(prev.rect, next.rect)) return prev
          return next
        })
      }

      params.setSelectedMeasurements((prev) =>
        prev.map((measurement) => {
          if (
            !measurement.elementRef ||
            !document.contains(measurement.elementRef)
          ) {
            return measurement
          }
          const next = getInspectMeasurement(measurement.elementRef)
          if (rectAlmostEqual(next.rect, measurement.rect)) return measurement
          return {
            ...next,
            id: measurement.id,
          }
        })
      )

      const hover = params.hoverElementRef.current
      if (hover && document.contains(hover)) {
        const rect = getRectFromDom(hover)
        params.setHoverRect((prev) =>
          prev && rectAlmostEqual(prev, rect) ? prev : rect
        )
      }

      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
      frameRef.current = null
    }
  }, [params])
}

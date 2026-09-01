import type { Dispatch, RefObject, SetStateAction } from "react"
import { useLayoutEffect, useRef } from "react"
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
  document: Document
  window: Window
  enabled: boolean
  selectionEnabled: boolean
  selectedElementRef: RefObject<Element | null>
  hoverElementRef: RefObject<Element | null>
  setSelectedMeasurement: Dispatch<SetStateAction<InspectMeasurement | null>>
  setSelectedMeasurements: Dispatch<SetStateAction<InspectMeasurement[]>>
  setHoverRect: Dispatch<SetStateAction<Rect | null>>
  setMeasurements: Dispatch<SetStateAction<Measurement[]>>
  setActiveMeasurement: Dispatch<SetStateAction<Measurement | null>>
  setHeldDistances: Dispatch<SetStateAction<DistanceOverlay[]>>
}

export const useLiveElementTracking = (params: LiveParams) => {
  const paramsRef = useRef(params)
  paramsRef.current = params
  const frameRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const ownerWindow = params.window
    if (!params.enabled) {
      if (frameRef.current) {
        ownerWindow.cancelAnimationFrame(frameRef.current)
      }
      frameRef.current = null
      return
    }

    const tick = () => {
      const current = paramsRef.current
      current.setMeasurements((prev) => {
        let changed = false
        const next = prev.map((measurement) => {
          if (
            !measurement.elementRef ||
            !current.document.contains(measurement.elementRef)
          ) {
            return measurement
          }

          const rect = getRectFromDom(measurement.elementRef)
          if (rectAlmostEqual(rect, measurement.rect)) return measurement

          changed = true
          return {
            ...measurement,
            rect,
            normalizedRect: normalizeRect(rect),
            originRect: undefined,
          }
        })
        return changed || prev.length === 0 ? next : prev
      })

      current.setActiveMeasurement((prev) => {
        if (!prev?.elementRef || !current.document.contains(prev.elementRef))
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

      current.setHeldDistances((prev) => {
        let changed = false
        const next = prev.map((distance) => {
          const canTrackA =
            distance.elementRefA && current.document.contains(distance.elementRefA)
          const canTrackB =
            distance.elementRefB && current.document.contains(distance.elementRefB)
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
            distance.elementRefB,
            ownerWindow,
          )

          changed = true
          return {
            ...updated,
            id: distance.id,
          }
        })
        return changed || prev.length === 0 ? next : prev
      })

      const selected = current.selectedElementRef.current
      if (current.selectionEnabled && selected && current.document.contains(selected)) {
        current.setSelectedMeasurement((prev) => {
          const next = getInspectMeasurement(selected, ownerWindow)
          if (prev && rectAlmostEqual(prev.rect, next.rect)) return prev
          return next
        })
      }

      if (current.selectionEnabled) {
        current.setSelectedMeasurements((prev) => {
          let changed = false
          const next = prev.map((measurement) => {
            if (
              !measurement.elementRef ||
              !current.document.contains(measurement.elementRef)
            ) {
              return measurement
            }
            const next = getInspectMeasurement(measurement.elementRef, ownerWindow)
            if (rectAlmostEqual(next.rect, measurement.rect)) return measurement
            changed = true
            return {
              ...next,
              id: measurement.id,
            }
          })
          return changed || prev.length === 0 ? next : prev
        })
      }

      const hover = current.hoverElementRef.current
      if (current.selectionEnabled && hover && current.document.contains(hover)) {
        const rect = getRectFromDom(hover)
        current.setHoverRect((prev) =>
          prev && rectAlmostEqual(prev, rect) ? prev : rect
        )
      }
      frameRef.current = ownerWindow.requestAnimationFrame(tick)
    }

    frameRef.current = ownerWindow.requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) {
        ownerWindow.cancelAnimationFrame(frameRef.current)
      }
      frameRef.current = null
    }
  }, [params.enabled, params.window])
}

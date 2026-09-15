import type { Dispatch, RefObject, SetStateAction } from "react"
import { useLayoutEffect, useRef } from "react"
import { applyPinCursor, getDistanceOverlay, withPin } from "../core/distances"
import { getInspectMeasurement, getRectFromDom, isConnectedElement } from "../core/dom"
import { getGuideRect } from "../core/guides"
import { normalizeRect, rectAlmostEqual } from "../core/geometry"
import type {
  DistanceOverlay,
  Guide,
  InspectMeasurement,
  Measurement,
  Rect,
} from "../core/types"

type LiveParams = {
  document: Document
  window: Window
  enabled: boolean
  active: boolean
  selectionEnabled: boolean
  guides: Guide[]
  selectedMeasurements: InspectMeasurement[]
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
    if (!params.enabled || !params.active) {
      if (frameRef.current) {
        ownerWindow.cancelAnimationFrame(frameRef.current)
      }
      frameRef.current = null
      return
    }

    const tick = () => {
      const current = paramsRef.current
      current.setMeasurements((prev) => {
        if (prev.length === 0) return prev
        let changed = false
        const next = prev.map((measurement) => {
          if (
            !measurement.elementRef ||
            !isConnectedElement(measurement.elementRef)
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
        return changed ? next : prev
      })

      current.setActiveMeasurement((prev) => {
        if (!prev?.elementRef || !isConnectedElement(prev.elementRef))
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
        if (prev.length === 0) return prev
        let changed = false
        const next = prev.map((distance) => {
          let nextDistance = distance
          if (
            distance.pinTargetRef &&
            isConnectedElement(distance.pinTargetRef)
          ) {
            const pinTargetRect = getRectFromDom(distance.pinTargetRef)
            if (
              !distance.pinTargetRect ||
              !rectAlmostEqual(pinTargetRect, distance.pinTargetRect)
            ) {
              nextDistance = applyPinCursor({
                ...nextDistance,
                pinTargetRect,
              })
              changed = true
            }
          }

          const canTrackA =
            distance.elementRefA && isConnectedElement(distance.elementRefA)
          const canTrackB =
            distance.elementRefB && isConnectedElement(distance.elementRefB)
          const guideA = distance.guideIds?.[0]
            ? current.guides.find((guide) => guide.id === distance.guideIds?.[0])
            : null
          const guideB = distance.guideIds?.[1]
            ? current.guides.find((guide) => guide.id === distance.guideIds?.[1])
            : null
          if (!canTrackA && !canTrackB && !guideA && !guideB) return nextDistance

          const rectA = guideA
            ? getGuideRect(guideA, ownerWindow)
            : canTrackA
            ? getRectFromDom(distance.elementRefA!)
            : distance.rectA
          const rectB = guideB
            ? getGuideRect(guideB, ownerWindow)
            : canTrackB
            ? getRectFromDom(distance.elementRefB!)
            : distance.rectB
          if (
            rectAlmostEqual(rectA, nextDistance.rectA) &&
            rectAlmostEqual(rectB, nextDistance.rectB)
          ) {
            return nextDistance
          }

          const updated = getDistanceOverlay(
            rectA,
            rectB,
            distance.elementRefA,
            distance.elementRefB,
            ownerWindow,
          )

          changed = true
          return withPin(updated, nextDistance)
        })
        return changed ? next : prev
      })

      const selected = current.selectedElementRef.current ?? current.selectedMeasurements[current.selectedMeasurements.length - 1]?.elementRef ?? null
      if (isConnectedElement(selected)) {
        current.setSelectedMeasurement((prev) => {
          const rect = getRectFromDom(selected)
          if (prev?.elementRef === selected && rectAlmostEqual(prev.rect, rect)) return prev
          return getInspectMeasurement(selected, ownerWindow)
        })
      }

      current.setSelectedMeasurements((prev) => {
        if (prev.length === 0) return prev
        let changed = false
        const next = prev.map((measurement) => {
          if (!measurement.elementRef || !isConnectedElement(measurement.elementRef)) return measurement
          const rect = getRectFromDom(measurement.elementRef)
          if (rectAlmostEqual(rect, measurement.rect)) return measurement
          changed = true
          return { ...getInspectMeasurement(measurement.elementRef, ownerWindow), id: measurement.id }
        })
        return changed ? next : prev
      })

      const hover = current.hoverElementRef.current
      if (isConnectedElement(hover)) {
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
  }, [params.active, params.enabled, params.window])
}

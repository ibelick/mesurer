import type { Dispatch, RefObject, SetStateAction } from "react"
import { useEffect, useRef } from "react"
import { updateDistanceForResize } from "../core/distances"
import { getInspectMeasurement, updateMeasurementForResize } from "../core/dom"
import { getViewportSize } from "../core/geometry"
import type {
  DistanceOverlay,
  Guide,
  InspectMeasurement,
  Measurement,
} from "../core/types"

type ResizeParams = {
  document: Document
  window: Window
  setMeasurements: Dispatch<SetStateAction<Measurement[]>>
  setActiveMeasurement: Dispatch<SetStateAction<Measurement | null>>
  setHeldDistances: Dispatch<SetStateAction<DistanceOverlay[]>>
  setSelectedMeasurement: Dispatch<SetStateAction<InspectMeasurement | null>>
  setGuides: Dispatch<SetStateAction<Guide[]>>
  selectedElementRef: RefObject<HTMLElement | null>
}

export const useResizeSync = (params: ResizeParams) => {
  const resizeFrameRef = useRef<number | null>(null)
  const viewportRef = useRef(getViewportSize(params.window))

  useEffect(() => {
    const handleResize = () => {
      if (resizeFrameRef.current) {
        params.window.cancelAnimationFrame(resizeFrameRef.current)
      }

      resizeFrameRef.current = params.window.requestAnimationFrame(() => {
        const viewport = getViewportSize(params.window)
        const previousViewport = viewportRef.current

        params.setMeasurements((prev) =>
          prev.map((measurement) =>
            updateMeasurementForResize(measurement, viewport, params.document)
          )
        )
        params.setActiveMeasurement((prev) =>
          prev ? updateMeasurementForResize(prev, viewport, params.document) : prev
        )
        params.setHeldDistances((prev) =>
          prev.map((distance) =>
            updateDistanceForResize(
              distance,
              viewport,
              params.document,
              params.window,
            )
          )
        )

        if (
          params.selectedElementRef.current &&
          params.document.contains(params.selectedElementRef.current)
        ) {
          params.setSelectedMeasurement(
              getInspectMeasurement(params.selectedElementRef.current, params.window)
          )
        }

        if (previousViewport.width > 0 && previousViewport.height > 0) {
          const scaleX = viewport.width / previousViewport.width
          const scaleY = viewport.height / previousViewport.height
          params.setGuides((prev) =>
            prev.map((guide) =>
              guide.orientation === "vertical"
                ? { ...guide, position: guide.position * scaleX }
                : { ...guide, position: guide.position * scaleY }
            )
          )
        }

        viewportRef.current = viewport
      })
    }

    params.window.addEventListener("resize", handleResize)
    return () => {
      if (resizeFrameRef.current) {
        params.window.cancelAnimationFrame(resizeFrameRef.current)
      }
      params.window.removeEventListener("resize", handleResize)
    }
  }, [params])
}

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
  setMeasurements: Dispatch<SetStateAction<Measurement[]>>
  setActiveMeasurement: Dispatch<SetStateAction<Measurement | null>>
  setHeldDistances: Dispatch<SetStateAction<DistanceOverlay[]>>
  setSelectedMeasurement: Dispatch<SetStateAction<InspectMeasurement | null>>
  setGuides: Dispatch<SetStateAction<Guide[]>>
  selectedElementRef: RefObject<HTMLElement | null>
}

export const useResizeSync = (params: ResizeParams) => {
  const resizeFrameRef = useRef<number | null>(null)
  const viewportRef = useRef(getViewportSize())

  useEffect(() => {
    const handleResize = () => {
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current)
      }

      resizeFrameRef.current = requestAnimationFrame(() => {
        const viewport = getViewportSize()
        const previousViewport = viewportRef.current

        params.setMeasurements((prev) =>
          prev.map((measurement) =>
            updateMeasurementForResize(measurement, viewport)
          )
        )
        params.setActiveMeasurement((prev) =>
          prev ? updateMeasurementForResize(prev, viewport) : prev
        )
        params.setHeldDistances((prev) =>
          prev.map((distance) => updateDistanceForResize(distance, viewport))
        )

        if (params.selectedElementRef.current) {
          params.setSelectedMeasurement(
            getInspectMeasurement(params.selectedElementRef.current)
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

    window.addEventListener("resize", handleResize)
    return () => {
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current)
      }
      window.removeEventListener("resize", handleResize)
    }
  }, [params])
}

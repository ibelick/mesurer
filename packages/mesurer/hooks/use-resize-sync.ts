import type { Dispatch, RefObject, SetStateAction } from "react"
import { useLayoutEffect, useRef } from "react"
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
  selectedElementRef: RefObject<Element | null>
}

export const useResizeSync = (params: ResizeParams) => {
  const paramsRef = useRef(params)
  paramsRef.current = params
  const resizeFrameRef = useRef<number | null>(null)
  const viewportRef = useRef(getViewportSize(params.window))

  useLayoutEffect(() => {
    const ownerWindow = params.window
    const handleResize = () => {
      const current = paramsRef.current
      if (resizeFrameRef.current) {
        ownerWindow.cancelAnimationFrame(resizeFrameRef.current)
      }

      resizeFrameRef.current = ownerWindow.requestAnimationFrame(() => {
        const viewport = getViewportSize(ownerWindow)
        const previousViewport = viewportRef.current

        current.setMeasurements((prev) =>
          prev.map((measurement) =>
            updateMeasurementForResize(measurement, viewport, current.document)
          )
        )
        current.setActiveMeasurement((prev) =>
          prev ? updateMeasurementForResize(prev, viewport, current.document) : prev
        )
        current.setHeldDistances((prev) =>
          prev.map((distance) =>
            updateDistanceForResize(
              distance,
              viewport,
              current.document,
              ownerWindow,
            )
          )
        )

        if (
          current.selectedElementRef.current &&
          current.document.contains(current.selectedElementRef.current)
        ) {
          current.setSelectedMeasurement(
            getInspectMeasurement(current.selectedElementRef.current, ownerWindow)
          )
        }

        if (previousViewport.width > 0 && previousViewport.height > 0) {
          const scaleX = viewport.width / previousViewport.width
          const scaleY = viewport.height / previousViewport.height
          current.setGuides((prev) =>
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

    ownerWindow.addEventListener("resize", handleResize)
    return () => {
      if (resizeFrameRef.current) {
        ownerWindow.cancelAnimationFrame(resizeFrameRef.current)
      }
      ownerWindow.removeEventListener("resize", handleResize)
    }
  }, [params.window])
}

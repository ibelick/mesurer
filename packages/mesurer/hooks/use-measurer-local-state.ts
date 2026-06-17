import { useCallback, useState } from "react"
import type { MutableRefObject } from "react"
import type { Point, Rect } from "../core/types"

type UseMeasurerLocalStateArgs = {
  selectedElementRef: MutableRefObject<HTMLElement | null>
  hoverElementRef: MutableRefObject<HTMLElement | null>
  selectionRectRef: MutableRefObject<Rect | null>
}

export const useMeasurerLocalState = ({
  selectedElementRef,
  hoverElementRef,
  selectionRectRef,
}: UseMeasurerLocalStateArgs) => {
  const [selectionOriginRect, setSelectionOriginRect] = useState<Rect | null>(
    null
  )
  const [hoverPointer, setHoverPointer] = useState<Point | null>(null)
  const [hoverElement, setHoverElementState] = useState<HTMLElement | null>(
    null
  )
  const [selectedElement, setSelectedElementState] =
    useState<HTMLElement | null>(null)

  const setSelectedElement = useCallback(
    (element: HTMLElement | null) => {
      selectedElementRef.current = element
      setSelectedElementState(element)
    },
    [selectedElementRef]
  )

  const setHoverElement = useCallback(
    (element: HTMLElement | null) => {
      hoverElementRef.current = element
      setHoverElementState(element)
    },
    [hoverElementRef]
  )

  const clearSelectionRect = useCallback(() => {
    selectionRectRef.current = null
    setSelectionOriginRect(null)
  }, [selectionRectRef])

  return {
    selectionOriginRect,
    setSelectionOriginRect,
    hoverPointer,
    setHoverPointer,
    hoverElement,
    setHoverElement,
    selectedElement,
    setSelectedElement,
    clearSelectionRect,
  }
}

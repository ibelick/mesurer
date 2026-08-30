import { useCallback, useState } from "react"
import type { MutableRefObject } from "react"
import type { Point, Rect } from "../core/types"

type UseMesurerLocalStateArgs = {
  selectedElementRef: MutableRefObject<Element | null>
  hoverElementRef: MutableRefObject<Element | null>
  selectionRectRef: MutableRefObject<Rect | null>
}

export const useMesurerLocalState = ({
  selectedElementRef,
  hoverElementRef,
  selectionRectRef,
}: UseMesurerLocalStateArgs) => {
  const [selectionOriginRect, setSelectionOriginRect] = useState<Rect | null>(
    null
  )
  const [hoverPointer, setHoverPointer] = useState<Point | null>(null)
  const [hoverElement, setHoverElementState] = useState<Element | null>(
    null
  )
  const [selectedElement, setSelectedElementState] =
    useState<Element | null>(null)

  const setSelectedElement = useCallback(
    (element: Element | null) => {
      selectedElementRef.current = element
      setSelectedElementState(element)
    },
    [selectedElementRef]
  )

  const setHoverElement = useCallback(
    (element: Element | null) => {
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

import { useCallback, useRef } from "react"
import type { MutableRefObject } from "react"
import { getTargetElement } from "../core/selection"
import type { Point, Rect } from "../core/types"

type UseMesurerPointerHoverArgs = {
  document: Document
  overlayRef: MutableRefObject<HTMLDivElement | null>
  setHoverRect: (value: Rect | null) => void
  setHoverElement: (value: Element | null) => void
}

export const useMesurerPointerHover = ({
  document,
  overlayRef,
  setHoverRect,
  setHoverElement,
}: UseMesurerPointerHoverArgs) => {
  const hoverFrameRef = useRef<number | null>(null)
  const hoverPointRef = useRef<Point | null>(null)

  const updateHoverTarget = useCallback(
    (point: Point) => {
      const target = getTargetElement(point, overlayRef.current, document)
      if (target) {
        const rect = target.getBoundingClientRect()
        setHoverRect({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        })
        setHoverElement(target)
      } else {
        setHoverRect(null)
        setHoverElement(null)
      }
    },
    [document, overlayRef, setHoverElement, setHoverRect]
  )

  const updateHoverElement = useCallback(
    (point: Point) => {
      const target = getTargetElement(point, overlayRef.current, document)
      setHoverElement(target)
    },
    [document, overlayRef, setHoverElement]
  )

  return {
    hoverFrameRef,
    hoverPointRef,
    updateHoverTarget,
    updateHoverElement,
  }
}

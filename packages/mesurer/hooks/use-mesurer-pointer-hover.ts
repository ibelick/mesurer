import { useCallback, useRef } from "react"
import type { MutableRefObject } from "react"
import { getRectFromDom } from "../core/dom"
import { rectAlmostEqual } from "../core/geometry"
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
  const lastTargetRef = useRef<Element | null>(null)
  const lastRectRef = useRef<Rect | null>(null)

  const clearHover = useCallback(() => {
    hoverPointRef.current = null
    if (lastTargetRef.current === null && lastRectRef.current === null) return
    lastTargetRef.current = null
    lastRectRef.current = null
    setHoverRect(null)
    setHoverElement(null)
  }, [setHoverElement, setHoverRect])

  const updateHoverTarget = useCallback(
    (point: Point) => {
      const target = getTargetElement(point, overlayRef.current, document)
      if (!target) {
        clearHover()
        return
      }
      const rect = getRectFromDom(target)
      if (
        lastTargetRef.current === target &&
        lastRectRef.current &&
        rectAlmostEqual(rect, lastRectRef.current)
      ) {
        return
      }
      lastTargetRef.current = target
      lastRectRef.current = rect
      setHoverRect(rect)
      setHoverElement(target)
    },
    [clearHover, document, overlayRef, setHoverElement, setHoverRect]
  )

  const updateHoverElement = useCallback(
    (point: Point) => {
      const target = getTargetElement(point, overlayRef.current, document)
      if (lastTargetRef.current === target) return
      lastTargetRef.current = target
      lastRectRef.current = null
      setHoverElement(target)
    },
    [document, overlayRef, setHoverElement]
  )

  return {
    hoverFrameRef,
    hoverPointRef,
    clearHover,
    updateHoverTarget,
    updateHoverElement,
  }
}

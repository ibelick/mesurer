import { useCallback, useRef } from "react"
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react"
import { getInspectMeasurement } from "../core/dom"
import { getRectFromPoints, rectsOverlap } from "../core/geometry"
import { transformedPenBounds } from "../core/pen-transform"
import { transformedArrowBounds } from "../core/arrow-transform"
import { textAnnotationBounds } from "../core/text-transform"
import {
  getCycledClickTarget,
  getElementsInRectCached,
  getSnappedClickTarget,
  getTargetElement,
  type ClickCycleState,
} from "../core/selection"
import { getSelectedMeasurementHit } from "../core/selection-helpers"
import type {
  Arrow,
  Guide,
  InspectMeasurement,
  Point,
  Rect,
  TextAnnotation,
} from "../core/types"

const MARQUEE_HIT_SLOP = 10

const expandRect = (rect: Rect, padding: number): Rect => ({
  left: rect.left - padding,
  top: rect.top - padding,
  width: rect.width + padding * 2,
  height: rect.height + padding * 2,
})

const mergeIds = (previous: string[], next: string[]) => {
  if (next.length === 0) return previous
  const seen = new Set(previous)
  let changed = false
  const merged = [...previous]
  for (const id of next) {
    if (seen.has(id)) continue
    seen.add(id)
    merged.push(id)
    changed = true
  }
  return changed ? merged : previous
}

type SelectionCache = {
  key: string
  entries: Array<{ element: Element; rect: Rect }>
  overlayNode: HTMLDivElement | null
  frame: number
}

type UseMesurerPointerSelectionArgs = {
  document: Document
  window: Window
  overlayRef: MutableRefObject<HTMLDivElement | null>
  selectionRectRef: MutableRefObject<Rect | null>
  selectedMeasurements: InspectMeasurement[]
  selectedMeasurement: InspectMeasurement | null
  snapEnabled: boolean
  selectionMode: boolean
  hoverHighlightEnabled: boolean
  scrollOffset: Point
  textAnnotations: TextAnnotation[]
  arrows: Arrow[]
  penStrokes: import("../core/types").PenStroke[]
  guides: Guide[]
  setSelectedTextIds: (value: SetStateAction<string[]>) => void
  setSelectedArrowIds: (value: SetStateAction<string[]>) => void
  setSelectedPenStrokeIds: (value: SetStateAction<string[]>) => void
  setSelectedGuideIds: (value: SetStateAction<string[]>) => void
  setSelectedElement: (value: Element | null) => void
  setSelectedMeasurements: (value: SetStateAction<InspectMeasurement[]>) => void
  setSelectedMeasurement: (
    value: SetStateAction<InspectMeasurement | null>
  ) => void
  setSelectionOriginRect: (value: SetStateAction<Rect | null>) => void
  clearSelectionRect: () => void
  setActiveMeasurement: (value: SetStateAction<import("../core/types").Measurement | null>) => void
  setMeasurements: (value: SetStateAction<import("../core/types").Measurement[]>) => void
}

export const useMesurerPointerSelection = ({
  document,
  window,
  overlayRef,
  selectionRectRef,
  selectedMeasurements,
  selectedMeasurement,
  snapEnabled,
  selectionMode,
  hoverHighlightEnabled,
  scrollOffset,
  textAnnotations,
  arrows,
  penStrokes,
  guides,
  setSelectedTextIds,
  setSelectedArrowIds,
  setSelectedPenStrokeIds,
  setSelectedGuideIds,
  setSelectedElement,
  setSelectedMeasurements,
  setSelectedMeasurement,
  setSelectionOriginRect,
  clearSelectionRect,
  setActiveMeasurement,
  setMeasurements,
}: UseMesurerPointerSelectionArgs) => {
  const selectionCacheRef = useRef<SelectionCache>({
    key: "",
    entries: [],
    overlayNode: null,
    frame: -1,
  })
  const shiftDragRef = useRef(false)
  const shiftToggleElementRef = useRef<Element | null>(null)
  const clickCycleRef = useRef<ClickCycleState | null>(null)

  const clearDomSelection = useCallback(() => {
    document.defaultView?.getSelection()?.removeAllRanges()
  }, [document])

  const itemsRef = useRef({
    textAnnotations,
    arrows,
    penStrokes,
    guides,
    scrollOffset,
  })
  itemsRef.current = {
    textAnnotations,
    arrows,
    penStrokes,
    guides,
    scrollOffset,
  }

  const selectOverlayAnnotations = useCallback((rect: Rect, additive = false) => {
    const current = itemsRef.current
    const hitRect = expandRect(rect, rect.width < 2 && rect.height < 2 ? MARQUEE_HIT_SLOP : 2)
    const toClient = (bounds: { x: number; y: number; width: number; height: number }): Rect => ({
      left: bounds.x - current.scrollOffset.x,
      top: bounds.y - current.scrollOffset.y,
      width: bounds.width,
      height: bounds.height,
    })
    const selectedText = current.textAnnotations.filter((item) => {
      const node = overlayRef.current?.querySelector(
        `[data-mesurer-text-id="${item.id}"]`,
      )
      const clientRect =
        node instanceof HTMLElement
          ? node.getBoundingClientRect()
          : toClient(textAnnotationBounds(item))
      return rectsOverlap(hitRect, {
        left: clientRect.left,
        top: clientRect.top,
        width: clientRect.width,
        height: clientRect.height,
      })
    }).map((item) => item.id)
    const selectedArrows = current.arrows.filter((arrow) =>
      rectsOverlap(hitRect, expandRect(toClient(transformedArrowBounds(arrow)), MARQUEE_HIT_SLOP)),
    ).map((arrow) => arrow.id)
    const selectedPen = current.penStrokes.filter((stroke) =>
      rectsOverlap(hitRect, expandRect(toClient(transformedPenBounds(stroke)), MARQUEE_HIT_SLOP)),
    ).map((stroke) => stroke.id)
    const selectedGuides = current.guides.filter((guide) => {
      const position = guide.position
      if (guide.orientation === "vertical") {
        return position >= hitRect.left && position <= hitRect.left + hitRect.width
      }
      return position >= hitRect.top && position <= hitRect.top + hitRect.height
    }).map((guide) => guide.id)

    const apply = (setter: (value: SetStateAction<string[]>) => void, next: string[]) => {
      if (additive) setter((previous) => mergeIds(previous, next))
      else setter(next)
    }
    apply(setSelectedTextIds, selectedText)
    apply(setSelectedArrowIds, selectedArrows)
    apply(setSelectedPenStrokeIds, selectedPen)
    apply(setSelectedGuideIds, selectedGuides)
  }, [
    overlayRef,
    setSelectedArrowIds,
    setSelectedGuideIds,
    setSelectedPenStrokeIds,
    setSelectedTextIds,
  ])

  const preparePointerDown = useCallback((point: Point, shiftKey: boolean) => {
    shiftDragRef.current = shiftKey
    shiftToggleElementRef.current = shiftKey
      ? (getSelectedMeasurementHit({
          point,
          selectedMeasurements,
          overlayNode: overlayRef.current,
          document,
        })?.elementRef ?? null)
      : null
    selectionCacheRef.current.key = ""
  }, [document, overlayRef, selectedMeasurements])

  const clearTransientMeasurements = useCallback(() => {
    setActiveMeasurement(null)
    setMeasurements([])
  }, [setActiveMeasurement, setMeasurements])

  const handleSelectionPointerUp = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    point: Point,
    start: Point,
    isDragging: boolean,
    commit: () => void,
    resetDragState: () => void,
  ) => {
    const additive = event.shiftKey || shiftDragRef.current

    if (isDragging) {
      clickCycleRef.current = null
      const selectionRect = getRectFromPoints(start, point)
      selectionRectRef.current = selectionRect
      setSelectionOriginRect(selectionRect)
      if (selectionMode) {
        commit()
        selectOverlayAnnotations(selectionRect, additive)
        clearDomSelection()
        setSelectedElement(null)
        setSelectedMeasurement(null)
        setSelectedMeasurements([])
        clearSelectionRect()
        clearTransientMeasurements()
        resetDragState()
        return
      }
      const elements = getElementsInRectCached(
        selectionRect,
        overlayRef.current,
        selectionCacheRef.current,
        document
      )
      const hasSameSelection =
        elements.length === selectedMeasurements.length &&
        elements.every(
          (element, index) => selectedMeasurements[index]?.elementRef === element
        )
      const lastElement = elements[elements.length - 1] ?? null
      const lastChanged =
        (selectedMeasurement?.elementRef ?? null) !== lastElement
      if (elements.length > 0) {
        if (!hasSameSelection) {
          commit()
          const nextMeasurements = elements.map((element) => ({
            ...getInspectMeasurement(element, window),
            originRect: selectionRect,
          }))
          setSelectedMeasurements(nextMeasurements)
          setSelectedElement(lastElement)
          setSelectedMeasurement(nextMeasurements[nextMeasurements.length - 1])
        } else if (lastChanged) {
          commit()
          setSelectedElement(lastElement)
          const lastMeasurement = selectedMeasurements.find(
            (measurement) => measurement.elementRef === lastElement
          )
          if (lastMeasurement) setSelectedMeasurement(lastMeasurement)
        }
      } else if (selectedMeasurements.length > 0 || selectedMeasurement) {
        commit()
        setSelectedElement(null)
        setSelectedMeasurement(null)
        setSelectedMeasurements([])
        clearSelectionRect()
      }
      clearTransientMeasurements()
      resetDragState()
      return
    }

    const selectedHit = shiftToggleElementRef.current
      ? (selectedMeasurements.find(
          (measurement) =>
            measurement.elementRef === shiftToggleElementRef.current
        ) ?? null)
      : getSelectedMeasurementHit({
          point,
          selectedMeasurements,
          overlayNode: overlayRef.current,
          document,
        })
    const removeSelected = (hit: InspectMeasurement) => {
      commit()
      const nextSelected = selectedMeasurements.filter(
        (measurement) => measurement.elementRef !== hit.elementRef
      )
      setSelectedMeasurements(nextSelected)
      clearSelectionRect()
      const nextPrimary =
        nextSelected.length > 0 ? nextSelected[nextSelected.length - 1] : null
      setSelectedElement(nextPrimary?.elementRef ?? null)
      setSelectedMeasurement(nextPrimary)
    }
    if (additive && selectedHit) {
      removeSelected(selectedHit)
      clearTransientMeasurements()
      resetDragState()
      return
    }
    if (!hoverHighlightEnabled && !additive && selectedHit) {
      removeSelected(selectedHit)
      clearTransientMeasurements()
      resetDragState()
      return
    }

    let target: Element | null = null
    if (additive) {
      target =
        getTargetElement(point, overlayRef.current, document) ??
        getSnappedClickTarget(point, overlayRef.current, snapEnabled, document)
      clickCycleRef.current = null
    } else {
      const cycled = getCycledClickTarget(
        point,
        overlayRef.current,
        snapEnabled,
        document,
        clickCycleRef.current
      )
      target = cycled.target
      clickCycleRef.current = cycled.cycle
    }
    if (target) {
      const inspectMeasurement = getInspectMeasurement(target, window)
      clearTransientMeasurements()
      if (additive) {
        const alreadySelected = selectedMeasurements.some(
          (measurement) => measurement.elementRef === target
        )
        if (alreadySelected) {
          removeSelected({ ...inspectMeasurement, elementRef: target })
        } else {
          commit()
          setSelectedMeasurements((prev) => [...prev, inspectMeasurement])
          setSelectedElement(target)
          setSelectedMeasurement(inspectMeasurement)
          clearSelectionRect()
        }
        clearTransientMeasurements()
        resetDragState()
        return
      }
      setSelectedElement(target)
      commit()
      setSelectedMeasurements([inspectMeasurement])
      setSelectedMeasurement(inspectMeasurement)
      clearSelectionRect()
    } else {
      if (additive) {
        clearTransientMeasurements()
        resetDragState()
        return
      }
      commit()
      if (selectionMode) {
        selectOverlayAnnotations({
          left: point.x,
          top: point.y,
          width: 0,
          height: 0,
        })
        clearDomSelection()
      }
      setSelectedElement(null)
      setSelectedMeasurement(null)
      setSelectedMeasurements([])
      clearSelectionRect()
      clickCycleRef.current = null
    }
    resetDragState()
  }, [
    clearDomSelection,
    clearSelectionRect,
    clearTransientMeasurements,
    document,
    hoverHighlightEnabled,
    overlayRef,
    selectOverlayAnnotations,
    selectedMeasurement,
    selectedMeasurements,
    selectionMode,
    selectionRectRef,
    setSelectedElement,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setSelectionOriginRect,
    snapEnabled,
    window,
  ])

  return {
    clickCycleRef,
    shiftDragRef,
    shiftToggleElementRef,
    preparePointerDown,
    handleSelectionPointerUp,
  }
}

import { useCallback, useRef } from "react"
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react"
import { getInspectMeasurement } from "../core/dom"
import { getRectFromPoints } from "../core/geometry"
import { transformedPenBounds } from "../core/pen-transform"
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
  InspectMeasurement,
  Point,
  Rect,
  TextAnnotation,
} from "../core/types"

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
  setSelectedTextIds: (value: SetStateAction<string[]>) => void
  setSelectedArrowIds: (value: SetStateAction<string[]>) => void
  setSelectedPenStrokeIds: (value: SetStateAction<string[]>) => void
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
  setSelectedTextIds,
  setSelectedArrowIds,
  setSelectedPenStrokeIds,
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

  const selectOverlayAnnotations = useCallback((rect: Rect) => {
    const overlaps = (candidate: Rect) =>
      candidate.left < rect.left + rect.width &&
      candidate.left + candidate.width > rect.left &&
      candidate.top < rect.top + rect.height &&
      candidate.top + candidate.height > rect.top
    const selectedText = textAnnotations.filter((item) => {
      const node = overlayRef.current?.querySelector(
        `[data-mesurer-text-id="${item.id}"]`
      )
      return (
        node instanceof HTMLElement && overlaps(node.getBoundingClientRect())
      )
    }).map((item) => item.id)
    const selectedArrows = arrows.filter((arrow) => {
      const points = [
        arrow.start,
        arrow.end,
        arrow.control ?? {
          x: (arrow.start.x + arrow.end.x) / 2,
          y: (arrow.start.y + arrow.end.y) / 2,
        },
      ]
      const candidate = {
        left: Math.min(...points.map((point) => point.x)) - scrollOffset.x,
        top: Math.min(...points.map((point) => point.y)) - scrollOffset.y,
        width: Math.max(
          1,
          Math.max(...points.map((point) => point.x)) -
            Math.min(...points.map((point) => point.x))
        ),
        height: Math.max(
          1,
          Math.max(...points.map((point) => point.y)) -
            Math.min(...points.map((point) => point.y))
        ),
      }
      return overlaps(candidate)
    }).map((arrow) => arrow.id)
    const selectedPen = penStrokes.filter((stroke) => {
      const bounds = transformedPenBounds(stroke)
      return overlaps({
        left: bounds.x - scrollOffset.x,
        top: bounds.y - scrollOffset.y,
        width: bounds.width,
        height: bounds.height,
      })
    }).map((stroke) => stroke.id)
    setSelectedTextIds(selectedText)
    setSelectedArrowIds(selectedArrows)
    setSelectedPenStrokeIds(selectedPen)
  }, [
    arrows,
    overlayRef,
    penStrokes,
    scrollOffset.x,
    scrollOffset.y,
    setSelectedArrowIds,
    setSelectedPenStrokeIds,
    setSelectedTextIds,
    textAnnotations,
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
    const dragDx = Math.abs(point.x - start.x)
    const dragDy = Math.abs(point.y - start.y)
    const isShiftClick = event.shiftKey && dragDx <= 12 && dragDy <= 12

    if (isDragging && !isShiftClick) {
      clickCycleRef.current = null
      const selectionRect = getRectFromPoints(start, point)
      selectionRectRef.current = selectionRect
      setSelectionOriginRect(selectionRect)
      if (selectionMode) {
        commit()
        selectOverlayAnnotations(selectionRect)
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
    if (event.shiftKey && selectedHit) {
      removeSelected(selectedHit)
      clearTransientMeasurements()
      resetDragState()
      return
    }
    if (!hoverHighlightEnabled && !event.shiftKey && selectedHit) {
      removeSelected(selectedHit)
      clearTransientMeasurements()
      resetDragState()
      return
    }

    let target: Element | null = null
    if (event.shiftKey) {
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
      if (event.shiftKey) {
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
      if (event.shiftKey) {
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

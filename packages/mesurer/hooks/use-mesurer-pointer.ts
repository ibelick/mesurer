import { useCallback, useRef } from "react"
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react"
import { getInspectMeasurement } from "../core/dom"
import { getRectFromPoints } from "../core/geometry"
import { transformedPenBounds } from "../core/pen-transform"
import { getSnapGuidePosition } from "../core/guides"
import {
  getCycledClickTarget,
  getElementsInRectCached,
  getSnappedClickTarget,
  getTargetElement,
  type ClickCycleState,
} from "../core/selection"
import { getSelectedMeasurementHit } from "../core/selection-helpers"
import type {
  DistanceOverlay,
  Guide,
  InspectMeasurement,
  Measurement,
  Point,
  Rect,
  ToolMode,
} from "../core/types"
import { createId } from "../core/utils"

type GuidePreview = {
  orientation: "vertical" | "horizontal"
  position: number
}

type UseMesurerPointerArgs = {
  document: Document
  window: Window
  toolbarRef: MutableRefObject<HTMLDivElement | null>
  overlayRef: MutableRefObject<HTMLDivElement | null>
  selectionRectRef: MutableRefObject<Rect | null>
  createActionCommit: () => () => void
  clearGuideDragHold: () => void
  scheduleGuideDragHold: (
    id: string,
    setDraggingGuideId: (value: SetStateAction<string | null>) => void
  ) => void
  enabled: boolean
  settingsOpen: boolean
  toolMode: ToolMode
  guidesEnabled: boolean
  snapEnabled: boolean
  snapGuidesEnabled: boolean
  selectNewGuideEnabled: boolean
  altPressed: boolean
  guideOrientation: "vertical" | "horizontal"
  hoverHighlightEnabled: boolean
  start: Point | null
  end: Point | null
  isDragging: boolean
  selectedMeasurements: InspectMeasurement[]
  selectedMeasurement: InspectMeasurement | null
  selectedGuideIds: string[]
  guides: Guide[]
  draggingGuideId: string | null
  optionPairOverlay: DistanceOverlay | null
  setAltPressed: (value: SetStateAction<boolean>) => void
  setGuidePreview: (value: SetStateAction<GuidePreview | null>) => void
  setSelectedGuideIds: (value: SetStateAction<string[]>) => void
  setGuides: (value: SetStateAction<Guide[]>) => void
  setStart: (value: SetStateAction<Point | null>) => void
  setEnd: (value: SetStateAction<Point | null>) => void
  setIsDragging: (value: SetStateAction<boolean>) => void
  setHeldDistances: (value: SetStateAction<DistanceOverlay[]>) => void
  setDraggingGuideId: (value: SetStateAction<string | null>) => void
  setActiveMeasurement: (value: SetStateAction<Measurement | null>) => void
  setMeasurements: (value: SetStateAction<Measurement[]>) => void
  setSelectedMeasurements: (value: SetStateAction<InspectMeasurement[]>) => void
  setSelectedMeasurement: (
    value: SetStateAction<InspectMeasurement | null>
  ) => void
  setSelectionOriginRect: (value: SetStateAction<Rect | null>) => void
  setSelectedElement: (value: HTMLElement | null) => void
  setHoverRect: (value: SetStateAction<Rect | null>) => void
  setHoverElement: (value: HTMLElement | null) => void
  setHoverPointer: (value: SetStateAction<Point | null>) => void
  clearSelectionRect: () => void
  selectionMode: boolean
  scrollOffset: Point
  textAnnotations: import("../core/types").TextAnnotation[]
  arrows: import("../core/types").Arrow[]
  penStrokes: import("../core/types").PenStroke[]
  setSelectedTextIds: (value: SetStateAction<string[]>) => void
  setSelectedArrowIds: (value: SetStateAction<string[]>) => void
  setSelectedPenStrokeIds: (value: SetStateAction<string[]>) => void
}

export const useMesurerPointer = ({
  document,
  window,
  toolbarRef,
  overlayRef,
  selectionRectRef,
  createActionCommit,
  clearGuideDragHold,
  scheduleGuideDragHold,
  enabled,
  settingsOpen,
  toolMode,
  guidesEnabled,
  snapEnabled,
  snapGuidesEnabled,
  selectNewGuideEnabled,
  altPressed,
  guideOrientation,
  hoverHighlightEnabled,
  start,
  end,
  isDragging,
  selectedMeasurements,
  selectedMeasurement,
  selectedGuideIds,
  guides,
  draggingGuideId,
  optionPairOverlay,
  setAltPressed,
  setGuidePreview,
  setSelectedGuideIds,
  setGuides,
  setStart,
  setEnd,
  setIsDragging,
  setHeldDistances,
  setDraggingGuideId,
  setActiveMeasurement,
  setMeasurements,
  setSelectedMeasurements,
  setSelectedMeasurement,
  setSelectionOriginRect,
  setSelectedElement,
  setHoverRect,
  setHoverElement,
  setHoverPointer,
  clearSelectionRect,
  selectionMode,
  scrollOffset,
  textAnnotations,
  arrows,
  penStrokes,
  setSelectedTextIds,
  setSelectedArrowIds,
  setSelectedPenStrokeIds,
}: UseMesurerPointerArgs) => {
  const hoverFrameRef = useRef<number | null>(null)
  const hoverPointRef = useRef<Point | null>(null)
  const selectionCacheRef = useRef({
    key: "",
    entries: [] as Array<{ element: HTMLElement; rect: Rect }>,
    overlayNode: null as HTMLDivElement | null,
    frame: -1,
  })
  const shiftDragRef = useRef(false)
  const shiftToggleElementRef = useRef<HTMLElement | null>(null)
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
      const node = overlayRef.current?.querySelector(`[data-mesurer-text-id="${item.id}"]`)
      return node instanceof HTMLElement && overlaps(node.getBoundingClientRect())
    }).map((item) => item.id)
    const selectedArrows = arrows.filter((arrow) => {
      const points = [arrow.start, arrow.end, arrow.control ?? { x: (arrow.start.x + arrow.end.x) / 2, y: (arrow.start.y + arrow.end.y) / 2 }]
      const candidate = {
        left: Math.min(...points.map((point) => point.x)) - scrollOffset.x,
        top: Math.min(...points.map((point) => point.y)) - scrollOffset.y,
        width: Math.max(1, Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))),
        height: Math.max(1, Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y))),
      }
      return overlaps(candidate)
    }).map((arrow) => arrow.id)
    const selectedPen = penStrokes.filter((stroke) => {
      const bounds = transformedPenBounds(stroke)
      return overlaps({ left: bounds.x - scrollOffset.x, top: bounds.y - scrollOffset.y, width: bounds.width, height: bounds.height })
    }).map((stroke) => stroke.id)
    setSelectedTextIds(selectedText)
    setSelectedArrowIds(selectedArrows)
    setSelectedPenStrokeIds(selectedPen)
  }, [arrows, document, overlayRef, penStrokes, scrollOffset.x, scrollOffset.y, setSelectedArrowIds, setSelectedPenStrokeIds, setSelectedTextIds, textAnnotations])

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

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const commit = createActionCommit()
      const toolbarNode = toolbarRef.current
      if (toolbarNode && toolbarNode.contains(event.target as Node)) return
      if (settingsOpen) return
      if (!enabled || event.button !== 0) return
      if (toolMode === "none") return
      clearSelectionRect()
      const point = { x: event.clientX, y: event.clientY }
      shiftDragRef.current = event.shiftKey
      shiftToggleElementRef.current = event.shiftKey
        ? (getSelectedMeasurementHit({
            point,
            selectedMeasurements,
            overlayNode: overlayRef.current,
            document,
          })?.elementRef ?? null)
        : null
      selectionCacheRef.current.key = ""

      if (altPressed && optionPairOverlay) {
        commit()
        setHeldDistances((prev) => [
          ...prev,
          {
            ...optionPairOverlay,
            id: createId(),
          },
        ])
        return
      }

      if (guidesEnabled) {
        event.preventDefault()
        commit()
        setStart(null)
        setEnd(null)
        setIsDragging(false)
        const position = getSnapGuidePosition({
          orientation: guideOrientation,
          point,
          snapGuidesEnabled,
          overlayNode: overlayRef.current,
          guides,
          draggingGuideId,
          document,
        })
        const id = createId()
        setSelectedGuideIds(selectNewGuideEnabled ? [id] : [])
        setGuides((prev) => [
          ...prev,
          { id, orientation: guideOrientation, position },
        ])
        scheduleGuideDragHold(id, setDraggingGuideId)
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }

      if (selectedGuideIds.length > 0) {
        commit()
        setSelectedGuideIds([])
      }

      setStart(point)
      setEnd(point)
      setIsDragging(false)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [
      altPressed,
      clearSelectionRect,
      createActionCommit,
          draggingGuideId,
      document,
      enabled,
      settingsOpen,
      guideOrientation,
      guides,
      guidesEnabled,
      optionPairOverlay,
      overlayRef,
      scheduleGuideDragHold,
      selectNewGuideEnabled,
      selectedGuideIds.length,
      selectedMeasurements,
      setDraggingGuideId,
      setEnd,
      setGuides,
      setHeldDistances,
      setIsDragging,
      setSelectedGuideIds,
      setStart,
      snapGuidesEnabled,
      toolMode,
      toolbarRef,
    ]
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const toolbarNode = toolbarRef.current
      if (toolbarNode && toolbarNode.contains(event.target as Node)) return
      if (settingsOpen) return
      if (!enabled) return
      const point = { x: event.clientX, y: event.clientY }
      if (event.altKey !== altPressed) {
        setAltPressed(event.altKey)
      }

      if (draggingGuideId) {
        setGuides((prev) =>
          prev.map((guide) =>
            guide.id === draggingGuideId
              ? {
                  ...guide,
                  position: getSnapGuidePosition({
                    orientation: guide.orientation,
                    point,
                    snapGuidesEnabled,
                    overlayNode: overlayRef.current,
                    guides,
                    draggingGuideId,
                    document,
                  }),
                }
              : guide
          )
        )
        return
      }

      if (toolMode === "none") {
        if (hoverHighlightEnabled) {
          setHoverRect(null)
          setHoverElement(null)
        }
        setHoverPointer(null)
        setGuidePreview(null)
        return
      }

      hoverPointRef.current = point
      if (!hoverFrameRef.current) {
        hoverFrameRef.current = window.requestAnimationFrame(() => {
          const latest = hoverPointRef.current
          if (latest && !draggingGuideId && !guidesEnabled) {
            if (hoverHighlightEnabled) {
              updateHoverTarget(latest)
            } else {
              updateHoverElement(latest)
            }
          }
          if (latest && guides.length > 0) {
            setHoverPointer(latest)
          } else {
            setHoverPointer(null)
          }
          if (
            guidesEnabled &&
            latest &&
            !draggingGuideId
          ) {
            const position = getSnapGuidePosition({
              orientation: guideOrientation,
              point: latest,
              snapGuidesEnabled,
              overlayNode: overlayRef.current,
              guides,
              draggingGuideId,
              document,
            })
            setGuidePreview({
              orientation: guideOrientation,
              position,
            })
          } else {
            setGuidePreview(null)
          }
          hoverFrameRef.current = null
        })
      }

      if (guidesEnabled) return

      if (!start) return
      setEnd(point)

      if (!isDragging) {
        const dx = Math.abs(point.x - start.x)
        const dy = Math.abs(point.y - start.y)
        const threshold = shiftDragRef.current ? 12 : 4
        if (dx > threshold || dy > threshold) {
          setIsDragging(true)
        }
      }
    },
    [
      altPressed,
      draggingGuideId,
      enabled,
      settingsOpen,
      hoverHighlightEnabled,
      guides,
      guidesEnabled,
      isDragging,
      overlayRef,
      guideOrientation,
      setAltPressed,
      setEnd,
      setGuidePreview,
      setGuides,
      setHoverElement,
      setHoverPointer,
      setHoverRect,
      setIsDragging,
      snapGuidesEnabled,
      start,
      toolMode,
      toolbarRef,
      updateHoverElement,
      updateHoverTarget,
    ]
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const commit = createActionCommit()
      const toolbarNode = toolbarRef.current
      if (toolbarNode && toolbarNode.contains(event.target as Node)) return
      if (settingsOpen) return
      if (!enabled) return
      clearGuideDragHold()
      if (guidesEnabled) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        setDraggingGuideId(null)
        setStart(null)
        setEnd(null)
        setIsDragging(false)
        return
      }
      if (toolMode === "none") {
        setStart(null)
        setEnd(null)
        setIsDragging(false)
        return
      }
      const point = { x: event.clientX, y: event.clientY }

      const resetDragState = () => {
        setStart(null)
        setEnd(null)
        setIsDragging(false)
        shiftDragRef.current = false
        shiftToggleElementRef.current = null
      }

      const clearTransientMeasurements = () => {
        setActiveMeasurement(null)
        setMeasurements([])
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      if (draggingGuideId) {
        setDraggingGuideId(null)
      }

      if (!start || !end) {
        resetDragState()
        return
      }

      const dragDx = Math.abs(point.x - start.x)
      const dragDy = Math.abs(point.y - start.y)
      const shiftThreshold = 12
      const isShiftClick =
        event.shiftKey && dragDx <= shiftThreshold && dragDy <= shiftThreshold

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
            (element, index) =>
              selectedMeasurements[index]?.elementRef === element
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
            setSelectedMeasurement(
              nextMeasurements[nextMeasurements.length - 1]
            )
          } else if (lastChanged) {
            commit()
            setSelectedElement(lastElement)
            const lastMeasurement = selectedMeasurements.find(
              (measurement) => measurement.elementRef === lastElement
            )
            if (lastMeasurement) {
              setSelectedMeasurement(lastMeasurement)
            }
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

      if (event.shiftKey && selectedHit) {
        commit()
        const nextSelected = selectedMeasurements.filter(
          (measurement) => measurement.elementRef !== selectedHit.elementRef
        )
        setSelectedMeasurements(nextSelected)
        clearSelectionRect()
        const nextPrimary =
          nextSelected.length > 0 ? nextSelected[nextSelected.length - 1] : null
        setSelectedElement(nextPrimary?.elementRef ?? null)
        setSelectedMeasurement(nextPrimary)
        clearTransientMeasurements()
        resetDragState()
        return
      }

      if (!hoverHighlightEnabled && !event.shiftKey && selectedHit) {
        commit()
        const nextSelected = selectedMeasurements.filter(
          (measurement) => measurement.elementRef !== selectedHit.elementRef
        )
        setSelectedMeasurements(nextSelected)
        clearSelectionRect()
        const nextPrimary =
          nextSelected.length > 0 ? nextSelected[nextSelected.length - 1] : null
        setSelectedElement(nextPrimary?.elementRef ?? null)
        setSelectedMeasurement(nextPrimary)
        clearTransientMeasurements()
        resetDragState()
        return
      }

      let target: HTMLElement | null = null
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
          clickCycleRef.current,
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
            commit()
            const nextSelected = selectedMeasurements.filter(
              (measurement) => measurement.elementRef !== target
            )
            setSelectedMeasurements(nextSelected)
            clearSelectionRect()
            const nextPrimary =
              nextSelected.length > 0
                ? nextSelected[nextSelected.length - 1]
                : null
            setSelectedElement(nextPrimary?.elementRef ?? null)
            setSelectedMeasurement(nextPrimary)
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
          selectOverlayAnnotations({ left: point.x, top: point.y, width: 0, height: 0 })
          clearDomSelection()
        }
        setSelectedElement(null)
        setSelectedMeasurement(null)
        setSelectedMeasurements([])
        clearSelectionRect()
        clickCycleRef.current = null
      }

      resetDragState()
    },
    [
      clearGuideDragHold,
      clearSelectionRect,
      createActionCommit,
      draggingGuideId,
      enabled,
      settingsOpen,
      end,
      guidesEnabled,
      hoverHighlightEnabled,
      isDragging,
      overlayRef,
      selectedMeasurement,
      selectedMeasurements,
      selectionRectRef,
      setActiveMeasurement,
      setDraggingGuideId,
      setEnd,
      setIsDragging,
      setMeasurements,
      setSelectedElement,
      setSelectedMeasurement,
      setSelectedMeasurements,
      setSelectionOriginRect,
      setStart,
      snapEnabled,
      start,
      toolMode,
      toolbarRef,
      clearDomSelection,
      selectOverlayAnnotations,
      selectionMode,
      setSelectedArrowIds,
      setSelectedPenStrokeIds,
      setSelectedTextIds,
    ]
  )

  const handlePointerLeave = useCallback(() => {
    if (hoverFrameRef.current) {
      window.cancelAnimationFrame(hoverFrameRef.current)
      hoverFrameRef.current = null
    }
    clearGuideDragHold()
    setStart(null)
    setEnd(null)
    setIsDragging(false)
    setDraggingGuideId(null)
    setGuidePreview(null)
  }, [
    clearGuideDragHold,
    setDraggingGuideId,
    setEnd,
    setGuidePreview,
    setIsDragging,
    setStart,
  ])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  }
}

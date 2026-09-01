import { useCallback } from "react"
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react"
import { getSnapGuidePosition } from "../core/guides"
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
import { useMesurerPointerSelection } from "./use-mesurer-pointer-selection"
import { useMesurerPointerHover } from "./use-mesurer-pointer-hover"

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
  setSelectedElement: (value: Element | null) => void
  setHoverRect: (value: SetStateAction<Rect | null>) => void
  setHoverElement: (value: Element | null) => void
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
  const hover = useMesurerPointerHover({
    document,
    overlayRef,
    setHoverRect,
    setHoverElement,
  })
  const selection = useMesurerPointerSelection({
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
  })

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
      selection.preparePointerDown(point, event.shiftKey)

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
      setDraggingGuideId,
      setEnd,
      setGuides,
      setHeldDistances,
      setIsDragging,
      setSelectedGuideIds,
      setStart,
      snapGuidesEnabled,
      selection,
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

      hover.hoverPointRef.current = point
      if (!hover.hoverFrameRef.current) {
        hover.hoverFrameRef.current = window.requestAnimationFrame(() => {
          const latest = hover.hoverPointRef.current
          if (latest && !draggingGuideId && !guidesEnabled) {
            if (hoverHighlightEnabled) {
              hover.updateHoverTarget(latest)
            } else {
              hover.updateHoverElement(latest)
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
          hover.hoverFrameRef.current = null
        })
      }

      if (guidesEnabled) return

      if (!start) return
      setEnd(point)

      if (!isDragging) {
        const dx = Math.abs(point.x - start.x)
        const dy = Math.abs(point.y - start.y)
        const threshold = 4
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
      selectedGuideIds.length,
      setSelectedGuideIds,
      start,
      toolMode,
      toolbarRef,
      hover,
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
        selection.shiftDragRef.current = false
        selection.shiftToggleElementRef.current = null
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

      selection.handleSelectionPointerUp(
        event,
        point,
        start,
        isDragging,
        commit,
        resetDragState,
      )
    },
    [
      clearGuideDragHold,
      createActionCommit,
      draggingGuideId,
      enabled,
      settingsOpen,
      end,
      guidesEnabled,
      isDragging,
      overlayRef,
      setDraggingGuideId,
      setEnd,
      setIsDragging,
      setStart,
      selection,
      start,
      toolMode,
      toolbarRef,
    ]
  )

  const handlePointerLeave = useCallback(() => {
    if (hover.hoverFrameRef.current) {
      window.cancelAnimationFrame(hover.hoverFrameRef.current)
      hover.hoverFrameRef.current = null
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

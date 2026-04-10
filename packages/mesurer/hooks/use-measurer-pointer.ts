import { useCallback, useEffect, useRef } from "react"
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react"
import { getInspectMeasurement } from "../dom"
import { getRectFromPoints } from "../geometry"
import { getSnapGuidePosition } from "../guides"
import {
  getElementsInRectCached,
  getSnappedClickTarget,
  getTargetElement,
} from "../selection"
import { getSelectedMeasurementHit } from "../selection-helpers"
import type {
  DistanceOverlay,
  Guide,
  InspectMeasurement,
  Measurement,
  Point,
  Rect,
  ToolMode,
} from "../types"
import { createId } from "../utils"

type GuidePreview = {
  orientation: "vertical" | "horizontal"
  position: number
}

type UseMeasurerPointerArgs = {
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
  toolMode: ToolMode
  guidesEnabled: boolean
  snapEnabled: boolean
  snapGuidesEnabled: boolean
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
}

export const useMeasurerPointer = ({
  toolbarRef,
  overlayRef,
  selectionRectRef,
  createActionCommit,
  clearGuideDragHold,
  scheduleGuideDragHold,
  enabled,
  toolMode,
  guidesEnabled,
  snapEnabled,
  snapGuidesEnabled,
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
}: UseMeasurerPointerArgs) => {
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
  const guidesEnabledRef = useRef(guidesEnabled)
  const guidesRef = useRef(guides)
  const snapGuidesEnabledRef = useRef(snapGuidesEnabled)
  const draggingGuideIdRef = useRef(draggingGuideId)
  const guideOrientationRef = useRef(guideOrientation)

  useEffect(() => {
    return () => {
      if (hoverFrameRef.current) {
        cancelAnimationFrame(hoverFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    guidesEnabledRef.current = guidesEnabled
  }, [guidesEnabled])

  useEffect(() => {
    guidesRef.current = guides
  }, [guides])

  useEffect(() => {
    snapGuidesEnabledRef.current = snapGuidesEnabled
  }, [snapGuidesEnabled])

  useEffect(() => {
    guideOrientationRef.current = guideOrientation
  }, [guideOrientation])

  useEffect(() => {
    draggingGuideIdRef.current = draggingGuideId
  }, [draggingGuideId])

  const updateHoverTarget = useCallback(
    (point: Point) => {
      const target = getSnappedClickTarget(
        point,
        overlayRef.current,
        snapEnabled
      )
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
    [overlayRef, setHoverElement, setHoverRect, snapEnabled]
  )

  const updateHoverElement = useCallback(
    (point: Point) => {
      const target = getSnappedClickTarget(
        point,
        overlayRef.current,
        snapEnabled
      )
      setHoverElement(target)
    },
    [overlayRef, setHoverElement, snapEnabled]
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const commit = createActionCommit()
      const toolbarNode = toolbarRef.current
      if (toolbarNode && toolbarNode.contains(event.target as Node)) return
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
        commit()
        const position = getSnapGuidePosition({
          orientation: guideOrientation,
          point,
          snapGuidesEnabled,
          overlayNode: overlayRef.current,
          guides,
          draggingGuideId,
        })
        const id = createId()
        setSelectedGuideIds([])
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
      enabled,
      guideOrientation,
      guides,
      guidesEnabled,
      optionPairOverlay,
      overlayRef,
      scheduleGuideDragHold,
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
      if (!enabled) return
      if (toolMode === "none") {
        if (hoverHighlightEnabled) {
          setHoverRect(null)
          setHoverElement(null)
        }
        setHoverPointer(null)
        setGuidePreview(null)
        return
      }

      const point = { x: event.clientX, y: event.clientY }
      if (event.altKey !== altPressed) {
        setAltPressed(event.altKey)
      }

      hoverPointRef.current = point
      if (!hoverFrameRef.current) {
        hoverFrameRef.current = requestAnimationFrame(() => {
          const latest = hoverPointRef.current
          if (latest && !draggingGuideIdRef.current) {
            if (hoverHighlightEnabled) {
              updateHoverTarget(latest)
            } else {
              updateHoverElement(latest)
            }
          }
          if (latest && guidesRef.current.length > 0) {
            setHoverPointer(latest)
          } else {
            setHoverPointer(null)
          }
          if (
            guidesEnabledRef.current &&
            latest &&
            !draggingGuideIdRef.current
          ) {
            const position = getSnapGuidePosition({
              orientation: guideOrientationRef.current,
              point: latest,
              snapGuidesEnabled: snapGuidesEnabledRef.current,
              overlayNode: overlayRef.current,
              guides: guidesRef.current,
              draggingGuideId: draggingGuideIdRef.current,
            })
            setGuidePreview({
              orientation: guideOrientationRef.current,
              position,
            })
          } else {
            setGuidePreview(null)
          }
          hoverFrameRef.current = null
        })
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
                    snapGuidesEnabled: snapGuidesEnabledRef.current,
                    overlayNode: overlayRef.current,
                    guides: guidesRef.current,
                    draggingGuideId: draggingGuideIdRef.current,
                  }),
                }
              : guide
          )
        )
      }

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
      hoverHighlightEnabled,
      isDragging,
      overlayRef,
      setAltPressed,
      setEnd,
      setGuidePreview,
      setGuides,
      setHoverElement,
      setHoverPointer,
      setHoverRect,
      setIsDragging,
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
      if (!enabled) return
      clearGuideDragHold()
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
        const selectionRect = getRectFromPoints(start, point)
        selectionRectRef.current = selectionRect
        setSelectionOriginRect(selectionRect)
        const elements = getElementsInRectCached(
          selectionRect,
          overlayRef.current,
          selectionCacheRef.current
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
              ...getInspectMeasurement(element),
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

      const target = event.shiftKey
        ? (getTargetElement(point, overlayRef.current) ??
          getSnappedClickTarget(point, overlayRef.current, snapEnabled))
        : getSnappedClickTarget(point, overlayRef.current, snapEnabled)

      if (target) {
        const inspectMeasurement = getInspectMeasurement(target)
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
        setSelectedElement(null)
        setSelectedMeasurement(null)
        setSelectedMeasurements([])
        clearSelectionRect()
      }

      resetDragState()
    },
    [
      clearGuideDragHold,
      clearSelectionRect,
      createActionCommit,
      draggingGuideId,
      enabled,
      end,
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
    ]
  )

  const handlePointerLeave = useCallback(() => {
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

import { useCallback, useEffect } from "react"
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

const sameDistanceTarget = (left: DistanceOverlay, right: DistanceOverlay) => {
  const sameValue = (a: number, b: number) => Math.abs(a - b) < 0.01
  const sameRect = (a: typeof left.normalizedRectA, b: typeof right.normalizedRectA) =>
    sameValue(a.left, b.left) &&
    sameValue(a.top, b.top) &&
    sameValue(a.width, b.width) &&
    sameValue(a.height, b.height)
  if (left.elementRefA && left.elementRefB && right.elementRefA && right.elementRefB) {
    return (
      (left.elementRefA === right.elementRefA && left.elementRefB === right.elementRefB) ||
      (left.elementRefA === right.elementRefB && left.elementRefB === right.elementRefA)
    )
  }
  return (
    (sameRect(left.normalizedRectA, right.normalizedRectA) && sameRect(left.normalizedRectB, right.normalizedRectB)) ||
    (sameRect(left.normalizedRectA, right.normalizedRectB) && sameRect(left.normalizedRectB, right.normalizedRectA))
  )
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
  onSelectElement?: (element: Element) => void
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
  onSelectElement,
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
    onSelectElement,
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

      const heldDistanceId =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-mesurer-held-distance]")?.dataset.mesurerHeldDistance
          : undefined
      if (!guidesEnabled && altPressed && heldDistanceId) {
        commit()
        setHeldDistances((prev) => prev.filter((distance) => distance.id !== heldDistanceId))
        return
      }

      if (!guidesEnabled && altPressed && optionPairOverlay) {
        commit()
        setHeldDistances((prev) => {
          const existing = prev.find((distance) => sameDistanceTarget(distance, optionPairOverlay))
          if (existing) return prev.filter((distance) => distance.id !== existing.id)
          return [...prev, { ...optionPairOverlay, id: createId() }]
        })
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
        if (event.isTrusted) event.currentTarget.setPointerCapture(event.pointerId)
        return
      }

      setStart(point)
      setEnd(point)
      setIsDragging(false)
      if (event.isTrusted) event.currentTarget.setPointerCapture(event.pointerId)
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
      const isInspectCardEvent = event.nativeEvent.composedPath().some((node) => {
        if (!node || typeof node !== "object" || !("getAttribute" in node)) return false
        return (node as Element).getAttribute("data-mesurer-inspect-info-card") !== null
      })
      if (isInspectCardEvent) {
        hover.hoverPointRef.current = null
        setHoverRect(null)
        setHoverElement(null)
        return
      }
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
          if (event.isTrusted) event.currentTarget.releasePointerCapture(event.pointerId)
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
          if (event.isTrusted) event.currentTarget.releasePointerCapture(event.pointerId)
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

  useEffect(() => {
    if (!enabled || settingsOpen || (toolMode !== "select" && toolMode !== "selection")) return

    const getDocumentOffset = (sourceDocument: Document) => {
      let currentDocument = sourceDocument
      let left = 0
      let top = 0
      while (currentDocument !== document) {
        const frame = currentDocument.defaultView?.frameElement
        if (!frame) break
        const rect = frame.getBoundingClientRect()
        left += rect.left + frame.clientLeft
        top += rect.top + frame.clientTop
        currentDocument = frame.ownerDocument
      }
      return { left, top }
    }

    const handlePortaledPointer = (event: PointerEvent, sourceDocument: Document = document) => {
      const overlayNode = overlayRef.current
      const path = event.composedPath()
      if (!overlayNode || path.includes(overlayNode)) return
      if (sourceDocument === document && toolbarRef.current && path.includes(toolbarRef.current)) return
      const eventTarget = overlayNode.querySelector<HTMLElement>("[data-mesurer-overlay]")
      if (!eventTarget) return
      const offset = getDocumentOffset(sourceDocument)

      const forwardedEvent = new PointerEvent(event.type, {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX + offset.left,
        clientY: event.clientY + offset.top,
        button: event.button,
        buttons: event.buttons,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
        pressure: event.pressure,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      })

      // Keep the application surface passive while Inspect is active, then
      // let the existing overlay handlers resolve the real target by point.
      event.preventDefault()
      event.stopImmediatePropagation()
      eventTarget.dispatchEvent(forwardedEvent)
    }

    const handlePortaledClick = (event: MouseEvent, sourceDocument: Document = document) => {
      const overlayNode = overlayRef.current
      const path = event.composedPath()
      if (!overlayNode || path.includes(overlayNode)) return
      if (sourceDocument === document && toolbarRef.current && path.includes(toolbarRef.current)) return
      if (event.detail === 0) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    const listeners: Array<{ sourceDocument: Document; type: string; listener: EventListener }> = []
    const registeredDocuments = new Set<Document>()
    const registerDocument = (sourceDocument: Document) => {
      if (registeredDocuments.has(sourceDocument)) return
      registeredDocuments.add(sourceDocument)
      const registrations: Array<[string, EventListener]> = [
        ["pointerdown", (event) => handlePortaledPointer(event as PointerEvent, sourceDocument)],
        ["pointermove", (event) => handlePortaledPointer(event as PointerEvent, sourceDocument)],
        ["pointerup", (event) => handlePortaledPointer(event as PointerEvent, sourceDocument)],
        ["pointercancel", (event) => handlePortaledPointer(event as PointerEvent, sourceDocument)],
        ["click", (event) => handlePortaledClick(event as MouseEvent, sourceDocument)],
      ]
      for (const [type, listener] of registrations) {
        sourceDocument.addEventListener(type, listener, true)
        listeners.push({ sourceDocument, type, listener })
      }
    }
    const registerFrameDocuments = (sourceDocument: Document) => {
      registerDocument(sourceDocument)
      for (const frame of Array.from(sourceDocument.querySelectorAll("iframe"))) {
        try {
          const childDocument = frame.contentDocument
          if (!childDocument) continue
          registerFrameDocuments(childDocument)
        } catch {
          // Cross-origin frames cannot expose a document to inspect.
        }
      }
    }
    registerFrameDocuments(document)
    const handleDocumentLoad = () => registerFrameDocuments(document)
    document.addEventListener("load", handleDocumentLoad, true)
    const frameObserver = new MutationObserver(registerFrameDocuments.bind(null, document))
    frameObserver.observe(document.documentElement, { childList: true, subtree: true })
    return () => {
      document.removeEventListener("load", handleDocumentLoad, true)
      frameObserver.disconnect()
      for (const { sourceDocument, type, listener } of listeners) {
        sourceDocument.removeEventListener(type, listener, true)
      }
    }
  }, [document, enabled, overlayRef, settingsOpen, toolbarRef, toolMode])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  }
}

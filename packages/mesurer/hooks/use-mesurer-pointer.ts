import { useCallback, useEffect, useRef } from "react"
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
  minimized: boolean
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
  minimized,
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
      if (event.target instanceof Element && event.target.closest("[data-mesurer-inspect-info-card]")) return
      if (settingsOpen) return
      if (!enabled || event.button !== 0) return
      if (toolMode === "none") return
      clearSelectionRect()
      const point = { x: event.clientX, y: event.clientY }
      selection.preparePointerDown(
        point,
        event.shiftKey,
        (event as ReactPointerEvent<HTMLDivElement> & { ownerDocument?: Document }).ownerDocument ?? document,
        (event as ReactPointerEvent<HTMLDivElement> & { localPoint?: { x: number; y: number } }).localPoint,
      )

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
        if (event.isTrusted) {
          event.currentTarget.setPointerCapture(event.pointerId)
          capturedPointersRef.current.set(event.pointerId, event.currentTarget)
        }
        return
      }

      setStart(point)
      setEnd(point)
      setIsDragging(false)
      if (event.isTrusted) {
        event.currentTarget.setPointerCapture(event.pointerId)
        capturedPointersRef.current.set(event.pointerId, event.currentTarget)
      }
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
        if (hoverHighlightEnabled) hover.clearHover()
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
          if (latest && (guides.length > 0 || event.altKey || altPressed)) {
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
      setHoverPointer,
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
        capturedPointersRef.current.delete(event.pointerId)
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
      capturedPointersRef.current.delete(event.pointerId)

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
        (event as ReactPointerEvent<HTMLDivElement> & { ownerDocument?: Document }).ownerDocument ?? document,
        (event as ReactPointerEvent<HTMLDivElement> & { localPoint?: { x: number; y: number } }).localPoint,
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
    for (const [pointerId, target] of capturedPointersRef.current) {
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
      capturedPointersRef.current.delete(pointerId)
    }
    pointerDocumentsRef.current.clear()
    pointerTargetsRef.current.clear()
    if (hover.hoverFrameRef.current) {
      window.cancelAnimationFrame(hover.hoverFrameRef.current)
      hover.hoverFrameRef.current = null
    }
    hover.clearHover()
    clearGuideDragHold()
    setStart(null)
    setEnd(null)
    setIsDragging(false)
    setDraggingGuideId(null)
    setGuidePreview(null)
  }, [
    clearGuideDragHold,
    hover,
    setDraggingGuideId,
    setEnd,
    setGuidePreview,
    setIsDragging,
    setStart,
  ])

  const capturedPointersRef = useRef(new Map<number, HTMLDivElement>())
  const pointerDocumentsRef = useRef(new Map<number, Document>())
  const pointerTargetsRef = useRef(new Map<number, Element>())

  const inputHandlersRef = useRef({
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  })
  inputHandlersRef.current = {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  }

  useEffect(() => {
    if (!enabled || settingsOpen || toolMode !== "selection") return

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

    const toOverlayInput = (event: PointerEvent, sourceDocument: Document) => {
      const overlayNode = overlayRef.current
      const overlay = overlayNode?.querySelector<HTMLDivElement>("[data-mesurer-overlay]")
      if (!overlay) return null
      const offset = getDocumentOffset(sourceDocument)
      // This is an internal semantic input record, not a DOM event replay.
      return {
        target: pointerTargetsRef.current.get(event.pointerId) ?? event.target,
        currentTarget: overlay,
        nativeEvent: event,
        ownerDocument: sourceDocument,
        localPoint: { x: event.clientX, y: event.clientY },
        clientX: event.clientX + offset.left,
        clientY: event.clientY + offset.top,
        button: event.button,
        buttons: event.buttons,
        pointerId: event.pointerId,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        isTrusted: false,
        preventDefault: () => event.preventDefault(),
      } as unknown as ReactPointerEvent<HTMLDivElement>
    }

    const handleDocumentPointer = (event: PointerEvent, sourceDocument: Document) => {
      if (!enabled || minimized) return
      const overlayNode = overlayRef.current
      const path = event.composedPath()
      if (!overlayNode || path.includes(overlayNode)) return
      if (sourceDocument === document && toolbarRef.current && path.includes(toolbarRef.current)) return
      const pointerOwner = pointerDocumentsRef.current.get(event.pointerId)
      if (pointerOwner && pointerOwner !== sourceDocument) return
      const input = toOverlayInput(event, sourceDocument)
      if (!input) return

      if (event.type === "pointerdown") pointerDocumentsRef.current.set(event.pointerId, sourceDocument)
      if (event.type === "pointerdown") {
        const ElementConstructor = sourceDocument.defaultView?.Element
        if (ElementConstructor && event.target instanceof ElementConstructor) {
          pointerTargetsRef.current.set(event.pointerId, event.target)
        }
      } else if (event.type === "pointerup" || event.type === "pointercancel") {
        pointerDocumentsRef.current.delete(event.pointerId)
        pointerTargetsRef.current.delete(event.pointerId)
      }

      // Inspect owns this pointer sequence. The host never receives a replayed
      // event; Mesurer consumes a normalized record directly.
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.type === "pointerdown") inputHandlersRef.current.handlePointerDown(input)
      else if (event.type === "pointermove") inputHandlersRef.current.handlePointerMove(input)
      else if (event.type === "pointerup") inputHandlersRef.current.handlePointerUp(input)
      else inputHandlersRef.current.handlePointerLeave()
    }

    const handlePortaledClick = (event: MouseEvent, sourceDocument: Document = document) => {
      if (!enabled || minimized) return
      const overlayNode = overlayRef.current
      const path = event.composedPath()
      if (!overlayNode || path.includes(overlayNode)) return
      if (sourceDocument === document && toolbarRef.current && path.includes(toolbarRef.current)) return
      if (event.detail === 0) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    const listeners = new Map<Document, Array<{ type: string; listener: EventListener }>>()
    const loadListeners = new Map<Document, EventListener>()
    const windowListeners = new Map<Window, EventListener>()
    const registeredDocuments = new Set<Document>()
    const rootObservers = new Map<Document | ShadowRoot, MutationObserver>()
    const rootOwners = new Map<Document | ShadowRoot, Document>()
    const frameLoadListeners = new Map<HTMLIFrameElement, EventListener>()
    const frameOwners = new Map<HTMLIFrameElement, Document>()
    let registerFrameDocuments: (sourceDocument: Document, reachable?: Set<Document>) => void
    const registerDocument = (sourceDocument: Document) => {
      if (registeredDocuments.has(sourceDocument)) return
      registeredDocuments.add(sourceDocument)
      const registrations: Array<[string, EventListener]> = [
        ["pointerdown", (event) => handleDocumentPointer(event as PointerEvent, sourceDocument)],
        ["pointermove", (event) => handleDocumentPointer(event as PointerEvent, sourceDocument)],
        ["pointerup", (event) => handleDocumentPointer(event as PointerEvent, sourceDocument)],
        ["pointercancel", (event) => handleDocumentPointer(event as PointerEvent, sourceDocument)],
        ["click", (event) => handlePortaledClick(event as MouseEvent, sourceDocument)],
      ]
      for (const [type, listener] of registrations) {
        sourceDocument.addEventListener(type, listener, true)
      }
      listeners.set(sourceDocument, registrations.map(([type, listener]) => ({ type, listener })))
      const loadListener: EventListener = () => registerFrameDocuments(document)
      sourceDocument.addEventListener("load", loadListener, true)
      loadListeners.set(sourceDocument, loadListener)
      const sourceWindow = sourceDocument.defaultView
      if (sourceWindow) {
        const listener: EventListener = () => {
          const ownsPointer = [...pointerDocumentsRef.current.values()].some((source) => source === sourceDocument)
          if (ownsPointer) inputHandlersRef.current.handlePointerLeave()
        }
        sourceWindow.addEventListener("blur", listener)
        windowListeners.set(sourceWindow, listener)
      }
    }
    const unregisterDocument = (sourceDocument: Document) => {
      for (const { type, listener } of listeners.get(sourceDocument) ?? []) {
        sourceDocument.removeEventListener(type, listener, true)
      }
      listeners.delete(sourceDocument)
      const loadListener = loadListeners.get(sourceDocument)
      if (loadListener) sourceDocument.removeEventListener("load", loadListener, true)
      loadListeners.delete(sourceDocument)
      registeredDocuments.delete(sourceDocument)
      const sourceWindow = sourceDocument.defaultView
      const listener = sourceWindow ? windowListeners.get(sourceWindow) : undefined
      if (sourceWindow && listener) {
        sourceWindow.removeEventListener("blur", listener)
        windowListeners.delete(sourceWindow)
      }
      for (const [root, owner] of rootOwners) {
        if (owner !== sourceDocument) continue
        rootObservers.get(root)?.disconnect()
        rootObservers.delete(root)
        rootOwners.delete(root)
      }
      for (const [frame, owner] of frameOwners) {
        if (owner !== sourceDocument) continue
        const listener = frameLoadListeners.get(frame)
        if (listener) frame.removeEventListener("load", listener)
        frameLoadListeners.delete(frame)
        frameOwners.delete(frame)
      }
    }
    const collectFramesFromTree = (root: Document | ShadowRoot | Element, sourceDocument: Document, frames: HTMLIFrameElement[]) => {
      const IFrameConstructor = sourceDocument.defaultView?.HTMLIFrameElement
      const visit = (currentRoot: Document | ShadowRoot | Element) => {
        if (IFrameConstructor && currentRoot instanceof IFrameConstructor) {
          const frame = currentRoot
          frames.push(frame)
          if (!frameLoadListeners.has(frame)) {
            const listener: EventListener = () => registerFrameDocuments(document)
            frameLoadListeners.set(frame, listener)
            frameOwners.set(frame, sourceDocument)
            frame.addEventListener("load", listener)
          }
        }
        if (currentRoot instanceof Element && currentRoot.shadowRoot) {
          observeRoot(currentRoot.shadowRoot, sourceDocument)
          visit(currentRoot.shadowRoot)
        }
        const ownerDocument = currentRoot instanceof Document ? currentRoot : currentRoot.ownerDocument ?? sourceDocument
        const walker = ownerDocument.createTreeWalker(currentRoot, 1)
        let node = walker.nextNode()
        while (node) {
          if (IFrameConstructor && node instanceof IFrameConstructor) {
            const frame = node
            frames.push(frame)
            if (!frameLoadListeners.has(frame)) {
              const listener: EventListener = () => registerFrameDocuments(document)
              frameLoadListeners.set(frame, listener)
              frameOwners.set(frame, sourceDocument)
              frame.addEventListener("load", listener)
            }
          }
          if (node instanceof Element && node.shadowRoot) {
            observeRoot(node.shadowRoot, sourceDocument)
            visit(node.shadowRoot)
          }
          node = walker.nextNode()
        }
      }
      visit(root)
    }
    const subtreeNeedsFrameRescan = (element: Element) => {
      if (element.tagName === "IFRAME" || element.shadowRoot) return true
      for (const child of element.querySelectorAll("*")) {
        if (child.tagName === "IFRAME" || child.shadowRoot) return true
      }
      return false
    }
    const observeRoot = (root: Document | ShadowRoot, sourceDocument: Document) => {
      if (rootObservers.has(root)) return
      const Observer = root.ownerDocument?.defaultView?.MutationObserver ?? MutationObserver
      const observer = new Observer((mutations) => {
        let shouldRescan = false
        for (const mutation of mutations) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType !== 1) continue
            const element = node as Element
            if (subtreeNeedsFrameRescan(element)) {
              shouldRescan = true
              break
            }
          }
          if (shouldRescan) break
        }
        const addedFrames: HTMLIFrameElement[] = []
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue
            collectFramesFromTree(node as Element, sourceDocument, addedFrames)
          }
        }
        if (shouldRescan || addedFrames.length > 0) registerFrameDocuments(document)
      })
      observer.observe(root, { childList: true, subtree: true })
      rootObservers.set(root, observer)
      rootOwners.set(root, sourceDocument)
    }
    const collectFrames = (root: Document | ShadowRoot, sourceDocument: Document) => {
      observeRoot(root, sourceDocument)
      const frames: HTMLIFrameElement[] = []
      collectFramesFromTree(root, sourceDocument, frames)
      return frames
    }
    registerFrameDocuments = (sourceDocument: Document, reachable = new Set<Document>()) => {
      reachable.add(sourceDocument)
      registerDocument(sourceDocument)
      for (const frame of collectFrames(sourceDocument, sourceDocument)) {
        try {
          const childDocument = frame.contentDocument
          if (!childDocument) continue
          registerFrameDocuments(childDocument, reachable)
        } catch {
          // Cross-origin frames cannot expose a document to inspect.
        }
      }
      if (sourceDocument === document) {
        for (const registeredDocument of registeredDocuments) {
          if (registeredDocument !== document && !reachable.has(registeredDocument)) unregisterDocument(registeredDocument)
        }
      }
    }
    registerFrameDocuments(document)
    return () => {
      for (const observer of rootObservers.values()) observer.disconnect()
      rootObservers.clear()
      rootOwners.clear()
      for (const [frame, listener] of frameLoadListeners) frame.removeEventListener("load", listener)
      frameLoadListeners.clear()
      frameOwners.clear()
      handlePointerLeave()
      for (const sourceDocument of registeredDocuments) {
        unregisterDocument(sourceDocument)
      }
      pointerDocumentsRef.current.clear()
      pointerTargetsRef.current.clear()
    }
  }, [document, enabled, minimized, overlayRef, settingsOpen, toolbarRef, toolMode])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  }
}

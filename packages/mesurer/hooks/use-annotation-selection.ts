import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from "react"
import type { Arrow, Guide, InspectMeasurement, PenStroke, Point, Rect, TextAnnotation, ToolMode } from "../core/types"
import { applyGroupResize, applyGroupRotation, type GroupResizeSnapshot, type GroupRotateSnapshot } from "../core/group-transform"
import { textAnnotationBounds, type ResizeHandle } from "../core/text-transform"
import { transformedArrowBounds } from "../core/arrow-transform"
import { translateArrow } from "../core/arrows"
import { abortPointerDrag } from "../core/pointer-drag"
import { movePenStroke, transformedPenBounds } from "../core/pen-transform"

type Setter<T> = Dispatch<SetStateAction<T>>

type GroupFrame = {
  rect: Rect
  rotation: number
}

type MoveSnapshot = {
  guides: Guide[]
  arrows: Arrow[]
  penStrokes: PenStroke[]
  texts: TextAnnotation[]
  frame: GroupFrame | null
}

type ExtraMoveId = {
  arrowId?: string
  penId?: string
  textId?: string
  guideId?: string
}

type Gesture = {
  pointerId: number
  x: number
  y: number
  moved: boolean
  shift: boolean
  onTarget: boolean
}

type AnnotationBounds = {
  x: number
  y: number
  width: number
  height: number
}

type UseAnnotationSelectionOptions = {
  enabled: boolean
  toolMode: string
  ownerDocument: Document
  overlayRef: RefObject<HTMLElement | null>
  toolbarRef: RefObject<HTMLElement | null>
  scrollOffset: Point
  guides: Guide[]
  arrows: Arrow[]
  penStrokes: PenStroke[]
  textAnnotations: TextAnnotation[]
  selectedGuideIds: string[]
  selectedArrowIds: string[]
  selectedPenStrokeIds: string[]
  selectedTextIds: string[]
  clearSelectionRect: () => void
  setStart: Setter<Point | null>
  setEnd: Setter<Point | null>
  setIsDragging: Setter<boolean>
  setSelectedGuideIds: Setter<string[]>
  setSelectedArrowIds: Setter<string[]>
  setSelectedTextIds: Setter<string[]>
  setSelectedPenStrokeIds: Setter<string[]>
  setSelectedMeasurements: Setter<InspectMeasurement[]>
  setSelectedMeasurement: Setter<InspectMeasurement | null>
  setSelectedElement: (element: Element | null) => void
  setGuides: Setter<Guide[]>
  setArrows: Setter<Arrow[]>
  setPenStrokes: Setter<PenStroke[]>
  setTextAnnotations: Setter<TextAnnotation[]>
  recordSnapshot: () => void
  setToolMode: Dispatch<SetStateAction<ToolMode>>
}

const ANNOTATION_HIT_SLOP = 12

const isPointInsideRect = (x: number, y: number, rect: Rect, slop = 0) =>
  x >= rect.left - slop &&
  x <= rect.left + rect.width + slop &&
  y >= rect.top - slop &&
  y <= rect.top + rect.height + slop

const getTranslatedBounds = (bounds: AnnotationBounds, scrollOffset: Point): Rect => ({
  left: bounds.x - scrollOffset.x,
  top: bounds.y - scrollOffset.y,
  width: bounds.width,
  height: bounds.height,
})

const getSelectionKey = (...ids: string[][]) =>
  ids.map((group) => [...group].sort().join(",")).join("|")

export const useAnnotationSelection = ({
  enabled,
  toolMode,
  ownerDocument,
  overlayRef,
  toolbarRef,
  scrollOffset,
  guides,
  arrows,
  penStrokes,
  textAnnotations,
  selectedGuideIds,
  selectedArrowIds,
  selectedPenStrokeIds,
  selectedTextIds,
  clearSelectionRect,
  setStart,
  setEnd,
  setIsDragging,
  setSelectedGuideIds,
  setSelectedArrowIds,
  setSelectedTextIds,
  setSelectedPenStrokeIds,
  setSelectedMeasurements,
  setSelectedMeasurement,
  setSelectedElement,
  setGuides,
  setArrows,
  setPenStrokes,
  setTextAnnotations,
  recordSnapshot,
  setToolMode,
}: UseAnnotationSelectionOptions) => {
  const clearSelection = useCallback(() => {
    setSelectedGuideIds([])
    setSelectedArrowIds([])
    setSelectedTextIds([])
    setSelectedPenStrokeIds([])
    setSelectedMeasurements([])
    setSelectedMeasurement(null)
    setSelectedElement(null)
    clearSelectionRect()
    setStart(null)
    setEnd(null)
    setIsDragging(false)
  }, [
    clearSelectionRect,
    setEnd,
    setIsDragging,
    setSelectedArrowIds,
    setSelectedElement,
    setSelectedGuideIds,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setSelectedPenStrokeIds,
    setSelectedTextIds,
    setStart,
  ])

  const outsideStateRef = useRef({
    arrows,
    penStrokes,
    textAnnotations,
    guides,
    scrollOffset,
    clearSelection,
  })
  outsideStateRef.current = {
    arrows,
    penStrokes,
    textAnnotations,
    guides,
    scrollOffset,
    clearSelection,
  }

  useLayoutEffect(() => {
    if (!enabled || toolMode !== "selection") return

    const gesture: Gesture = {
      pointerId: -1,
      x: 0,
      y: 0,
      moved: false,
      shift: false,
      onTarget: false,
    }

    const isAnnotationAt = (x: number, y: number) => {
      const current = outsideStateRef.current
      const textIsAtPoint = current.textAnnotations.some((item) => {
        const node = overlayRef.current?.querySelector(
          `[data-mesurer-text-id="${item.id}"]`,
        )
        const rect =
          node instanceof HTMLElement
            ? node.getBoundingClientRect()
            : getTranslatedBounds(textAnnotationBounds(item), current.scrollOffset)
        return isPointInsideRect(x, y, rect, ANNOTATION_HIT_SLOP)
      })
      if (textIsAtPoint) return true

      const penIsAtPoint = current.penStrokes.some((stroke) => {
        const bounds = transformedPenBounds(stroke)
        return isPointInsideRect(
          x,
          y,
          getTranslatedBounds(bounds, current.scrollOffset),
          ANNOTATION_HIT_SLOP,
        )
      })
      if (penIsAtPoint) return true

      const arrowIsAtPoint = current.arrows.some((arrow) => {
        const bounds = transformedArrowBounds(arrow)
        return isPointInsideRect(
          x,
          y,
          getTranslatedBounds(bounds, current.scrollOffset),
          ANNOTATION_HIT_SLOP,
        )
      })
      if (arrowIsAtPoint) return true

      return current.guides.some((guide) =>
        guide.orientation === "vertical"
          ? Math.abs(x - guide.position) <= ANNOTATION_HIT_SLOP
          : Math.abs(y - guide.position) <= ANNOTATION_HIT_SLOP,
      )
    }

    const isMesurerChrome = (event: PointerEvent) =>
      event.composedPath().some((node) => {
        if (!(node instanceof Element)) return false
        if (toolbarRef.current?.contains(node)) return true
        return (
          node.hasAttribute("data-mesurer-group-frame") ||
          node.hasAttribute("data-mesurer-group-controls") ||
          node.hasAttribute("data-mesurer-guide") ||
          node.hasAttribute("data-mesurer-arrow-id") ||
          node.hasAttribute("data-mesurer-arrow-frame") ||
          node.hasAttribute("data-mesurer-pen-id") ||
          node.hasAttribute("data-mesurer-pen-frame") ||
          node.hasAttribute("data-mesurer-text-id") ||
          node.hasAttribute("data-mesurer-text-frame")
        )
      })

    const onPointerDown = (event: PointerEvent) => {
      gesture.pointerId = event.pointerId
      gesture.x = event.clientX
      gesture.y = event.clientY
      gesture.moved = false
      gesture.shift = event.shiftKey
      gesture.onTarget = isMesurerChrome(event) || isAnnotationAt(event.clientX, event.clientY)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== gesture.pointerId) return
      gesture.moved ||= Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 4
    }

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== gesture.pointerId || gesture.moved) return
      if (event.shiftKey || gesture.shift || gesture.onTarget) return
      if (isMesurerChrome(event)) return
      if (!isAnnotationAt(event.clientX, event.clientY)) {
        outsideStateRef.current.clearSelection()
      }
    }

    ownerDocument.addEventListener("pointerdown", onPointerDown)
    ownerDocument.addEventListener("pointermove", onPointerMove)
    ownerDocument.addEventListener("pointerup", onPointerUp)

    return () => {
      ownerDocument.removeEventListener("pointerdown", onPointerDown)
      ownerDocument.removeEventListener("pointermove", onPointerMove)
      ownerDocument.removeEventListener("pointerup", onPointerUp)
    }
  }, [enabled, ownerDocument, overlayRef, toolbarRef, toolMode])

  const removeSelected = useCallback(() => {
    const hasGuides = selectedGuideIds.length > 0
    const hasArrows = selectedArrowIds.length > 0
    const hasText = selectedTextIds.length > 0
    const hasPen = selectedPenStrokeIds.length > 0
    if (!hasGuides && !hasArrows && !hasText && !hasPen) return false

    recordSnapshot()
    if (hasGuides) {
      setGuides((previous) => previous.filter((guide) => !selectedGuideIds.includes(guide.id)))
      setSelectedGuideIds([])
    }
    if (hasArrows) {
      setArrows((previous) => previous.filter((arrow) => !selectedArrowIds.includes(arrow.id)))
      setSelectedArrowIds([])
    }
    if (hasText) {
      setTextAnnotations((previous) => previous.filter((item) => !selectedTextIds.includes(item.id)))
      setSelectedTextIds([])
    }
    if (hasPen) {
      setPenStrokes((previous) => previous.filter((stroke) => !selectedPenStrokeIds.includes(stroke.id)))
      setSelectedPenStrokeIds([])
    }
    return true
  }, [
    recordSnapshot,
    selectedArrowIds,
    selectedGuideIds,
    selectedPenStrokeIds,
    selectedTextIds,
    setArrows,
    setGuides,
    setPenStrokes,
    setSelectedArrowIds,
    setSelectedGuideIds,
    setSelectedPenStrokeIds,
    setSelectedTextIds,
    setTextAnnotations,
  ])

  const itemsRef = useRef({
    arrows,
    guides,
    penStrokes,
    textAnnotations,
  })
  itemsRef.current = { arrows, guides, penStrokes, textAnnotations }
  const selectedIdsRef = useRef({
    selectedGuideIds,
    selectedArrowIds,
    selectedPenStrokeIds,
    selectedTextIds,
  })
  selectedIdsRef.current = {
    selectedGuideIds,
    selectedArrowIds,
    selectedPenStrokeIds,
    selectedTextIds,
  }
  const groupRotateFrameRef = useRef<GroupFrame | null>(null)
  const moveSessionRef = useRef<MoveSnapshot | null>(null)
  const [selectionDragOffset, setSelectionDragOffset] = useState({ x: 0, y: 0 })
  const selectionDragOffsetRef = useRef(selectionDragOffset)
  selectionDragOffsetRef.current = selectionDragOffset

  const applySessionDelta = useCallback((dx: number, dy: number) => {
    const snap = moveSessionRef.current
    if (!snap || (dx === 0 && dy === 0)) return
    if (snap.frame) {
      setGroupRotateFrame({
        ...snap.frame,
        rect: {
          ...snap.frame.rect,
          left: snap.frame.rect.left + dx,
          top: snap.frame.rect.top + dy,
        },
      })
    }
    if (snap.guides.length > 0) {
      const byId = new Map(snap.guides.map((guide) => [guide.id, guide]))
      setGuides((previous) =>
        previous.map((guide) => {
          const origin = byId.get(guide.id)
          if (!origin) return guide
          return {
            ...origin,
            position:
              origin.position + (origin.orientation === "vertical" ? dx : dy),
          }
        }),
      )
    }
    if (snap.arrows.length > 0) {
      const byId = new Map(snap.arrows.map((arrow) => [arrow.id, arrow]))
      setArrows((previous) =>
        previous.map((arrow) => {
          const origin = byId.get(arrow.id)
          return origin ? translateArrow(origin, dx, dy) : arrow
        }),
      )
    }
    if (snap.texts.length > 0) {
      const byId = new Map(snap.texts.map((item) => [item.id, item]))
      setTextAnnotations((previous) =>
        previous.map((item) => {
          const origin = byId.get(item.id)
          return origin ? { ...origin, x: origin.x + dx, y: origin.y + dy } : item
        }),
      )
    }
    if (snap.penStrokes.length > 0) {
      const byId = new Map(snap.penStrokes.map((stroke) => [stroke.id, stroke]))
      setPenStrokes((previous) =>
        previous.map((stroke) => {
          const origin = byId.get(stroke.id)
          return origin ? movePenStroke(origin, dx, dy) : stroke
        }),
      )
    }
  }, [setArrows, setGuides, setPenStrokes, setTextAnnotations])

  const beginMoveSession = useCallback((extra?: ExtraMoveId) => {
    const items = itemsRef.current
    const selected = selectedIdsRef.current
    const guideIds = new Set(selected.selectedGuideIds)
    const arrowIds = new Set(selected.selectedArrowIds)
    const penIds = new Set(selected.selectedPenStrokeIds)
    const textIds = new Set(selected.selectedTextIds)
    if (extra?.guideId) guideIds.add(extra.guideId)
    if (extra?.arrowId) arrowIds.add(extra.arrowId)
    if (extra?.penId) penIds.add(extra.penId)
    if (extra?.textId) textIds.add(extra.textId)
    selectionDragOffsetRef.current = { x: 0, y: 0 }
    setSelectionDragOffset({ x: 0, y: 0 })
    moveSessionRef.current = {
      guides: items.guides.filter((guide) => guideIds.has(guide.id)),
      arrows: items.arrows.filter((arrow) => arrowIds.has(arrow.id)),
      penStrokes: items.penStrokes.filter((stroke) => penIds.has(stroke.id)),
      texts: items.textAnnotations.filter((item) => textIds.has(item.id)),
      frame: groupRotateFrameRef.current,
    }
  }, [])

  const moveFromSession = useCallback((dx: number, dy: number) => {
    if (!moveSessionRef.current) return
    selectionDragOffsetRef.current = { x: dx, y: dy }
    setSelectionDragOffset({ x: dx, y: dy })
  }, [])

  const endMoveSession = useCallback(() => {
    const delta = selectionDragOffsetRef.current
    applySessionDelta(delta.x, delta.y)
    moveSessionRef.current = null
    selectionDragOffsetRef.current = { x: 0, y: 0 }
    setSelectionDragOffset({ x: 0, y: 0 })
  }, [applySessionDelta])

  const cancelMoveSession = useCallback(() => {
    abortPointerDrag()
    moveSessionRef.current = null
    selectionDragOffsetRef.current = { x: 0, y: 0 }
    setSelectionDragOffset({ x: 0, y: 0 })
  }, [])

  const selectAllAnnotations = useCallback(() => {
    const current = itemsRef.current
    const hasAnnotations =
      current.guides.length > 0 ||
      current.arrows.length > 0 ||
      current.penStrokes.length > 0 ||
      current.textAnnotations.length > 0
    if (!hasAnnotations) return false
    setSelectedGuideIds(current.guides.map((guide) => guide.id))
    setSelectedArrowIds(current.arrows.map((arrow) => arrow.id))
    setSelectedTextIds(current.textAnnotations.map((item) => item.id))
    setSelectedPenStrokeIds(current.penStrokes.map((stroke) => stroke.id))
    setSelectedMeasurements([])
    setSelectedMeasurement(null)
    setSelectedElement(null)
    clearSelectionRect()
    if (toolMode !== "selection") setToolMode("selection")
    else recordSnapshot()
    return true
  }, [
    clearSelectionRect,
    recordSnapshot,
    setSelectedArrowIds,
    setSelectedElement,
    setSelectedGuideIds,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setSelectedPenStrokeIds,
    setSelectedTextIds,
    setToolMode,
    toolMode,
  ])

  const groupBounds = useMemo(() => {
    if (toolMode !== "selection") return null

    const renderedTextBounds = (id: string): AnnotationBounds | null => {
      if (moveSessionRef.current) return null
      const node = overlayRef.current?.querySelector(`[data-mesurer-text-id="${id}"]`)
      if (!(node instanceof HTMLElement)) return null
      const rect = node.getBoundingClientRect()
      return {
        x: rect.left + scrollOffset.x,
        y: rect.top + scrollOffset.y,
        width: rect.width,
        height: rect.height,
      }
    }

    const rects = [
      ...arrows
        .filter((item) => selectedArrowIds.includes(item.id))
        .map(transformedArrowBounds),
      ...penStrokes
        .filter((item) => selectedPenStrokeIds.includes(item.id))
        .map(transformedPenBounds),
      ...textAnnotations
        .filter((item) => selectedTextIds.includes(item.id))
        .map((item) => renderedTextBounds(item.id) ?? textAnnotationBounds(item)),
    ]
    if (rects.length === 0) return null
    if (rects.length < 2 && selectedGuideIds.length === 0) return null

    const left = Math.min(...rects.map((rect) => rect.x))
    const top = Math.min(...rects.map((rect) => rect.y))
    const right = Math.max(...rects.map((rect) => rect.x + rect.width))
    const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
    return { left, top, width: right - left, height: bottom - top }
  }, [
    arrows,
    overlayRef,
    penStrokes,
    scrollOffset.x,
    scrollOffset.y,
    selectedArrowIds,
    selectedGuideIds.length,
    selectedPenStrokeIds,
    selectedTextIds,
    textAnnotations,
    toolMode,
  ])

  const groupRotateSnapshotRef = useRef<GroupRotateSnapshot | null>(null)
  const groupResizeSnapshotRef = useRef<GroupResizeSnapshot | null>(null)
  const groupSelectionKeyRef = useRef("")
  const [groupRotateFrame, setGroupRotateFrame] = useState<GroupFrame | null>(null)
  groupRotateFrameRef.current = groupRotateFrame

  useLayoutEffect(() => {
    const key = getSelectionKey(selectedArrowIds, selectedPenStrokeIds, selectedTextIds)
    const selectionChanged =
      groupSelectionKeyRef.current && groupSelectionKeyRef.current !== key
    const hasActiveTransform =
      groupRotateSnapshotRef.current || groupResizeSnapshotRef.current

    if (selectionChanged && !hasActiveTransform) {
      setGroupRotateFrame(null)
    }
    groupSelectionKeyRef.current = key
  }, [selectedArrowIds, selectedPenStrokeIds, selectedTextIds])

  const moveSelectedAnnotations = useCallback((dx: number, dy: number) => {
    setGroupRotateFrame((frame) =>
      frame
        ? { ...frame, rect: { ...frame.rect, left: frame.rect.left + dx, top: frame.rect.top + dy } }
        : frame,
    )
    setGuides((previous) =>
      previous.map((guide) =>
        selectedGuideIds.includes(guide.id)
          ? {
              ...guide,
              position: guide.position + (guide.orientation === "vertical" ? dx : dy),
            }
          : guide,
      ),
    )
    setArrows((previous) =>
      previous.map((arrow) =>
        selectedArrowIds.includes(arrow.id)
          ? {
              ...arrow,
              start: { x: arrow.start.x + dx, y: arrow.start.y + dy },
              end: { x: arrow.end.x + dx, y: arrow.end.y + dy },
              control: arrow.control
                ? { x: arrow.control.x + dx, y: arrow.control.y + dy }
                : undefined,
            }
          : arrow,
      ),
    )
    setTextAnnotations((previous) =>
      previous.map((item) =>
        selectedTextIds.includes(item.id)
          ? { ...item, x: item.x + dx, y: item.y + dy }
          : item,
      ),
    )
    setPenStrokes((previous) =>
      previous.map((stroke) =>
        selectedPenStrokeIds.includes(stroke.id)
          ? {
              ...stroke,
              points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
            }
          : stroke,
      ),
    )
  }, [
    selectedArrowIds,
    selectedGuideIds,
    selectedPenStrokeIds,
    selectedTextIds,
    setArrows,
    setGuides,
    setPenStrokes,
    setTextAnnotations,
  ])

  const textSnapshot = (item: TextAnnotation) => {
    const node = overlayRef.current?.querySelector(`[data-mesurer-text-id="${item.id}"]`)
    const bounds =
      node instanceof HTMLElement
        ? { x: item.x, y: item.y, width: node.offsetWidth, height: node.offsetHeight }
        : textAnnotationBounds(item)
    return { item, bounds }
  }

  const startGroupRotate = useCallback((center: Point, startAngle: number, rect: Rect) => {
    recordSnapshot()
    groupRotateSnapshotRef.current = {
      center,
      startAngle,
      rect,
      arrows: arrows.filter((item) => selectedArrowIds.includes(item.id)),
      penStrokes: penStrokes.filter((item) => selectedPenStrokeIds.includes(item.id)),
      texts: textAnnotations
        .filter((item) => selectedTextIds.includes(item.id))
        .map(textSnapshot),
      initialRotation: groupRotateFrame?.rotation ?? 0,
    }
    setGroupRotateFrame({ rect, rotation: groupRotateFrame?.rotation ?? 0 })
  }, [
    arrows,
    groupRotateFrame,
    overlayRef,
    penStrokes,
    recordSnapshot,
    selectedArrowIds,
    selectedPenStrokeIds,
    selectedTextIds,
    textAnnotations,
  ])

  const updateGroupRotate = useCallback((pointerAngle: number) => {
    const snapshot = groupRotateSnapshotRef.current
    if (!snapshot) return
    const rotated = applyGroupRotation(snapshot, pointerAngle)
    setGroupRotateFrame({
      rect: snapshot.rect,
      rotation: (snapshot.initialRotation ?? 0) + rotated.degrees,
    })
    setArrows((previous) => previous.map((arrow) => rotated.arrows.get(arrow.id) ?? arrow))
    setPenStrokes((previous) =>
      previous.map((stroke) => rotated.penStrokes.get(stroke.id) ?? stroke),
    )
    setTextAnnotations((previous) =>
      previous.map((item) => rotated.texts.get(item.id) ?? item),
    )
  }, [setArrows, setPenStrokes, setTextAnnotations])

  const endGroupRotate = useCallback(() => {
    groupRotateSnapshotRef.current = null
  }, [])

  const startGroupResize = useCallback((handle: ResizeHandle, rect: Rect, rotation: number) => {
    groupResizeSnapshotRef.current = {
      rect,
      rotation,
      arrows: arrows.filter((item) => selectedArrowIds.includes(item.id)),
      penStrokes: penStrokes.filter((item) => selectedPenStrokeIds.includes(item.id)),
      texts: textAnnotations
        .filter((item) => selectedTextIds.includes(item.id))
        .map(textSnapshot),
    }
    recordSnapshot()
  }, [
    arrows,
    overlayRef,
    penStrokes,
    recordSnapshot,
    selectedArrowIds,
    selectedPenStrokeIds,
    selectedTextIds,
    textAnnotations,
  ])

  const resizeSelectedAnnotations = useCallback((handle: ResizeHandle, event: ReactPointerEvent<HTMLElement>) => {
    const snapshot = groupResizeSnapshotRef.current
    if (!snapshot) return
    const resized = applyGroupResize(snapshot, handle, {
      x: event.clientX + scrollOffset.x,
      y: event.clientY + scrollOffset.y,
    })
    setGroupRotateFrame((frame) => (frame ? { ...frame, rect: resized.rect } : frame))
    setArrows((previous) => previous.map((arrow) => resized.arrows.get(arrow.id) ?? arrow))
    setPenStrokes((previous) =>
      previous.map((stroke) => resized.penStrokes.get(stroke.id) ?? stroke),
    )
    setTextAnnotations((previous) =>
      previous.map((item) => resized.texts.get(item.id) ?? item),
    )
  }, [scrollOffset.x, scrollOffset.y, setArrows, setPenStrokes, setTextAnnotations])

  const endGroupResize = useCallback(() => {
    groupResizeSnapshotRef.current = null
  }, [])

  return {
    clearSelection,
    removeSelected,
    selectAllAnnotations,
    groupBounds,
    groupRotateFrame,
    moveSelectedAnnotations,
    beginMoveSession,
    moveFromSession,
    endMoveSession,
    cancelMoveSession,
    selectionDragOffset,
    startGroupRotate,
    updateGroupRotate,
    endGroupRotate,
    startGroupResize,
    resizeSelectedAnnotations,
    endGroupResize,
  }
}

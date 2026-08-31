import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from "react"
import type { Arrow, Guide, InspectMeasurement, PenStroke, Point, Rect, TextAnnotation } from "../core/types"
import { applyGroupResize, applyGroupRotation, type GroupResizeSnapshot, type GroupRotateSnapshot } from "../core/group-transform"
import { textAnnotationBounds, type ResizeHandle } from "../core/text-transform"
import { transformedArrowBounds } from "../core/arrow-transform"
import { transformedPenBounds } from "../core/pen-transform"

type Setter<T> = Dispatch<SetStateAction<T>>

type GroupFrame = {
  rect: Rect
  rotation: number
}

type Gesture = {
  pointerId: number
  x: number
  y: number
  moved: boolean
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
}

const isPointInsideRect = (x: number, y: number, rect: Rect) =>
  x >= rect.left &&
  x <= rect.left + rect.width &&
  y >= rect.top &&
  y <= rect.top + rect.height

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
    scrollOffset,
    clearSelection,
  })
  outsideStateRef.current = {
    arrows,
    penStrokes,
    textAnnotations,
    scrollOffset,
    clearSelection,
  }

  useEffect(() => {
    if (!enabled || toolMode !== "selection") return

    const gesture: Gesture = {
      pointerId: -1,
      x: 0,
      y: 0,
      moved: false,
    }

    const isAnnotationAt = (x: number, y: number) => {
      const current = outsideStateRef.current
      const textIsAtPoint = current.textAnnotations.some((item) => {
        const node = overlayRef.current?.querySelector(
          `[data-mesurer-text-id="${item.id}"]`,
        )
        return node instanceof HTMLElement && isPointInsideRect(x, y, node.getBoundingClientRect())
      })
      if (textIsAtPoint) return true

      const penIsAtPoint = current.penStrokes.some((stroke) => {
        const bounds = transformedPenBounds(stroke)
        return isPointInsideRect(
          x,
          y,
          getTranslatedBounds(bounds, current.scrollOffset),
        )
      })
      if (penIsAtPoint) return true

      return current.arrows.some((arrow) => {
        const bounds = transformedArrowBounds(arrow)
        return isPointInsideRect(
          x,
          y,
          getTranslatedBounds(bounds, current.scrollOffset),
        )
      })
    }

    const onPointerDown = (event: PointerEvent) => {
      gesture.pointerId = event.pointerId
      gesture.x = event.clientX
      gesture.y = event.clientY
      gesture.moved = false
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== gesture.pointerId) return
      gesture.moved ||= Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 4
    }

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== gesture.pointerId || gesture.moved) return
      const target = event.target
      if (target instanceof Node && toolbarRef.current?.contains(target)) return
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

  const selectAllAnnotations = useCallback(() => {
    if (toolMode !== "selection") return false
    recordSnapshot()
    setSelectedGuideIds(guides.map((guide) => guide.id))
    setSelectedArrowIds(arrows.map((arrow) => arrow.id))
    setSelectedTextIds(textAnnotations.map((item) => item.id))
    setSelectedPenStrokeIds(penStrokes.map((stroke) => stroke.id))
    setSelectedMeasurements([])
    setSelectedMeasurement(null)
    setSelectedElement(null)
    clearSelectionRect()
    ownerDocument.defaultView?.getSelection()?.removeAllRanges()
    return true
  }, [
    arrows,
    clearSelectionRect,
    guides,
    ownerDocument,
    penStrokes,
    recordSnapshot,
    setSelectedArrowIds,
    setSelectedElement,
    setSelectedGuideIds,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setSelectedPenStrokeIds,
    setSelectedTextIds,
    textAnnotations,
    toolMode,
  ])

  const groupBounds = useMemo(() => {
    if (toolMode !== "selection") return null

    const renderedTextBounds = (id: string): AnnotationBounds | null => {
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
    if (rects.length < 2) return null

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
    selectedPenStrokeIds,
    selectedTextIds,
    textAnnotations,
    toolMode,
  ])

  const groupRotateSnapshotRef = useRef<GroupRotateSnapshot | null>(null)
  const groupResizeSnapshotRef = useRef<GroupResizeSnapshot | null>(null)
  const groupSelectionKeyRef = useRef("")
  const [groupRotateFrame, setGroupRotateFrame] = useState<GroupFrame | null>(null)

  useEffect(() => {
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
    startGroupRotate,
    updateGroupRotate,
    endGroupRotate,
    startGroupResize,
    resizeSelectedAnnotations,
    endGroupResize,
  }
}

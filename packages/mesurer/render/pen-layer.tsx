import { memo, useRef, type PointerEvent as ReactPointerEvent } from "react"
import type { PenStroke, Point } from "../core/types"
import { boxCenter, rotationFromPointer, type ResizeHandle } from "../core/text-transform"
import { penBounds, movePenStroke, resizePenStroke, rotatePenStroke } from "../core/pen-transform"
import { eventView, listenPointerDrag } from "../core/pointer-drag"
import { TextTransformFrame } from "./text-transform-frame"

const pathForPoints = (points: Point[]) => points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")

export const PenLayer = memo(function PenLayer({
  strokes,
  preview,
  scrollOffset,
  selectionMode,
  selectedIds,
  moveOffset = { x: 0, y: 0 },
  onSelect,
  onChange,
  onChangeStart,
  onMove,
  onMoveStart,
  onMoveEnd,
  selectionCount,
}: {
  strokes: PenStroke[]
  preview: Point[]
  scrollOffset: Point
  selectionMode: boolean
  selectedIds: string[]
  moveOffset?: { x: number; y: number }
  onSelect: (id: string, additive?: boolean) => void
  onChange: (stroke: PenStroke) => void
  onChangeStart: () => void
  onMove?: (id: string, dx: number, dy: number) => void
  onMoveStart?: (id: string) => void
  onMoveEnd?: () => void
  selectionCount: number
}) {
  const dragRef = useRef<{ id: string; type: "move" | "resize" | "rotate"; start: Point; stroke: PenStroke; handle?: ResizeHandle; offset?: number } | null>(null)
  const scrollRef = useRef(scrollOffset)
  scrollRef.current = scrollOffset
  if (strokes.length === 0 && preview.length === 0) return null
  const translate = (points: Point[]) => points.map((point) => ({ x: point.x - scrollOffset.x, y: point.y - scrollOffset.y }))
  const selectedStrokes = strokes.filter((stroke) => selectedIds.includes(stroke.id))
  const pointerPage = (event: { clientX: number; clientY: number }) => ({
    x: event.clientX + scrollRef.current.x,
    y: event.clientY + scrollRef.current.y,
  })
  const applyDrag = (dx: number, dy: number, event: PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.type === "move") {
      if (onMove) onMove(drag.id, dx, dy)
      else onChange(movePenStroke(drag.stroke, dx, dy))
      return
    }
    const pointer = pointerPage(event)
    const next = drag.type === "resize"
      ? resizePenStroke(drag.stroke, drag.handle!, pointer)
      : rotatePenStroke(drag.stroke, pointer, drag.offset!)
    onChange(next)
  }
  const trackDrag = (event: ReactPointerEvent<Element>) => {
    const view = eventView(event)
    if (!view) return
    listenPointerDrag(event.pointerId, view, { x: event.clientX, y: event.clientY }, {
      onMove: applyDrag,
      onEnd: () => {
        dragRef.current = null
        onMoveEnd?.()
      },
    })
  }
  const startMove = (stroke: PenStroke, event: ReactPointerEvent<Element>) => {
    event.preventDefault()
    event.stopPropagation()
    onSelect(stroke.id, event.shiftKey)
    if (event.shiftKey) return
    onChangeStart()
    onMoveStart?.(stroke.id)
    dragRef.current = { id: stroke.id, type: "move", start: pointerPage(event), stroke }
    trackDrag(event)
  }
  const startResize = (stroke: PenStroke, handle: ResizeHandle, event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onChangeStart()
    dragRef.current = { id: stroke.id, type: "resize", start: pointerPage(event), stroke, handle }
    trackDrag(event)
  }
  const startRotate = (stroke: PenStroke, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const box = penBounds(stroke)
    const center = boxCenter(box.x, box.y, box.width, box.height)
    onChangeStart()
    dragRef.current = { id: stroke.id, type: "rotate", start: pointerPage(event), stroke, offset: rotationFromPointer(center, pointerPage(event)) - (stroke.rotation ?? 0) }
    trackDrag(event)
  }
  return (
    <div className="msr:absolute msr:inset-0 msr:pointer-events-none">
    <svg aria-hidden="true" className="msr:absolute msr:inset-0 msr:size-full" style={{ pointerEvents: selectionMode ? "auto" : "none" }} data-mesurer-pen-layer="true">
      {strokes.map((stroke) => (
        <g
          key={stroke.id}
          transform={[
            selectedIds.includes(stroke.id) && (moveOffset.x || moveOffset.y)
              ? `translate(${moveOffset.x} ${moveOffset.y})`
              : "",
            stroke.rotation
              ? `rotate(${stroke.rotation} ${penBounds(stroke).x + penBounds(stroke).width / 2 - scrollOffset.x} ${penBounds(stroke).y + penBounds(stroke).height / 2 - scrollOffset.y})`
              : "",
          ].filter(Boolean).join(" ") || undefined}
          data-mesurer-pen-transform={stroke.id}
        >
          <path d={pathForPoints(translate(stroke.points))} fill="none" stroke="transparent" strokeWidth={Math.max(28, stroke.width + 20)} strokeLinecap="round" strokeLinejoin="round" pointerEvents={selectionMode ? "stroke" : "none"} onPointerDown={(event) => startMove(stroke, event)} data-mesurer-pen-id={stroke.id} />
          <path d={pathForPoints(translate(stroke.points))} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" data-mesurer-pen="true" data-mesurer-pen-id={stroke.id} />
        </g>
      ))}
      {preview.length > 0 ? (
        <path d={pathForPoints(translate(preview))} fill="none" stroke="#0d99ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.65} data-mesurer-pen-preview="true" />
      ) : null}
    </svg>
    {selectionMode ? selectedStrokes.map((stroke) => {
      const box = penBounds(stroke)
      const showControls = selectionCount === 1
      return (
        <div key={stroke.id} className={`msr:absolute ${showControls ? "msr:pointer-events-auto" : "msr:pointer-events-none"}`} style={{ left: box.x - scrollOffset.x + (selectedIds.includes(stroke.id) ? moveOffset.x : 0), top: box.y - scrollOffset.y + (selectedIds.includes(stroke.id) ? moveOffset.y : 0), width: box.width, height: box.height, transform: `rotate(${stroke.rotation ?? 0}deg)`, transformOrigin: "center center" }} onPointerDown={showControls ? (event) => startMove(stroke, event) : undefined}>
           <TextTransformFrame frameDataAttribute="data-mesurer-pen-frame" handleDataAttribute="data-mesurer-pen-handle" rotation={stroke.rotation ?? 0} showControls={showControls} showOutline onResizeStart={(handle, event) => startResize(stroke, handle, event)} onRotateStart={(event) => startRotate(stroke, event)} />
        </div>
      )
    }) : null}
    </div>
  )
  })

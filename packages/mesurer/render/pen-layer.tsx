import { memo, useRef, type PointerEvent } from "react"
import type { PenStroke, Point } from "../core/types"
import { boxCenter, rotationFromPointer, type ResizeHandle } from "../core/text-transform"
import { penBounds, movePenStroke, resizePenStroke, rotatePenStroke } from "../core/pen-transform"
import { TextTransformFrame } from "./text-transform-frame"

const pathForPoints = (points: Point[]) => points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")

export const PenLayer = memo(function PenLayer({
  strokes,
  preview,
  scrollOffset,
  selectionMode,
  selectedIds,
  onSelect,
  onChange,
  onChangeStart,
  onMove,
  selectionCount,
}: {
  strokes: PenStroke[]
  preview: Point[]
  scrollOffset: Point
  selectionMode: boolean
  selectedIds: string[]
  onSelect: (id: string, additive?: boolean) => void
  onChange: (stroke: PenStroke) => void
  onChangeStart: () => void
  onMove?: (id: string, dx: number, dy: number) => void
  selectionCount: number
}) {
  const dragRef = useRef<{ id: string; type: "move" | "resize" | "rotate"; start: Point; last: Point; stroke: PenStroke; handle?: ResizeHandle; offset?: number } | null>(null)
  if (strokes.length === 0 && preview.length === 0) return null
  const translate = (points: Point[]) => points.map((point) => ({ x: point.x - scrollOffset.x, y: point.y - scrollOffset.y }))
  const selectedStrokes = strokes.filter((stroke) => selectedIds.includes(stroke.id))
  const pointerPage = (event: PointerEvent<Element>) => ({ x: event.clientX + scrollOffset.x, y: event.clientY + scrollOffset.y })
  const startMove = (stroke: PenStroke, event: PointerEvent<Element>) => {
    event.stopPropagation()
    onSelect(stroke.id, event.shiftKey)
    if (event.shiftKey) return
    onChangeStart()
    dragRef.current = { id: stroke.id, type: "move", start: pointerPage(event), last: pointerPage(event), stroke }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startResize = (stroke: PenStroke, handle: ResizeHandle, event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    onChangeStart()
    dragRef.current = { id: stroke.id, type: "resize", start: pointerPage(event), last: pointerPage(event), stroke, handle }
  }
  const startRotate = (stroke: PenStroke, event: PointerEvent<HTMLButtonElement>) => {
    const box = penBounds(stroke)
    const center = boxCenter(box.x, box.y, box.width, box.height)
    onChangeStart()
    dragRef.current = { id: stroke.id, type: "rotate", start: pointerPage(event), last: pointerPage(event), stroke, offset: rotationFromPointer(center, pointerPage(event)) - (stroke.rotation ?? 0) }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const pointer = pointerPage(event)
    if (drag.type === "move" && onMove) {
      onMove(drag.id, pointer.x - drag.last.x, pointer.y - drag.last.y)
      drag.last = pointer
      return
    }
    const next = drag.type === "move"
      ? movePenStroke(drag.stroke, pointer.x - drag.start.x, pointer.y - drag.start.y)
      : drag.type === "resize"
        ? resizePenStroke(drag.stroke, drag.handle!, pointer)
        : rotatePenStroke(drag.stroke, pointer, drag.offset!)
    onChange(next)
  }
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
  }
  return (
    <div className="msr:absolute msr:inset-0 msr:pointer-events-none" onPointerMove={handleMove} onPointerUp={endDrag}>
    <svg aria-hidden="true" className="msr:absolute msr:inset-0 msr:size-full" style={{ pointerEvents: selectionMode ? "auto" : "none" }} data-mesurer-pen-layer="true">
      {strokes.map((stroke) => (
        <g
          key={stroke.id}
          transform={stroke.rotation
            ? `rotate(${stroke.rotation} ${penBounds(stroke).x + penBounds(stroke).width / 2 - scrollOffset.x} ${penBounds(stroke).y + penBounds(stroke).height / 2 - scrollOffset.y})`
            : undefined}
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
        <div key={stroke.id} className={`msr:absolute ${showControls ? "msr:pointer-events-auto" : "msr:pointer-events-none"}`} style={{ left: box.x - scrollOffset.x, top: box.y - scrollOffset.y, width: box.width, height: box.height, transform: `rotate(${stroke.rotation ?? 0}deg)`, transformOrigin: "center center" }} onPointerDown={showControls ? (event) => startMove(stroke, event) : undefined} onPointerMove={showControls ? handleMove : undefined} onPointerUp={showControls ? endDrag : undefined}>
           <TextTransformFrame frameDataAttribute="data-mesurer-pen-frame" handleDataAttribute="data-mesurer-pen-handle" rotation={stroke.rotation ?? 0} showControls={showControls} showOutline onResizeStart={(handle, event) => startResize(stroke, handle, event)} onRotateStart={(event) => startRotate(stroke, event)} />
        </div>
      )
    }) : null}
    </div>
  )
  })

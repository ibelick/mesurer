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
}: {
  strokes: PenStroke[]
  preview: Point[]
  scrollOffset: Point
  selectionMode: boolean
  selectedIds: string[]
  onSelect: (id: string) => void
  onChange: (stroke: PenStroke) => void
  onChangeStart: () => void
}) {
  const dragRef = useRef<{ id: string; type: "move" | "resize" | "rotate"; start: Point; stroke: PenStroke; handle?: ResizeHandle; offset?: number } | null>(null)
  if (strokes.length === 0 && preview.length === 0) return null
  const translate = (points: Point[]) => points.map((point) => ({ x: point.x - scrollOffset.x, y: point.y - scrollOffset.y }))
  const selected = strokes.find((stroke) => selectedIds.includes(stroke.id))
  const selectedBox = selected ? penBounds(selected) : null
  const pointerPage = (event: PointerEvent<Element>) => ({ x: event.clientX + scrollOffset.x, y: event.clientY + scrollOffset.y })
  const startMove = (stroke: PenStroke, event: PointerEvent<Element>) => {
    event.stopPropagation()
    onSelect(stroke.id)
    onChangeStart()
    dragRef.current = { id: stroke.id, type: "move", start: pointerPage(event), stroke }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startResize = (handle: ResizeHandle, event: PointerEvent<HTMLElement>) => {
    if (!selected) return
    event.currentTarget.setPointerCapture(event.pointerId)
    onChangeStart()
    dragRef.current = { id: selected.id, type: "resize", start: pointerPage(event), stroke: selected, handle }
  }
  const startRotate = (event: PointerEvent<HTMLButtonElement>) => {
    if (!selected || !selectedBox) return
    const center = boxCenter(selectedBox.x, selectedBox.y, selectedBox.width, selectedBox.height)
    onChangeStart()
    dragRef.current = { id: selected.id, type: "rotate", start: pointerPage(event), stroke: selected, offset: rotationFromPointer(center, pointerPage(event)) - (selected.rotation ?? 0) }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const pointer = pointerPage(event)
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
          <path d={pathForPoints(translate(stroke.points))} fill="none" stroke="transparent" strokeWidth={Math.max(16, stroke.width + 12)} strokeLinecap="round" strokeLinejoin="round" pointerEvents={selectionMode ? "stroke" : "none"} onPointerDown={(event) => startMove(stroke, event)} />
          <path d={pathForPoints(translate(stroke.points))} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" data-mesurer-pen="true" data-mesurer-pen-id={stroke.id} />
        </g>
      ))}
      {preview.length > 0 ? (
        <path d={pathForPoints(translate(preview))} fill="none" stroke="#0d99ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.65} data-mesurer-pen-preview="true" />
      ) : null}
    </svg>
    {selectionMode && selected && selectedBox ? (
      <div className="msr:absolute msr:pointer-events-auto" style={{ left: selectedBox.x - scrollOffset.x, top: selectedBox.y - scrollOffset.y, width: selectedBox.width, height: selectedBox.height, transform: `rotate(${selected.rotation ?? 0}deg)`, transformOrigin: "center center" }} onPointerDown={(event) => startMove(selected, event)} onPointerMove={handleMove} onPointerUp={endDrag}>
        <TextTransformFrame frameDataAttribute="data-mesurer-pen-frame" handleDataAttribute="data-mesurer-pen-handle" rotation={selected.rotation ?? 0} onResizeStart={startResize} onRotateStart={startRotate} />
      </div>
    ) : null}
    </div>
  )
})

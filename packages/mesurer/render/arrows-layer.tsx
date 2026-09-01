import { memo, useRef, type PointerEvent } from "react"
import { arrowHead, arrowPath, midpoint, quadraticPoint } from "../core/arrows"
import type { Arrow, Point } from "../core/types"
import { arrowBounds, moveArrow, resizeArrow, rotateArrow, transformedArrowPoints } from "../core/arrow-transform"
import { boxCenter, rotationFromPointer, type ResizeHandle } from "../core/text-transform"
import { HandleNode } from "./handle-node"
import { TextTransformFrame } from "./text-transform-frame"

type ArrowsLayerProps = {
  arrows: Arrow[]
  selectedIds: string[]
  moveOffset?: { x: number; y: number }
  preview: { start: Point; end: Point; control?: Point } | null
  scrollOffset: Point
  color: string
  onSelect: (id: string) => void
  onChange: (arrow: Arrow) => void
  onChangeStart: () => void
  editingArrowId: string | null
  selectionCount: number
}

const ArrowNode = ({
  x,
  y,
  color,
  id,
  handle,
}: {
  x: number
  y: number
  color: string
  id?: string
  handle: "start" | "control" | "end"
}) => (
  <HandleNode
    x={x}
    y={y}
    color={color}
    pointerEvents="all"
    data-mesurer-arrow-node="true"
    data-mesurer-arrow-id={id}
    data-mesurer-arrow-handle={handle}
    data-mesurer-arrow-x={x}
    data-mesurer-arrow-y={y}
  />
)

const ArrowLine = ({
  start,
  end,
  control: providedControl,
  color,
  width,
  selected,
  showNodes = true,
  preview = false,
  id,
}: {
  start: Point
  end: Point
  control?: Point
  color: string
  width: number
  selected?: boolean
  showNodes?: boolean
  preview?: boolean
  id?: string
}) => {
  const control = providedControl ?? midpoint(start, end)
  const path = arrowPath(start, end, control)
  const head = arrowHead(start, control, end, width)
  const touchPoints = preview
    ? []
    : [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t) => quadraticPoint(start, control, end, t))

  return (
    <g>
      {touchPoints.map((point, index) => (
        <circle
          key={`touch-${index}`}
          cx={point.x}
          cy={point.y}
          r="12"
          fill="transparent"
          pointerEvents="all"
          data-mesurer-arrow-id={id}
          data-mesurer-arrow-touch-zone="true"
        />
      ))}
      <path
        d={path}
        fill="none"
        stroke={color}
        opacity="0"
        strokeWidth={Math.max(width, 24)}
        pointerEvents={preview ? "none" : "all"}
        data-mesurer-arrow-id={id}
        data-mesurer-arrow-hit="true"
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        pointerEvents={preview ? "none" : "all"}
        opacity={preview ? 0.65 : 1}
        data-mesurer-arrow={preview ? undefined : "true"}
        data-mesurer-arrow-id={id}
        data-mesurer-arrow-preview={preview ? "true" : undefined}
      />
      <path
        d={`M ${head.left.x} ${head.left.y} L ${head.tip.x} ${head.tip.y} L ${head.right.x} ${head.right.y}`}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents={preview ? "none" : "all"}
        opacity={preview ? 0.65 : 1}
        data-mesurer-arrow-id={id}
        data-mesurer-arrow-hit="true"
      />
      {selected && showNodes ? (
        <>
          <ArrowNode
            x={start.x}
            y={start.y}
            color={color}
            id={id}
            handle="start"
          />
          <ArrowNode
            x={control.x}
            y={control.y}
            color={color}
            id={id}
            handle="control"
          />
          <ArrowNode
            x={end.x}
            y={end.y}
            color={color}
            id={id}
            handle="end"
          />
        </>
      ) : null}
      {selected && showNodes ? (
        <>
          <circle
            cx={start.x}
            cy={start.y}
            r="12"
            fill="transparent"
            pointerEvents="all"
            data-mesurer-arrow-id={id}
            data-mesurer-arrow-handle="start"
            data-mesurer-arrow-hit="true"
            data-mesurer-arrow-x={start.x}
            data-mesurer-arrow-y={start.y}
          />
          <circle
            cx={control.x}
            cy={control.y}
            r="12"
            fill="transparent"
            pointerEvents="all"
            data-mesurer-arrow-id={id}
            data-mesurer-arrow-handle="control"
            data-mesurer-arrow-hit="true"
            data-mesurer-arrow-x={control.x}
            data-mesurer-arrow-y={control.y}
          />
          <circle
            cx={end.x}
            cy={end.y}
            r="12"
            fill="transparent"
            pointerEvents="all"
            data-mesurer-arrow-id={id}
            data-mesurer-arrow-handle="end"
            data-mesurer-arrow-hit="true"
            data-mesurer-arrow-x={end.x}
            data-mesurer-arrow-y={end.y}
          />
        </>
      ) : null}
    </g>
  )
}

export const ArrowsLayer = memo(function ArrowsLayer({
  arrows,
  selectedIds,
  moveOffset = { x: 0, y: 0 },
  preview,
  scrollOffset,
  color,
  onSelect,
  onChange,
  onChangeStart,
  editingArrowId,
  selectionCount,
}: ArrowsLayerProps) {
  const dragRef = useRef<{
    type: "resize" | "rotate"
    arrow: Arrow
    start: Point
    handle?: ResizeHandle
    offset?: number
  } | null>(null)
  if (arrows.length === 0 && !preview) return null

  const pagePoint = (event: PointerEvent<Element>) => ({ x: event.clientX + scrollOffset.x, y: event.clientY + scrollOffset.y })
  const startResize = (arrow: Arrow, handle: ResizeHandle, event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onSelect(arrow.id)
    onChangeStart()
    dragRef.current = { type: "resize", arrow, start: pagePoint(event), handle }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startRotate = (arrow: Arrow, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onSelect(arrow.id)
    onChangeStart()
    const bounds = arrowBounds(arrow)
    const center = boxCenter(bounds.x, bounds.y, bounds.width, bounds.height)
    dragRef.current = {
      type: "rotate",
      arrow,
      start: pagePoint(event),
      offset: rotationFromPointer(center, pagePoint(event)) - (arrow.rotation ?? 0),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const pointer = pagePoint(event)
    onChange(drag.type === "resize"
      ? resizeArrow(drag.arrow, drag.handle!, pointer)
      : rotateArrow(drag.arrow, pointer, drag.offset!))
  }
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
  }

  return (
    <div className="msr:pointer-events-none msr:absolute msr:inset-0" data-mesurer-arrows-layer="true" onPointerMove={handleMove} onPointerUp={endDrag}>
      <svg
        aria-hidden="true"
        className="msr:pointer-events-none msr:absolute msr:inset-0 msr:size-full"
      >
      {arrows.map((arrow) => (
        <g
          key={arrow.id}
          transform={
            selectedIds.includes(arrow.id) && (moveOffset.x || moveOffset.y)
              ? `translate(${moveOffset.x} ${moveOffset.y})`
              : undefined
          }
        >
        <ArrowLine
          start={{ x: transformedArrowPoints(arrow)[0]!.x - scrollOffset.x, y: transformedArrowPoints(arrow)[0]!.y - scrollOffset.y }}
          end={{ x: transformedArrowPoints(arrow)[2]!.x - scrollOffset.x, y: transformedArrowPoints(arrow)[2]!.y - scrollOffset.y }}
          control={{ x: transformedArrowPoints(arrow)[1]!.x - scrollOffset.x, y: transformedArrowPoints(arrow)[1]!.y - scrollOffset.y }}
          color={arrow.color}
          width={arrow.width}
           selected={selectedIds.includes(arrow.id)}
           showNodes={selectionCount === 1}
          id={arrow.id}
        />
        </g>
      ))}
      {preview ? (
        <ArrowLine
          start={{ x: preview.start.x - scrollOffset.x, y: preview.start.y - scrollOffset.y }}
          end={{ x: preview.end.x - scrollOffset.x, y: preview.end.y - scrollOffset.y }}
          control={preview.control ? { x: preview.control.x - scrollOffset.x, y: preview.control.y - scrollOffset.y } : undefined}
          color="#0d99ff"
          width={1}
          preview
        />
      ) : null}
      </svg>
      {arrows.filter((arrow) => selectedIds.includes(arrow.id) && arrow.id !== editingArrowId).map((arrow) => {
        const bounds = arrowBounds(arrow)
        const left = bounds.x - scrollOffset.x + moveOffset.x
        const top = bounds.y - scrollOffset.y + moveOffset.y
        const width = bounds.width
        const height = bounds.height
        return (
          <div
            key={`frame-${arrow.id}`}
            className="msr:absolute msr:pointer-events-none"
            style={{ left, top, width, height, transform: `rotate(${arrow.rotation ?? 0}deg)`, transformOrigin: "center center" }}
          >
            <TextTransformFrame
              rotation={arrow.rotation ?? 0}
              showControls={selectionCount === 1}
              handleOffset={8}
              frameDataAttribute="data-mesurer-arrow-frame"
              handleDataAttribute="data-mesurer-arrow-handle"
              onResizeStart={(handle, event) => startResize(arrow, handle, event)}
              onRotateStart={(event) => startRotate(arrow, event)}
            />
          </div>
        )
      })}
    </div>
  )
})

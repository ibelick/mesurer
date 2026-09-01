import { useRef, type PointerEvent as ReactPointerEvent } from "react"
import type { Point, Rect } from "../core/types"
import { eventView, listenPointerDrag } from "../core/pointer-drag"
import { boxCenter, rotationFromPointer, type ResizeHandle } from "../core/text-transform"
import { TextTransformFrame } from "./text-transform-frame"

export const GroupSelectionFrame = ({
  rect,
  rotation,
  scrollOffset,
  onResizeStart,
  onResize,
   onResizeEnd,
   onMove,
   onMoveStart,
   onMoveEnd,
  onRotateStart,
  onRotate,
  onRotateEnd,
}: {
  rect: Rect
  rotation: number
  scrollOffset: { x: number; y: number }
  onResizeStart: (handle: ResizeHandle, rect: Rect, rotation: number) => void
  onResize: (handle: ResizeHandle, event: ReactPointerEvent<HTMLElement>) => void
   onResizeEnd: () => void
   onMove: (dx: number, dy: number) => void
   onMoveStart: () => void
   onMoveEnd?: () => void
  onRotateStart: (center: Point, startAngle: number, rect: Rect) => void
  onRotate: (pointerAngle: number) => void
  onRotateEnd: () => void
}) => {
  const transform = useRef<{ type: "resize" | "rotate" | "move"; handle?: ResizeHandle; last?: Point } | null>(null)
  const scrollRef = useRef(scrollOffset)
  scrollRef.current = scrollOffset

  const pointerPage = (event: { clientX: number; clientY: number }) => ({
    x: event.clientX + scrollRef.current.x,
    y: event.clientY + scrollRef.current.y,
  })

  const applyDrag = (dx: number, dy: number, event: PointerEvent) => {
    if (!transform.current) return
    if (transform.current.type === "resize") {
      onResize(transform.current.handle!, event as unknown as ReactPointerEvent<HTMLElement>)
      return
    }
    if (transform.current.type === "rotate") {
      const center = boxCenter(rect.left, rect.top, rect.width, rect.height)
      onRotate(rotationFromPointer(center, pointerPage(event)))
      return
    }
    if (transform.current.type === "move") onMove(dx, dy)
  }

  const endDrag = () => {
    const transformType = transform.current?.type
    transform.current = null
    if (transformType === "rotate") onRotateEnd()
    if (transformType === "resize") onResizeEnd()
    if (transformType === "move") onMoveEnd?.()
  }

  const trackDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const view = eventView(event)
    if (!view) return
    listenPointerDrag(event.pointerId, view, { x: event.clientX, y: event.clientY }, {
      onMove: applyDrag,
      onEnd: endDrag,
    })
  }

  return (
    <div
       className="msr:pointer-events-auto msr:absolute msr:border msr:border-dashed msr:border-[#0d99ff]"
      style={{
        left: rect.left - scrollOffset.x,
        top: rect.top - scrollOffset.y,
        width: rect.width,
        height: rect.height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "center center",
      }}
      data-mesurer-group-frame="true"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        event.stopPropagation()
        onMoveStart()
        const point = pointerPage(event)
        transform.current = { type: "move", last: point }
        trackDrag(event)
      }}
    >
      <TextTransformFrame
        frameDataAttribute="data-mesurer-group-controls"
        handleDataAttribute="data-mesurer-group-handle"
        showOutline={false}
        rotation={rotation}
        onResizeStart={(handle, event) => {
          event.preventDefault()
          event.stopPropagation()
          transform.current = { type: "resize", handle }
          onResizeStart(handle, rect, rotation)
          trackDrag(event)
        }}
        onRotateStart={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const center = boxCenter(rect.left, rect.top, rect.width, rect.height)
          const startAngle = rotationFromPointer(center, pointerPage(event))
          transform.current = { type: "rotate" }
          onRotateStart(center, startAngle, rect)
          trackDrag(event)
        }}
      />
    </div>
  )
}

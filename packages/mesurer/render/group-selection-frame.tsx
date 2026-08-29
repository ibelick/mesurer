import { useRef, type PointerEvent } from "react"
import type { Point, Rect } from "../core/types"
import { boxCenter, rotationFromPointer, type ResizeHandle } from "../core/text-transform"
import { TextTransformFrame } from "./text-transform-frame"

export const GroupSelectionFrame = ({
  rect,
  rotation,
  scrollOffset,
  onResizeStart,
  onResize,
  onResizeEnd,
  onRotateStart,
  onRotate,
  onRotateEnd,
}: {
  rect: Rect
  rotation: number
  scrollOffset: { x: number; y: number }
  onResizeStart: (handle: ResizeHandle, rect: Rect, rotation: number) => void
  onResize: (handle: ResizeHandle, event: PointerEvent<HTMLElement>) => void
  onResizeEnd: () => void
  onRotateStart: (center: Point, startAngle: number, rect: Rect) => void
  onRotate: (pointerAngle: number) => void
  onRotateEnd: () => void
}) => {
  const frameRef = useRef<HTMLDivElement>(null)
  const transform = useRef<{ type: "resize" | "rotate"; handle?: ResizeHandle } | null>(null)

  const captureFrame = (event: PointerEvent<HTMLElement>) => {
    frameRef.current?.setPointerCapture(event.pointerId)
  }

  const pointerPage = (event: { clientX: number; clientY: number }) => ({
    x: event.clientX + scrollOffset.x,
    y: event.clientY + scrollOffset.y,
  })

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!transform.current) return
    event.preventDefault()
    event.stopPropagation()
    if (transform.current?.type === "resize") {
      onResize(transform.current.handle!, event)
      return
    }
    if (transform.current?.type === "rotate") {
      const center = boxCenter(rect.left, rect.top, rect.width, rect.height)
      onRotate(rotationFromPointer(center, pointerPage(event)))
      return
    }
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const transformType = transform.current?.type
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    transform.current = null
    if (transformType === "rotate") onRotateEnd()
    if (transformType === "resize") onResizeEnd()
  }

  return (
    <div
      ref={frameRef}
      className="msr:pointer-events-none msr:absolute msr:border msr:border-dashed msr:border-[#0d99ff]"
      style={{
        left: rect.left - scrollOffset.x,
        top: rect.top - scrollOffset.y,
        width: rect.width,
        height: rect.height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "center center",
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      data-mesurer-group-frame="true"
    >
      <TextTransformFrame
        frameDataAttribute="data-mesurer-group-controls"
        handleDataAttribute="data-mesurer-group-handle"
        showOutline={false}
        rotation={rotation}
        onResizeStart={(handle, event) => {
          transform.current = { type: "resize", handle }
          onResizeStart(handle, rect, rotation)
          captureFrame(event)
        }}
        onRotateStart={(event) => {
          const center = boxCenter(rect.left, rect.top, rect.width, rect.height)
          const startAngle = rotationFromPointer(center, pointerPage(event))
          transform.current = { type: "rotate" }
          onRotateStart(center, startAngle, rect)
          captureFrame(event)
        }}
      />
    </div>
  )
}

import type { PointerEvent } from "react"
import { RESIZE_HANDLES, resizeCursor, type ResizeHandle } from "../core/text-transform"
import { HandleNodeMark } from "./handle-node"

const HANDLE_COLOR = "#0d99ff"
const HANDLE_HIT =
  "msr:absolute msr:flex msr:size-3 msr:-translate-x-1/2 msr:-translate-y-1/2 msr:items-center msr:justify-center msr:pointer-events-auto"

const HANDLE_POSITION: Record<ResizeHandle, { left: string; top: string }> = {
  n: { left: "50%", top: "0%" },
  ne: { left: "100%", top: "0%" },
  e: { left: "100%", top: "50%" },
  se: { left: "100%", top: "100%" },
  s: { left: "50%", top: "100%" },
  sw: { left: "0%", top: "100%" },
  w: { left: "0%", top: "50%" },
  nw: { left: "0%", top: "0%" },
}

type TextTransformFrameProps = {
  rotation: number
  onResizeStart: (handle: ResizeHandle, event: PointerEvent<HTMLButtonElement>) => void
  onRotateStart: (event: PointerEvent<HTMLButtonElement>) => void
}

export const TextTransformFrame = ({ rotation, onResizeStart, onRotateStart }: TextTransformFrameProps) => (
  <div
    className="msr:pointer-events-none msr:absolute msr:-inset-1 msr:outline msr:outline-1 msr:outline-[#0d99ff]"
    data-mesurer-text-frame="true"
  >
    <div className="msr:absolute msr:left-1/2 msr:top-0 msr:h-3 msr:w-px msr:-translate-x-1/2 msr:-translate-y-full msr:bg-[#0d99ff]" />
    <button
      type="button"
      aria-label="Rotate text"
      data-mesurer-text-handle="rotate"
      className={`${HANDLE_HIT} msr:cursor-grab`}
      style={{ left: "50%", top: "-12px" }}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onRotateStart(event)
      }}
    >
      <HandleNodeMark color={HANDLE_COLOR} />
    </button>
    {RESIZE_HANDLES.map((handle) => (
      <button
        key={handle}
        type="button"
        aria-label={`Resize ${handle}`}
        data-mesurer-text-handle={handle}
        className={HANDLE_HIT}
        style={{ ...HANDLE_POSITION[handle], cursor: resizeCursor(handle, rotation) }}
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onResizeStart(handle, event)
        }}
      >
        <HandleNodeMark color={HANDLE_COLOR} />
      </button>
    ))}
  </div>
)

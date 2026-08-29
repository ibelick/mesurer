import type { PointerEvent } from "react"
import { resizeCursor, type ResizeHandle } from "../core/text-transform"
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

const CORNER_HANDLES: ResizeHandle[] = ["ne", "se", "sw", "nw"]
const EDGE_HANDLES: Array<{
  handle: "n" | "e" | "s" | "w"
  className: string
}> = [
  { handle: "n", className: "msr:-top-1 msr:left-1 msr:right-1 msr:h-2" },
  { handle: "e", className: "msr:-right-1 msr:bottom-1 msr:top-1 msr:w-2" },
  { handle: "s", className: "msr:-bottom-1 msr:left-1 msr:right-1 msr:h-2" },
  { handle: "w", className: "msr:-left-1 msr:bottom-1 msr:top-1 msr:w-2" },
]

type TextTransformFrameProps = {
  rotation: number
  showControls?: boolean
  showOutline?: boolean
  handleOffset?: number
  frameDataAttribute?: "data-mesurer-text-frame" | "data-mesurer-pen-frame" | "data-mesurer-arrow-frame" | "data-mesurer-group-controls"
  handleDataAttribute?: "data-mesurer-text-handle" | "data-mesurer-pen-handle" | "data-mesurer-arrow-handle" | "data-mesurer-group-handle"
  onResizeStart: (handle: ResizeHandle, event: PointerEvent<HTMLElement>) => void
  onRotateStart: (event: PointerEvent<HTMLButtonElement>) => void
}

export const TextTransformFrame = ({ rotation, showControls = true, showOutline = true, handleOffset = 0, frameDataAttribute = "data-mesurer-text-frame", handleDataAttribute = "data-mesurer-text-handle", onResizeStart, onRotateStart }: TextTransformFrameProps) => (
  <div
    className={`msr:pointer-events-none msr:absolute msr:inset-0 ${showOutline ? "msr:outline msr:outline-1 msr:outline-[#0d99ff]" : ""}`}
    {...{ [frameDataAttribute]: "true" }}
  >
    {showControls ? <div className="msr:absolute msr:left-1/2 msr:top-0 msr:h-3 msr:w-px msr:-translate-x-1/2 msr:-translate-y-full msr:bg-[#0d99ff]" /> : null}
    {showControls ? <button
      type="button"
      aria-label="Rotate text"
      {...{ [handleDataAttribute]: "rotate" }}
      className={`${HANDLE_HIT} msr:cursor-grab`}
      style={{ left: "50%", top: "-12px" }}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onRotateStart(event)
      }}
    >
      <HandleNodeMark color={HANDLE_COLOR} />
    </button> : null}
    {showControls ? EDGE_HANDLES.map(({ handle, className }) => (
      <button
        key={handle}
        type="button"
        aria-label={`Resize ${handle}`}
        {...{ [handleDataAttribute]: handle }}
        className={`msr:absolute msr:z-10 msr:border-0 msr:bg-transparent msr:pointer-events-auto ${className}`}
         style={{ cursor: resizeCursor(handle, rotation), transform: handleOffset ? `translate(${handle === "e" ? handleOffset : handle === "w" ? -handleOffset : 0}px, ${handle === "s" ? handleOffset : handle === "n" ? -handleOffset : 0}px)` : undefined }}
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onResizeStart(handle, event)
        }}
      />
    )) : null}
    {showControls ? CORNER_HANDLES.map((handle) => (
      <button
        key={handle}
        type="button"
        aria-label={`Resize ${handle}`}
        {...{ [handleDataAttribute]: handle }}
        className={`${HANDLE_HIT} msr:z-20`}
         style={{ ...HANDLE_POSITION[handle], cursor: resizeCursor(handle, rotation), transform: handleOffset ? `translate(calc(-50% + ${handle.includes("e") ? handleOffset : handle.includes("w") ? -handleOffset : 0}px), calc(-50% + ${handle.includes("s") ? handleOffset : handle.includes("n") ? -handleOffset : 0}px))` : undefined }}
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onResizeStart(handle, event)
        }}
      >
        <HandleNodeMark color={HANDLE_COLOR} />
      </button>
    )) : null}
  </div>
)

import type { CSSProperties, PointerEvent } from "react"
import { beginResizeCursor, resizeCursor, type ResizeHandle } from "../core/text-transform"
import { EDGE_HIT_SIZE, HANDLE_HIT_SIZE, HANDLE_NODE_SIZE, HandleNodeMark } from "./handle-node"

const HANDLE_COLOR = "#0d99ff"
const HANDLE_HIT =
  "msr:absolute msr:z-20 msr:flex msr:-translate-x-1/2 msr:-translate-y-1/2 msr:items-center msr:justify-center msr:pointer-events-auto"

const HANDLE_POSITION: Record<Extract<ResizeHandle, "ne" | "se" | "sw" | "nw">, { left: string; top: string }> = {
  ne: { left: "100%", top: "0%" },
  se: { left: "100%", top: "100%" },
  sw: { left: "0%", top: "100%" },
  nw: { left: "0%", top: "0%" },
}

const CORNER_HANDLES: Array<"ne" | "se" | "sw" | "nw"> = ["ne", "se", "sw", "nw"]
const CORNER_INSET = HANDLE_NODE_SIZE
const EDGE_HANDLES: Array<{
  handle: "n" | "e" | "s" | "w"
  style: CSSProperties
}> = [
  { handle: "n", style: { left: CORNER_INSET, right: CORNER_INSET, top: -EDGE_HIT_SIZE / 2, height: EDGE_HIT_SIZE } },
  { handle: "e", style: { top: CORNER_INSET, bottom: CORNER_INSET, right: -EDGE_HIT_SIZE / 2, width: EDGE_HIT_SIZE } },
  { handle: "s", style: { left: CORNER_INSET, right: CORNER_INSET, bottom: -EDGE_HIT_SIZE / 2, height: EDGE_HIT_SIZE } },
  { handle: "w", style: { top: CORNER_INSET, bottom: CORNER_INSET, left: -EDGE_HIT_SIZE / 2, width: EDGE_HIT_SIZE } },
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

const cornerOffsetTransform = (handle: "ne" | "se" | "sw" | "nw", handleOffset: number) => {
  if (!handleOffset) return undefined
  const x = handle.includes("e") ? handleOffset : -handleOffset
  const y = handle.includes("s") ? handleOffset : -handleOffset
  return `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
}

const edgeOffsetTransform = (handle: "n" | "e" | "s" | "w", handleOffset: number) => {
  if (!handleOffset) return undefined
  const x = handle === "e" ? handleOffset : handle === "w" ? -handleOffset : 0
  const y = handle === "s" ? handleOffset : handle === "n" ? -handleOffset : 0
  return `translate(${x}px, ${y}px)`
}

const cursorClassName = (handle: ResizeHandle, rotation: number) => {
  const cursor = resizeCursor(handle, rotation)
  if (cursor === "ew-resize") return "msr:cursor-ew-resize"
  if (cursor === "ns-resize") return "msr:cursor-ns-resize"
  if (cursor === "nwse-resize") return "msr:cursor-nwse-resize"
  if (cursor === "nesw-resize") return "msr:cursor-nesw-resize"
  return ""
}

const startResize = (
  handle: ResizeHandle,
  rotation: number,
  event: PointerEvent<HTMLElement>,
  onResizeStart: TextTransformFrameProps["onResizeStart"],
) => {
  event.preventDefault()
  event.stopPropagation()
  const cursor = resizeCursor(handle, rotation)
  beginResizeCursor(cursor, event.currentTarget)
  onResizeStart(handle, event)
}

export const TextTransformFrame = ({
  rotation,
  showControls = true,
  showOutline = true,
  handleOffset = 0,
  frameDataAttribute = "data-mesurer-text-frame",
  handleDataAttribute = "data-mesurer-text-handle",
  onResizeStart,
  onRotateStart,
}: TextTransformFrameProps) => (
  <div
    className={`msr:pointer-events-none msr:absolute msr:inset-0 ${showOutline ? "msr:outline msr:outline-1 msr:outline-[#0d99ff]" : ""}`}
    {...{ [frameDataAttribute]: "true" }}
  >
    {showControls ? (
      <div
        className="msr:absolute msr:left-1/2 msr:top-0 msr:w-px msr:-translate-x-1/2 msr:-translate-y-full msr:bg-[#0d99ff]"
        style={{ height: 12 + handleOffset }}
      />
    ) : null}
    {showControls ? (
      <button
        type="button"
        aria-label="Rotate"
        {...{ [handleDataAttribute]: "rotate" }}
        className={HANDLE_HIT}
        style={{
          left: "50%",
          top: -(12 + handleOffset),
          width: HANDLE_HIT_SIZE,
          height: HANDLE_HIT_SIZE,
        }}
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onRotateStart(event)
        }}
      >
        <HandleNodeMark color={HANDLE_COLOR} />
      </button>
    ) : null}
    {showControls
      ? EDGE_HANDLES.map(({ handle, style }) => {
          const cursor = resizeCursor(handle, rotation)
          return (
          <button
            key={handle}
            type="button"
            aria-label={`Resize ${handle}`}
            {...{ [handleDataAttribute]: handle }}
            data-mesurer-resize-cursor={cursor}
            className={`msr:absolute msr:z-10 msr:border-0 msr:bg-transparent msr:pointer-events-auto ${cursorClassName(handle, rotation)}`}
            style={{
              ...style,
              ["--msr-resize-cursor" as string]: cursor,
              cursor,
              transform: edgeOffsetTransform(handle, handleOffset),
            }}
            onPointerDown={(event) => startResize(handle, rotation, event, onResizeStart)}
          />
          )
        })
      : null}
    {showControls
      ? CORNER_HANDLES.map((handle) => {
          const cursor = resizeCursor(handle, rotation)
          return (
          <button
            key={handle}
            type="button"
            aria-label={`Resize ${handle}`}
            {...{ [handleDataAttribute]: handle }}
            data-mesurer-resize-cursor={cursor}
            className={`${HANDLE_HIT} ${cursorClassName(handle, rotation)}`}
            style={{
              ...HANDLE_POSITION[handle],
              width: HANDLE_HIT_SIZE,
              height: HANDLE_HIT_SIZE,
              ["--msr-resize-cursor" as string]: cursor,
              cursor,
              transform: cornerOffsetTransform(handle, handleOffset),
            }}
            onPointerDown={(event) => startResize(handle, rotation, event, onResizeStart)}
          >
            <HandleNodeMark color={HANDLE_COLOR} />
          </button>
          )
        })
      : null}
  </div>
)

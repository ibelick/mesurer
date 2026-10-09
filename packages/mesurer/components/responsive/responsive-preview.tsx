import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { trackOwnFrame } from "../../core/document-tree"
import type { LayoutGuide } from "../../core/layout-guides"
import type { PreviewGuide } from "../../core/responsive"
import {
  RESPONSIVE_FRAME_ATTRIBUTE,
  RESPONSIVE_MAX_SIZE,
  RESPONSIVE_MIN_SIZE,
  type ResponsiveSize,
} from "../../core/responsive"
import { cn } from "../../core/utils"
import { ControlNumberInput } from "../control-field"
import { CloseIcon } from "../icons/close"
import { LayoutGuidesOverlay } from "../layout-guides-overlay"
import { iconButton, surface } from "./shared"
import { PreviewGuides } from "./preview-guides"
import { SizeSelect, sizeName } from "./size-select"

// The narrowest a preview's header gets, so its controls always fit above a small frame.
const HEADER_MIN_WIDTH = 272

// Everything a page needs, except leave to take the whole tab somewhere else.
const FRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"

type ResizeAxis = "width" | "height" | "both"

const GripIcon = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
    {[2, 7, 12].flatMap((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />))}
  </svg>
)

// One size of the page: the page itself in a frame of that size, drawn at `scale`, under the
// controls that change it.
export function ResponsivePreview({
  id,
  url,
  size,
  breakpoints,
  layoutGuides,
  guides,
  guidesActive,
  guideOrientation,
  onGuides,
  scale,
  order,
  onResize,
  onDrag,
  onStep,
  onRemove,
}: {
  id: number
  url: string
  size: ResponsiveSize
  /** The page's own breakpoints, offered among the sizes to choose from. */
  breakpoints: readonly number[]
  /** The layout guides to draw over the page in this preview, at its size. */
  layoutGuides: LayoutGuide[]
  /** This preview's own guides, and whether the guides tool is in use. */
  guides: PreviewGuide[]
  guidesActive: boolean
  guideOrientation: "horizontal" | "vertical"
  onGuides: (guides: PreviewGuide[]) => void
  scale: number
  /** Where it stands in the row. The row is reordered without moving a frame, which would reload it. */
  order: number
  onResize: (size: ResponsiveSize) => void
  /** Its grip was dragged to this point across the row. */
  onDrag: (clientX: number) => void
  /** Its grip was asked, from the keyboard, to move it one place either way. */
  onStep: (places: -1 | 1) => void
  /** Absent for the only preview left, which stays. */
  onRemove?: () => void
}) {
  const [resizing, setResizing] = useState(false)
  // Whether the page turned out to refuse being shown in a frame. Known once it first loads.
  const [refused, setRefused] = useState<boolean | null>(null)
  const name = sizeName(size, breakpoints) ?? "Custom"

  // Mesurer's tools reach into the page's frames, and this one is told to them: it is not found
  // by looking through the page when Mesurer sits outside it.
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  useEffect(() => (frameRef.current ? trackOwnFrame(frameRef.current) : undefined), [])

  const [dragging, setDragging] = useState(false)
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const grip = event.currentTarget
    grip.setPointerCapture(event.pointerId)
    setDragging(true)
    const onMove = (move: PointerEvent) => onDrag(move.clientX)
    const onEnd = () => {
      setDragging(false)
      grip.removeEventListener("pointermove", onMove)
      grip.removeEventListener("pointerup", onEnd)
      grip.removeEventListener("pointercancel", onEnd)
    }
    grip.addEventListener("pointermove", onMove)
    grip.addEventListener("pointerup", onEnd)
    grip.addEventListener("pointercancel", onEnd)
  }

  const startResize = (axis: ResizeAxis) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    const start = { x: event.clientX, y: event.clientY, ...size }
    handle.setPointerCapture(event.pointerId)
    setResizing(true)
    const onMove = (move: PointerEvent) =>
      onResize({
        width: axis === "height" ? start.width : start.width + (move.clientX - start.x) / scale,
        height: axis === "width" ? start.height : start.height + (move.clientY - start.y) / scale,
      })
    const onEnd = () => {
      setResizing(false)
      handle.removeEventListener("pointermove", onMove)
      handle.removeEventListener("pointerup", onEnd)
      handle.removeEventListener("pointercancel", onEnd)
    }
    handle.addEventListener("pointermove", onMove)
    handle.addEventListener("pointerup", onEnd)
    handle.addEventListener("pointercancel", onEnd)
  }

  return (
    <section
      className={cn("msr:flex msr:shrink-0 msr:flex-col msr:items-center msr:gap-2", dragging && "msr:opacity-80")}
      style={{ order }}
      data-preview={id}
      aria-label={`${name}, ${size.width} × ${size.height}`}
    >
      <header
        className={cn(surface, "msr:flex msr:h-8 msr:items-center msr:gap-1 msr:px-1")}
        style={{ width: Math.max(size.width * scale, HEADER_MIN_WIDTH) }}
      >
        <button
          type="button"
          aria-label="Move preview"
          title="Drag to reorder"
          className={cn(iconButton, "msr:w-4 msr:touch-none", dragging ? "msr:cursor-grabbing" : "msr:cursor-grab")}
          onPointerDown={startDrag}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
            event.preventDefault()
            event.stopPropagation()
            onStep(event.key === "ArrowLeft" ? -1 : 1)
          }}
        >
          <GripIcon />
        </button>
        <SizeSelect
          label="Size"
          size={size}
          breakpoints={breakpoints}
          placeholder="Custom"
          onSelect={(choice) => onResize({ ...size, ...choice })}
        />
        <div className="msr:w-12 msr:shrink-0">
          <ControlNumberInput
            label="Width"
            value={size.width}
            min={RESPONSIVE_MIN_SIZE}
            max={RESPONSIVE_MAX_SIZE}
            onChange={(width) => onResize({ ...size, width })}
          />
        </div>
        <span className="msr:text-[11px] msr:text-ink-500" aria-hidden="true">×</span>
        <div className="msr:w-12 msr:shrink-0">
          <ControlNumberInput
            label="Height"
            value={size.height}
            min={RESPONSIVE_MIN_SIZE}
            max={RESPONSIVE_MAX_SIZE}
            onChange={(height) => onResize({ ...size, height })}
          />
        </div>
        <button type="button" aria-label="Remove preview" title="Remove" className={iconButton} disabled={!onRemove} onClick={onRemove}>
          <CloseIcon size={12} />
        </button>
      </header>

      <div
        className={cn("msr:relative", guidesActive && "msr:z-[1]")}
        style={{ width: size.width * scale, height: size.height * scale }}
      >
        <div className="msr:absolute msr:inset-0 msr:overflow-hidden msr:rounded-lg msr:bg-white msr:shadow-floating">
          <iframe
            ref={frameRef}
            {...{ [RESPONSIVE_FRAME_ATTRIBUTE]: "" }}
            title={`${name} preview`}
            src={url}
            sandbox={FRAME_SANDBOX}
            onLoad={(event) => {
              if (refused !== null) return
              // A page that forbids framing is replaced by an error page, which cannot be read.
              let readable = false
              try {
                readable = Boolean(event.currentTarget.contentDocument)
              } catch {
                /* Not readable. */
              }
              setRefused(!readable)
            }}
            className="msr:block msr:border-0 msr:bg-white"
            style={{
              width: size.width,
              height: size.height,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              // A drag over the page in the frame would otherwise be taken by that page.
              pointerEvents: resizing ? "none" : undefined,
            }}
          />
          <div
            className="msr:pointer-events-none msr:absolute msr:top-0 msr:left-0"
            style={{ width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}
          >
            <LayoutGuidesOverlay enabled guides={layoutGuides} />
          </div>
          {refused ? (
            <p className="msr:absolute msr:inset-0 msr:m-0 msr:flex msr:items-center msr:justify-center msr:bg-surface msr:p-6 msr:text-center msr:text-[12px] msr:text-ink-500">
              This page does not allow itself to be shown in a preview.
            </p>
          ) : null}
        </div>
        <PreviewGuides
          guides={guides}
          size={size}
          scale={scale}
          active={guidesActive}
          orientation={guideOrientation}
          getDocument={() => frameRef.current?.contentDocument ?? null}
          onChange={onGuides}
        />
        <div
          className="msr:group msr:absolute msr:z-[1] msr:top-0 msr:-right-4 msr:flex msr:h-full msr:w-4 msr:cursor-ew-resize msr:touch-none msr:items-center msr:justify-center"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize width"
          onPointerDown={startResize("width")}
        >
          <span className="msr:h-10 msr:w-1 msr:rounded-full msr:bg-white/50 msr:group-hover:bg-white" />
        </div>
        <div
          className="msr:group msr:absolute msr:z-[1] msr:-bottom-4 msr:left-0 msr:flex msr:h-4 msr:w-full msr:cursor-ns-resize msr:touch-none msr:items-center msr:justify-center"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize height"
          onPointerDown={startResize("height")}
        >
          <span className="msr:h-1 msr:w-10 msr:rounded-full msr:bg-white/50 msr:group-hover:bg-white" />
        </div>
        <div
          className="msr:absolute msr:z-[1] msr:-right-4 msr:-bottom-4 msr:size-4 msr:cursor-nwse-resize msr:touch-none"
          aria-hidden="true"
          onPointerDown={startResize("both")}
        />
      </div>
    </section>
  )
}

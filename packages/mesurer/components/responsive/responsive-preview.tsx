import { useState, type PointerEvent as ReactPointerEvent } from "react"
import {
  RESPONSIVE_FRAME_ATTRIBUTE,
  RESPONSIVE_MAX_SIZE,
  RESPONSIVE_MIN_SIZE,
  responsiveDeviceFor,
  type ResponsiveSize,
} from "../../core/responsive"
import { cn } from "../../core/utils"
import { ControlNumberInput } from "../control-field"
import { CloseIcon } from "../icons/close"
import { DeviceSelect } from "./device-select"
import { iconButton, surface } from "./shared"
import { ZoomSelect } from "./zoom-select"

// The narrowest a preview's header gets, so its controls always fit above a small frame.
const HEADER_MIN_WIDTH = 336

// Everything a page needs, except leave to take the whole tab somewhere else.
const FRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"

type ResizeAxis = "width" | "height" | "both"

const RotateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v2.6h-2.6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// One size of the page: the page itself in a frame of that size, drawn at `scale`, under the
// controls that change it.
export function ResponsivePreview({
  url,
  size,
  scale,
  zoom,
  onZoom,
  onResize,
  onRemove,
}: {
  url: string
  size: ResponsiveSize
  scale: number
  /** This preview's own zoom, or none while it follows the one all previews share. */
  zoom: number | null
  onZoom: (zoom: number | null) => void
  onResize: (size: ResponsiveSize) => void
  /** Absent for the only preview left, which stays. */
  onRemove?: () => void
}) {
  const [resizing, setResizing] = useState(false)
  // Whether the page turned out to refuse being shown in a frame. Known once it first loads.
  const [refused, setRefused] = useState<boolean | null>(null)
  const device = responsiveDeviceFor(size)
  const name = device?.name ?? "Custom"

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
    <section className="msr:flex msr:shrink-0 msr:flex-col msr:items-center msr:gap-2" aria-label={`${name}, ${size.width} × ${size.height}`}>
      <header
        className={cn(surface, "msr:flex msr:h-8 msr:items-center msr:gap-1 msr:px-1")}
        style={{ width: Math.max(size.width * scale, HEADER_MIN_WIDTH) }}
      >
        <DeviceSelect label="Device" value={device?.id} placeholder="Custom" onSelect={onResize} />
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
        <div className="msr:w-[60px] msr:shrink-0">
          <ZoomSelect label="Preview zoom" value={zoom} auto="Auto" onChange={onZoom} />
        </div>
        <button
          type="button"
          aria-label="Rotate"
          title="Rotate"
          className={iconButton}
          onClick={() => onResize({ width: size.height, height: size.width })}
        >
          <RotateIcon />
        </button>
        <button type="button" aria-label="Remove preview" title="Remove" className={iconButton} disabled={!onRemove} onClick={onRemove}>
          <CloseIcon size={12} />
        </button>
      </header>

      <div className="msr:relative" style={{ width: size.width * scale, height: size.height * scale }}>
        <div className="msr:absolute msr:inset-0 msr:overflow-hidden msr:rounded-lg msr:bg-white msr:shadow-floating">
          <iframe
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
          {refused ? (
            <p className="msr:absolute msr:inset-0 msr:m-0 msr:flex msr:items-center msr:justify-center msr:bg-surface msr:p-6 msr:text-center msr:text-[12px] msr:text-ink-500">
              This page does not allow itself to be shown in a preview.
            </p>
          ) : null}
        </div>
        <div
          className="msr:group msr:absolute msr:top-0 msr:-right-4 msr:flex msr:h-full msr:w-4 msr:cursor-ew-resize msr:touch-none msr:items-center msr:justify-center"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize width"
          onPointerDown={startResize("width")}
        >
          <span className="msr:h-10 msr:w-1 msr:rounded-full msr:bg-white/50 msr:group-hover:bg-white" />
        </div>
        <div
          className="msr:group msr:absolute msr:-bottom-4 msr:left-0 msr:flex msr:h-4 msr:w-full msr:cursor-ns-resize msr:touch-none msr:items-center msr:justify-center"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize height"
          onPointerDown={startResize("height")}
        >
          <span className="msr:h-1 msr:w-10 msr:rounded-full msr:bg-white/50 msr:group-hover:bg-white" />
        </div>
        <div
          className="msr:absolute msr:-right-4 msr:-bottom-4 msr:size-4 msr:cursor-nwse-resize msr:touch-none"
          aria-hidden="true"
          onPointerDown={startResize("both")}
        />
      </div>
    </section>
  )
}

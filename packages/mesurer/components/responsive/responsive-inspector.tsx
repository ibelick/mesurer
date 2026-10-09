import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import {
  DEFAULT_RESPONSIVE_DEVICE,
  RESPONSIVE_MAX_PREVIEWS,
  activeBreakpoint,
  clampResponsiveSize,
  readBreakpoints,
  responsiveFitScale,
  type ResponsiveSize,
} from "../../core/responsive"
import { cn } from "../../core/utils"
import { CloseIcon } from "../icons/close"
import { DeviceSelect } from "./device-select"
import { ResponsivePreview } from "./responsive-preview"
import { iconButton, stop, surface } from "./shared"
import { ZoomSelect, percent } from "./zoom-select"

// `zoom` is a preview's own, when it does not follow the one they share.
type Preview = ResponsiveSize & { id: number; zoom: number | null }

// Room kept around the previews: above for the toolbar, at the sides so one always fits whole,
// and below for the resize handle and the row's scrollbar.
const STAGE_TOP = 72
const STAGE_SIDE = 32
const STAGE_BOTTOM = 40
const BAR_HEIGHT = 36
const BAR_GAP = 12
// A preview's header and the gap under it (see ResponsivePreview).
const PREVIEW_HEADER = 40

let nextPreviewId = 1
const createPreview = (size: ResponsiveSize): Preview => ({ id: nextPreviewId++, zoom: null, ...clampResponsiveSize(size) })

// The previews and their zoom as they were last left, for the next time the tool opens on this page.
let lastPreviews: Preview[] = [createPreview(DEFAULT_RESPONSIVE_DEVICE)]
let lastZoom: number | null = null

const chip =
  "msr:flex msr:h-5 msr:shrink-0 msr:items-center msr:rounded-control msr:px-1.5 msr:font-mono msr:text-[11px] msr:font-medium msr:tabular-nums msr:text-ink-500 msr:outline-none msr:hover:bg-ink-100 msr:hover:text-ink-900 msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)] msr:disabled:pointer-events-none msr:disabled:opacity-40"

const Divider = () => <span className="msr:mx-1 msr:h-4 msr:w-px msr:shrink-0 msr:bg-ink-200" aria-hidden="true" />

// The page at several screen sizes at once, side by side, over the page itself.
export function ResponsiveInspector({ ownerWindow, onClose }: { ownerWindow: Window; onClose: () => void }) {
  const [previews, setPreviews] = useState(lastPreviews)
  // The scale the previews share, or none for the one that fits them in the window.
  const [zoom, setZoom] = useState(lastZoom)
  const [viewport, setViewport] = useState({ width: ownerWindow.innerWidth, height: ownerWindow.innerHeight })
  const breakpoints = useMemo(() => readBreakpoints(ownerWindow.document), [ownerWindow])
  const rowRef = useRef<HTMLDivElement | null>(null)
  const full = previews.length >= RESPONSIVE_MAX_PREVIEWS

  useEffect(() => {
    const onResize = () => setViewport({ width: ownerWindow.innerWidth, height: ownerWindow.innerHeight })
    ownerWindow.addEventListener("resize", onResize)
    return () => ownerWindow.removeEventListener("resize", onResize)
  }, [ownerWindow])

  // The page behind stays where it is while the previews are over it.
  useEffect(() => {
    const root = ownerWindow.document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = "hidden"
    return () => {
      root.style.overflow = overflow
    }
  }, [ownerWindow])

  // A preview that was just added is brought into view at the end of the row.
  const countRef = useRef(previews.length)
  useEffect(() => {
    lastPreviews = previews
    lastZoom = zoom
    if (previews.length > countRef.current) rowRef.current?.scrollTo({ left: rowRef.current.scrollWidth })
    countRef.current = previews.length
  }, [previews, zoom])

  // One scale for all that have none of their own, so they stay comparable. Fitting is the one
  // that lets the largest be seen whole.
  const fit = responsiveFitScale(
    {
      width: Math.max(...previews.map((preview) => preview.width)),
      height: Math.max(...previews.map((preview) => preview.height)),
    },
    {
      width: viewport.width - STAGE_SIDE * 2,
      height: viewport.height - STAGE_TOP - BAR_HEIGHT - BAR_GAP - PREVIEW_HEADER - STAGE_BOTTOM,
    },
  )
  const scale = zoom ?? fit

  const add = (size: ResponsiveSize) => {
    if (!full) setPreviews((current) => [...current, createPreview(size)])
  }
  const change = (id: number, changes: Partial<Preview>) =>
    setPreviews((current) => current.map((preview) => (preview.id === id ? { ...preview, ...changes } : preview)))
  const remove = (id: number) => setPreviews((current) => current.filter((preview) => preview.id !== id))
  // A press on the empty stage, not on something in it.
  const closeFromStage = (event: ReactMouseEvent) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div
      className="msr:pointer-events-auto msr:absolute msr:inset-0 msr:z-[90] msr:flex msr:flex-col msr:bg-[rgba(9,9,11,0.78)]"
      style={{ paddingTop: STAGE_TOP }}
      data-mesurer-responsive
      role="dialog"
      aria-label="Responsive preview"
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onWheel={stop}
      onClick={(event) => {
        event.stopPropagation()
        closeFromStage(event)
      }}
    >
      <div
        className={cn(surface, "msr:flex msr:max-w-[calc(100vw-64px)] msr:shrink-0 msr:items-center msr:gap-1 msr:self-center msr:px-1.5")}
        style={{ height: BAR_HEIGHT, marginBottom: BAR_GAP }}
      >
        <div className="msr:flex msr:w-28 msr:shrink-0">
          <DeviceSelect label="Add a size" placeholder="Add a size" sizes disabled={full} onSelect={add} />
        </div>
        {breakpoints.length ? (
          <>
            <Divider />
            <div
              className="mesurer-thin-scrollbar msr:flex msr:min-w-0 msr:items-center msr:gap-0.5 msr:overflow-x-auto"
              role="group"
              aria-label="Breakpoints"
            >
              <span className="msr:shrink-0 msr:px-1 msr:text-[11px] msr:text-ink-500">Breakpoints</span>
              {breakpoints.map((breakpoint) => {
                const shown = previews.some((preview) => activeBreakpoint(breakpoints, preview.width) === breakpoint)
                return (
                  <button
                    key={breakpoint}
                    type="button"
                    aria-pressed={shown}
                    title={`Add a preview at ${breakpoint}px`}
                    disabled={full}
                    className={cn(chip, shown && "msr:bg-ink-100 msr:text-ink-900")}
                    onClick={() => add({ width: breakpoint, height: previews[0].height })}
                  >
                    {breakpoint}
                  </button>
                )
              })}
            </div>
          </>
        ) : null}
        <Divider />
        <div className="msr:w-[84px] msr:shrink-0">
          <ZoomSelect label="Zoom" value={zoom} auto={`Fit · ${percent(fit)}`} onChange={setZoom} />
        </div>
        <Divider />
        <button type="button" aria-label="Close responsive preview" className={iconButton} onClick={onClose}>
          <CloseIcon size={12} />
        </button>
      </div>

      <div
        ref={rowRef}
        className="mesurer-thin-scrollbar msr:min-h-0 msr:flex-1 msr:overflow-auto msr:overscroll-contain"
        onClick={closeFromStage}
      >
        <div className="msr:mx-auto msr:flex msr:w-max msr:items-start msr:gap-8 msr:px-8 msr:pb-10" onClick={closeFromStage}>
          {previews.map((preview) => (
            <ResponsivePreview
              key={preview.id}
              url={ownerWindow.location.href}
              size={preview}
              scale={preview.zoom ?? scale}
              zoom={preview.zoom}
              onZoom={(next) => change(preview.id, { zoom: next })}
              onResize={(size) => change(preview.id, clampResponsiveSize(size))}
              onRemove={previews.length > 1 ? () => remove(preview.id) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

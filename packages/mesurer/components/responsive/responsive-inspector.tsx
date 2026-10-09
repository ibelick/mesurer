import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import type { LayoutGuide } from "../../core/layout-guides"
import type { PreviewGuide } from "../../core/responsive"
import {
  DEFAULT_RESPONSIVE_DEVICE,
  RESPONSIVE_MAX_PREVIEWS,
  clampResponsiveSize,
  moveItem,
  readBreakpoints,
  responsiveFitScale,
  type ResponsiveSize,
} from "../../core/responsive"
import { cn } from "../../core/utils"
import { CloseIcon } from "../icons/close"
import { ResponsivePreview } from "./responsive-preview"
import { iconButton, stop, surface } from "./shared"
import { SizeSelect, type SizeChoice } from "./size-select"
import { passWheelOn } from "./wheel"
import { ZoomSelect, percent } from "./zoom-select"

type Preview = ResponsiveSize & { id: number; guides: PreviewGuide[] }

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
const createPreview = (size: ResponsiveSize): Preview => ({ id: nextPreviewId++, guides: [], ...clampResponsiveSize(size) })

// The previews and their zoom as they were last left, for the next time the tool opens on this page.
let lastPreviews: Preview[] = [createPreview(DEFAULT_RESPONSIVE_DEVICE)]
let lastZoom: number | null = null

const Divider = () => <span className="msr:mx-1 msr:h-4 msr:w-px msr:shrink-0 msr:bg-ink-200" aria-hidden="true" />

// The page at several screen sizes at once, side by side, over the page itself.
export function ResponsiveInspector({
  layoutGuides,
  guidesActive,
  guideOrientation,
  wanted,
  commented,
  onClose,
}: {
  /** The sizes of the previews the comments were left in, one for each comment. */
  commented: readonly ResponsiveSize[]
  /** A size one of the previews is to have: a comment left at it is being looked at. */
  wanted?: ResponsiveSize | null
  /** The layout guides that are showing, drawn in each preview at its own size. */
  layoutGuides: LayoutGuide[]
  /** The guides tool is in use: the previews' guides can be drawn and moved. */
  guidesActive: boolean
  guideOrientation: "horizontal" | "vertical"
  onClose: () => void
}) {
  const [previews, setPreviews] = useState(lastPreviews)
  // The scale the previews are drawn at, or none for the one that fits them in the window.
  const [zoom, setZoom] = useState(lastZoom)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  // The window this is drawn in, found from its own element. It is not handed in as a prop:
  // React's development build reads through props, and from a window into the page's frames,
  // where one from another origin stops it with an error.
  const [view, setView] = useState<Window | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const breakpoints = useMemo(() => (view ? readBreakpoints(view.document) : []), [view])
  const full = previews.length >= RESPONSIVE_MAX_PREVIEWS

  useLayoutEffect(() => {
    const ownerWindow = rootRef.current?.ownerDocument.defaultView
    if (!ownerWindow) return
    setView(ownerWindow)
    const measure = () => setViewport({ width: ownerWindow.innerWidth, height: ownerWindow.innerHeight })
    measure()
    ownerWindow.addEventListener("resize", measure)
    // The page behind stays where it is while the previews are over it.
    const page = ownerWindow.document.documentElement
    const overflow = page.style.overflow
    page.style.overflow = "hidden"
    const onWheel = (event: WheelEvent) => passWheelOn(event, listRef.current?.querySelectorAll("iframe") ?? [], rowRef.current)
    // Not passive: a wheel that is passed on is kept from the browser.
    ownerWindow.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      ownerWindow.removeEventListener("resize", measure)
      ownerWindow.removeEventListener("wheel", onWheel)
      page.style.overflow = overflow
    }
  }, [])

  // A wanted size no preview has the width of is added, in place of the last one in a full row.
  useEffect(() => {
    if (!wanted) return
    setPreviews((current) =>
      current.some((preview) => preview.width === wanted.width)
        ? current
        : [...current.slice(0, RESPONSIVE_MAX_PREVIEWS - 1), createPreview(wanted)],
    )
  }, [wanted])

  // A preview that was just added is brought into view at the end of the row.
  const countRef = useRef(previews.length)
  useEffect(() => {
    lastPreviews = previews
    lastZoom = zoom
    if (previews.length > countRef.current) rowRef.current?.scrollTo({ left: rowRef.current.scrollWidth })
    countRef.current = previews.length
  }, [previews, zoom])

  // One scale for all of them, so they stay comparable. Fitting is the one that lets the largest
  // be seen whole.
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

  // A breakpoint is only a width: the new preview takes the height of the first one.
  const add = (choice: SizeChoice) => {
    if (!full) setPreviews((current) => [...current, createPreview({ height: current[0].height, ...choice })])
  }
  const resize = (id: number, size: ResponsiveSize) =>
    setPreviews((current) => current.map((preview) => (preview.id === id ? { ...preview, ...clampResponsiveSize(size) } : preview)))
  const setGuides = (id: number, guides: PreviewGuide[]) =>
    setPreviews((current) => current.map((preview) => (preview.id === id ? { ...preview, guides } : preview)))
  const remove = (id: number) => setPreviews((current) => current.filter((preview) => preview.id !== id))
  const move = (id: number, to: (from: number) => number) =>
    setPreviews((current) => {
      const from = current.findIndex((preview) => preview.id === id)
      const target = Math.max(0, Math.min(current.length - 1, to(from)))
      return target === from ? current : moveItem(current, from, target)
    })
  // A dragged preview takes the place of the last one whose middle the pointer has passed.
  const dragTo = (id: number, clientX: number) => {
    const passed = [...(listRef.current?.children ?? [])].filter((section) => {
      if (section.getAttribute("data-preview") === String(id)) return false
      const box = section.getBoundingClientRect()
      return box.left + box.width / 2 < clientX
    }).length
    move(id, () => passed)
  }
  // A press on the empty stage, not on something in it.
  const closeFromStage = (event: ReactMouseEvent) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div
      className="msr:pointer-events-auto msr:absolute msr:inset-0 msr:flex msr:flex-col msr:bg-[rgba(9,9,11,0.78)]"
      ref={rootRef}
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
          <SizeSelect label="Add a size" placeholder="Add a size" breakpoints={breakpoints} detailed disabled={full} onSelect={add} />
        </div>
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
        <div ref={listRef} className="msr:mx-auto msr:flex msr:w-max msr:items-start msr:gap-8 msr:px-8 msr:pb-10" onClick={closeFromStage}>
          {/* Kept in the order they were added: a frame moved in the document loads again. */}
          {(view ? [...previews].sort((a, b) => a.id - b.id) : []).map((preview) => (
            <ResponsivePreview
              key={preview.id}
              id={preview.id}
              url={view?.location.href ?? ""}
              size={preview}
              breakpoints={breakpoints}
              layoutGuides={layoutGuides}
              guides={preview.guides}
              comments={commented.filter((size) => size.width === preview.width).length}
              guidesActive={guidesActive}
              guideOrientation={guideOrientation}
              onGuides={(guides) => setGuides(preview.id, guides)}
              scale={scale}
              order={previews.indexOf(preview)}
              onResize={(size) => resize(preview.id, size)}
              onDrag={(clientX) => dragTo(preview.id, clientX)}
              onStep={(places) => move(preview.id, (from) => from + places)}
              onRemove={previews.length > 1 ? () => remove(preview.id) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

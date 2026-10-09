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

type Axis = "x" | "y"

// Whether there is anything left of it to scroll that way.
const hasRoom = (node: Element, axis: Axis, delta: number) => {
  const at = axis === "x" ? node.scrollLeft : node.scrollTop
  const room = axis === "x" ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight
  return delta < 0 ? at > 0 : at < room - 1
}

// The nearest thing around `start`, itself included, with room left to scroll that way.
const scrollerFor = (start: Element | null, axis: Axis, delta: number): Element | null => {
  const view = start?.ownerDocument.defaultView
  if (!view) return null
  const overflowOf = (style: CSSStyleDeclaration) => (axis === "x" ? style.overflowX : style.overflowY)
  for (let node = start; node; node = node.parentElement ?? (node.getRootNode() as Partial<ShadowRoot>).host ?? null) {
    const page = node.ownerDocument
    let style = view.getComputedStyle(node)
    let scrolls = overflowOf(style) === "auto" || overflowOf(style) === "scroll"
    // The page itself scrolls unless it is told not to, and its body may be what tells it.
    if (node === page.scrollingElement) {
      if (style.overflowX === "visible" && style.overflowY === "visible" && page.body) style = view.getComputedStyle(page.body)
      scrolls = overflowOf(style) !== "hidden" && overflowOf(style) !== "clip"
    }
    if (scrolls && hasRoom(node, axis, delta)) return node
  }
  return null
}

const Divider = () => <span className="msr:mx-1 msr:h-4 msr:w-px msr:shrink-0 msr:bg-ink-200" aria-hidden="true" />

// The page at several screen sizes at once, side by side, over the page itself.
export function ResponsiveInspector({
  layoutGuides,
  guidesActive,
  guideOrientation,
  onClose,
}: {
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
    // With a tool in hand the pointer is the tool's, over the previews too, and a wheel turned
    // there never reaches the page in one, nor the row. It is passed on: up and down to what
    // scrolls under the pointer in that preview and past its end to the row, sideways the
    // other way round.
    const onWheel = (event: WheelEvent) => {
      // Only what the overlay took. Anywhere else the wheel already scrolls what it is over.
      if (!event.composedPath().some((node) => (node as Partial<Element>).matches?.("[data-mesurer-overlay]"))) return
      let under: Element | null = null
      let drawn = 1
      for (const frame of listRef.current?.querySelectorAll("iframe") ?? []) {
        const box = frame.getBoundingClientRect()
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) continue
        drawn = box.width / frame.offsetWidth || 1
        const page = frame.contentDocument
        under = page?.elementFromPoint((event.clientX - box.left) / drawn, (event.clientY - box.top) / drawn) ?? page?.scrollingElement ?? null
        break
      }
      const step = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? ownerWindow.innerHeight : 1
      // A trackpad never moves quite straight. Only the way it mostly goes is followed, so going
      // down a preview does not also slide the row.
      const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      for (const axis of ["x", "y"] as const) {
        const delta = (axis === "x" ? event.deltaX : event.deltaY) * step
        if (!delta || (axis === "x") !== sideways) continue
        const row = rowRef.current
        // Sideways is the row's first, so the previews can be gone through from over any of
        // them: a page that is a little too wide would otherwise keep the wheel for itself.
        const rowFirst = axis === "x" && row !== null && hasRoom(row, axis, delta)
        const inPreview = rowFirst ? null : scrollerFor(under, axis, delta)
        // Instant: a page that scrolls smoothly would start over at every turn of the wheel.
        ;(inPreview ?? row)?.scrollBy({
          [axis === "x" ? "left" : "top"]: inPreview ? delta / drawn : delta,
          behavior: "instant",
        })
      }
    }
    ownerWindow.addEventListener("wheel", onWheel, { passive: true })
    return () => {
      ownerWindow.removeEventListener("resize", measure)
      ownerWindow.removeEventListener("wheel", onWheel)
      page.style.overflow = overflow
    }
  }, [])

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

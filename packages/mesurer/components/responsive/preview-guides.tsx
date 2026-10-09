import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { GUIDE_HITBOX_SIZE, GUIDE_SNAP_DISTANCE, MEASURE_LABEL_OFFSET } from "../../core/constants"
import { getDistanceOverlay } from "../../core/distances"
import { getBodyElementsCached } from "../../core/dom"
import { getHoveredGuide, getSelectedGuide } from "../../core/option-measurements"
import { DEFAULT_GUIDE_STYLE } from "../../core/persistence"
import type { DistanceOverlay, Guide, Rect } from "../../core/types"
import { cn } from "../../core/utils"
import { DistanceOverlayItem } from "../../render/distance-overlay-item"
import { GuideLine, GuidePreviewLine } from "../../render/guide-line"

// The page's default guide colour, and the accent for what is selected, hovered or being made.
const GUIDE_COLOR = "oklch(0.63 0.26 29.23)"
const ACCENT = "#0d99ff"
const NOOP = () => {}

type Point = { x: number; y: number }
type Drag = { id: string; orientation: Guide["orientation"] }
// The positions a guide snaps to in the preview, as the page does: the edges and middles of its
// elements, on each axis.
type SnapTargets = { xs: number[]; ys: number[] }

// Read once per press, not per frame: reading every element's position forces the page to lay out
// again, which on a large page is what made dragging slow.
const collectSnapTargets = (doc: Document): SnapTargets => {
  const xs: number[] = []
  const ys: number[] = []
  const ElementConstructor = doc.defaultView?.HTMLElement ?? HTMLElement
  for (const element of getBodyElementsCached(doc)) {
    if (!(element instanceof ElementConstructor)) continue
    if (element === doc.body || element === doc.documentElement) continue
    const rect = element.getBoundingClientRect()
    if (rect.width <= 2 || rect.height <= 2) continue
    xs.push(rect.left, rect.left + rect.width, rect.left + rect.width / 2)
    ys.push(rect.top, rect.top + rect.height, rect.top + rect.height / 2)
  }
  return { xs, ys }
}

const newGuideId = () => `preview-guide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

// The guides of one preview, drawn and edited the way the page's guides are: pressing empty space
// makes one, pressing a guide selects it (shift adds), dragging moves it and snaps it to the
// preview's elements, Delete removes what is selected, and a guide dragged off the preview is
// removed. With Alt held over an element, the distance from the guide to that element is shown.
//
// While a guide is being made or moved, the changes are kept here and sent to the previews once,
// on release. Sending each move would re-render every preview, which is what made it lag.
export function PreviewGuides({
  guides,
  size,
  scale,
  active,
  orientation,
  getDocument,
  onChange,
}: {
  guides: Guide[]
  /** The preview's size in its own pixels. */
  size: { width: number; height: number }
  /** How much smaller than its own pixels the preview is drawn. */
  scale: number
  active: boolean
  /** The orientation of a guide made by pressing on empty space. */
  orientation: Guide["orientation"]
  /** The preview's document, whose elements guides snap to and measure against. */
  getDocument: () => Document | null
  onChange: (guides: Guide[]) => void
}) {
  const layerRef = useRef<HTMLDivElement | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const sizeRef = useRef(size)
  sizeRef.current = size

  // The guides as they are while a press is held: null when nothing is in progress.
  const draft = useRef<Guide[] | null>(null)
  const [, setDraftVersion] = useState(0)
  const shown = draft.current ?? guides
  const shownRef = useRef(shown)
  shownRef.current = shown

  const drag = useRef<Drag | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hover, setHover] = useState<{ snapped: number; guideId: string | null } | null>(null)
  // What Alt measures, as on the page: the selected guide against the guide or element under the
  // pointer, and the guide about to be made against the nearest one beside it.
  const [distances, setDistances] = useState<DistanceOverlay[]>(NO_DISTANCES)
  const clearDistances = () => setDistances(NO_DISTANCES)
  const pendingPoint = useRef<Point | null>(null)
  const pendingAlt = useRef(false)
  // Where the pointer last was over the preview, so pressing or releasing Alt measures there
  // without the pointer having to move.
  const lastPoint = useRef<Point | null>(null)
  const frameRef = useRef<number | null>(null)
  const snapTargets = useRef<SnapTargets | null>(null)

  const setDraft = (next: Guide[]) => {
    draft.current = next
    setDraftVersion((version) => version + 1)
  }
  // Sends a finished press to the previews, once.
  const commitDraft = () => {
    const finished = draft.current
    if (!finished) return
    draft.current = null
    onChangeRef.current(finished)
    setDraftVersion((version) => version + 1)
  }
  const list = () => draft.current ?? shownRef.current

  // Frame pixels from the pointer's position over the layer.
  const toFrame = (event: { clientX: number; clientY: number }): Point => {
    const box = layerRef.current!.getBoundingClientRect()
    return { x: (event.clientX - box.left) / scale, y: (event.clientY - box.top) / scale }
  }
  // The guide under a point, within the grab distance of its hitbox.
  const hitGuide = (point: Point) => {
    const reach = GUIDE_HITBOX_SIZE / 2 / scale
    return list().find((guide) => {
      const along = guide.orientation === "vertical" ? point.x : point.y
      return Math.abs(along - guide.position) <= reach
    })
  }
  // Where a guide along `point` lands: snapped to the preview's elements and to the other guides,
  // as on the page. The nearest within the snap distance wins.
  const snapped = (guideOrientation: Guide["orientation"], point: Point, id: string | null) => {
    const raw = guideOrientation === "vertical" ? point.x : point.y
    const doc = getDocument()
    if (!doc) return raw
    if (!snapTargets.current) snapTargets.current = collectSnapTargets(doc)
    const candidates = guideOrientation === "vertical" ? snapTargets.current.xs : snapTargets.current.ys
    let best = raw
    let bestDistance = GUIDE_SNAP_DISTANCE + 1
    for (const candidate of candidates) {
      const distance = Math.abs(candidate - raw)
      if (distance <= GUIDE_SNAP_DISTANCE && distance < bestDistance) {
        best = candidate
        bestDistance = distance
      }
    }
    for (const guide of list()) {
      if (guide.id === id) continue
      const distance = Math.abs(guide.position - raw)
      if (distance <= GUIDE_SNAP_DISTANCE && distance < bestDistance) {
        best = guide.position
        bestDistance = distance
      }
    }
    return best
  }

  // Applies the last pointer position: moves the dragged guide, or refreshes the hover. Called
  // at most once per animation frame, however many moves the pointer made in it.
  const flush = () => {
    frameRef.current = null
    const point = pendingPoint.current
    pendingPoint.current = null
    if (!point) return
    const current = drag.current
    if (current) {
      const position = snapped(current.orientation, point, current.id)
      setDraft(list().map((guide) => (guide.id === current.id ? { ...guide, position } : guide)))
      return
    }
    const hoverGuide = hitGuide(point)
    setHover({ snapped: snapped(orientation, point, null), guideId: hoverGuide?.id ?? null })
    setDistances(pendingAlt.current ? measure(point) : NO_DISTANCES)
  }
  // The page's Alt measurements at this point of the preview. They are worked out where they are
  // drawn, in this layer's pixels, from the preview's own elements; the element they are tied to
  // tells the labels the preview's scale, so they read in the preview's pixels.
  const measure = (point: Point): DistanceOverlay[] => {
    const doc = getDocument()
    const view = doc?.defaultView
    if (!doc || !view) return NO_DISTANCES
    const { width, height } = sizeRef.current
    const guideRect = (guide: Pick<Guide, "orientation" | "position">): Rect =>
      guide.orientation === "vertical"
        ? { left: guide.position * scale, top: 0, width: 0, height: height * scale }
        : { left: 0, top: guide.position * scale, width: width * scale, height: 0 }
    const between = (a: Rect, b: Rect) => getDistanceOverlay(a, b, doc.documentElement, null, view)

    const all = list()
    const found: DistanceOverlay[] = []
    const selectedGuide = getSelectedGuide(all, selected)
    const hoverGuide = getHoveredGuide(point, selectedGuide ? all.filter((guide) => guide.id !== selectedGuide.id) : all)
    if (selectedGuide && hoverGuide) {
      found.push(between(guideRect(selectedGuide), guideRect(hoverGuide)))
      return found
    }
    if (selectedGuide) {
      const element = doc.elementFromPoint(point.x, point.y)
      if (element && element !== doc.body && element !== doc.documentElement) {
        const box = element.getBoundingClientRect()
        found.push(
          between(guideRect(selectedGuide), {
            left: box.left * scale,
            top: box.top * scale,
            width: box.width * scale,
            height: box.height * scale,
          }),
        )
      }
    }
    // The guide a press here would make, against the nearest one that runs the same way.
    const position = snapped(orientation, point, null)
    const nearest = all
      .filter((guide) => guide.orientation === orientation)
      .sort((first, second) => Math.abs(first.position - position) - Math.abs(second.position - position))[0]
    if (nearest) found.push(between(guideRect({ orientation, position }), guideRect(nearest)))
    return found
  }
  const schedule = (point: Point, alt: boolean) => {
    pendingPoint.current = point
    pendingAlt.current = alt
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(flush)
  }
  const cancelScheduled = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    pendingPoint.current = null
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    // A fresh read of the page for each press, so what it snaps to is what is there now.
    snapTargets.current = null
    setHover(null)
    clearDistances()
    const point = toFrame(event)
    const hit = hitGuide(point)
    if (hit) {
      setSelected((current) =>
        event.shiftKey
          ? current.includes(hit.id) ? current.filter((id) => id !== hit.id) : [...current, hit.id]
          : current.includes(hit.id) ? current : [hit.id],
      )
      drag.current = { id: hit.id, orientation: hit.orientation }
    } else {
      if (!event.shiftKey) setSelected([])
      const id = newGuideId()
      const position = snapped(orientation, point, id)
      setDraft([...list(), { id, orientation, position }])
      setSelected((current) => (event.shiftKey ? [...current, id] : [id]))
      drag.current = { id, orientation }
    }
    setDraggingId(drag.current.id)
    layerRef.current?.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active) return
    const point = toFrame(event)
    lastPoint.current = point
    schedule(point, event.altKey)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current) return
    // Apply the last position before the guide is judged on it.
    if (pendingPoint.current) {
      cancelScheduled()
      flush()
    }
    drag.current = null
    setDraggingId(null)
    layerRef.current?.releasePointerCapture(event.pointerId)
    const guide = list().find((candidate) => candidate.id === current.id)
    const limit = current.orientation === "vertical" ? sizeRef.current.width : sizeRef.current.height
    // Dragged off the preview: gone, as a guide dragged off the page is.
    if (guide && (guide.position < 0 || guide.position > limit)) {
      setDraft(list().filter((candidate) => candidate.id !== current.id))
      setSelected((ids) => ids.filter((id) => id !== current.id))
    }
    commitDraft()
  }

  // Keys: Delete removes the selection, Escape clears it, and Alt measures. Alt pressed or let go
  // re-measures where the pointer is, without it having to move.
  useEffect(() => {
    const view = layerRef.current?.ownerDocument.defaultView
    if (!active || !view) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Alt" && !event.repeat && lastPoint.current) schedule(lastPoint.current, true)
      if (event.key === "Escape") setSelected([])
      if ((event.key === "Delete" || event.key === "Backspace") && selected.length > 0) {
        event.preventDefault()
        draft.current = null
        onChangeRef.current(shownRef.current.filter((guide) => !selected.includes(guide.id)))
        setSelected([])
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") clearDistances()
    }
    view.addEventListener("keydown", onKeyDown)
    view.addEventListener("keyup", onKeyUp)
    view.addEventListener("blur", clearDistances)
    return () => {
      view.removeEventListener("keydown", onKeyDown)
      view.removeEventListener("keyup", onKeyUp)
      view.removeEventListener("blur", clearDistances)
    }
  }, [active, selected, orientation, scale])

  // Leaving the tool drops the hover, any selection, and anything still in progress.
  useEffect(() => {
    if (active) return
    setHover(null)
    clearDistances()
    setSelected([])
    snapTargets.current = null
    cancelScheduled()
    commitDraft()
  }, [active])

  const hovered = draggingId ? null : (hover?.guideId ?? null)
  const showPreviewLine = active && hover !== null && !draggingId && hover.guideId === null

  return (
    <div
      ref={layerRef}
      className={cn("msr:absolute msr:inset-0", active ? "msr:z-[2] msr:cursor-crosshair" : "msr:pointer-events-none")}
      data-preview-guides={active ? "active" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => {
        lastPoint.current = null
        setHover(null)
        clearDistances()
        snapTargets.current = null
      }}
    >
      {shown.map((guide) => (
        <GuideLine
          key={guide.id}
          guide={{ ...guide, position: guide.position * scale }}
          selected={selected.includes(guide.id)}
          hovered={hovered === guide.id}
          dragging={draggingId === guide.id}
          highlightEnabled={active}
          selectEnabled={active}
          style={DEFAULT_GUIDE_STYLE}
          pointerEvents={false}
          colorActive={ACCENT}
          colorHover={ACCENT}
          colorDefault={GUIDE_COLOR}
          onPointerDown={NOOP}
          onPointerUp={NOOP}
          onPointerCancel={NOOP}
          onContextMenu={NOOP}
        />
      ))}
      {showPreviewLine && hover ? (
        <GuidePreviewLine
          orientation={orientation}
          position={hover.snapped * scale}
          color={GUIDE_COLOR}
          style={DEFAULT_GUIDE_STYLE}
          emphasized={false}
        />
      ) : null}
      {distances.map((distance, index) => (
        <DistanceOverlayItem key={index} distance={distance} labelOffset={MEASURE_LABEL_OFFSET} />
      ))}
    </div>
  )
}

const NO_DISTANCES: DistanceOverlay[] = []

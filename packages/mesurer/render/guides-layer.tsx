import {
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import type { Guide } from "../core/types"
import type { GuideStyle } from "../core/persistence"
import { MenuItem, MenuSurface } from "../components/menu"
import { GuideLine, GuidePreviewLine } from "./guide-line"

type GuideColors = {
  active: string
  hover: string
  default: string
  preview: string
  previewEmphasized: boolean
}

type GuidesLayerProps = {
  guides: Guide[]
  selectedIds: string[]
  moveOffset?: { x: number; y: number }
  hoverId: string | null
  draggingId: string | null
  highlightEnabled: boolean
  selectEnabled: boolean
  style: GuideStyle
  pointerEvents: boolean
  colors: GuideColors
  preview: { orientation: "vertical" | "horizontal"; position: number } | null
  onPointerDown: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onRemoveGuides: (ids: string[]) => void
}

type GuideMenu = { ids: string[]; x: number; y: number; ownerWindow: Window } | null

export function GuidesLayer({
  guides,
  selectedIds,
  moveOffset = { x: 0, y: 0 },
  hoverId,
  draggingId,
  highlightEnabled,
  selectEnabled,
  style,
  pointerEvents,
  colors,
  preview,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onRemoveGuides,
}: GuidesLayerProps) {
  const [menu, setMenu] = useState<GuideMenu>(null)

  useEffect(() => {
    if (!pointerEvents || draggingId) setMenu(null)
  }, [draggingId, pointerEvents])

  useEffect(() => {
    if (!menu) return
    const close = (event: PointerEvent) => {
      const clickedMenu = event.composedPath().some(
        (target) =>
          target instanceof Element &&
          target.hasAttribute("data-mesurer-guide-menu"),
      )
      if (clickedMenu) return
      setMenu(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopImmediatePropagation()
      setMenu(null)
    }
    menu.ownerWindow.addEventListener("pointerdown", close, true)
    menu.ownerWindow.addEventListener("keydown", handleKeyDown, true)
    return () => {
      menu.ownerWindow.removeEventListener("pointerdown", close, true)
      menu.ownerWindow.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [menu])

  const handleContextMenu = (guide: Guide, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const ownerWindow = event.currentTarget.ownerDocument.defaultView ?? window
    setMenu({
      ids: selectedIds.includes(guide.id) ? selectedIds : [guide.id],
      x: Math.min(event.clientX, ownerWindow.innerWidth - 132),
      y: Math.min(event.clientY, ownerWindow.innerHeight - 42),
      ownerWindow,
    })
  }

  return (
    <>
      {preview ? (
        <GuidePreviewLine
          orientation={preview.orientation}
          position={preview.position}
          color={colors.preview}
          style={style}
          emphasized={colors.previewEmphasized}
        />
      ) : null}
      {guides.map((guide) => (
        <GuideLine
          key={guide.id}
          guide={
            selectedIds.includes(guide.id) && (moveOffset.x || moveOffset.y)
              ? {
                  ...guide,
                  position:
                    guide.position +
                    (guide.orientation === "vertical" ? moveOffset.x : moveOffset.y),
                }
              : guide
          }
          selected={selectedIds.includes(guide.id)}
          hovered={hoverId === guide.id || draggingId === guide.id}
          dragging={draggingId === guide.id}
          highlightEnabled={highlightEnabled}
          selectEnabled={selectEnabled}
          style={style}
          pointerEvents={pointerEvents}
          colorActive={colors.active}
          colorHover={colors.hover}
          colorDefault={colors.default}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={handleContextMenu}
        />
      ))}
      {menu ? (
        <MenuSurface
          data-mesurer-guide-menu
          autoFocus
          tabIndex={0}
          className="msr:pointer-events-auto msr:absolute msr:w-32"
          style={{ left: Math.max(8, menu.x), top: Math.max(8, menu.y) }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenu(null)
          }}
        >
          <MenuItem
            variant="neutral"
            onClick={() => {
              onRemoveGuides(menu.ids)
              setMenu(null)
            }}
          >
            {menu.ids.length === 1 ? "Remove guide" : "Remove guides"}
          </MenuItem>
        </MenuSurface>
      ) : null}
    </>
  )
}

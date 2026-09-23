import {
  useEffect,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import type { Guide, OpenMenu } from "../core/types"
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
  openMenu: OpenMenu
  setOpenMenu: import("react").Dispatch<import("react").SetStateAction<OpenMenu>>
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

export function GuidesLayer({
  openMenu,
  setOpenMenu,
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
  const menu = openMenu?.type === "guide-context" ? openMenu : null

  useEffect(() => {
    if (!pointerEvents || draggingId) setOpenMenu(null)
  }, [draggingId, pointerEvents, setOpenMenu])

  useEffect(() => {
    if (!menu) return
    const close = (event: PointerEvent) => {
      const clickedMenu = event.composedPath().some(
        (target) =>
          target instanceof Element &&
          target.hasAttribute("data-mesurer-guide-menu"),
      )
      if (clickedMenu) return
      setOpenMenu(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpenMenu(null)
    }
    menu.ownerWindow.addEventListener("pointerdown", close, true)
    menu.ownerWindow.addEventListener("keydown", handleKeyDown, true)
    return () => {
      menu.ownerWindow.removeEventListener("pointerdown", close, true)
      menu.ownerWindow.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [menu, setOpenMenu])

  const handleContextMenu = (guide: Guide, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const ownerWindow = event.currentTarget.ownerDocument.defaultView ?? window
    setOpenMenu({
      type: "guide-context",
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
           className="msr:pointer-events-auto msr:absolute msr:z-[100] msr:w-32"
          style={{ left: Math.max(8, menu.x), top: Math.max(8, menu.y) }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpenMenu(null)
          }}
        >
          <MenuItem
            variant="neutral"
            onClick={() => {
              onRemoveGuides(menu.ids)
              setOpenMenu(null)
            }}
          >
            {menu.ids.length === 1 ? "Remove guide" : "Remove guides"}
          </MenuItem>
        </MenuSurface>
      ) : null}
    </>
  )
}

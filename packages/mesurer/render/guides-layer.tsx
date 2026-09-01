import type { PointerEvent as ReactPointerEvent } from "react"
import type { Guide } from "../core/types"
import type { GuideStyle } from "../core/persistence"
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
  style: GuideStyle
  pointerEvents: boolean
  colors: GuideColors
  preview: { orientation: "vertical" | "horizontal"; position: number } | null
  onPointerDown: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
}

export function GuidesLayer({
  guides,
  selectedIds,
  moveOffset = { x: 0, y: 0 },
  hoverId,
  draggingId,
  style,
  pointerEvents,
  colors,
  preview,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: GuidesLayerProps) {
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
          style={style}
          pointerEvents={pointerEvents}
          colorActive={colors.active}
          colorHover={colors.hover}
          colorDefault={colors.default}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      ))}
    </>
  )
}

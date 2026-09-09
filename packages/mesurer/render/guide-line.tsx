import type { PointerEvent as ReactPointerEvent } from "react"
import { GUIDE_HITBOX_SIZE } from "../core/constants"
import type { Guide } from "../core/types"
import type { GuideStyle } from "../core/persistence"

type GuideLineProps = {
  guide: Guide
  selected: boolean
  hovered: boolean
  dragging: boolean
  highlightEnabled: boolean
  selectEnabled: boolean
  style: GuideStyle
  pointerEvents: boolean
  colorActive: string
  colorHover: string
  colorDefault: string
  onPointerDown: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
}

export function GuideLine({
  guide,
  selected,
  hovered,
  dragging,
  highlightEnabled,
  selectEnabled,
  style,
  pointerEvents,
  colorActive,
  colorHover,
  colorDefault,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: GuideLineProps) {
  const active = selectEnabled && selected && !dragging
  const highlighted = highlightEnabled && (hovered || dragging)
  const strokeColor = active
    ? colorActive
    : highlighted
      ? colorHover
      : colorDefault
  const strokeWidth = active || highlighted ? Math.max(style.width, 1) : style.width
  const opacity = !highlightEnabled || active || highlighted ? 1 : Math.min(style.opacity, 0.55)
  const isSolid = style.pattern === "solid"
  const backgroundImage = style.pattern === "solid"
    ? undefined
    : style.pattern === "dotted"
      ? `radial-gradient(circle, ${strokeColor} 0 ${strokeWidth / 2}px, transparent ${strokeWidth / 2 + 0.5}px)`
      : `repeating-linear-gradient(${guide.orientation === "vertical" ? "to bottom" : "to right"}, ${strokeColor} 0 ${style.dashLength}px, transparent ${style.dashLength}px ${style.dashLength + style.gap}px)`
  const backgroundSize = style.pattern === "dotted"
    ? guide.orientation === "vertical"
      ? `${strokeWidth}px ${style.dashLength + style.gap}px`
      : `${style.dashLength + style.gap}px ${strokeWidth}px`
    : undefined
  const position = Math.round(guide.position)
  const strokeOffset = GUIDE_HITBOX_SIZE / 2 - Math.floor((strokeWidth - 1) / 2)

  return (
    <div
      className="msr:absolute"
      data-mesurer-guide="true"
      style={
        guide.orientation === "vertical"
          ? {
              left: position - GUIDE_HITBOX_SIZE / 2,
              top: 0,
              width: GUIDE_HITBOX_SIZE,
              height: "100%",
              pointerEvents: pointerEvents ? "auto" : "none",
            }
          : {
              top: position - GUIDE_HITBOX_SIZE / 2,
              left: 0,
              height: GUIDE_HITBOX_SIZE,
              width: "100%",
              pointerEvents: pointerEvents ? "auto" : "none",
            }
      }
      onPointerDown={(event) => onPointerDown(guide, event)}
      onPointerUp={(event) => onPointerUp(guide, event)}
      onPointerCancel={(event) => onPointerCancel(guide, event)}
    >
      <div
        className="msr:absolute"
        style={
          guide.orientation === "vertical"
            ? {
                left: strokeOffset,
                top: 0,
                width: strokeWidth,
                height: "100%",
                backgroundColor: isSolid ? strokeColor : "transparent",
                backgroundImage,
                backgroundSize,
                 opacity,
              }
            : {
                top: strokeOffset,
                left: 0,
                height: strokeWidth,
                width: "100%",
                backgroundColor: isSolid ? strokeColor : "transparent",
                backgroundImage,
                backgroundSize,
                 opacity,
              }
        }
      />
    </div>
  )
}

type GuidePreviewLineProps = {
  orientation: "vertical" | "horizontal"
  position: number
  color: string
  style: GuideStyle
  emphasized: boolean
}

export function GuidePreviewLine({
  orientation,
  position,
  color,
  style,
  emphasized,
}: GuidePreviewLineProps) {
  const strokeWidth = emphasized ? Math.max(style.width, 1) : style.width
  const strokeOffset = GUIDE_HITBOX_SIZE / 2 - Math.floor((strokeWidth - 1) / 2)

  return (
    <div
      className="msr:pointer-events-none msr:absolute"
      style={
        orientation === "vertical"
          ? {
              left: position - GUIDE_HITBOX_SIZE / 2,
              top: 0,
              width: GUIDE_HITBOX_SIZE,
              height: "100%",
            }
          : {
              top: position - GUIDE_HITBOX_SIZE / 2,
              left: 0,
              height: GUIDE_HITBOX_SIZE,
              width: "100%",
            }
      }
    >
      <div
        className="msr:absolute"
        style={
          orientation === "vertical"
            ? {
                left: strokeOffset,
                top: 0,
                width: strokeWidth,
                height: "100%",
                backgroundColor: color,
                opacity: style.opacity,
              }
            : {
                top: strokeOffset,
                left: 0,
                height: strokeWidth,
                width: "100%",
                backgroundColor: color,
                opacity: style.opacity,
              }
        }
      />
    </div>
  )
}

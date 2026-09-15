import type { EdgeVisibility } from "../core/edge-visibility"
import type { Rect } from "../core/types"

type HoverRectProps = {
  rect: Rect
  fillColor: string
  outlineColor: string
  edges: EdgeVisibility | null
}

export function HoverRect({
  rect,
  fillColor,
  outlineColor,
  edges,
}: HoverRectProps) {
  return (
    <div
      className="msr:pointer-events-none msr:absolute"
      data-mesurer-hover="true"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        backgroundColor: fillColor,
      }}
    >
      {edges?.top ? (
        <div
          className="msr:absolute msr:left-0 msr:top-0 msr:h-px msr:w-full"
          style={{ backgroundColor: outlineColor }}
        />
      ) : null}
      {edges?.right ? (
        <div
          className="msr:absolute msr:right-0 msr:top-0 msr:h-full msr:w-px"
          style={{ backgroundColor: outlineColor }}
        />
      ) : null}
      {edges?.bottom ? (
        <div
          className="msr:absolute msr:bottom-0 msr:left-0 msr:h-px msr:w-full"
          style={{ backgroundColor: outlineColor }}
        />
      ) : null}
      {edges?.left ? (
        <div
          className="msr:absolute msr:left-0 msr:top-0 msr:h-full msr:w-px"
          style={{ backgroundColor: outlineColor }}
        />
      ) : null}
    </div>
  )
}

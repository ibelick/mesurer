import { memo } from "react"
import type { Arrow, Point } from "../core/types"

type ArrowsLayerProps = {
  arrows: Arrow[]
  selectedIds: string[]
  preview: { start: Point; end: Point } | null
  markerId: string
}

const ArrowLine = ({
  start,
  end,
  color,
  width,
  markerId,
  selected,
  preview = false,
  id,
}: {
  start: Point
  end: Point
  color: string
  width: number
  markerId: string
  selected?: boolean
  preview?: boolean
  id?: string
}) => (
  <g>
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={color}
      strokeWidth={selected || preview ? Math.max(width, 2) : width}
      strokeLinecap="round"
      markerEnd={`url(#${markerId})`}
      pointerEvents={preview ? "none" : "stroke"}
      opacity={preview ? 0.65 : 1}
      data-mesurer-arrow={preview ? undefined : "true"}
      data-mesurer-arrow-id={id}
      data-mesurer-arrow-preview={preview ? "true" : undefined}
    />
    {selected && id ? (
      <>
        <circle
          cx={start.x}
          cy={start.y}
          r="6"
          fill="white"
          stroke={color}
          strokeWidth="2"
          pointerEvents="all"
          data-mesurer-arrow-id={id}
          data-mesurer-arrow-handle="start"
        />
        <circle
          cx={end.x}
          cy={end.y}
          r="6"
          fill="white"
          stroke={color}
          strokeWidth="2"
          pointerEvents="all"
          data-mesurer-arrow-id={id}
          data-mesurer-arrow-handle="end"
        />
      </>
    ) : null}
  </g>
)

export const ArrowsLayer = memo(function ArrowsLayer({
  arrows,
  selectedIds,
  preview,
  markerId,
}: ArrowsLayerProps) {
  if (arrows.length === 0 && !preview) return null

  return (
    <svg
      aria-hidden="true"
      className="msr:pointer-events-none msr:absolute msr:inset-0 msr:size-full"
      data-mesurer-arrows-layer="true"
    >
      <defs>
        <marker
          id={markerId}
          markerHeight="8"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          orient="auto-start-reverse"
          refX="7"
          refY="4"
        >
          <path d="M0 0L8 4L0 8Z" fill="context-stroke" />
        </marker>
      </defs>
      {arrows.map((arrow) => (
        <ArrowLine
          key={arrow.id}
          start={arrow.start}
          end={arrow.end}
          color={arrow.color}
          width={arrow.width}
          markerId={markerId}
          selected={selectedIds.includes(arrow.id)}
          id={arrow.id}
        />
      ))}
      {preview ? (
        <ArrowLine
          start={preview.start}
          end={preview.end}
          color="#0d99ff"
          width={1}
          markerId={markerId}
          preview
        />
      ) : null}
    </svg>
  )
})

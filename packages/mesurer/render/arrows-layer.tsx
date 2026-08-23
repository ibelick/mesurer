import { memo } from "react"
import { arrowPath, midpoint } from "../core/arrows"
import type { Arrow, Point } from "../core/types"

type ArrowsLayerProps = {
  arrows: Arrow[]
  selectedIds: string[]
  preview: { start: Point; end: Point; control?: Point } | null
  markerId: string
  scrollOffset: Point
}

const NODE_SIZE = 6

const ArrowNode = ({
  x,
  y,
  color,
  id,
  handle,
}: {
  x: number
  y: number
  color: string
  id?: string
  handle: "start" | "control" | "end"
}) => (
  <rect
    x={x - NODE_SIZE / 2}
    y={y - NODE_SIZE / 2}
    width={NODE_SIZE}
    height={NODE_SIZE}
    fill="white"
    stroke={color}
    strokeWidth="1.5"
    pointerEvents="all"
    data-mesurer-arrow-node="true"
    data-mesurer-arrow-id={id}
    data-mesurer-arrow-handle={handle}
    data-mesurer-arrow-x={x}
    data-mesurer-arrow-y={y}
  />
)

const ArrowLine = ({
  start,
  end,
  control: providedControl,
  color,
  width,
  markerId,
  selected,
  preview = false,
  id,
}: {
  start: Point
  end: Point
  control?: Point
  color: string
  width: number
  markerId: string
  selected?: boolean
  preview?: boolean
  id?: string
}) => {
  const control = providedControl ?? midpoint(start, end)
  const path = arrowPath(start, end, control)
  const touchPoints = preview
    ? []
    : [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t) => ({
        x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
        y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
      }))

  return (
    <g>
      {touchPoints.map((point, index) => (
        <circle
          key={`touch-${index}`}
          cx={point.x}
          cy={point.y}
          r="12"
          fill="transparent"
          pointerEvents="all"
          data-mesurer-arrow-id={id}
          data-mesurer-arrow-touch-zone="true"
        />
      ))}
      <path
        d={path}
        fill="none"
        stroke={color}
        opacity="0"
        strokeWidth={Math.max(width, 24)}
        pointerEvents="none"
        data-mesurer-arrow-id={id}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        pointerEvents={preview ? "none" : "all"}
        opacity={preview ? 0.65 : 1}
        data-mesurer-arrow={preview ? undefined : "true"}
        data-mesurer-arrow-id={id}
        data-mesurer-arrow-preview={preview ? "true" : undefined}
      />
      {selected ? (
        <>
          <ArrowNode
            x={start.x}
            y={start.y}
            color={color}
            id={id}
            handle="start"
          />
          <ArrowNode
            x={control.x}
            y={control.y}
            color={color}
            id={id}
            handle="control"
          />
          <ArrowNode
            x={end.x}
            y={end.y}
            color={color}
            id={id}
            handle="end"
          />
        </>
      ) : null}
      {selected ? (
        <>
          <circle
            cx={start.x}
            cy={start.y}
            r="12"
            fill="transparent"
            pointerEvents="all"
            data-mesurer-arrow-id={id}
            data-mesurer-arrow-handle="start"
            data-mesurer-arrow-hit="true"
            data-mesurer-arrow-x={start.x}
            data-mesurer-arrow-y={start.y}
          />
          <circle
            cx={control.x}
            cy={control.y}
            r="12"
            fill="transparent"
            pointerEvents="all"
            data-mesurer-arrow-id={id}
            data-mesurer-arrow-handle="control"
            data-mesurer-arrow-hit="true"
            data-mesurer-arrow-x={control.x}
            data-mesurer-arrow-y={control.y}
          />
          <circle
            cx={end.x}
            cy={end.y}
            r="12"
            fill="transparent"
            pointerEvents="all"
            data-mesurer-arrow-id={id}
            data-mesurer-arrow-handle="end"
            data-mesurer-arrow-hit="true"
            data-mesurer-arrow-x={end.x}
            data-mesurer-arrow-y={end.y}
          />
        </>
      ) : null}
    </g>
  )
}

export const ArrowsLayer = memo(function ArrowsLayer({
  arrows,
  selectedIds,
  preview,
  markerId,
  scrollOffset,
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
          markerHeight="12"
          markerWidth="14"
          markerUnits="strokeWidth"
          orient="auto"
          overflow="visible"
          refX="12"
          refY="6"
          viewBox="0 0 14 12"
        >
          <path
            d="M1 0.5L12 6L1 11.5"
            fill="none"
            stroke="context-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1"
          />
        </marker>
      </defs>
      {arrows.map((arrow) => (
        <ArrowLine
          key={arrow.id}
          start={{ x: arrow.start.x - scrollOffset.x, y: arrow.start.y - scrollOffset.y }}
          end={{ x: arrow.end.x - scrollOffset.x, y: arrow.end.y - scrollOffset.y }}
          control={arrow.control ? { x: arrow.control.x - scrollOffset.x, y: arrow.control.y - scrollOffset.y } : undefined}
          color={arrow.color}
          width={arrow.width}
          markerId={markerId}
          selected={selectedIds.includes(arrow.id)}
          id={arrow.id}
        />
      ))}
      {preview ? (
        <ArrowLine
          start={{ x: preview.start.x - scrollOffset.x, y: preview.start.y - scrollOffset.y }}
          end={{ x: preview.end.x - scrollOffset.x, y: preview.end.y - scrollOffset.y }}
          control={preview.control ? { x: preview.control.x - scrollOffset.x, y: preview.control.y - scrollOffset.y } : undefined}
          color="#0d99ff"
          width={1}
          markerId={markerId}
          preview
        />
      ) : null}
    </svg>
  )
})

import type { SVGProps } from "react"

export const HANDLE_NODE_SIZE = 6
export const HANDLE_NODE_STROKE = 1.5
export const HANDLE_NODE_FILL = "white"

type HandleNodeProps = {
  color: string
  x?: number
  y?: number
} & Omit<SVGProps<SVGRectElement>, "x" | "y" | "width" | "height" | "fill" | "stroke" | "strokeWidth">

export const HandleNode = ({
  color,
  x = HANDLE_NODE_SIZE / 2,
  y = HANDLE_NODE_SIZE / 2,
  ...props
}: HandleNodeProps) => (
  <rect
    x={x - HANDLE_NODE_SIZE / 2}
    y={y - HANDLE_NODE_SIZE / 2}
    width={HANDLE_NODE_SIZE}
    height={HANDLE_NODE_SIZE}
    fill={HANDLE_NODE_FILL}
    stroke={color}
    strokeWidth={HANDLE_NODE_STROKE}
    {...props}
  />
)

export const HandleNodeMark = ({ color }: { color: string }) => (
  <svg
    width={HANDLE_NODE_SIZE}
    height={HANDLE_NODE_SIZE}
    overflow="visible"
    className="msr:block msr:shrink-0"
    aria-hidden
  >
    <HandleNode color={color} />
  </svg>
)

export function DropperIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  const stroke = (strokePx * 256) / size / fill
  const scale = 256 / 24

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <g
        transform={`scale(${scale})`}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke / scale}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 7l6 6" />
        <path d="M4 16l11.7-11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4" />
      </g>
    </svg>
  )
}

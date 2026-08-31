export function MeasureBarIcon({ size = 20, strokePx = 1, fill = 1, className }: { size?: number; strokePx?: number; fill?: number; className?: string }) {
  const stroke = (strokePx * 256) / size / fill

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true" className={className}>
      <path
        d="M40 80h176a16 16 0 0 1 16 16v64a16 16 0 0 1-16 16H40a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16ZM88 80v32M128 80v32M168 80v32"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

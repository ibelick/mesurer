export function MeasureLIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  const stroke = (strokePx * 256) / size / fill

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M56 40H200a16 16 0 0 1 16 16v36a16 16 0 0 1-16 16H108V200a16 16 0 0 1-16 16H56a16 16 0 0 1-16-16V56a16 16 0 0 1 16-16Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M88 40v32M128 40v32M168 40v32M40 88h32M40 128h32M40 168h32"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="butt"
      />
    </svg>
  )
}

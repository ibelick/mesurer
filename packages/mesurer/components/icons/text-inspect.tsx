export function TextInspectIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  const stroke = (strokePx * 256) / size / fill

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M64 36H48A12 12 0 0 0 36 48V64M176 64V48A12 12 0 0 0 164 36H148M64 176H48A12 12 0 0 1 36 164V148M90.1 36h31.9M36 90.1v31.9"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M124 112h52M150 112v72"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

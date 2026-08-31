export function PenIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  const stroke = (strokePx * 256) / size / fill

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <g transform="rotate(-45 128 128)" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round">
        <path d="M110 48H146A16 16 0 0 1 162 64V160L128 216L94 160V64A16 16 0 0 1 110 48Z" strokeLinecap="round" />
        <path d="M94 160H162" strokeLinecap="butt" />
      </g>
    </svg>
  )
}

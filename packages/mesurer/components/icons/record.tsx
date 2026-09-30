export function RecordIcon({ size = 20, strokePx = 1.5, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  const stroke = (strokePx * 24) / size / fill

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth={stroke} />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </svg>
  )
}

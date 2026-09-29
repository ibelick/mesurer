export function RecordIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  const stroke = (strokePx * 256) / size / fill

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M36 92H156A16 16 0 0 1 172 108V180A16 16 0 0 1 156 196H36A16 16 0 0 1 20 180V108A16 16 0 0 1 36 92Z"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="96" cy="144" r="28" stroke="currentColor" strokeWidth={stroke} />
      <path
        d="M172 116L228 88V200L172 172V116Z"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

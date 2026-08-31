export function CameraIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  const stroke = (strokePx * 256) / size / fill

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M56 96H96V76A12 12 0 0 1 108 64H148A12 12 0 0 1 160 76V96H200A16 16 0 0 1 216 112V188A16 16 0 0 1 200 204H56A16 16 0 0 1 40 188V112A16 16 0 0 1 56 96Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="128" cy="150" r="32" fill="none" stroke="currentColor" strokeWidth={stroke} />
    </svg>
  )
}

export function XRayIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M76 48h96a16 16 0 0 1 16 16v96a16 16 0 0 1-16 16H76a16 16 0 0 1-16-16V64a16 16 0 0 1 16-16Zm32 32h96a16 16 0 0 1 16 16v96a16 16 0 0 1-16 16h-96a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={(strokePx * 256) / size / fill}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

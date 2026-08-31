export function DropperIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        transform="rotate(-45 128 128)"
        d="M108 48H148A16 16 0 0 1 164 64V92H148V156L142 200A12 12 0 0 1 114 200L108 156V92H92V64A16 16 0 0 1 108 48Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={(strokePx * 256) / size / fill}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

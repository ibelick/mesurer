export function ArrowIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M40 128H216M176 88L216 128L176 168"
        fill="none"
        stroke="currentColor"
        strokeWidth={(strokePx * 256) / size / fill}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

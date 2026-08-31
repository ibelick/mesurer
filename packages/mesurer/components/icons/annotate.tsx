export function AnnotateIcon({
  size = 20,
  strokePx = 1.25,
  fill = 1,
}: {
  size?: number
  strokePx?: number
  fill?: number
}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M29.9 109.4C44.7 103.4 94.5 199.8 109.3 193.8C124.1 187.8 92.9 83.9 107.8 77.9C122.6 71.9 172.3 168.3 187.2 162.3C202 156.3 170.8 52.5 185.7 46.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={(strokePx * 256) / size / fill}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

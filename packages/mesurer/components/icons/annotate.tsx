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
        d="M40 184C52.1 154.8 69.8 65 86 60C102.3 55 104.3 155 118 160C131.8 165 139.1 83.2 152 84C164.9 84.8 168.3 159 180 164C191.7 169 197.2 111.3 208 108C218.8 104.7 224.5 136.3 232 148"
        fill="none"
        stroke="currentColor"
        strokeWidth={(strokePx * 256) / size / fill}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SelectInspectIcon({
  size = 20,
  strokePx = 1.25,
  fill = 1,
}: {
  size?: number
  strokePx?: number
  fill?: number
}) {
  const stroke = (strokePx * 256) / size / fill
  const nested = 132
  const nestedStroke = stroke * (12 / nested)

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M56 40H200a16 16 0 0 1 16 16v36a16 16 0 0 1-16 16H108V200a16 16 0 0 1-16 16H56a16 16 0 0 1-16-16V56a16 16 0 0 1 16-16Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M88 40v32M128 40v32M168 40v32M40 88h32M40 128h32M40 168h32"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="butt"
      />
      <svg x="118" y="122" width={nested} height={nested} viewBox="9.4 12.5 12 12" overflow="visible">
        <path
          d="m18.76 16.64-6.25-2.07c-0.68-0.22-1.31 0.4-1.09 1.08l2.1 6.17c0.24 0.74 1.25 0.78 1.55 0.06l1.17-2.55 2.6-1.17c0.72-0.33 0.67-1.29-0.08-1.52z"
          fill="none"
          stroke="currentColor"
          strokeWidth={nestedStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </svg>
  )
}

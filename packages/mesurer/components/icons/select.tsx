export function SelectIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  const stroke = (strokePx * 256) / size / fill
  const nested = 152
  const nestedStroke = stroke * (12 / nested)

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M64 36H48A12 12 0 0 0 36 48V64M96 36h28M148 36h16M176 64V48A12 12 0 0 0 164 36H148M36 96v28M36 148v16M64 176H48A12 12 0 0 1 36 164V148M90.1 36h31.9M36 90.1v31.9"
      />
      <svg x="88" y="84" width={nested} height={nested} viewBox="9.4 12.5 12 12" overflow="visible">
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

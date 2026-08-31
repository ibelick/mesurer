export function SettingsIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M93 67.38L111 33.52L145 33.52L163 67.38L201.32 66.04L218.32 95.48L198 128L218.32 160.52L201.32 189.96L163 188.62L145 222.48L111 222.48L93 188.62L54.68 189.96L37.68 160.52L58 128L37.68 95.48L54.68 66.04L93 67.38ZM160 128A32 32 0 1 0 96 128A32 32 0 1 0 160 128Z"
        fill="none"
        fillRule="evenodd"
        stroke="currentColor"
        strokeWidth={(strokePx * 256) / size / fill}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

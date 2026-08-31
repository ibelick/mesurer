export function CursorIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="9.4 12.5 12 12" fill="none" aria-hidden="true">
      <path
        d="m18.76 16.64-6.25-2.07c-0.68-0.22-1.31 0.4-1.09 1.08l2.1 6.17c0.24 0.74 1.25 0.78 1.55 0.06l1.17-2.55 2.6-1.17c0.72-0.33 0.67-1.29-0.08-1.52z"
        fill="none"
        stroke="currentColor"
        strokeWidth={(strokePx * 12) / size / fill}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

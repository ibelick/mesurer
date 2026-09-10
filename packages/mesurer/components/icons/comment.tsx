export function CommentIcon({ size = 20, strokePx = 1, fill = 1 }: { size?: number; strokePx?: number; fill?: number }) {
  const stroke = (strokePx * 12) / size / fill

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="9.4 12.5 12 12" fill="none" aria-hidden="true">
      <path
        d="M11.38 18.46C11.38 16.29 13.2 14.52 15.37 14.52C17.54 14.52 19.31 16.29 19.31 18.46C19.31 20.63 17.54 22.39 15.37 22.39H13.28C12.23 22.39 11.38 21.54 11.38 20.49V18.46Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.95 18.46H16.79M15.37 17.04V19.88"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  )
}

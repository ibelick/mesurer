export function CommentResolveIcon({ resolved = false, size = 13 }: { resolved?: boolean; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none" className="msr:block">
      <circle cx="8" cy="8" r="5.5" fill={resolved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.25" />
      <path d="m5.2 8 1.8 1.8 3.8-4" stroke={resolved ? "var(--msr-surface)" : "currentColor"} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

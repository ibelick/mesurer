type StatusEllipsisProps = {
  label: string
  className?: string
}

export function StatusEllipsis({ label, className }: StatusEllipsisProps) {
  return (
    <span className={className} role="status" aria-live="polite">
      {label}
      <span className="mesurer-status-ellipsis" aria-hidden="true" />
    </span>
  )
}

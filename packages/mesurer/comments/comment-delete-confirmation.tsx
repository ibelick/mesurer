import { useRef } from "react"

type CommentDeleteConfirmationProps = {
  commentId: string
  onConfirm: (commentId: string) => void
  onCancel: () => void
  message?: string
  floating?: boolean
}

export function CommentDeleteConfirmation({
  commentId,
  onConfirm,
  onCancel,
  message = "Do you want to delete this comment?",
  floating = false,
}: CommentDeleteConfirmationProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  return (
    <div
      data-mesurer-comment-delete-confirmation
      data-mesurer-comment-ui
      className={`${floating ? "msr:relative" : "msr:absolute msr:right-2 msr:top-9"} msr:z-10 msr:w-48 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-3 msr:shadow-floating msr:outline-none`}
      role="dialog"
      aria-label="Delete comment"
      tabIndex={-1}
      autoFocus
      ref={(node) => {
        dialogRef.current = node
        node?.focus()
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <p className="msr:text-[12px] msr:text-ink-900">{message}</p>
      <div className="msr:mt-3 msr:flex msr:justify-end msr:gap-2">
        <button
          type="button"
          className="msr:rounded-control msr:px-2 msr:py-1 msr:text-[11px] msr:text-ink-600 msr:hover:bg-ink-100"
          onClick={onCancel}
        >
          No
        </button>
        <button
          type="button"
          className="msr:rounded-control msr:bg-red-600 msr:px-2 msr:py-1 msr:text-[11px] msr:text-white msr:hover:bg-red-700"
          onClick={() => onConfirm(commentId)}
        >
          Yes
        </button>
      </div>
    </div>
  )
}

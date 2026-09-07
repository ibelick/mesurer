type CommentOverflowMenuProps = {
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  commentId: string
}

export function CommentOverflowMenu({ commentId, onEdit, onDelete }: CommentOverflowMenuProps) {
  return (
    <div
      data-mesurer-comment-overflow-menu
      className="msr:absolute msr:right-0 msr:top-7 msr:z-10 msr:w-52 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-1 msr:shadow-lg"
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button type="button" role="menuitem" className="msr:block msr:w-full msr:rounded-control msr:px-2 msr:py-1.5 msr:text-left msr:text-[11px] msr:text-ink-700 msr:hover:bg-ink-50" onClick={() => onEdit(commentId)}>
        Edit
      </button>
      <button type="button" role="menuitem" className="msr:block msr:w-full msr:rounded-control msr:px-2 msr:py-1.5 msr:text-left msr:text-[11px] msr:text-red-600 msr:hover:bg-red-50" onClick={() => onDelete(commentId)}>
        Delete
      </button>
    </div>
  )
}

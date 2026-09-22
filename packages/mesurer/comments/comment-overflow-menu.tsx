type CommentOverflowMenuProps = {
  onEdit?: (id: string) => void
  onCopySelector?: (id: string) => void
  onDelete: (id: string) => void
  commentId: string
}

export function CommentOverflowMenu({ commentId, onEdit, onCopySelector, onDelete }: CommentOverflowMenuProps) {
  return (
    <div
      data-mesurer-comment-overflow-menu
      data-mesurer-comment-ui
      className="mesurer-comment-overflow-menu msr:absolute msr:right-0 msr:top-7 msr:z-10 msr:w-52 msr:rounded-lg msr:bg-white msr:p-1 msr:shadow-floating"
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {onEdit ? (
        <button type="button" role="menuitem" className="mesurer-comment-menu-item msr:block msr:w-full msr:rounded-control msr:px-2 msr:py-1.5 msr:text-left msr:text-[11px] msr:text-ink-700 msr:hover:bg-ink-200" onClick={() => onEdit(commentId)}>
          Edit
        </button>
      ) : null}
      {onCopySelector ? (
        <button type="button" role="menuitem" className="mesurer-comment-menu-item msr:block msr:w-full msr:rounded-control msr:px-2 msr:py-1.5 msr:text-left msr:text-[11px] msr:text-ink-700 msr:hover:bg-ink-200" onClick={() => onCopySelector(commentId)}>
          Copy selector
        </button>
      ) : null}
      <button type="button" role="menuitem" className="mesurer-comment-menu-danger msr:block msr:w-full msr:rounded-control msr:px-2 msr:py-1.5 msr:text-left msr:text-red-600 msr:hover:bg-red-50" onClick={() => onDelete(commentId)}>
        Delete
      </button>
    </div>
  )
}

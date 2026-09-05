import { useState, type KeyboardEvent } from "react"
import type { CommentThread } from "./types"
import { CloseIcon, TrashIcon } from "../components/icons"
import { CommentDeleteConfirmation } from "./comment-delete-confirmation"
import { CommentOverflowMenu } from "./comment-overflow-menu"

type CommentThreadCardProps = {
  comment: CommentThread
  point: { x: number; y: number }
  deleteConfirmationOpen: boolean
  onRequestDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onSaveEdit: (messageId: string, text: string) => void
  replyText: string
  onReplyTextChange: (text: string) => void
  onAddMessage: (text: string) => void
  onClose?: () => void
  formatTime: (timestamp: number) => string
}

export function CommentThreadCard({
  comment,
  point,
  deleteConfirmationOpen,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onSaveEdit,
  replyText,
  onReplyTextChange,
  onAddMessage,
  onClose,
  formatTime,
}: CommentThreadCardProps) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [overflowOpenId, setOverflowOpenId] = useState<string | null>(null)
  const message = comment.messages[0]
  const [editText, setEditText] = useState(message?.text ?? "")
  const saveEdit = (messageId: string) => {
    if (!editText.trim()) return
    onSaveEdit(messageId, editText)
    setEditingMessageId(null)
  }
  const submitReply = () => {
    if (!replyText.trim()) return
    onAddMessage(replyText)
  }

  return (
    <div
      data-mesurer-comment-popover
      data-mesurer-comment-ui
      className="msr:pointer-events-auto msr:absolute msr:w-64 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-3 msr:pt-8 msr:text-[12px] msr:text-ink-900 msr:shadow-lg"
      style={{ left: point.x + 16, top: point.y - 40, paddingTop: 40 }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onClose?.()
        }
      }}
    >
      <div className="msr:absolute msr:inset-x-0 msr:top-0 msr:flex msr:h-7 msr:items-center msr:justify-end msr:gap-1 msr:border-b msr:border-ink-100 msr:px-2 msr:py-1">
        <button
          type="button"
          aria-label="Delete comment"
          className="msr:flex msr:size-5 msr:items-center msr:justify-center msr:rounded msr:bg-white msr:text-ink-500 msr:hover:bg-red-50 msr:hover:text-red-600"
          onClick={onRequestDelete}
        >
          <TrashIcon />
        </button>
        <button
          type="button"
          aria-label="Close comment"
          className="msr:flex msr:size-5 msr:items-center msr:justify-center msr:rounded msr:bg-white msr:text-ink-500 msr:hover:bg-ink-100 msr:hover:text-ink-900"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div>
        <div className="msr:min-w-0">
          {comment.messages.map((item, index) => (
            <div key={item.id} className={`msr:group msr:relative ${index === 0 ? "" : "msr:mt-4"}`}>
              <div className="msr:flex msr:items-center msr:justify-between msr:gap-2 msr:text-[11px] msr:text-ink-500">
                <span className="msr:font-medium msr:text-ink-700">You</span>
                <time dateTime={new Date(item.createdAt).toISOString()}>{formatTime(item.createdAt)}</time>
              </div>
              <div className="msr:relative">
                {editingMessageId === item.id ? (
                  <textarea
                    autoFocus
                    value={editText}
                    rows={1}
                    aria-label="Edit comment"
                    className="msr:mt-1 msr:block msr:min-h-6 msr:max-h-32 msr:w-full msr:resize-none msr:overflow-y-auto msr:rounded-md msr:border msr:border-ink-200 msr:p-2 msr:text-[12px] msr:outline-none msr:focus:border-[#0d99ff]"
                    style={{ fieldSizing: "content" }}
                    onChange={(event) => setEditText(event.currentTarget.value)}
                    onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                      if (event.key === "Escape") {
                        event.preventDefault()
                      setEditingMessageId(null)
                      } else if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                      saveEdit(item.id)
                      }
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                ) : (
                  <p className="msr:mt-1 msr:whitespace-pre-wrap">{item.text}</p>
                )}
                <button
                  type="button"
                  aria-label="Comment actions"
                  aria-expanded={overflowOpenId === item.id}
                  className="msr:absolute msr:right-0 msr:top-0 msr:flex msr:size-5 msr:items-center msr:justify-center msr:rounded msr:bg-white msr:text-ink-600 msr:opacity-0 msr:group-hover:opacity-100 msr:focus-visible:opacity-100 msr:hover:bg-ink-100"
                  onClick={() => setOverflowOpenId((value) => value === item.id ? null : item.id)}
                >
                  ...
                </button>
                {overflowOpenId === item.id ? (
                  <CommentOverflowMenu
                    commentId={comment.id}
                    onEdit={() => { setOverflowOpenId(null); setEditText(item.text); setEditingMessageId(item.id) }}
                    onDelete={() => { setOverflowOpenId(null); onRequestDelete() }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <textarea
        value={replyText}
        rows={1}
        placeholder="Reply..."
        aria-label="Reply to comment"
        className="msr:mt-3 msr:block msr:min-h-6 msr:max-h-32 msr:w-full msr:resize-none msr:overflow-y-auto msr:rounded-md msr:border msr:border-ink-200 msr:p-2 msr:text-[12px] msr:outline-none msr:focus:border-[#0d99ff]"
        style={{ fieldSizing: "content" }}
        onChange={(event) => onReplyTextChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            onClose?.()
          } else if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            submitReply()
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
      />

      {deleteConfirmationOpen ? (
        <CommentDeleteConfirmation onConfirm={onConfirmDelete} onCancel={onCancelDelete} />
      ) : null}
    </div>
  )
}

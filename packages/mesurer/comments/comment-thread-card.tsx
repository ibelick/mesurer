import { useState } from "react"
import type { CommentThread } from "./types"
import { CloseIcon, MoreIcon, SendIcon, TrashIcon } from "../components/icons"
import { CommentDeleteConfirmation } from "./comment-delete-confirmation"
import { CommentOverflowMenu } from "./comment-overflow-menu"
import { CommentComposer } from "./comment-composer"

type CommentThreadCardProps = {
  comment: CommentThread
  point: { x: number; y: number }
  deleteConfirmationOpen: boolean
  onRequestDelete: (commentId: string) => void
  messageDeleteConfirmationId: string | null
  onRequestDeleteMessage: (messageId: string) => void
  onConfirmDeleteMessage: (messageId: string) => void
  onCancelDeleteMessage: () => void
  onConfirmDelete: (commentId: string) => void
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
  messageDeleteConfirmationId,
  onRequestDeleteMessage,
  onConfirmDeleteMessage,
  onCancelDeleteMessage,
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
      className="msr:pointer-events-auto msr:absolute msr:cursor-default msr:w-64 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-3 msr:pt-8 msr:text-[12px] msr:text-ink-900 msr:shadow-lg"
      style={{ left: point.x + 16, top: point.y - 40, paddingTop: 40 }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onClose?.()
        }
      }}
    >
      <div className="msr:absolute msr:inset-x-0 msr:top-0 msr:flex msr:h-7 msr:items-center msr:justify-end msr:gap-1 msr:border-b msr:border-ink-100 msr:px-3 msr:py-1">
        <button
          type="button"
          aria-label="Delete comment"
          className="msr:flex msr:size-5 msr:items-center msr:justify-center msr:rounded msr:bg-white msr:text-ink-500 msr:hover:bg-red-50 msr:hover:text-red-600"
          onClick={() => onRequestDelete(comment.id)}
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
                  <CommentComposer
                    value={editText}
                    placeholder="Edit comment"
                    ariaLabel="Edit comment"
                    actionLabel="Save edit"
                    onChange={(event) => setEditText(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault()
                        setEditingMessageId(null)
                      } else if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        saveEdit(item.id)
                      }
                    }}
                    onSubmit={() => saveEdit(item.id)}
                  />
                ) : (
                  <p
                    className="msr:mt-1 msr:whitespace-pre-wrap"
                    style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                  >
                    {item.text}
                  </p>
                )}
                {editingMessageId !== item.id ? <button
                  type="button"
                  aria-label="Comment actions"
                  aria-expanded={overflowOpenId === item.id}
                   className="msr:absolute msr:right-0 msr:top-0 msr:flex msr:size-5 msr:items-center msr:justify-center msr:rounded msr:bg-white msr:text-ink-600 msr:leading-none msr:opacity-0 msr:group-hover:opacity-100 msr:focus-visible:opacity-100 msr:hover:bg-ink-100"
                  onClick={() =>
                    setOverflowOpenId((value) => (value === item.id ? null : item.id))
                  }
                >
                   <MoreIcon />
                </button> : null}
                {overflowOpenId === item.id ? (
                  <CommentOverflowMenu
                    commentId={comment.id}
                    onEdit={() => {
                      setOverflowOpenId(null)
                      setEditText(item.text)
                      setEditingMessageId(item.id)
                    }}
                    onDelete={() => {
                      setOverflowOpenId(null)
                      onRequestDeleteMessage(item.id)
                    }}
                  />
                ) : null}
                {messageDeleteConfirmationId === item.id ? (
                  <CommentDeleteConfirmation
                    commentId={item.id}
                    onConfirm={onConfirmDeleteMessage}
                    onCancel={onCancelDeleteMessage}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="msr:mt-3">
        <CommentComposer
          value={replyText}
          placeholder="Reply..."
          ariaLabel="Reply to comment"
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
          onSubmit={submitReply}
        />
      </div>

      {deleteConfirmationOpen ? (
        <CommentDeleteConfirmation commentId={comment.id} onConfirm={onConfirmDelete} onCancel={onCancelDelete} />
      ) : null}
    </div>
  )
}

import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from "react"
import type { CommentThread } from "./types"
import { CloseIcon, MoreIcon, SendIcon } from "../components/icons"
import { CommentDeleteConfirmation } from "./comment-delete-confirmation"
import { CommentOverflowMenu } from "./comment-overflow-menu"
import { CommentComposer } from "./comment-composer"
import { useOverlayPosition } from "../hooks/use-overlay-position"
import { copyCommentSelector } from "./export"

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
  onToggleResolved: (commentId: string) => void
  onClose?: () => void
  ownerWindow: Window | null
  formatTime: (timestamp: number) => string
  outsidePointerDownRef: MutableRefObject<() => boolean>
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
  onToggleResolved,
  onClose,
  ownerWindow,
  formatTime,
  outsidePointerDownRef,
}: CommentThreadCardProps) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [overflowOpenId, setOverflowOpenId] = useState<string | null>(null)
  const [threadOverflowOpen, setThreadOverflowOpen] = useState(false)
  const [nudge, setNudge] = useState(false)
  const outsideAttemptRef = useRef(false)
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
  useEffect(() => {
    outsidePointerDownRef.current = () => {
      const hasActiveInput = Boolean(replyText.trim()) ||
        (editingMessageId !== null && Boolean(editText.trim()))
      if (!hasActiveInput) return false
      if (!outsideAttemptRef.current) {
        outsideAttemptRef.current = true
        setNudge(true)
        return true
      }
      outsideAttemptRef.current = false
      onClose?.()
      return true
    }
    return () => {
      outsidePointerDownRef.current = () => false
    }
  }, [editText, editingMessageId, onClose, outsidePointerDownRef, replyText])
  const overlay = useOverlayPosition({
    ownerWindow,
    position: { left: point.x + 16, top: point.y - 12 },
    avoidRect: { left: point.x - 12, top: point.y - 12, width: 24, height: 24 },
    avoidAxis: "horizontal",
    gap: 4,
  })

  return (
    <div
      data-mesurer-comment-popover
      data-mesurer-comment-ui
      ref={overlay.overlayRef}
      className={`msr:pointer-events-auto msr:absolute msr:cursor-default msr:w-64 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-3 msr:pt-8 msr:text-[12px] msr:text-ink-900 msr:shadow-lg ${nudge ? "mesurer-comment-nudge" : ""}`}
      style={{ paddingTop: 40 }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        outsideAttemptRef.current = false
        setNudge(false)
        event.stopPropagation()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onClose?.()
        }
      }}
    >
      <div className="msr:absolute msr:inset-x-0 msr:top-0 msr:flex msr:h-7 msr:items-center msr:justify-end msr:gap-1 msr:border-b msr:border-ink-100 msr:pl-3 msr:pr-1.5 msr:py-1">
        <div className="msr:relative">
          <button
            type="button"
            aria-label="Comment actions"
            aria-expanded={threadOverflowOpen}
            className="msr:flex msr:size-5 msr:items-center msr:justify-center msr:rounded-control msr:bg-white msr:text-ink-500 msr:hover:bg-ink-100 msr:hover:text-ink-900"
            onClick={() => setThreadOverflowOpen((value) => !value)}
          >
            <MoreIcon />
          </button>
          {threadOverflowOpen ? (
            <CommentOverflowMenu
              commentId={comment.id}
              onCopySelector={() => {
                if (!ownerWindow) return
                void copyCommentSelector(comment.target.selector, ownerWindow).finally(() => {
                  setThreadOverflowOpen(false)
                })
              }}
              onDelete={() => {
                setThreadOverflowOpen(false)
                onRequestDelete(comment.id)
              }}
            />
          ) : null}
        </div>
        <button
          type="button"
          aria-label={comment.status === "resolved" ? "Reopen comment" : "Mark comment as resolved"}
          aria-pressed={comment.status === "resolved"}
          className={`msr:flex msr:size-5 msr:items-center msr:justify-center msr:rounded-control msr:bg-white msr:p-0 msr:outline-none msr:hover:bg-ink-100 msr:focus-visible:ring-2 msr:focus-visible:ring-ink-400 ${comment.status === "resolved" ? "msr:text-ink-700" : "msr:text-ink-500"}`}
          onClick={() => onToggleResolved(comment.id)}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.25" />
            <path d="m5.2 8 1.8 1.8 3.8-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Close comment"
          className="msr:flex msr:size-5 msr:items-center msr:justify-center msr:rounded-control msr:bg-white msr:p-0 msr:text-ink-500 msr:hover:bg-ink-100 msr:hover:text-ink-900"
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
                    onChange={(event) => {
                      outsideAttemptRef.current = false
                      setNudge(false)
                      setEditText(event.currentTarget.value)
                    }}
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
                  className="msr:absolute msr:right-0 msr:top-0 msr:flex msr:size-5 msr:items-center msr:justify-center msr:rounded-control msr:bg-white msr:text-ink-600 msr:leading-none msr:opacity-0 msr:group-hover:opacity-100 msr:focus-visible:opacity-100 msr:hover:bg-ink-100"
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
          onChange={(event) => {
            outsideAttemptRef.current = false
            setNudge(false)
            onReplyTextChange(event.currentTarget.value)
          }}
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

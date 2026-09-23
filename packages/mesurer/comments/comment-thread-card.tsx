import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent } from "react"
import type { CommentThread } from "./types"
import { CloseIcon, MoreIcon } from "../components/icons"
import { CommentDeleteConfirmation, readDeleteAnchor } from "./comment-delete-confirmation"
import { CommentOverflowMenu } from "./comment-overflow-menu"
import { CommentComposer } from "./comment-composer"
import { CommentIconButton } from "./comment-icon-button"
import { useOverlayPosition } from "../hooks/use-overlay-position"
import { useToolbarTooltip } from "../hooks/use-toolbar-tooltip"
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
  const tooltipGroup = useToolbarTooltip()
  const replyTextRef = useRef(replyText)
  const editTextRef = useRef(editText)
  replyTextRef.current = replyText
  editTextRef.current = editText
  const saveEdit = (messageId: string) => {
    if (!editText.trim()) return
    onSaveEdit(messageId, editText)
    setEditingMessageId(null)
  }
  const submitReply = () => {
    if (!replyText.trim()) return
    onAddMessage(replyText)
  }
  outsidePointerDownRef.current = () => {
    const hasActiveInput = Boolean(replyTextRef.current.trim()) ||
      (editingMessageId !== null && Boolean(editTextRef.current.trim()))
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
  const overlay = useOverlayPosition({
    ownerWindow,
    position: { left: point.x + 16, top: point.y - 12 },
    avoidRect: { left: point.x - 12, top: point.y - 12, width: 24, height: 24 },
    avoidAxis: "horizontal",
    gap: 4,
  })
  const overlayRoot =
    overlay.overlayRef.current?.closest("[data-mesurer-root]") ?? ownerWindow?.document.body ?? null
  const [cardAnchor, setCardAnchor] = useState<ReturnType<typeof readDeleteAnchor> | null>(null)
  const [threadMenuAnchor, setThreadMenuAnchor] = useState<ReturnType<typeof readDeleteAnchor> | null>(null)
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<ReturnType<typeof readDeleteAnchor> | null>(null)
  useEffect(() => {
    if (!ownerWindow || (!threadOverflowOpen && !overflowOpenId)) return
    const handleOutsidePointerDown = (event: Event) => {
      const isMenuEvent = event.composedPath().some((target) =>
        typeof (target as Element).matches === "function" &&
        (target as Element).matches("[data-mesurer-comment-overflow-menu], [data-mesurer-comment-actions]"),
      )
      if (isMenuEvent) return
      setThreadOverflowOpen(false)
      setOverflowOpenId(null)
      setThreadMenuAnchor(null)
      setMessageMenuAnchor(null)
    }
    ownerWindow.document.addEventListener("pointerdown", handleOutsidePointerDown, true)
    return () => ownerWindow.document.removeEventListener("pointerdown", handleOutsidePointerDown, true)
  }, [overflowOpenId, ownerWindow, threadOverflowOpen])
  useLayoutEffect(() => {
    const node = overlay.overlayRef.current
    if (!node || (!deleteConfirmationOpen && !messageDeleteConfirmationId)) return
    setCardAnchor(readDeleteAnchor(node))
  }, [deleteConfirmationOpen, messageDeleteConfirmationId])

  return (
    <div
      data-mesurer-comment-popover
      data-mesurer-comment-ui
      ref={overlay.overlayRef}
      className={`mesurer-comment-card msr:pointer-events-auto msr:absolute msr:cursor-default msr:w-64 msr:rounded-lg msr:bg-white msr:p-3 msr:pt-8 msr:text-[12px] msr:text-ink-900 msr:shadow-floating ${nudge ? "mesurer-comment-nudge" : ""}`}
      style={{ paddingTop: 40 }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        outsideAttemptRef.current = false
        setNudge(false)
        event.stopPropagation()
      }}
      onMouseLeave={tooltipGroup.onToolbarLeave}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onClose?.()
        }
      }}
    >
      <div className="msr:absolute msr:inset-x-0 msr:top-0 msr:flex msr:h-7 msr:items-center msr:justify-end msr:gap-1 msr:border-b msr:border-ink-100 msr:pl-3 msr:pr-1.5 msr:py-1">
        <div className="msr:relative">
          <CommentIconButton
            data-mesurer-comment-actions="true"
            label="Comment actions"
            tooltip="More"
            tooltipId="comment-thread-more"
            tooltipGroup={tooltipGroup}
            aria-expanded={threadOverflowOpen}
            onClick={(event) => {
              const anchor = readDeleteAnchor(event.currentTarget)
              setThreadOverflowOpen((value) => {
                if (value) {
                  setThreadMenuAnchor(null)
                  return false
                }
                setOverflowOpenId(null)
                setMessageMenuAnchor(null)
                setThreadMenuAnchor(anchor)
                return true
              })
            }}
          >
            <MoreIcon />
          </CommentIconButton>
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
        <CommentIconButton
          label={comment.status === "resolved" ? "Reopen comment" : "Mark comment as resolved"}
          tooltip={comment.status === "resolved" ? "Reopen" : "Mark as resolved"}
          tooltipId="comment-thread-resolve"
          tooltipGroup={tooltipGroup}
          aria-pressed={comment.status === "resolved"}
          className={comment.status === "resolved" ? "msr:text-ink-700" : "msr:text-ink-500"}
          onClick={() => onToggleResolved(comment.id)}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" className="msr:block">
            <circle cx="8" cy="8" r="5.5" fill={comment.status === "resolved" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.25" />
            <path d="m5.2 8 1.8 1.8 3.8-4" stroke={comment.status === "resolved" ? "var(--msr-surface)" : "currentColor"} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </CommentIconButton>
        <CommentIconButton
          label="Close comment"
          tooltip="Close"
          tooltipId="comment-thread-close"
          tooltipGroup={tooltipGroup}
          onClick={onClose}
        >
          <CloseIcon />
        </CommentIconButton>
      </div>

      <div>
        <div className="msr:min-w-0">
          {comment.messages.map((item, index) => (
            <div key={item.id} className={`msr:group msr:relative ${index === 0 ? "" : "msr:mt-3"}`}>
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
                    tooltipGroup={tooltipGroup}
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
                    className="msr:mt-0.5 msr:pr-6 msr:whitespace-pre-wrap"
                    style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                  >
                    {item.text}
                  </p>
                )}
                {editingMessageId !== item.id ? (
                  <CommentIconButton
                    data-mesurer-comment-actions="true"
                    label="Comment actions"
                    tooltip="More"
                    tooltipId={`comment-message-more-${item.id}`}
                    tooltipGroup={tooltipGroup}
                    aria-expanded={overflowOpenId === item.id}
                    wrapperClassName={`msr:absolute msr:right-0 msr:top-0.5 ${overflowOpenId === item.id ? "msr:opacity-100" : "msr:opacity-0 msr:group-hover:opacity-100 msr:focus-within:opacity-100"}`}
                    onClick={(event) => {
                      const anchor = readDeleteAnchor(event.currentTarget)
                      setOverflowOpenId((value) => {
                        if (value === item.id) {
                          setMessageMenuAnchor(null)
                          return null
                        }
                        setThreadOverflowOpen(false)
                        setThreadMenuAnchor(null)
                        setMessageMenuAnchor(anchor)
                        return item.id
                      })
                    }}
                  >
                    <MoreIcon />
                  </CommentIconButton>
                ) : null}
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
                {messageDeleteConfirmationId === item.id && ownerWindow && (messageMenuAnchor ?? cardAnchor) ? (
                  <CommentDeleteConfirmation
                    commentId={item.id}
                    ownerWindow={ownerWindow}
                    anchor={messageMenuAnchor ?? cardAnchor}
                    portalTarget={overlayRoot}
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
          tooltipGroup={tooltipGroup}
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

      {deleteConfirmationOpen && ownerWindow && (threadMenuAnchor ?? cardAnchor) ? (
        <CommentDeleteConfirmation
          commentId={comment.id}
          ownerWindow={ownerWindow}
          anchor={threadMenuAnchor ?? cardAnchor}
          portalTarget={overlayRoot}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      ) : null}
    </div>
  )
}

import { useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from "react"
import type { CommentDraft } from "./state"
import type { CommentThread, Rect } from "./types"

type CommentsLayerProps = {
  comments: CommentThread[]
  rects: ReadonlyMap<string, Rect>
  unresolvedIds: ReadonlySet<string>
  hoverRect: Rect | null
  hoverPoint: { x: number; y: number } | null
  draft: CommentDraft | null
  selectedId: string | null
  draftText: string
  onDraftTextChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  onDraftKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onSelect: (id: string) => void
  onAddMessage: (id: string, text: string) => void
  onDelete: (id: string) => void
  onClose?: () => void
  movingId: string | null
  onStartMove: (id: string, event: PointerEvent<HTMLElement>) => void
  onMoveComment: (event: PointerEvent<HTMLElement>) => void
  onEndMove: (event: PointerEvent<HTMLElement>) => void
  onDraftPointerDown: (event: PointerEvent<HTMLTextAreaElement>) => void
}

const markerPoint = (
  rect: Rect,
  anchor?: { x: number; y: number },
  point?: { x: number; y: number } | null,
) => ({
  x: point?.x ?? rect.left + rect.width * (anchor?.x ?? 1),
  y: point?.y ?? rect.top + rect.height * (anchor?.y ?? 0),
})

const markerStyle = (point: { x: number; y: number }) => ({
  left: Math.max(4, point.x - 12),
  top: Math.max(4, point.y - 12),
})

export function CommentsLayer({
  comments,
  rects,
  unresolvedIds,
  hoverRect,
  hoverPoint,
  draft,
  selectedId,
  draftText,
  onDraftTextChange,
  onDraftKeyDown,
  onSelect,
  onAddMessage,
  onDelete,
  onClose,
  movingId,
  onStartMove,
  onMoveComment,
  onEndMove,
  onDraftPointerDown,
}: CommentsLayerProps) {
  const [replyText, setReplyText] = useState("")
  const selected = comments.find((comment) => comment.id === selectedId) ?? null
  const selectedRect = selected ? rects.get(selected.id) ?? selected.target.rect : null
  const selectedPoint = selected && selectedRect
    ? markerPoint(
        selectedRect,
        selected.target.anchor,
        movingId === selected.id ? hoverPoint : null,
      )
    : null
  const draftRect = draft?.target.rect ?? null

  return (
    <div className="msr:pointer-events-none msr:absolute msr:inset-0 msr:z-[60]" data-mesurer-comment-ui aria-hidden={false}>
      {hoverRect ? (
        <div
          data-mesurer-comment-highlight
          data-mesurer-comment-ui
          className="msr:pointer-events-none msr:absolute msr:border msr:border-[#0d99ff] msr:bg-[#0d99ff]/8"
          style={hoverRect}
        />
      ) : null}

      {comments.map((comment, index) => {
        const rect = rects.get(comment.id) ?? comment.target.rect
        const unresolved = unresolvedIds.has(comment.id)
        const active = selectedId === comment.id
        const point = markerPoint(
          rect,
          comment.target.anchor,
          movingId === comment.id ? hoverPoint : null,
        )
        return (
          <button
            key={comment.id}
            type="button"
            data-mesurer-comment-pin
            aria-label={`Comment ${index + 1}`}
            className={`msr:pointer-events-auto msr:absolute msr:flex msr:size-6 msr:items-center msr:justify-center msr:rounded-full msr:border-2 msr:border-white msr:text-[11px] msr:font-semibold msr:shadow-md msr:outline-none ${
              unresolved
                ? "msr:bg-ink-400 msr:text-white"
                : active
                  ? "msr:bg-[#0d99ff] msr:text-white"
                  : "msr:bg-[#0d99ff] msr:text-white msr:hover:bg-[#087dcc]"
            }`}
            style={markerStyle(point)}
            onPointerDown={(event) => onStartMove(comment.id, event)}
            onPointerMove={onMoveComment}
            onPointerUp={onEndMove}
            onPointerCancel={onEndMove}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                onClose?.()
              }
            }}
            onClick={() => onSelect(comment.id)}
          >
            {index + 1}
          </button>
        )
      })}

      {selected && selectedPoint ? (
        <div
          data-mesurer-comment-popover
          data-mesurer-comment-ui
          className="msr:pointer-events-auto msr:absolute msr:w-64 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-3 msr:text-[12px] msr:text-ink-900 msr:shadow-lg"
          style={{ left: selectedPoint.x + 16, top: selectedPoint.y - 12 }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              onClose?.()
            }
          }}
        >
          {selected.messages.map((message) => (
            <p key={message.id} className="msr:whitespace-pre-wrap">{message.text}</p>
          ))}
          <textarea
            value={replyText}
            rows={2}
            placeholder="Reply"
            aria-label="Reply to comment"
            className="msr:mt-2 msr:block msr:w-full msr:resize-none msr:rounded-md msr:border msr:border-ink-200 msr:p-2 msr:text-[12px] msr:outline-none msr:focus:border-[#0d99ff]"
            onChange={(event) => setReplyText(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                onClose?.()
                return
              }
              if (event.key !== "Enter" || event.shiftKey) return
              event.preventDefault()
              if (!replyText.trim()) return
              onAddMessage(selected.id, replyText)
              setReplyText("")
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="msr:mt-2 msr:text-[11px] msr:text-red-600 msr:hover:text-red-700"
            onClick={() => onDelete(selected.id)}
          >
            Delete comment
          </button>
        </div>
      ) : null}

      {draft && draftRect ? (
        <div
          data-mesurer-comment-popover
          data-mesurer-comment-ui
          className="msr:pointer-events-auto msr:absolute msr:w-64 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-2 msr:shadow-lg"
          style={{ left: draftRect.left + draftRect.width + 16, top: draftRect.top }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              onClose?.()
            }
          }}
        >
          <textarea
            value={draftText}
            autoFocus
            rows={3}
            placeholder="Leave a comment"
            aria-label="Comment"
            className="msr:block msr:w-full msr:resize-none msr:rounded-md msr:border msr:border-ink-200 msr:p-2 msr:text-[12px] msr:text-ink-900 msr:outline-none msr:focus:border-[#0d99ff]"
            onChange={onDraftTextChange}
            onKeyDown={onDraftKeyDown}
            onPointerDown={onDraftPointerDown}
          />
          <div className="msr:mt-2 msr:text-[11px] msr:text-ink-500">Enter to save · Esc to cancel</div>
        </div>
      ) : null}
    </div>
  )
}

import { useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from "react"
import type { CommentDraft } from "./state"
import type { CommentThread, Rect } from "./types"
import { CommentHoverCard } from "./comment-hover-card"
import { CommentThreadCard } from "./comment-thread-card"
import { CommentComposer } from "./comment-composer"

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
  onDraftSubmit: () => void
  onSelect: (id: string) => void
  onClickComment: (id: string) => string | undefined
  onAddMessage: (id: string, text: string) => void
  onDelete: (id: string) => void
  onDeleteMessage: (commentId: string, messageId: string) => void
  onEditMessage: (commentId: string, messageId: string, text: string) => void
  onClose?: () => void
  movingId: string | null
  onStartMove: (id: string, event: PointerEvent<HTMLElement>) => void
  onMoveComment: (event: PointerEvent<HTMLElement>) => void
  onEndMove: (event: PointerEvent<HTMLElement>) => void
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

const formatRelativeTime = (timestamp: number, now = Date.now()) => {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? "day" : "days"} ago`
}

const targetKey = (comment: CommentThread) => comment.target.selector

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
  onDraftSubmit,
  onSelect,
  onClickComment,
  onAddMessage,
  onDelete,
  onDeleteMessage,
  onEditMessage,
  onClose,
  movingId,
  onStartMove,
  onMoveComment,
  onEndMove,
}: CommentsLayerProps) {
  const [replyText, setReplyText] = useState("")
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)
  const [messageDeleteConfirmationId, setMessageDeleteConfirmationId] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<number | null>(null)
  const selected = comments.find((comment) => comment.id === selectedId) ?? null
  const selectedRect = selected ? rects.get(selected.id) ?? selected.target.rect : null
  const selectedPoint = selected && selectedRect
    ? markerPoint(selectedRect, selected.target.anchor, movingId === selected.id ? hoverPoint : null)
    : null
  const hovered = comments.find((comment) => comment.id === hoveredId) ?? null
  const hoveredRect = hovered ? rects.get(hovered.id) ?? hovered.target.rect : null
  const hoveredPoint = hovered && hoveredRect ? markerPoint(hoveredRect, hovered.target.anchor) : null
  const movingComment = movingId ? comments.find((comment) => comment.id === movingId) ?? null : null
  const movingRect = movingComment ? rects.get(movingComment.id) ?? movingComment.target.rect : null
  const movingPoint = movingComment && movingRect && hoverPoint
    ? markerPoint(movingRect, movingComment.target.anchor, hoverPoint)
    : null
  const previewComment = movingComment ?? hovered
  const previewPoint = movingPoint ?? hoveredPoint
  const previewGroup = previewComment
    ? comments.filter((comment) => targetKey(comment) === targetKey(previewComment))
    : []
  const showHover = () => {
    if (hoverTimeoutRef.current !== null) window.clearTimeout(hoverTimeoutRef.current)
  }
  const hideHover = () => {
    hoverTimeoutRef.current = window.setTimeout(() => setHoveredId(null), 120)
  }

  return (
    <div
      className="msr:pointer-events-none msr:absolute msr:inset-0 msr:z-[60]"
      data-mesurer-comment-ui
      aria-hidden={false}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && (deleteConfirmationId || messageDeleteConfirmationId)) {
          event.preventDefault()
          event.stopPropagation()
          setDeleteConfirmationId(null)
          setMessageDeleteConfirmationId(null)
        }
      }}
    >
      {hoverRect && !draft && (movingId || (!hoveredId && !selectedId)) ? (
        <div data-mesurer-comment-highlight data-mesurer-comment-ui className="msr:pointer-events-none msr:absolute msr:border msr:border-[#0d99ff] msr:bg-[#0d99ff]/8" style={hoverRect} />
      ) : null}

      {comments.map((comment, index) => {
        const rect = rects.get(comment.id) ?? comment.target.rect
        const point = markerPoint(rect, comment.target.anchor, movingId === comment.id ? hoverPoint : null)
        const active = selectedId === comment.id
        const unresolved = unresolvedIds.has(comment.id)
        return (
          <button
            key={comment.id}
            type="button"
            data-mesurer-comment-pin
            aria-label={`Comment ${index + 1}`}
            className={`msr:pointer-events-auto msr:absolute msr:flex msr:size-6 msr:items-center msr:justify-center msr:rounded-full msr:border-2 msr:border-white msr:text-[11px] msr:font-semibold msr:shadow-md msr:outline-none ${unresolved ? "msr:bg-ink-400 msr:text-white" : active ? "msr:bg-[#0d99ff] msr:text-white" : "msr:bg-[#0d99ff] msr:text-white msr:hover:bg-[#087dcc]"}`}
            style={markerStyle(point)}
            onPointerDown={(event) => {
              onStartMove(comment.id, event)
            }}
            onPointerMove={onMoveComment}
            onPointerUp={onEndMove}
            onPointerCancel={onEndMove}
            onKeyDown={(event) => event.key === "Escape" && onClose?.()}
            onMouseEnter={() => { showHover(); setHoveredId(comment.id) }}
            onMouseLeave={hideHover}
            onClick={() => {
              const clickedId = onClickComment(comment.id)
              if (clickedId) onSelect(clickedId)
            }}
          >
            {index + 1}
          </button>
        )
      })}

      {previewComment && previewPoint && previewComment.id !== selectedId ? (
        <CommentHoverCard
          comments={previewGroup}
          point={previewPoint}
          formatTime={formatRelativeTime}
          onEnter={() => { if (!movingId && hovered) { showHover(); setHoveredId(hovered.id) } }}
          onLeave={hideHover}
        />
      ) : null}

      {selected && selectedPoint ? (
        <CommentThreadCard
          comment={selected}
          point={selectedPoint}
          deleteConfirmationOpen={deleteConfirmationId === selected.id}
          onRequestDelete={(commentId) => setDeleteConfirmationId(commentId)}
          onConfirmDelete={(commentId) => { onDelete(commentId); setDeleteConfirmationId(null) }}
          onCancelDelete={() => setDeleteConfirmationId(null)}
          messageDeleteConfirmationId={messageDeleteConfirmationId}
          onRequestDeleteMessage={setMessageDeleteConfirmationId}
          onConfirmDeleteMessage={(messageId) => { onDeleteMessage(selected.id, messageId); setMessageDeleteConfirmationId(null) }}
          onCancelDeleteMessage={() => setMessageDeleteConfirmationId(null)}
          onSaveEdit={(messageId, text) => onEditMessage(selected.id, messageId, text)}
          replyText={replyText}
          onReplyTextChange={setReplyText}
          onAddMessage={(text) => { onAddMessage(selected.id, text); setReplyText("") }}
          onClose={onClose}
          formatTime={formatRelativeTime}
        />
      ) : null}

      {draft ? (
        <div data-mesurer-comment-popover data-mesurer-comment-ui className="msr:pointer-events-auto msr:absolute msr:w-64 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-2 msr:shadow-lg" style={{ left: draft.point.x + 16, top: draft.point.y - 12 }} onPointerDown={(event) => event.stopPropagation()}>
          <CommentComposer value={draftText} placeholder="Leave a comment" ariaLabel="Comment" onChange={onDraftTextChange} onKeyDown={onDraftKeyDown} onSubmit={onDraftSubmit} />
        </div>
      ) : null}
    </div>
  )
}

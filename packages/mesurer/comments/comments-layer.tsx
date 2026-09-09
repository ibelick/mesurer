import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from "react"
import type { CommentDraft } from "./state"
import type { CommentThread, Rect } from "./types"
import { CommentHoverCard } from "./comment-hover-card"
import { CommentThreadCard } from "./comment-thread-card"
import { CommentComposer } from "./comment-composer"
import { useOverlayPosition } from "../hooks/use-overlay-position"
import { getRectFromDom } from "../core/dom"
import { getCommentTargetKey, isRectEqual } from "./dom"

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
  onDraftCancel: () => void
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
  ownerDocument: Document
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

const targetKey = (comment: CommentThread) => getCommentTargetKey(comment.target)

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
  onDraftCancel,
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
  ownerDocument,
}: CommentsLayerProps) {
  const [replyText, setReplyText] = useState("")
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)
  const [messageDeleteConfirmationId, setMessageDeleteConfirmationId] = useState<string | null>(null)
  const [draftRect, setDraftRect] = useState<Rect | null>(null)
  const [draftNudge, setDraftNudge] = useState(false)
  const draftOutsideAttemptRef = useRef(false)
  const selectedOutsidePointerDownRef = useRef<() => boolean>(() => false)
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
  useEffect(() => {
    if (!draft || !draftText.trim()) {
      draftOutsideAttemptRef.current = false
      setDraftNudge(false)
    }
  }, [draft, draftText])

  useEffect(() => {
    if (!draft) {
      setDraftRect(null)
      return
    }
    const ownerWindow = ownerDocument.defaultView
    if (!ownerWindow) return
    let frame: number | null = null
    const update = () => {
      const next = getRectFromDom(draft.element)
      setDraftRect((previous) => previous && isRectEqual(previous, next) ? previous : next)
      frame = ownerWindow.requestAnimationFrame(update)
    }
    update()
    return () => {
      if (frame !== null) ownerWindow.cancelAnimationFrame(frame)
    }
  }, [draft?.element, ownerDocument])

  const showHover = () => {
    if (hoverTimeoutRef.current !== null) window.clearTimeout(hoverTimeoutRef.current)
  }
  const hideHover = () => {
    hoverTimeoutRef.current = window.setTimeout(() => setHoveredId(null), 120)
  }
  const draftOverlay = useOverlayPosition({
    ownerWindow: ownerDocument.defaultView,
    position: draft
      ? { left: draft.point.x + 16, top: draft.point.y - 12 }
      : { left: 0, top: 0 },
    avoidRect: draft
      ? { left: draft.point.x - 12, top: draft.point.y - 12, width: 24, height: 24 }
      : undefined,
    gap: 4,
    enabled: draft !== null,
  })

  useEffect(() => {
    if ((!selectedId && !draft) || (!onClose && !onDraftCancel)) return
    const handlePointerDown = (event: Event) => {
      const pointerEvent = event as globalThis.PointerEvent
      const draftRect = draftOverlay.overlayRef.current?.getBoundingClientRect()
      const clickedDraft = draftRect
        ? pointerEvent.clientX >= draftRect.left &&
          pointerEvent.clientX <= draftRect.right &&
          pointerEvent.clientY >= draftRect.top &&
          pointerEvent.clientY <= draftRect.bottom
        : false
      if (clickedDraft) {
        draftOutsideAttemptRef.current = false
        setDraftNudge(false)
      }
      if (draft && !clickedDraft) {
        event.preventDefault()
        event.stopPropagation()
        if (draftText.trim() && !draftOutsideAttemptRef.current) {
          draftOutsideAttemptRef.current = true
          setDraftNudge(true)
          return
        }
        onDraftCancel()
        if (selectedId) onClose?.()
        return
      }
      const clickedCommentUi = event.composedPath().some((target) => {
        if (!target || typeof target !== "object" || !("getAttribute" in target)) return false
        const element = target as Element
        return (
          element.getAttribute("data-mesurer-comment-ui") !== null &&
          element.getAttribute("data-mesurer-comments-layer") === null
        )
      })
      if (clickedCommentUi) return
      if (selectedId && selectedOutsidePointerDownRef.current()) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (draft || selectedId) {
        event.preventDefault()
        event.stopPropagation()
      }
      if (draft) onDraftCancel()
      if (selectedId) onClose?.()
    }
    const eventTarget = ownerDocument.defaultView ?? ownerDocument
    eventTarget.addEventListener("pointerdown", handlePointerDown, true)
    return () => eventTarget.removeEventListener("pointerdown", handlePointerDown, true)
  }, [draft, draftText, onClose, onDraftCancel, ownerDocument, selectedId])

  return (
    <div
      className="msr:pointer-events-none msr:absolute msr:inset-0 msr:z-[60]"
      data-mesurer-comment-ui
      data-mesurer-comments-layer
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
      {draft ? (
        <div
          data-mesurer-comment-draft-target
          data-mesurer-comment-ui
          className="msr:pointer-events-none msr:absolute msr:border msr:border-[#0d99ff] msr:bg-[#0d99ff]/8"
          style={draftRect ?? draft.target.rect}
        />
      ) : null}
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
            data-mesurer-comment-ui
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
          ownerWindow={ownerDocument.defaultView}
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
          ownerWindow={ownerDocument.defaultView}
          formatTime={formatRelativeTime}
          outsidePointerDownRef={selectedOutsidePointerDownRef}
        />
      ) : null}

      {draft ? (
        <>
          <div
            className="msr:pointer-events-auto msr:absolute msr:inset-0"
            onPointerDown={(event) => {
              event.stopPropagation()
              onDraftCancel()
            }}
          />
          <div
            ref={draftOverlay.overlayRef}
            data-mesurer-comment-popover
            data-mesurer-comment-ui
            className={`msr:pointer-events-auto msr:absolute msr:z-[1] msr:w-64 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-2 msr:shadow-lg ${draftNudge ? "mesurer-comment-nudge" : ""}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <CommentComposer
              value={draftText}
              placeholder="Leave a comment"
              ariaLabel="Comment"
              onChange={(event) => {
                draftOutsideAttemptRef.current = false
                setDraftNudge(false)
                onDraftTextChange(event)
              }}
              onKeyDown={onDraftKeyDown}
              onSubmit={onDraftSubmit}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

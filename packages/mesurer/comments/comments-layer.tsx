import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from "react"
import type { CommentDraft } from "./state"
import type { CommentFilter, CommentThread, Rect } from "./types"
import { CommentHoverCard } from "./comment-hover-card"
import { CommentThreadCard } from "./comment-thread-card"
import { CommentComposer } from "./comment-composer"
import { useOverlayPosition } from "../hooks/use-overlay-position"
import { getRectFromDom } from "../core/dom"
import { isRectEqual } from "./dom"
import { addMesurerCaptureListener } from "../core/keyboard-gate"

type CommentsLayerProps = {
  comments: CommentThread[]
  commentFilter: CommentFilter
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
  onToggleResolved: (id: string) => void
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

const MARKER_SIZE = 24
const MARKER_OFFSET_DISTANCE = 18
const MARKER_OFFSETS = [
  { x: 0, y: 0 },
  { x: MARKER_OFFSET_DISTANCE, y: 0 },
  { x: -MARKER_OFFSET_DISTANCE, y: 0 },
  { x: 0, y: MARKER_OFFSET_DISTANCE },
  { x: 0, y: -MARKER_OFFSET_DISTANCE },
  { x: MARKER_OFFSET_DISTANCE, y: MARKER_OFFSET_DISTANCE },
  { x: -MARKER_OFFSET_DISTANCE, y: MARKER_OFFSET_DISTANCE },
  { x: MARKER_OFFSET_DISTANCE, y: -MARKER_OFFSET_DISTANCE },
  { x: -MARKER_OFFSET_DISTANCE, y: -MARKER_OFFSET_DISTANCE },
]

const markerStyleWithOffset = (
  point: { x: number; y: number },
  offsetIndex: number,
  viewport: { innerWidth: number; innerHeight: number } | null,
) => {
  const offset = MARKER_OFFSETS[offsetIndex] ?? {
    x: 0,
    y: MARKER_OFFSET_DISTANCE * Math.ceil(offsetIndex / 2),
  }
  return {
    left: Math.min(
      Math.max(4, point.x - 12 + offset.x),
      Math.max(4, (viewport?.innerWidth ?? Number.POSITIVE_INFINITY) - 28),
    ),
    top: Math.min(
      Math.max(4, point.y - 12 + offset.y),
      Math.max(4, (viewport?.innerHeight ?? Number.POSITIVE_INFINITY) - 28),
    ),
  }
}

const targetKey = (comment: CommentThread) =>
  `${(comment.target.framePath ?? []).join("/")}::${(comment.target.frameShadowPaths ?? []).map((path) => path.join("/")).join("|")}::${(comment.target.shadowPath ?? []).join("/")}::${comment.target.selector}`

const formatRelativeTime = (timestamp: number, now = Date.now()) => {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? "day" : "days"} ago`
}

const isCommentChromeEvent = (event: Event) =>
  event.composedPath().some((node) => {
    if (!(node instanceof Element)) return false
    return (
      node.hasAttribute("data-mesurer-comment-pin") ||
      node.hasAttribute("data-mesurer-comment-popover") ||
      (node.hasAttribute("data-mesurer-comment-ui") && !node.hasAttribute("data-mesurer-comments-layer"))
    )
  })

export function CommentsLayer({
  comments,
  commentFilter,
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
  onToggleResolved,
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
  const visibleComments = comments.filter((comment) =>
    commentFilter === "all" || comment.status === commentFilter,
  )
  const selected = visibleComments.find((comment) => comment.id === selectedId) ?? null
  const selectedRect = selected ? rects.get(selected.id) ?? selected.target.rect : null
  const selectedPoint = selected && selectedRect
    ? markerPoint(selectedRect, selected.target.anchor, movingId === selected.id ? hoverPoint : null)
    : null
  const hovered = visibleComments.find((comment) => comment.id === hoveredId) ?? null
  const hoveredRect = hovered ? rects.get(hovered.id) ?? hovered.target.rect : null
  const hoveredPoint = hovered && hoveredRect ? markerPoint(hoveredRect, hovered.target.anchor) : null
  const movingComment = movingId ? visibleComments.find((comment) => comment.id === movingId) ?? null : null
  const movingRect = movingComment ? rects.get(movingComment.id) ?? movingComment.target.rect : null
  const movingPoint = movingComment && movingRect && hoverPoint
    ? markerPoint(movingRect, movingComment.target.anchor, hoverPoint)
    : null
  const previewComment = movingComment ?? hovered
  const previewPoint = movingPoint ?? hoveredPoint
  const previewGroup = previewComment ? [previewComment] : []
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
      if (isCommentChromeEvent(event)) return
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
    const view = ownerDocument.defaultView
    if (!view) return
    return addMesurerCaptureListener(view, view, "pointerdown", handlePointerDown)
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

      {visibleComments.map((comment, index) => {
        const rect = rects.get(comment.id) ?? comment.target.rect
        const point = markerPoint(rect, comment.target.anchor, movingId === comment.id ? hoverPoint : null)
            const duplicateIndex = visibleComments
              .slice(0, index)
          .filter((candidate) => {
            if (targetKey(candidate) !== targetKey(comment)) return false
            const candidateRect = rects.get(candidate.id) ?? candidate.target.rect
            const candidatePoint = markerPoint(
              candidateRect,
              candidate.target.anchor,
              movingId === candidate.id ? hoverPoint : null,
            )
            return Math.abs(candidatePoint.x - point.x) < MARKER_SIZE &&
              Math.abs(candidatePoint.y - point.y) < MARKER_SIZE
          })
          .length
        const active = selectedId === comment.id
        const unresolved = unresolvedIds.has(comment.id)
        return (
          <button
            key={comment.id}
            type="button"
            data-mesurer-comment-pin
            data-mesurer-comment-ui
            aria-label={`Comment ${index + 1}`}
             className={`msr:pointer-events-auto msr:absolute msr:flex msr:size-6 msr:items-center msr:justify-center msr:rounded-full msr:border-2 msr:border-white msr:text-[11px] msr:font-semibold msr:outline-none ${unresolved ? "msr:bg-ink-400 msr:text-white" : active ? "msr:bg-[#0d99ff] msr:text-white" : "msr:bg-[#0d99ff] msr:text-white msr:hover:bg-[#087dcc]"}`}
            style={{
              ...markerStyleWithOffset(
                point,
                movingId === comment.id ? 0 : duplicateIndex,
                ownerDocument.defaultView,
              ),
              opacity: comment.status === "resolved" ? 0.45 : 1,
            }}
            onPointerDown={(event) => {
              event.stopPropagation()
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
          onToggleResolved={(id) => {
            onToggleResolved(id)
            if (selected.status === "open") onClose?.()
          }}
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
             className={`msr:pointer-events-auto msr:absolute msr:z-[1] msr:w-64 msr:rounded-lg msr:bg-white msr:p-2 msr:shadow-floating ${draftNudge ? "mesurer-comment-nudge" : ""}`}
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

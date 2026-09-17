import type { CommentThread } from "./types"
import { useOverlayPosition } from "../hooks/use-overlay-position"

type CommentHoverCardProps = {
  comments: CommentThread[]
  point: { x: number; y: number }
  formatTime: (timestamp: number) => string
  onEnter: () => void
  onLeave: () => void
  ownerWindow: Window | null
}

export function CommentHoverCard({
  comments,
  point,
  formatTime,
  onEnter,
  onLeave,
  ownerWindow,
}: CommentHoverCardProps) {
  const replyCount = comments.reduce(
    (count, comment) => count + Math.max(0, comment.messages.length - 1),
    0,
  )
  const overlay = useOverlayPosition({
    ownerWindow,
    position: { left: point.x + 16, top: point.y - 12 },
    avoidRect: { left: point.x - 12, top: point.y - 12, width: 24, height: 24 },
    avoidAxis: "horizontal",
    gap: 4,
  })

  return (
    <div
      data-mesurer-comment-hover-card
      data-mesurer-comment-ui
      ref={overlay.overlayRef}
      className="msr:pointer-events-auto msr:absolute msr:w-64 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-3 msr:text-[12px] msr:text-ink-900 msr:shadow-floating"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="msr:max-h-48 msr:overflow-y-auto">
        {comments.map((comment, index) => {
          const message = comment.messages[0]
          if (!message) return null
          return (
            <div key={comment.id} className={index === 0 ? "" : "msr:mt-4"}>
              <div className="msr:flex msr:items-center msr:justify-between msr:gap-2 msr:text-[11px] msr:text-ink-500">
                <span className="msr:font-medium msr:text-ink-700">You</span>
                <time dateTime={new Date(message.createdAt).toISOString()}>{formatTime(message.createdAt)}</time>
              </div>
              <div
                className="msr:mt-1 msr:whitespace-pre-wrap"
                style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                {message.text}
              </div>
            </div>
          )
        })}
        {replyCount > 0 ? (
          <div className="msr:mt-1 msr:text-[11px] msr:text-ink-500">
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </div>
        ) : null}
      </div>
    </div>
  )
}

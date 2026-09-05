import type { CommentThread } from "./types"

type CommentHoverCardProps = {
  comments: CommentThread[]
  point: { x: number; y: number }
  formatTime: (timestamp: number) => string
  onEnter: () => void
  onLeave: () => void
}

export function CommentHoverCard({
  comments,
  point,
  formatTime,
  onEnter,
  onLeave,
}: CommentHoverCardProps) {
  return (
    <div
      data-mesurer-comment-hover-card
      data-mesurer-comment-ui
      className="msr:pointer-events-auto msr:absolute msr:w-64 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-3 msr:text-[12px] msr:text-ink-900 msr:shadow-lg"
      style={{ left: point.x + 16, top: point.y - 12 }}
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
              <div className="msr:mt-1 msr:whitespace-pre-wrap">{message.text}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

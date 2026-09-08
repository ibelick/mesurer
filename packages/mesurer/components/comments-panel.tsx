import type { CommentThread } from "../comments/types"
import type { RefObject } from "react"
import { useEffect, useState } from "react"
import { CommentDeleteConfirmation } from "../comments/comment-delete-confirmation"
import { TextInput } from "./text-input"
import { SettingsButton } from "./settings-button"
import { CheckIcon } from "./icons"

const formatCommentDate = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - timestamp) / 60000))
  if (elapsedMinutes < 60) return `${elapsedMinutes || 1}m ago`
  if (date.toDateString() === now.toDateString()) return `${Math.round(elapsedMinutes / 60)}h ago`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  if (date.toDateString() === yesterday.toDateString()) return `yesterday at ${time}`
  return `${date.toLocaleDateString([], { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" })} at ${time}`
}

export function CommentsPanel({
  comments,
  unresolvedIds,
  selectedId,
  onSelect,
  onCopy,
  ownerWindow,
  copyShortcut,
  onDelete,
  panelRef,
  placement,
}: {
  comments: CommentThread[]
  unresolvedIds: ReadonlySet<string>
  selectedId: string | null
  onSelect: (id: string) => void
  onCopy: () => void | Promise<void>
  ownerWindow: Window
  copyShortcut: string
  onDelete: (id: string) => void
  panelRef: RefObject<HTMLDivElement | null>
  placement: { side: "top" | "bottom"; height: number; right: number }
}) {
  const orderedComments = [...comments].sort((a, b) => b.updatedAt - a.updatedAt)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredComments = normalizedQuery
    ? orderedComments.filter((comment) =>
        comment.messages.some((message) => message.text.toLowerCase().includes(normalizedQuery)),
      )
    : orderedComments

  useEffect(() => {
    const handleCopied = () => {
      setCopied(true)
      ownerWindow.setTimeout(() => setCopied(false), 1800)
    }
    ownerWindow.addEventListener("mesurer:comments-copied", handleCopied)
    return () => ownerWindow.removeEventListener("mesurer:comments-copied", handleCopied)
  }, [ownerWindow])

  useEffect(() => {
    if (!openMenuId) return
    const ownerDocument = panelRef.current?.ownerDocument
    if (!ownerDocument) return
    const handlePointerDown = (event: PointerEvent) => {
      const clickedMenu = event.composedPath().some((target) => {
        if (!target || typeof target !== "object" || !("getAttribute" in target)) return false
        return (target as Element).getAttribute("data-mesurer-comment-actions") !== null
      })
      if (!clickedMenu) setOpenMenuId(null)
    }
    ownerDocument.addEventListener("pointerdown", handlePointerDown, true)
    return () => ownerDocument.removeEventListener("pointerdown", handlePointerDown, true)
  }, [openMenuId, panelRef])

  return (
    <div ref={panelRef} role="dialog" aria-label="Comments" className={`msr:absolute msr:right-0 msr:z-[70] msr:flex msr:w-72 msr:flex-col msr:overflow-hidden msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-0 msr:shadow-lg ${placement.side === "bottom" ? "msr:top-full msr:mt-2" : "msr:bottom-full msr:mb-2"}`} style={{ right: placement.right, height: placement.height, maxHeight: placement.height }} data-mesurer-comment-ui onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <div className="msr:flex msr:items-center msr:justify-between msr:px-3 msr:py-1">
        <div>
          <h2 className="msr:text-[11px] msr:font-semibold msr:text-ink-500">Comments</h2>
        </div>
        <SettingsButton
          type="button"
          className="msr:h-6 msr:gap-1.5"
          aria-label={copied ? "Comments copied" : "Copy comments"}
          rightIcon={copied ? <CheckIcon size={12} /> : <span className="msr:font-normal msr:text-[11px] msr:leading-none msr:text-ink-500">{copyShortcut}</span>}
          onClick={async () => {
            await onCopy()
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
          }}
        >
          <span>Copy comments</span>
        </SettingsButton>
      </div>
      <div className="msr:px-3 msr:py-1">
        <TextInput
          type="search"
          aria-label="Search comments"
          placeholder="Search comments"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          leftIcon={<svg aria-hidden="true" viewBox="0 0 16 16" className="msr:size-3 msr:text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" strokeLinecap="round" /></svg>}
        />
      </div>
      {filteredComments.length > 0 ? (
        <ul className="mesurer-thin-scrollbar msr:m-0 msr:flex msr:flex-col msr:overflow-y-auto msr:p-0" aria-label="Comment threads">
          {filteredComments.map((comment) => {
            const message = comment.messages[0]
            const replyCount = Math.max(0, comment.messages.length - 1)
            const unresolved = unresolvedIds.has(comment.id)
            const selected = selectedId === comment.id
            return (
              <li key={comment.id} className="msr:relative">
                <div className={`msr:px-3 msr:py-1.5 ${selected ? "msr:bg-ink-50" : "msr:hover:bg-ink-50"}`}>
                  <div className="msr:flex msr:items-start msr:justify-between msr:gap-2">
                    <button type="button" className="msr:flex msr:min-w-0 msr:flex-1 msr:flex-col msr:items-start msr:gap-1 msr:text-left msr:outline-none msr:focus-visible:ring-2 msr:focus-visible:ring-inset msr:focus-visible:ring-ink-400" aria-current={selected ? "true" : undefined} onClick={() => onSelect(comment.id)}>
                      <span className="msr:text-[11px] msr:font-medium msr:text-ink-700">You</span>
                      <span className="msr:text-[10px] msr:text-ink-500">{formatCommentDate(comment.updatedAt)}</span>
                      <span className="msr:line-clamp-2 msr:w-full msr:text-[11px] msr:leading-4 msr:text-ink-700">{message?.text ?? "Empty comment"}</span>
                      <span className="msr:text-[10px] msr:text-ink-500">{replyCount} {replyCount === 1 ? "reply" : "replies"}{unresolved ? " · target not found" : ""}</span>
                    </button>
                    <button type="button" data-mesurer-comment-actions aria-label={`Actions for comment: ${message?.text ?? "Empty comment"}`} aria-expanded={openMenuId === comment.id} className="msr:flex msr:size-6 msr:shrink-0 msr:items-center msr:justify-center msr:rounded-control msr:text-[14px] msr:text-ink-500 msr:outline-none msr:hover:bg-black/5 msr:focus-visible:ring-2 msr:focus-visible:ring-ink-400" onClick={() => setOpenMenuId((value) => value === comment.id ? null : comment.id)}>
                      <span aria-hidden="true">...</span>
                    </button>
                  </div>
                  {openMenuId === comment.id ? (
                    <div role="menu" aria-label="Comment actions" data-mesurer-comment-actions className="msr:absolute msr:right-2 msr:top-9 msr:z-[1] msr:w-32 msr:rounded-md msr:border msr:border-ink-200 msr:bg-white msr:p-1 msr:shadow-lg" onPointerDown={(event) => event.stopPropagation()}>
                      <button type="button" role="menuitem" className="msr:flex msr:w-full msr:rounded-[4px] msr:px-2 msr:py-1.5 msr:text-left msr:text-[12px] msr:text-red-600 msr:hover:bg-red-50" onClick={() => { setOpenMenuId(null); setDeleteId(comment.id) }}>Delete</button>
                    </div>
                  ) : null}
                  {deleteId === comment.id ? <CommentDeleteConfirmation commentId={comment.id} onConfirm={(id) => { onDelete(id); setDeleteId(null) }} onCancel={() => setDeleteId(null)} /> : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : <p className="msr:px-3 msr:py-6 msr:text-center msr:text-[12px] msr:text-ink-500">{normalizedQuery ? "No matching comments." : "No comments yet."}</p>}
    </div>
  )
}

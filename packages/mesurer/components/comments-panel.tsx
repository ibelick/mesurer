import type { CommentThread } from "../comments/types"
import type { RefObject } from "react"
import { createPortal } from "react-dom"
import { useEffect, useState } from "react"
import { CommentDeleteConfirmation } from "../comments/comment-delete-confirmation"
import { TextInput } from "./text-input"
import { SettingsButton } from "./settings-button"
import { CheckIcon, MoreIcon } from "./icons"

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
  onDeleteAll,
  ownerWindow,
  copyShortcut,
  onDelete,
  panelRef,
  placement,
  fixed = false,
}: {
  comments: CommentThread[]
  unresolvedIds: ReadonlySet<string>
  selectedId: string | null
  onSelect: (id: string) => void
  onCopy: () => void | Promise<void>
  onDeleteAll: () => void
  ownerWindow: Window
  copyShortcut: string
  onDelete: (id: string) => void
  panelRef: RefObject<HTMLDivElement | null>
  placement: { side: "top" | "bottom"; height: number; right: number; top?: number; bottom?: number }
  fixed?: boolean
}) {
  const orderedComments = [...comments].sort((a, b) => b.updatedAt - a.updatedAt)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [commentMenuPosition, setCommentMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [deletePosition, setDeletePosition] = useState<{ top: number; right: number } | null>(null)
  const [deleteAllPosition, setDeleteAllPosition] = useState<{ top: number; right: number } | null>(null)
  const [listMenuPosition, setListMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredComments = normalizedQuery
    ? orderedComments.filter((comment) =>
        comment.messages.some((message) => message.text.toLowerCase().includes(normalizedQuery)),
      )
    : orderedComments
  const portalTarget = panelRef.current ?? ownerWindow.document.body

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
    <div ref={panelRef} role="dialog" aria-label="Comments" className={`${fixed ? "msr:fixed" : "msr:absolute"} msr:right-0 msr:z-[70] msr:flex msr:w-72 msr:flex-col ${openMenuId || deleteId || deleteAllOpen ? "msr:overflow-visible" : "msr:overflow-hidden"} msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-0 msr:shadow-lg ${!fixed && (placement.side === "bottom" ? "msr:top-full msr:mt-2" : "msr:bottom-full msr:mb-2")}`} style={{ position: fixed ? "fixed" : "absolute", width: fixed ? "18rem" : undefined, zIndex: fixed ? 70 : undefined, pointerEvents: "auto", right: placement.right, top: placement.top, bottom: placement.bottom, height: placement.height, maxHeight: placement.height }} data-mesurer-comment-ui onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
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
        <div className="msr:relative msr:flex msr:items-center msr:gap-1.5">
          <TextInput
            type="search"
            aria-label="Search comments"
            placeholder="Search comments"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            containerClassName="msr:min-w-0 msr:flex-1"
            leftIcon={<svg aria-hidden="true" viewBox="0 0 16 16" className="msr:size-3 msr:text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" strokeLinecap="round" /></svg>}
          />
          <button
            type="button"
            data-mesurer-comment-actions
            aria-label="Comment list actions"
            aria-expanded={openMenuId === "all"}
            className="msr:flex msr:size-6 msr:shrink-0 msr:items-center msr:justify-center msr:rounded-control msr:text-[14px] msr:leading-none msr:text-ink-500 msr:outline-none msr:hover:bg-black/5 msr:focus-visible:ring-2 msr:focus-visible:ring-ink-400"
            onClick={(event) => {
              if (openMenuId === "all") {
                setOpenMenuId(null)
                return
              }
              const panel = panelRef.current
              const buttonRect = event.currentTarget.getBoundingClientRect()
              if (panel) {
                setDeleteAllPosition({
                  top: buttonRect.bottom + 4,
                  right: ownerWindow.innerWidth - buttonRect.right,
                })
                setListMenuPosition({
                  top: buttonRect.bottom + 4,
                  right: ownerWindow.innerWidth - buttonRect.right,
                })
              }
              setOpenMenuId("all")
            }}
          >
            <MoreIcon size={12} />
          </button>
        </div>
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
                    <button type="button" data-mesurer-comment-actions aria-label={`Actions for comment: ${message?.text ?? "Empty comment"}`} aria-expanded={openMenuId === comment.id} className="msr:flex msr:size-6 msr:shrink-0 msr:items-center msr:justify-center msr:rounded-control msr:text-[14px] msr:text-ink-500 msr:outline-none msr:hover:bg-black/5 msr:focus-visible:ring-2 msr:focus-visible:ring-ink-400" onClick={(event) => {
                      if (openMenuId === comment.id) {
                        setOpenMenuId(null)
                        return
                      }
                      const panel = panelRef.current
                      if (panel) {
                        const buttonRect = event.currentTarget.getBoundingClientRect()
                        setCommentMenuPosition({
                          top: buttonRect.top - 4,
                          right: ownerWindow.innerWidth - buttonRect.right,
                        })
                      }
                      setOpenMenuId(comment.id)
                    }}>
                      <MoreIcon size={12} />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : <p className="msr:px-3 msr:py-6 msr:text-center msr:text-[12px] msr:text-ink-500">{normalizedQuery ? "No matching comments." : "No comments yet."}</p>}
      {openMenuId && openMenuId !== "all" && commentMenuPosition ? (
        createPortal(<div
          role="menu"
          aria-label="Comment actions"
          data-mesurer-comment-actions
          data-mesurer-comment-ui
           className="msr:pointer-events-auto msr:fixed msr:z-[100] msr:w-32 msr:-translate-y-full msr:rounded-md msr:border msr:border-ink-200 msr:bg-white msr:p-1 msr:shadow-lg"
           style={{ position: "fixed", zIndex: 100, pointerEvents: "auto", width: "8rem", top: commentMenuPosition.top, right: commentMenuPosition.right }}
          onPointerDown={(event) => event.stopPropagation()}
        >
           <button type="button" role="menuitem" className="msr:flex msr:w-full msr:rounded-[4px] msr:px-2 msr:py-1.5 msr:text-left msr:text-[12px] msr:text-red-600 msr:hover:bg-red-50" onClick={(event) => { event.stopPropagation(); setDeletePosition(commentMenuPosition); setOpenMenuId(null); setDeleteId(openMenuId) }}>Delete</button>
        </div>, portalTarget)
      ) : null}
      {openMenuId === "all" && listMenuPosition ? (
        createPortal(<div
          role="menu"
          aria-label="Comment list actions"
          data-mesurer-comment-actions
          data-mesurer-comment-ui
           className="msr:pointer-events-auto msr:fixed msr:z-[100] msr:w-40 msr:rounded-md msr:border msr:border-ink-200 msr:bg-white msr:p-1 msr:shadow-lg"
           style={{ position: "fixed", zIndex: 100, pointerEvents: "auto", width: "10rem", top: listMenuPosition.top, right: listMenuPosition.right }}
          onPointerDown={(event) => event.stopPropagation()}
        >
           <button type="button" role="menuitem" className="msr:flex msr:w-full msr:rounded-[4px] msr:px-2 msr:py-1.5 msr:text-left msr:text-[11px] msr:text-red-600 msr:hover:bg-red-50" onClick={(event) => { event.stopPropagation(); setOpenMenuId(null); setDeleteAllOpen(true) }}>Delete all comments</button>
        </div>, portalTarget)
      ) : null}
      {deleteId && deletePosition ? (
        createPortal(<div
          data-mesurer-comment-ui
          className="msr:pointer-events-auto msr:fixed msr:z-[100] msr:-translate-y-full"
          style={{ top: deletePosition.top, right: deletePosition.right }}
        >
          <CommentDeleteConfirmation
            commentId={deleteId}
            floating
            onConfirm={(id) => { onDelete(id); setDeleteId(null); setDeletePosition(null) }}
            onCancel={() => { setDeleteId(null); setDeletePosition(null) }}
          />
        </div>, portalTarget)
      ) : null}
      {deleteAllOpen && deleteAllPosition ? (
        createPortal(<div
          data-mesurer-comment-ui
          className="msr:pointer-events-auto msr:fixed msr:z-[100]"
          style={{ top: deleteAllPosition.top, right: deleteAllPosition.right }}
        >
          <CommentDeleteConfirmation
            commentId="all"
            message="Do you want to delete all comments?"
            floating
            onConfirm={() => { onDeleteAll(); setDeleteAllOpen(false); setDeleteAllPosition(null) }}
            onCancel={() => { setDeleteAllOpen(false); setDeleteAllPosition(null) }}
          />
        </div>, portalTarget)
      ) : null}
    </div>
  )
}

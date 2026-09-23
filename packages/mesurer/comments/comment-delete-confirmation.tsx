import { createPortal } from "react-dom"
import { useEffect, useRef } from "react"
import { addMesurerCaptureListener } from "../core/keyboard-gate"
import { cn } from "../core/utils"
import { useOverlayPosition } from "../hooks/use-overlay-position"
import { SettingsButton } from "../components/settings-button"

export type DeleteAnchorRect = {
  left: number
  top: number
  width: number
  height: number
}

type CommentDeleteConfirmationProps = {
  commentId: string
  onConfirm: (commentId: string) => void
  onCancel: () => void
  message?: string
  floating?: boolean
  ownerWindow?: Window | null
  anchor?: DeleteAnchorRect | null
  portalTarget?: Element | DocumentFragment | null
}

const CONFIRMATION_WIDTH = 192

export const readDeleteAnchor = (node: Element): DeleteAnchorRect => {
  const rect = node.getBoundingClientRect()
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

export const findDeleteConfirmation = (view: Window) => {
  const roots: ParentNode[] = [view.document]
  const host = view.document.getElementById("mesurer-extension-host")
  if (host?.shadowRoot) roots.push(host.shadowRoot)
  for (const root of roots) {
    const confirmation = root.querySelector("[data-mesurer-comment-delete-confirmation]")
    if (confirmation) return confirmation
  }
  return null
}

export function CommentDeleteConfirmation({
  commentId,
  onConfirm,
  onCancel,
  message = "Do you want to delete this comment?",
  floating = false,
  ownerWindow = null,
  anchor = null,
  portalTarget = null,
}: CommentDeleteConfirmationProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  const anchored = Boolean(anchor && ownerWindow)
  const overlay = useOverlayPosition({
    ownerWindow: ownerWindow ?? null,
    position: anchor
      ? {
          left: anchor.left + anchor.width - CONFIRMATION_WIDTH,
          top: anchor.top + anchor.height + 4,
        }
      : { left: 0, top: 0 },
    avoidRect: anchor ?? undefined,
    avoidAxis: "vertical",
    gap: 4,
    enabled: anchored,
  })

  useEffect(() => {
    const node = dialogRef.current
    const view = ownerWindow ?? node?.ownerDocument.defaultView
    if (!view) return
    return addMesurerCaptureListener(view, view, "pointerdown", (event) => {
      if (!node || event.composedPath().includes(node)) return
      event.preventDefault()
      event.stopPropagation()
      if ("stopImmediatePropagation" in event) event.stopImmediatePropagation()
      onCancelRef.current()
    })
  }, [ownerWindow])

  const dialog = (
    <div
      data-mesurer-comment-delete-confirmation
      data-mesurer-comment-ui
      className={cn(
        "mesurer-comment-delete-confirmation msr:w-48 msr:rounded-lg msr:bg-white msr:p-3 msr:shadow-floating msr:outline-none",
        anchored
          ? "msr:pointer-events-auto msr:fixed msr:z-100"
          : floating
            ? "msr:relative msr:z-10"
            : "msr:absolute msr:right-2 msr:top-9 msr:z-10",
      )}
      role="dialog"
      aria-label="Delete comment"
      tabIndex={-1}
      autoFocus
      ref={(node) => {
        dialogRef.current = node
        if (anchored) overlay.overlayRef.current = node
        node?.focus()
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <p className="msr:text-[12px] msr:text-ink-900">{message}</p>
      <div className="msr:mt-3 msr:flex msr:justify-end msr:gap-2">
        <button
          type="button"
          className="msr:rounded-control msr:px-2 msr:py-1 msr:text-[11px] msr:text-ink-600 msr:hover:bg-ink-200"
          onClick={onCancel}
        >
          No
        </button>
        <SettingsButton
          variant="danger-solid"
          type="button"
          className="msr:h-auto msr:py-1"
          onClick={() => onConfirm(commentId)}
        >
          Yes
        </SettingsButton>
      </div>
    </div>
  )

  if (anchored && portalTarget) return createPortal(dialog, portalTarget)
  return dialog
}

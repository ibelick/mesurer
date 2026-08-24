import { memo, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react"
import type { TextAnnotation } from "../core/types"

type TextLayerProps = {
  items: TextAnnotation[]
  scrollOffset: { x: number; y: number }
  draft: { x: number; y: number } | null
  draftValue: string
  draftInputRef: RefObject<HTMLTextAreaElement | null>
  selectedIds: string[]
  interactive: boolean
  onSelect: (id: string) => void
  onMoveStart: () => void
  onMove: (id: string, x: number, y: number) => void
  onEdit: (id: string) => void
  onDraftChange: (value: string) => void
  onDraftKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onDraftBlur: () => void
}

export const TextLayer = memo(function TextLayer({
  items,
  scrollOffset,
  draft,
  draftValue,
  draftInputRef,
  onDraftChange,
  onDraftKeyDown,
  onDraftBlur,
  selectedIds,
  interactive,
  onSelect,
  onMoveStart,
  onMove,
  onEdit,
}: TextLayerProps) {
  const dragRef = useRef<{ id: string; startX: number; startY: number; itemX: number; itemY: number } | null>(null)

  useLayoutEffect(() => {
    if (!draftInputRef.current) return
    draftInputRef.current.style.height = "auto"
    draftInputRef.current.style.height = `${draftInputRef.current.scrollHeight}px`
  }, [draft, draftInputRef, draftValue])
  if (items.length === 0 && !draft) return null

  return (
    <div className="msr:absolute msr:inset-0 msr:pointer-events-none" data-mesurer-text-layer="true">
      {items.map((item) => (
        <div
          key={item.id}
          style={{ left: item.x - scrollOffset.x, top: item.y - scrollOffset.y }}
          onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
            if (!interactive) return
            event.preventDefault()
            event.stopPropagation()
            onSelect(item.id)
            onMoveStart()
            dragRef.current = {
              id: item.id,
              startX: event.clientX,
              startY: event.clientY,
              itemX: item.x,
              itemY: item.y,
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current
            if (!drag || drag.id !== item.id) return
            onMove(drag.id, drag.itemX + event.clientX - drag.startX, drag.itemY + event.clientY - drag.startY)
          }}
          onPointerUp={(event) => {
            if (dragRef.current?.id !== item.id) return
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            dragRef.current = null
          }}
          onDoubleClick={(event) => {
            if (!interactive) return
            event.preventDefault()
            event.stopPropagation()
            onEdit(item.id)
          }}
          className={`msr:absolute msr:whitespace-pre msr:text-[16px] msr:leading-6 msr:text-black ${
            interactive ? "msr:pointer-events-auto msr:cursor-pointer" : "msr:pointer-events-none"
          } ${selectedIds.includes(item.id) ? "msr:outline msr:outline-1 msr:outline-[#0d99ff]" : ""}`}
          data-mesurer-text="true"
          data-mesurer-text-id={item.id}
        >
          {item.text}
        </div>
      ))}
      {draft ? (
        <textarea
          ref={draftInputRef}
          value={draftValue}
          onChange={(event) => {
            event.currentTarget.style.height = "auto"
            event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`
            onDraftChange(event.target.value)
          }}
          onKeyDown={onDraftKeyDown}
          onBlur={onDraftBlur}
          autoFocus
          aria-label="Text annotation"
          rows={1}
          className="msr:pointer-events-auto msr:absolute msr:min-h-6 msr:min-w-32 msr:resize-none msr:overflow-hidden msr:border msr:border-[#0d99ff] msr:bg-white msr:px-1 msr:text-[16px] msr:leading-6 msr:text-black msr:outline-none"
          style={{ left: draft.x - scrollOffset.x, top: draft.y - scrollOffset.y }}
          data-mesurer-text-input="true"
        />
      ) : null}
    </div>
  )
})

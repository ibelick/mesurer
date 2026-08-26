import {
  memo,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
} from "react"
import type { TextAnnotation } from "../core/types"

type TextDraft = { id?: string; key?: string; x: number; y: number; caretX?: number; caretY?: number }

type TextLayerProps = {
  items: TextAnnotation[]
  scrollOffset: { x: number; y: number }
  draft: TextDraft | null
  draftInputRef: MutableRefObject<HTMLElement | null>
  interactive: boolean
  editable: boolean
  selectedIds: string[]
  onSelect: (id: string) => void
  onMoveStart: () => void
  onMove: (id: string, x: number, y: number) => void
  onEdit: (id: string, x: number, y: number) => void
  onDraftKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onDraftBlur: () => void
  onActivateEditor: (element: HTMLElement) => void
}

const editorClassName =
  "msr:pointer-events-auto msr:absolute msr:min-h-6 msr:min-w-32 msr:w-max msr:h-max msr:overflow-hidden msr:whitespace-pre msr:border-0 msr:bg-transparent msr:px-0 msr:text-[16px] msr:leading-6 msr:text-black msr:outline-none msr:cursor-text"

export const readEditableText = (element: HTMLElement | null) => {
  if (!element) return ""
  return (element.innerText ?? element.textContent ?? "").replace(/\r\n/g, "\n").replace(/\n$/, "")
}

const placeCaretAtPoint = (element: HTMLElement, x: number, y: number) => {
  const ownerDocument = element.ownerDocument
  const selection = getSelectionFor(element)
  if (!selection) return

  let range: Range | null = null
  if (typeof ownerDocument.caretRangeFromPoint === "function") {
    range = ownerDocument.caretRangeFromPoint(x, y)
  } else {
    const position = (
      ownerDocument as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
      }
    ).caretPositionFromPoint?.(x, y)
    if (position) {
      range = ownerDocument.createRange()
      range.setStart(position.offsetNode, position.offset)
      range.collapse(true)
    }
  }
  if (!range || !element.contains(range.startContainer)) return
  selection.removeAllRanges()
  selection.addRange(range)
}

const selectionIsIn = (element: HTMLElement) => {
  const selection = getSelectionFor(element)
  return Boolean(selection?.anchorNode && element.contains(selection.anchorNode))
}

const getSelectionFor = (element: HTMLElement) => {
  const root = element.getRootNode()
  if (root instanceof ShadowRoot && "getSelection" in root) {
    const selection = (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.()
    if (selection) return selection
  }
  return element.ownerDocument.defaultView?.getSelection() ?? null
}

const insertPlainText = (element: HTMLElement, value: string) => {
  element.focus()
  const selection = getSelectionFor(element)
  const canInsertCommand = value !== "\n"
  if (canInsertCommand && element.ownerDocument.execCommand("insertText", false, value)) return
  if (!selection) {
    element.append(value)
    return
  }
  if (selection.rangeCount === 0) {
    const range = element.ownerDocument.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.addRange(range)
  }
  const range = selection.getRangeAt(0)
  range.deleteContents()
  const node = element.ownerDocument.createTextNode(value)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

export const TextLayer = memo(function TextLayer({
  items,
  scrollOffset,
  draft,
  draftInputRef,
  onDraftKeyDown,
  onDraftBlur,
  onActivateEditor,
  interactive,
  editable,
  selectedIds,
  onSelect,
  onMoveStart,
  onMove,
  onEdit,
}: TextLayerProps) {
  const dragRef = useRef<{ id: string; startX: number; startY: number; itemX: number; itemY: number } | null>(null)
  const initializedDraftRef = useRef<object | null>(null)

  useLayoutEffect(() => {
    if (!draft) {
      initializedDraftRef.current = null
      return
    }
    const input = draftInputRef.current
    if (!input) return
    if (initializedDraftRef.current === draft) return
    initializedDraftRef.current = draft

    if (selectionIsIn(input)) return
    if (draft.caretX !== undefined && draft.caretY !== undefined) {
      placeCaretAtPoint(input, draft.caretX, draft.caretY)
      return
    }
    input.focus()
  }, [draft, draftInputRef])

  const handleEditorPaste = (event: ClipboardEvent<HTMLElement>) => {
    event.preventDefault()
    insertPlainText(event.currentTarget, event.clipboardData.getData("text/plain"))
  }

  const handleEditorBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget
    if (next instanceof HTMLElement && next.closest("[data-mesurer-text], [data-mesurer-text-input]")) return
    onDraftBlur()
  }

  if (items.length === 0 && !draft) return null

  return (
    <div className="msr:absolute msr:inset-0 msr:pointer-events-none" data-mesurer-text-layer="true">
      {items.map((item) => {
        const editing = draft?.id === item.id
        return (
          <TextItem
            key={item.id}
            item={item}
            scrollOffset={scrollOffset}
            editing={editing}
            draftInputRef={draftInputRef}
            interactive={interactive}
            editable={editable}
            selected={selectedIds.includes(item.id)}
            dragRef={dragRef}
            onSelect={onSelect}
            onMoveStart={onMoveStart}
            onMove={onMove}
            onEdit={onEdit}
            onKeyDown={onDraftKeyDown}
            onPaste={handleEditorPaste}
            onBlur={handleEditorBlur}
            onActivateEditor={onActivateEditor}
          />
        )
      })}
      {draft && !draft.id ? (
        <div
          key={draft.key}
          ref={(element) => {
            draftInputRef.current = element
            if (element) onActivateEditor(element)
          }}
          role="textbox"
          aria-label="Text annotation"
          contentEditable="plaintext-only"
          suppressContentEditableWarning
          autoFocus
          spellCheck={false}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={onDraftKeyDown}
          onPaste={handleEditorPaste}
          onBlur={handleEditorBlur}
          className={editorClassName}
          style={{ left: draft.x - scrollOffset.x, top: draft.y - scrollOffset.y }}
          data-mesurer-text-input="true"
        />
      ) : null}
    </div>
  )
})

function TextItem({
  item,
  scrollOffset,
  editing,
  draftInputRef,
  interactive,
  editable,
  selected,
  dragRef,
  onSelect,
  onMoveStart,
  onMove,
  onEdit,
  onKeyDown,
  onPaste,
  onBlur,
  onActivateEditor,
}: {
  item: TextAnnotation
  scrollOffset: { x: number; y: number }
  editing: boolean
  draftInputRef: MutableRefObject<HTMLElement | null>
  interactive: boolean
  editable: boolean
  selected: boolean
  dragRef: MutableRefObject<{ id: string; startX: number; startY: number; itemX: number; itemY: number } | null>
  onSelect: (id: string) => void
  onMoveStart: () => void
  onMove: (id: string, x: number, y: number) => void
  onEdit: (id: string, x: number, y: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onPaste: (event: ClipboardEvent<HTMLElement>) => void
  onBlur: (event: FocusEvent<HTMLElement>) => void
  onActivateEditor: (element: HTMLElement) => void
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const seededRef = useRef(false)

  useLayoutEffect(() => {
    const node = nodeRef.current
    if (!node || editing) return
    if (readEditableText(node) !== item.text) {
      node.textContent = item.text
    }
  }, [editing, item.text])

  return (
    <div
      ref={(element) => {
        if (element && !seededRef.current) {
          element.textContent = item.text
          seededRef.current = true
        }
        nodeRef.current = element
        if (editing && element) {
          draftInputRef.current = element
          onActivateEditor(element)
        } else if (draftInputRef.current === element) {
          draftInputRef.current = null
        }
      }}
      role={editing ? "textbox" : undefined}
      aria-label={editing ? "Text annotation" : undefined}
      contentEditable={editing || editable ? "plaintext-only" : "false"}
      suppressContentEditableWarning
      spellCheck={false}
      style={{ left: item.x - scrollOffset.x, top: item.y - scrollOffset.y }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        if (!interactive && !editable) return
        event.stopPropagation()
        if (editable) {
          if (!editing) onEdit(item.id, event.clientX, event.clientY)
          return
        }
        event.preventDefault()
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
        onEdit(item.id, event.clientX, event.clientY)
      }}
      onKeyDown={editing || editable ? onKeyDown : undefined}
      onPaste={editing || editable ? onPaste : undefined}
      onBlur={editing ? onBlur : undefined}
      className={`msr:absolute msr:whitespace-pre msr:w-max msr:h-max msr:text-[16px] msr:leading-6 msr:text-black ${
        editing ? editorClassName : interactive || editable ? "msr:pointer-events-auto msr:cursor-text" : "msr:pointer-events-none"
      } ${selected && !editing ? "msr:outline msr:outline-1 msr:outline-[#0d99ff] msr:outline-offset-1" : ""}`}
      data-mesurer-text="true"
      data-mesurer-text-id={item.id}
      data-mesurer-text-input={editing ? "true" : undefined}
    />
  )
}

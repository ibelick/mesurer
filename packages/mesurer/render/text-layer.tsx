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
import {
  boxCenter,
  isWidthHandle,
  resizeWidthBox,
  scaleBox,
  scaledFont,
  rotationFromPointer,
  type ResizeHandle,
} from "../core/text-transform"
import { TextTransformFrame } from "./text-transform-frame"

type TextDraft = { id?: string; key?: string; x: number; y: number; caretX?: number; caretY?: number }

type TextLayerProps = {
  items: TextAnnotation[]
  scrollOffset: { x: number; y: number }
  draft: TextDraft | null
  draftInputRef: MutableRefObject<HTMLElement | null>
  interactive: boolean
  editable: boolean
  selectedIds: string[]
  moveOffset?: { x: number; y: number }
  onSelect: (id: string, additive?: boolean) => void
  onMoveStart: (id: string) => void
  onMove: (id: string, dx: number, dy: number) => void
  onMoveEnd?: () => void
  onChangeStart?: () => void
  onTransform: (
    id: string,
    next: { x: number; y: number; scale?: number; rotation?: number; boxWidth?: number },
  ) => void
  onEdit: (id: string, x: number, y: number) => void
  onDraftKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onDraftBlur: () => void
  onActivateEditor: (element: HTMLElement) => void
  fontFamily: string
  color: string
  selectionCount: number
}

type TextDrag =
  | { type: "move"; id: string; startX: number; startY: number; itemX: number; itemY: number; moved: boolean }
  | {
      type: "resize"
      id: string
      handle: ResizeHandle
      width: number
      height: number
      x: number
      y: number
      rotation: number
      scale: number
      boxWidth?: number
    }
  | { type: "rotate"; id: string; centerX: number; centerY: number; offset: number }

const editorClassName =
  "msr:pointer-events-auto msr:absolute msr:min-h-6 msr:min-w-32 msr:w-max msr:h-max msr:overflow-hidden msr:whitespace-pre msr:border-0 msr:bg-transparent msr:px-0 msr:text-[16px] msr:leading-6 msr:outline-none msr:cursor-text"

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
  moveOffset = { x: 0, y: 0 },
  onSelect,
  onMoveStart,
  onMove,
  onMoveEnd,
  onChangeStart,
  onTransform,
  onEdit,
  fontFamily,
  color,
  selectionCount,
}: TextLayerProps) {
  const dragRef = useRef<TextDrag | null>(null)
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
            showTransformControls={selectedIds.length === 1}
            selectionCount={selectionCount}
            dragRef={dragRef}
            onSelect={onSelect}
            onMoveStart={onMoveStart}
            onMove={onMove}
            onMoveEnd={onMoveEnd}
            onChangeStart={onChangeStart}
            moveOffset={selectedIds.includes(item.id) ? moveOffset : { x: 0, y: 0 }}
            onTransform={onTransform}
            onEdit={onEdit}
            onKeyDown={onDraftKeyDown}
            onPaste={handleEditorPaste}
            onBlur={handleEditorBlur}
            onActivateEditor={onActivateEditor}
            fontFamily={fontFamily}
            color={color}
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
          style={{ left: draft.x - scrollOffset.x, top: draft.y - scrollOffset.y, fontFamily, color }}
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
  showTransformControls,
  dragRef,
  onSelect,
  onMoveStart,
  onMove,
  onMoveEnd,
  moveOffset,
  onChangeStart,
  onTransform,
  onEdit,
  onKeyDown,
  onPaste,
  onBlur,
  onActivateEditor,
  fontFamily,
  color,
  selectionCount,
}: {
  item: TextAnnotation
  scrollOffset: { x: number; y: number }
  editing: boolean
  draftInputRef: MutableRefObject<HTMLElement | null>
  interactive: boolean
  editable: boolean
  selected: boolean
  showTransformControls: boolean
  selectionCount: number
  dragRef: MutableRefObject<TextDrag | null>
  onSelect: (id: string, additive?: boolean) => void
  onMoveStart: (id: string) => void
  onMove: (id: string, dx: number, dy: number) => void
  onMoveEnd?: () => void
  onChangeStart?: () => void
  moveOffset: { x: number; y: number }
  onTransform: (
    id: string,
    next: { x: number; y: number; scale?: number; rotation?: number; boxWidth?: number },
  ) => void
  onEdit: (id: string, x: number, y: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onPaste: (event: ClipboardEvent<HTMLElement>) => void
  onBlur: (event: FocusEvent<HTMLElement>) => void
  onActivateEditor: (element: HTMLElement) => void
  fontFamily: string
  color: string
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const seededRef = useRef(false)
  const lastPointerDownRef = useRef(0)
  const rotation = item.rotation ?? 0
  const scale = item.scale ?? 1
  const boxWidth = item.boxWidth
  const typeStyle = scaledFont(scale)

  useLayoutEffect(() => {
    const node = nodeRef.current
    if (!node || editing) return
    if (readEditableText(node) !== item.text) {
      node.textContent = item.text
    }
  }, [editing, item.text])

  const measureBox = () => {
    const box = boxRef.current
    return {
      width: box?.offsetWidth ?? 32,
      height: box?.offsetHeight ?? 24,
    }
  }

  const pointerPage = (event: PointerEvent<HTMLElement>) => ({
    x: event.clientX + scrollOffset.x,
    y: event.clientY + scrollOffset.y,
  })

  const startMove = (event: PointerEvent<HTMLElement>) => {
    onSelect(item.id, event.shiftKey)
    if (event.shiftKey) return
    onMoveStart(item.id)
    dragRef.current = {
      type: "move",
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      itemX: item.x,
      itemY: item.y,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  return (
    <div
      ref={boxRef}
      style={{
        left: item.x - scrollOffset.x + moveOffset.x,
        top: item.y - scrollOffset.y + moveOffset.y,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "center center",
        fontFamily,
        color,
        width: boxWidth,
        ...typeStyle,
      }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        if (!interactive && !editable) return
        event.stopPropagation()
        if (editable) return
        const previous = lastPointerDownRef.current
        lastPointerDownRef.current = event.timeStamp
        if (previous && event.timeStamp - previous < 400) {
          dragRef.current = null
          onEdit(item.id, event.clientX, event.clientY)
          return
        }
        startMove(event)
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag || drag.id !== item.id) return
        if (drag.type === "move") {
          const dx = event.clientX - drag.startX
          const dy = event.clientY - drag.startY
          if (!drag.moved && Math.hypot(dx, dy) < 4) return
          if (!drag.moved) {
            dragRef.current = { ...drag, moved: true }
          }
          onMove(drag.id, dx, dy)
          return
        }
        const pointer = pointerPage(event)
        if (drag.type === "resize") {
          onTransform(
            item.id,
            isWidthHandle(drag.handle)
              ? resizeWidthBox(drag, drag.handle, pointer)
              : scaleBox({ ...drag, scale: drag.scale, boxWidth: drag.boxWidth }, drag.handle, pointer),
          )
          return
        }
        onTransform(item.id, {
          x: item.x,
          y: item.y,
          rotation: rotationFromPointer({ x: drag.centerX, y: drag.centerY }, pointer) - drag.offset,
        })
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.id !== item.id) return
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        const wasMove = dragRef.current.type === "move"
        dragRef.current = null
        if (wasMove) onMoveEnd?.()
      }}
      className={`msr:absolute msr:h-max ${boxWidth ? "msr:w-auto" : "msr:w-max"} ${
        interactive || editable ? "msr:pointer-events-auto" : "msr:pointer-events-none"
      } ${interactive ? "msr:cursor-default" : editable ? "msr:cursor-text" : ""}`}
      data-mesurer-text="true"
      data-mesurer-text-id={item.id}
    >
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
        contentEditable={editing ? "plaintext-only" : "false"}
        suppressContentEditableWarning
        spellCheck={false}
        onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
          if (!editable) return
          event.stopPropagation()
          if (!editing) onEdit(item.id, event.clientX, event.clientY)
        }}
        onDoubleClick={(event) => {
          if (!interactive) return
          event.preventDefault()
          event.stopPropagation()
          onEdit(item.id, event.clientX, event.clientY)
        }}
        onKeyDown={editing ? onKeyDown : undefined}
        onPaste={editing ? onPaste : undefined}
        onBlur={editing ? onBlur : undefined}
        className={`${boxWidth ? "msr:w-full msr:whitespace-pre-wrap msr:break-words" : "msr:whitespace-pre"} ${
          editing ? "msr:min-h-6 msr:min-w-0 msr:cursor-text msr:border-0 msr:bg-transparent msr:px-0 msr:outline-none" : ""
        }`}
        data-mesurer-text-input={editing ? "true" : undefined}
      />
      {selected && !editing && interactive ? (
        <TextTransformFrame
          rotation={rotation}
          showControls={showTransformControls && selectionCount === 1}
          onResizeStart={(handle, event) => {
            const size = measureBox()
            onSelect(item.id)
            onChangeStart?.()
            dragRef.current = {
              type: "resize",
              id: item.id,
              handle,
              ...size,
              x: item.x,
              y: item.y,
              rotation,
              scale,
              boxWidth,
            }
            boxRef.current?.setPointerCapture(event.pointerId)
          }}
          onRotateStart={(event) => {
            const size = measureBox()
            const center = boxCenter(item.x, item.y, size.width, size.height)
            const pointer = pointerPage(event)
            onSelect(item.id)
            onChangeStart?.()
            dragRef.current = {
              type: "rotate",
              id: item.id,
              centerX: center.x,
              centerY: center.y,
              offset: rotationFromPointer(center, pointer) - rotation,
            }
            boxRef.current?.setPointerCapture(event.pointerId)
          }}
        />
      ) : null}
    </div>
  )
}

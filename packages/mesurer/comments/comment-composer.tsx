import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { SendIcon } from "../components/icons"
import { Tooltip, useTooltip } from "../components/tooltip"

const COMPOSER_MAX_HEIGHT = 128
const COMPOSER_SINGLE_ROW_HEIGHT = 34
const COMPOSER_COMPACT_RIGHT_PADDING = 36
const COMPOSER_EXPANDED_RIGHT_PADDING = 8
const COMPOSER_COMPACT_BOTTOM_PADDING = 8
const COMPOSER_EXPANDED_BOTTOM_PADDING = 32

type CommentComposerProps = {
  value: string
  placeholder: string
  ariaLabel: string
  actionLabel?: string
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onSubmit: () => void
}

export function CommentComposer({
  value,
  placeholder,
  ariaLabel,
  actionLabel,
  onChange,
  onKeyDown,
  onSubmit,
}: CommentComposerProps) {
  const [expanded, setExpanded] = useState(false)
  const [height, setHeight] = useState(COMPOSER_SINGLE_ROW_HEIGHT)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const sendButtonRef = useRef<HTMLDivElement | null>(null)
  const tooltip = useTooltip()
  const tooltipId = `comment-composer-send-${ariaLabel}`
  const canSubmit = Boolean(value.trim())
  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = `${COMPOSER_SINGLE_ROW_HEIGHT}px`
    setHeight(COMPOSER_SINGLE_ROW_HEIGHT)
    setExpanded(false)
  }
  const submit = () => {
    onSubmit()
    resetHeight()
  }

  return (
    <div className="msr:relative">
      <textarea
        value={value}
        ref={textareaRef}
        autoFocus
        rows={1}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="msr:block msr:min-h-6 msr:max-h-32 msr:w-full msr:resize-none msr:overflow-y-auto msr:rounded-md msr:border msr:border-ink-200 msr:caret-[#0d99ff] msr:p-2 msr:text-[12px] msr:text-ink-900 msr:outline-none msr:focus:border-[#0d99ff]"
        style={{
          paddingRight: expanded ? COMPOSER_EXPANDED_RIGHT_PADDING : COMPOSER_COMPACT_RIGHT_PADDING,
          paddingBottom: expanded ? COMPOSER_EXPANDED_BOTTOM_PADDING : COMPOSER_COMPACT_BOTTOM_PADDING,
          height,
        }}
        onChange={(event) => {
          onChange(event)
          const textarea = event.currentTarget
          textarea.style.height = "auto"
          textarea.style.paddingRight = `${COMPOSER_COMPACT_RIGHT_PADDING}px`
          textarea.style.paddingBottom = `${COMPOSER_COMPACT_BOTTOM_PADDING}px`
          const singleRowHeight = textarea.scrollHeight
          const nextExpanded = singleRowHeight > COMPOSER_SINGLE_ROW_HEIGHT
          setExpanded(nextExpanded)
          if (nextExpanded) {
            textarea.style.paddingRight = `${COMPOSER_EXPANDED_RIGHT_PADDING}px`
            textarea.style.paddingBottom = `${COMPOSER_EXPANDED_BOTTOM_PADDING}px`
          }
          const nextHeight = nextExpanded
            ? `${Math.min(COMPOSER_MAX_HEIGHT, textarea.scrollHeight)}px`
            : `${COMPOSER_SINGLE_ROW_HEIGHT}px`
          textarea.style.height = nextHeight
          setHeight(Number.parseInt(nextHeight, 10))
        }}
        onKeyDown={(event) => {
          onKeyDown(event)
          if (event.key === "Enter" && !event.shiftKey) resetHeight()
        }}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <div
        ref={sendButtonRef}
        className={`msr:absolute msr:right-1.5 msr:flex msr:items-center ${expanded ? "msr:bottom-1.5" : "msr:top-1/2 msr:-translate-y-1/2"}`}
      onMouseEnter={() => canSubmit && tooltip.onTooltipEnter(tooltipId)}
      onMouseLeave={tooltip.onTooltipLeave}
      onFocus={() => canSubmit && tooltip.onTooltipEnter(tooltipId)}
        onBlur={tooltip.onTooltipLeave}
      >
        <button
          type="button"
          aria-label={actionLabel ?? (ariaLabel === "Comment" ? "Send comment" : "Send reply")}
          disabled={!canSubmit}
          className="msr:flex msr:size-6 msr:items-center msr:justify-center msr:rounded-full msr:bg-[#0d99ff] msr:text-white msr:hover:bg-[#087dcc] msr:disabled:cursor-default msr:disabled:opacity-40"
          onClick={submit}
        >
          <SendIcon />
        </button>
        <Tooltip
          label="Send"
          shortcut="Enter"
          visible={canSubmit && tooltip.visibleTooltipId === tooltipId}
          instant={tooltip.tooltipInstant}
          anchorRef={sendButtonRef}
        />
      </div>
    </div>
  )
}

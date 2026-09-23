import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { SendIcon } from "../components/icons"
import { Tooltip, useTooltip } from "../components/tooltip"

const COMPOSER_MAX_HEIGHT = 128
const COMPOSER_SINGLE_ROW_HEIGHT = 34
const COMPOSER_COMPACT_RIGHT_PADDING = 36
const COMPOSER_EXPANDED_RIGHT_PADDING = 8
const COMPOSER_COMPACT_BOTTOM_PADDING = 6
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

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || !value) return

    textarea.style.height = "auto"
    textarea.style.overflowY = "hidden"
    textarea.style.paddingRight = `${COMPOSER_COMPACT_RIGHT_PADDING}px`
    textarea.style.paddingBottom = `${COMPOSER_COMPACT_BOTTOM_PADDING}px`
    const nextExpanded = textarea.scrollHeight > COMPOSER_SINGLE_ROW_HEIGHT
    if (nextExpanded) {
      textarea.style.paddingRight = `${COMPOSER_EXPANDED_RIGHT_PADDING}px`
      textarea.style.paddingBottom = `${COMPOSER_EXPANDED_BOTTOM_PADDING}px`
    }
    const contentHeight = nextExpanded ? textarea.scrollHeight : COMPOSER_SINGLE_ROW_HEIGHT
    const nextHeight = Math.min(COMPOSER_MAX_HEIGHT, contentHeight)
    textarea.style.height = `${nextHeight}px`
    setExpanded(nextExpanded)
    setHeight(nextHeight)
  }, [value])

  return (
    <div className="msr:relative">
      <textarea
        value={value}
        ref={textareaRef}
        autoFocus
        wrap="soft"
        rows={1}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="msr:block msr:min-h-6 msr:max-h-32 msr:w-full msr:resize-none msr:rounded-control msr:border msr:border-ink-200 msr:caret-[#0d99ff] msr:px-2 msr:py-1.5 msr:text-[13px] msr:leading-5 msr:text-ink-900 msr:outline-none msr:focus:border-[#0d99ff]"
        style={{
          paddingRight: expanded ? COMPOSER_EXPANDED_RIGHT_PADDING : COMPOSER_COMPACT_RIGHT_PADDING,
          paddingBottom: expanded ? COMPOSER_EXPANDED_BOTTOM_PADDING : COMPOSER_COMPACT_BOTTOM_PADDING,
          height,
          overflowY: height >= COMPOSER_MAX_HEIGHT ? "auto" : "hidden",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
        onChange={onChange}
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

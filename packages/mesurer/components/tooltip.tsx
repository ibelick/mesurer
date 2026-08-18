import { useCallback, useRef, useState } from "react"
import { cn } from "../core/utils"

const TOOLTIP_DELAY_MS = 800

export function Tooltip({
  label,
  shortcut,
  visible,
  instant = false,
  side = "top",
  className,
}: {
  label: string
  shortcut?: string
  visible?: boolean
  instant?: boolean
  side?: "top" | "bottom"
  className?: string
}) {
  return (
    <span
      role="tooltip"
      className={cn(
        "msr:pointer-events-none msr:absolute msr:left-1/2 msr:-translate-x-1/2 msr:whitespace-nowrap msr:rounded msr:bg-black msr:px-2 msr:py-1 msr:text-[11px] msr:text-white msr:transition-opacity msr:duration-150 msr:select-none",
        instant && "msr:transition-none",
        side === "top" ? "msr:bottom-full msr:mb-2" : "msr:top-full msr:mt-2",
        visible === undefined ? null : visible ? "msr:opacity-100" : "msr:opacity-0",
        className,
      )}
    >
      {label}{shortcut ? <> <kbd className="msr:text-white/60">{shortcut}</kbd></> : null}
    </span>
  )
}

export function useTooltip() {
  const [visibleTooltipId, setVisibleTooltipId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const instantRef = useRef(false)
  const [tooltipInstant, setTooltipInstant] = useState(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const onTooltipEnter = useCallback((id: string) => {
    clearTimer()
    if (instantRef.current) {
      setTooltipInstant(true)
      setVisibleTooltipId(id)
      return
    }

    setTooltipInstant(false)
    timerRef.current = window.setTimeout(() => {
      setVisibleTooltipId(id)
      instantRef.current = true
      timerRef.current = null
    }, TOOLTIP_DELAY_MS)
  }, [clearTimer])

  const onTooltipLeave = useCallback(() => {
    clearTimer()
    setVisibleTooltipId(null)
  }, [clearTimer])

  const onTooltipContainerLeave = useCallback(() => {
    clearTimer()
    setVisibleTooltipId(null)
    instantRef.current = false
    setTooltipInstant(false)
  }, [clearTimer])

  return {
    visibleTooltipId,
    tooltipInstant,
    onTooltipEnter,
    onTooltipLeave,
    onTooltipContainerLeave,
  }
}

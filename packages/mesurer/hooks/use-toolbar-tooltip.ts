import { useCallback, useRef, useState } from "react"

const TOOLBAR_TOOLTIP_DELAY_MS = 800

export const useToolbarTooltip = () => {
  const [visibleTooltipId, setVisibleTooltipId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const instantRef = useRef(false)
  const [tooltipInstant, setTooltipInstant] = useState(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const onTooltipEnter = useCallback(
    (id: string) => {
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
      }, TOOLBAR_TOOLTIP_DELAY_MS)
    },
    [clearTimer],
  )

  const onTooltipLeave = useCallback(
    (id: string) => {
      clearTimer()
      setVisibleTooltipId((prev) => (prev === id ? null : prev))
    },
    [clearTimer],
  )

  const onToolbarLeave = useCallback(() => {
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
    onToolbarLeave,
  }
}

export type ToolbarTooltip = ReturnType<typeof useToolbarTooltip>

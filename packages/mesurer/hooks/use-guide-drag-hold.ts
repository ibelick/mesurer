import { useCallback, useRef } from "react"
import { GUIDE_DRAG_HOLD_MS } from "../core/constants"

export const useGuideDragHold = () => {
  const guideDragHoldTimerRef = useRef<number | null>(null)
  const guideDragHoldGuideIdRef = useRef<string | null>(null)

  const clearGuideDragHold = useCallback(() => {
    if (guideDragHoldTimerRef.current !== null) {
      window.clearTimeout(guideDragHoldTimerRef.current)
      guideDragHoldTimerRef.current = null
    }
    guideDragHoldGuideIdRef.current = null
  }, [])

  const scheduleGuideDragHold = useCallback(
    (id: string, onHold: (guideId: string) => void) => {
      clearGuideDragHold()
      guideDragHoldGuideIdRef.current = id
      guideDragHoldTimerRef.current = window.setTimeout(() => {
        if (guideDragHoldGuideIdRef.current === id) {
          onHold(id)
        }
      }, GUIDE_DRAG_HOLD_MS)
    },
    [clearGuideDragHold]
  )

  return {
    clearGuideDragHold,
    scheduleGuideDragHold,
  }
}

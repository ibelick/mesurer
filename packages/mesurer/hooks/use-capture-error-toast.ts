import { useCallback, useEffect, useRef, useState } from "react"

export const CAPTURE_TOAST_MS = 2500

export function useCaptureErrorToast(ownerWindow: Window) {
  const timeoutRef = useRef<number | null>(null)
  const [error, setError] = useState(false)

  const dismissError = useCallback(() => {
    if (timeoutRef.current !== null) {
      ownerWindow.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setError(false)
  }, [ownerWindow])

  const flashError = useCallback(() => {
    setError(true)
    if (timeoutRef.current !== null) {
      ownerWindow.clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = ownerWindow.setTimeout(() => {
      timeoutRef.current = null
      setError(false)
    }, CAPTURE_TOAST_MS)
  }, [ownerWindow])

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) ownerWindow.clearTimeout(timeoutRef.current)
    },
    [ownerWindow],
  )

  return { error, flashError, dismissError }
}

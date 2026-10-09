import { useCallback, useState } from "react"
import { useTimeout } from "./use-timeout"

const CAPTURE_TOAST_MS = 2500

export function useCaptureErrorToast(ownerWindow: Window) {
  const [error, setError] = useState(false)
  const { start, clear } = useTimeout(ownerWindow)

  const dismissError = useCallback(() => {
    clear()
    setError(false)
  }, [clear])

  const flashError = useCallback(() => {
    setError(true)
    start(() => setError(false), CAPTURE_TOAST_MS)
  }, [start])

  return { error, flashError, dismissError }
}

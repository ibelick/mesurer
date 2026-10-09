import { useCallback, useEffect, useRef } from "react"

// One timeout at a time: starting it again replaces the one that is waiting, and it is cleared
// when the component goes away.
export const useTimeout = (ownerWindow: Window | null) => {
  const idRef = useRef<number | null>(null)
  const clear = useCallback(() => {
    if (idRef.current === null) return
    ownerWindow?.clearTimeout(idRef.current)
    idRef.current = null
  }, [ownerWindow])
  const start = useCallback((run: () => void, delay: number) => {
    clear()
    if (!ownerWindow) return
    idRef.current = ownerWindow.setTimeout(() => {
      idRef.current = null
      run()
    }, delay)
  }, [clear, ownerWindow])
  useEffect(() => clear, [clear])
  return { start, clear }
}

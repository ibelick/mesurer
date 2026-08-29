import { useLayoutEffect, useRef } from "react"
import { syncXrayStyles } from "../runtime/xray-styles"

export const useXray = (ownerDocument: Document, visible: boolean) => {
  const appliedRef = useRef<{ doc: Document; visible: boolean } | null>(null)
  useLayoutEffect(() => {
    if (appliedRef.current && appliedRef.current.doc !== ownerDocument) {
      appliedRef.current.doc.body.classList.remove("xray-mode")
    }
    syncXrayStyles(ownerDocument, visible)
    appliedRef.current = { doc: ownerDocument, visible }
    return () => {
      if (appliedRef.current?.doc === ownerDocument) {
        ownerDocument.body.classList.remove("xray-mode")
      }
    }
  }, [ownerDocument, visible])
}

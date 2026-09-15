import { useLayoutEffect, useRef } from "react"
import { getAccessibleDocuments } from "../core/document-tree"
import { syncXrayStyles } from "../runtime/xray-styles"

export const useXray = (ownerDocument: Document, visible: boolean) => {
  const appliedDocumentsRef = useRef<Document[]>([])
  useLayoutEffect(() => {
    const sync = () => {
      const documents = getAccessibleDocuments(ownerDocument)
      for (const document of appliedDocumentsRef.current) {
        if (!documents.includes(document)) syncXrayStyles(document, false)
      }
      for (const document of documents) syncXrayStyles(document, visible)
      appliedDocumentsRef.current = documents
    }

    sync()
    ownerDocument.addEventListener("load", sync, true)
    const observer = typeof MutationObserver === "undefined" || !ownerDocument.body
      ? null
      : new MutationObserver(sync)
    observer?.observe(ownerDocument.body, { childList: true, subtree: true })

    return () => {
      ownerDocument.removeEventListener("load", sync, true)
      observer?.disconnect()
      for (const document of appliedDocumentsRef.current) syncXrayStyles(document, false)
      appliedDocumentsRef.current = []
    }
  }, [ownerDocument, visible])
}

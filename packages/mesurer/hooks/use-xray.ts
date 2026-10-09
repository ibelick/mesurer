import { useLayoutEffect, useRef } from "react"
import { getAccessibleDocuments, getOwnFrameDocuments, onOwnFramesChange } from "../core/document-tree"
import { syncXrayStyles } from "../runtime/xray-styles"

// While the responsive previews are open, X-ray shows in them only: the page behind is left as it is.
export const useXray = (ownerDocument: Document, visible: boolean, previewsOnly = false) => {
  const appliedDocumentsRef = useRef<Document[]>([])
  useLayoutEffect(() => {
    const sync = () => {
      const documents = previewsOnly ? getOwnFrameDocuments(ownerDocument) : getAccessibleDocuments(ownerDocument)
      for (const document of appliedDocumentsRef.current) {
        if (!documents.includes(document)) syncXrayStyles(document, false)
      }
      for (const document of documents) syncXrayStyles(document, visible)
      appliedDocumentsRef.current = documents
    }

    sync()
    ownerDocument.addEventListener("load", sync, true)
    const offOwnFrames = onOwnFramesChange(sync)
    const observer = typeof MutationObserver === "undefined" || !ownerDocument.body
      ? null
      : new MutationObserver(sync)
    observer?.observe(ownerDocument.body, { childList: true, subtree: true })

    return () => {
      ownerDocument.removeEventListener("load", sync, true)
      offOwnFrames()
      observer?.disconnect()
      for (const document of appliedDocumentsRef.current) syncXrayStyles(document, false)
      appliedDocumentsRef.current = []
    }
  }, [ownerDocument, visible, previewsOnly])
}

import { useEffect, useMemo, useState } from "react"
import { TypographyInspector, resolveTypographyElement, type TypographyInfo } from "../runtime/text-inspector-typography"

// The typography of the selected element, read again whenever something that can change it
// does: its size, its classes and styles up the tree, the page's stylesheets and its fonts.
export const useSelectedTypography = (
  selectedElement: Element | null,
  ownerDocument: Document,
  ownerWindow: Window,
) => {
  const inspector = useMemo(
    () => new TypographyInspector(ownerDocument, ownerWindow),
    [ownerDocument, ownerWindow],
  )
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!selectedElement) return
    const elementWindow = selectedElement.ownerDocument.defaultView
    if (!elementWindow) return
    const refresh = () => {
      inspector.invalidate()
      setRevision((current) => current + 1)
    }
    const resizeObserver = typeof elementWindow.ResizeObserver === "function"
      ? new elementWindow.ResizeObserver(refresh)
      : null
    resizeObserver?.observe(selectedElement)
    const mutationObserver = new elementWindow.MutationObserver(refresh)
    const stylesheetObserver = new elementWindow.MutationObserver((records) => {
      const stylesheetChanged = records.some((record) => {
        if (record.type === "characterData") {
          return (record.target.parentElement?.closest("style") ?? null) !== null
        }
        return [record.target, ...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some((node) => {
          if (!(node instanceof elementWindow.Element)) return false
          return node.matches("style, link[rel~='stylesheet']") || node.querySelector("style, link[rel~='stylesheet']") !== null
        })
      })
      if (stylesheetChanged) refresh()
    })
    let node: Element | null = selectedElement
    while (node) {
      mutationObserver.observe(node, { attributes: true, attributeFilter: ["class", "style"] })
      node = node.parentElement
    }
    const selectedRoot = selectedElement.getRootNode()
    const stylesheetRoots: Node[] = [selectedElement.ownerDocument.head ?? selectedElement.ownerDocument]
    if (selectedRoot !== selectedElement.ownerDocument) {
      mutationObserver.observe(selectedRoot, { attributes: true, childList: true, subtree: true })
      stylesheetRoots.push(selectedRoot)
    }
    for (const root of stylesheetRoots) {
      stylesheetObserver.observe(root, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    }
    elementWindow.addEventListener("resize", refresh)
    elementWindow.document.fonts?.addEventListener("loadingdone", refresh)
    elementWindow.document.fonts?.addEventListener("loadingerror", refresh)
    return () => {
      resizeObserver?.disconnect()
      mutationObserver.disconnect()
      stylesheetObserver.disconnect()
      elementWindow.removeEventListener("resize", refresh)
      elementWindow.document.fonts?.removeEventListener("loadingdone", refresh)
      elementWindow.document.fonts?.removeEventListener("loadingerror", refresh)
    }
  }, [selectedElement, inspector])
  return useMemo<TypographyInfo | null>(() => {
    if (!selectedElement) return null
    const ElementConstructor = selectedElement.ownerDocument.defaultView?.HTMLElement
    if (!ElementConstructor || !(selectedElement instanceof ElementConstructor)) return null
    const typographyElement = resolveTypographyElement(selectedElement)
    if (!typographyElement || !(typographyElement instanceof ElementConstructor)) return null
    return inspector.getFast(typographyElement)
    // `revision` is what makes this read again after a refresh.
  }, [selectedElement, revision, inspector])
}

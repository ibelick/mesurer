import type { Rect } from "./types"
import { projectRect } from "./frame-geometry"

export const getFrameToken = () =>
  typeof performance === "undefined" ? 0 : Math.floor(performance.now() / 16)

export const isIframeElement = (element: Element): element is HTMLIFrameElement => {
  const IFrameConstructor = element.ownerDocument.defaultView?.HTMLIFrameElement
  return Boolean(IFrameConstructor && element instanceof IFrameConstructor)
}

export const getAccessibleFrameDocument = (element: Element): Document | null => {
  if (!isIframeElement(element)) return null
  try {
    return element.contentDocument
  } catch {
    return null
  }
}

export const isConnectedElement = (element: Element | null | undefined): element is Element =>
  Boolean(element?.isConnected)

export const getViewportRect = (element: Element): Rect => {
  const rect = element.getBoundingClientRect()
  return projectRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }, element.ownerDocument)
}

const elementCache = new WeakMap<Document, { version: number; elements: Element[] }>()
const accessibleElementCache = new WeakMap<Document, { version: number; elements: Element[] }>()
const observedDocuments = new WeakSet<Document>()
const observedShadowRoots = new WeakSet<ShadowRoot>()
let documentTreeVersion = 0

export const getDocumentTreeVersion = () => documentTreeVersion

// Frames Mesurer itself shows the page in (the responsive previews). They are part of Mesurer's
// own tree, which may sit outside the page's body where the walks below never go, so they are
// made known here. `onOwnFramesChange` tells when one comes, goes or loads a page.
const ownFrames = new Set<HTMLIFrameElement>()
const ownFrameListeners = new Set<() => void>()

export const onOwnFramesChange = (listener: () => void) => {
  ownFrameListeners.add(listener)
  return () => {
    ownFrameListeners.delete(listener)
  }
}

export const trackOwnFrame = (frame: HTMLIFrameElement) => {
  const changed = () => {
    documentTreeVersion += 1
    for (const listener of ownFrameListeners) listener()
  }
  ownFrames.add(frame)
  frame.addEventListener("load", changed)
  changed()
  return () => {
    ownFrames.delete(frame)
    frame.removeEventListener("load", changed)
    changed()
  }
}

// How much smaller than it is one of Mesurer's own frames is drawn, for an element in it. What
// is measured on screen there, divided by this, is the size the page has in that frame. It is 1
// for an element anywhere else.
export const ownFrameScale = (element: Element | null | undefined) => {
  const frame = element?.ownerDocument?.defaultView?.frameElement as HTMLIFrameElement | null | undefined
  if (!frame || !ownFrames.has(frame) || !frame.offsetWidth) return 1
  return frame.getBoundingClientRect().width / frame.offsetWidth || 1
}

const ownFrameDocuments = (ownerDocument: Document) =>
  [...ownFrames].flatMap((frame) => {
    const childDocument = frame.ownerDocument === ownerDocument ? getAccessibleFrameDocument(frame) : null
    return childDocument ? [childDocument] : []
  })

const observeShadowRoot = (ownerDocument: Document, shadowRoot: ShadowRoot) => {
  if (observedShadowRoots.has(shadowRoot)) return
  observedShadowRoots.add(shadowRoot)
  const Observer = ownerDocument.defaultView?.MutationObserver ?? MutationObserver
  const observer = new Observer((mutations) => {
    documentTreeVersion += 1
    attachShadowsInMutations(ownerDocument, mutations)
  })
  observer.observe(shadowRoot, { childList: true, subtree: true })
  attachShadowsInTree(ownerDocument, shadowRoot)
}

const attachShadowsInTree = (ownerDocument: Document, root: Document | ShadowRoot | Element) => {
  const ElementConstructor = ownerDocument.defaultView?.Element ?? Element
  if (root instanceof ElementConstructor && root.shadowRoot) {
    observeShadowRoot(ownerDocument, root.shadowRoot)
  }
  const walker = ownerDocument.createTreeWalker(root, 1)
  let node = walker.nextNode()
  while (node) {
    if (node instanceof ElementConstructor && node.shadowRoot) {
      observeShadowRoot(ownerDocument, node.shadowRoot)
    }
    node = walker.nextNode()
  }
}

const attachShadowsInMutations = (ownerDocument: Document, mutations: MutationRecord[]) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === 1) attachShadowsInTree(ownerDocument, node as Element)
    }
  }
}

const observeDocument = (ownerDocument: Document) => {
  if (observedDocuments.has(ownerDocument)) return
  observedDocuments.add(ownerDocument)
  ownerDocument.addEventListener("load", () => {
    documentTreeVersion += 1
    attachShadowsInTree(ownerDocument, ownerDocument)
  }, true)
  if (typeof MutationObserver === "undefined" || !ownerDocument.body) return
  const observer = new MutationObserver((mutations) => {
    documentTreeVersion += 1
    attachShadowsInMutations(ownerDocument, mutations)
  })
  observer.observe(ownerDocument.body, { childList: true, subtree: true })
  attachShadowsInTree(ownerDocument, ownerDocument)
}

export const getBodyElementsCached = (ownerDocument: Document = document) => {
  observeDocument(ownerDocument)
  const version = documentTreeVersion
  const cached = elementCache.get(ownerDocument)
  if (cached?.version === version) return cached.elements

  const elements: Element[] = []
  const ElementConstructor = ownerDocument.defaultView?.Element ?? Element
  const visit = (root: Document | ShadowRoot | Element) => {
    const walker = ownerDocument.createTreeWalker(root, 1)
    let node = walker.nextNode()
    while (node) {
      if (node instanceof ElementConstructor) {
        elements.push(node)
        if (node.shadowRoot) visit(node.shadowRoot)
      }
      node = walker.nextNode()
    }
  }

  if (ownerDocument.body) visit(ownerDocument.body)
  elementCache.set(ownerDocument, { version, elements })
  return elements
}

export const getAccessibleDocumentElements = (ownerDocument: Document = document): Element[] => {
  observeDocument(ownerDocument)
  const version = documentTreeVersion
  const cached = accessibleElementCache.get(ownerDocument)
  if (cached?.version === version) return cached.elements

  // Mesurer's own frames stand over the whole page. While there are some, the page behind them
  // is not offered: only what is in them is.
  const ownDocuments = ownFrameDocuments(ownerDocument)
  const elements = ownDocuments.length > 0 ? [] : [...getBodyElementsCached(ownerDocument)]
  for (const element of elements) {
    const childDocument = getAccessibleFrameDocument(element)
    if (childDocument) elements.push(...getAccessibleDocumentElements(childDocument))
  }
  for (const childDocument of ownDocuments) elements.push(...getAccessibleDocumentElements(childDocument))
  accessibleElementCache.set(ownerDocument, { version, elements })
  return elements
}

export const getAccessibleDocuments = (ownerDocument: Document = document): Document[] => {
  const documents = [ownerDocument]
  for (const element of getBodyElementsCached(ownerDocument)) {
    const childDocument = getAccessibleFrameDocument(element)
    if (childDocument && !documents.includes(childDocument)) {
      documents.push(...getAccessibleDocuments(childDocument))
    }
  }
  for (const childDocument of ownFrameDocuments(ownerDocument)) {
    if (!documents.includes(childDocument)) documents.push(...getAccessibleDocuments(childDocument))
  }
  return documents
}

import type { Rect } from "./types"

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
  let left = rect.left
  let top = rect.top
  let frame = element.ownerDocument.defaultView?.frameElement

  while (frame) {
    const frameRect = frame.getBoundingClientRect()
    left += frameRect.left + frame.clientLeft
    top += frameRect.top + frame.clientTop
    frame = frame.ownerDocument.defaultView?.frameElement
  }

  return { left, top, width: rect.width, height: rect.height }
}

const elementCache = new WeakMap<Document, { version: number; elements: Element[] }>()
const accessibleElementCache = new WeakMap<Document, { version: number; elements: Element[] }>()
const observedDocuments = new WeakSet<Document>()
const observedShadowRoots = new WeakSet<ShadowRoot>()
let documentTreeVersion = 0

export const getDocumentTreeVersion = () => documentTreeVersion

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

  const elements = [...getBodyElementsCached(ownerDocument)]
  for (const element of elements) {
    const childDocument = getAccessibleFrameDocument(element)
    if (childDocument) elements.push(...getAccessibleDocumentElements(childDocument))
  }
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
  return documents
}

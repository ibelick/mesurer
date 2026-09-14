const getElementName = (element: Element) => element.tagName.toLowerCase()

export const getElementSelector = (element: Element) => {
  const parts: string[] = []
  let current: Element | null = element
  while (current && current !== current.ownerDocument.documentElement) {
    const tag = getElementName(current)
    if (current.id) {
      parts.unshift(`${tag}#${CSS.escape(current.id)}`)
      break
    }
    const parent: Element | null = current.parentElement
    if (!parent) {
      const root = current.getRootNode()
      if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && "children" in root) {
        const siblings = Array.from((root as ShadowRoot).children).filter(
          (sibling) => sibling.tagName === current?.tagName,
        )
        const index = siblings.indexOf(current)
        const selector = siblings.length > 1 ? `${tag}:nth-of-type(${index + 1})` : tag
        parts.unshift(selector)
      } else {
        parts.unshift(tag)
      }
      break
    }
    const siblings = Array.from(parent.children).filter(
      (sibling) => sibling.tagName === current?.tagName,
    )
    const index = siblings.indexOf(current)
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index + 1})` : tag)
    current = parent
  }
  return parts.join(" > ") || getElementName(element)
}

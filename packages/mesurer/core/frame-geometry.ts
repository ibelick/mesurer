import type { Point, Rect } from "./types"

type Matrix = { a: number; b: number; c: number; d: number; x: number; y: number }
const outside = (): Point => ({ x: -1, y: -1 })
const scaleValue = (value: string) => Number.parseFloat(value) * (value.endsWith("%") ? 0.01 : 1)

// Compose the iframe and its transformed ancestors. The border-box AABB supplies
// translation, including transform origins, scroll, and positioned ancestors.
function frameMatrix(frame: Element): Matrix | null {
  const view = frame.ownerDocument.defaultView
  let a = 1, b = 0, c = 0, d = 1
  let frameStyle: CSSStyleDeclaration | undefined
  let current: Element | null = frame
  while (current && view) {
    const style = view.getComputedStyle(current)
    if (current === frame) frameStyle = style
    const Constructor = (view as Window & typeof globalThis).DOMMatrixReadOnly ?? (view as Window & typeof globalThis).DOMMatrix
    let transform = { a: 1, b: 0, c: 0, d: 1, is2D: true }
    if (style.transform && style.transform !== "none") {
      if (!Constructor) return null
      const parsed = new Constructor(style.transform)
      if (parsed.is2D === false) return null
      transform = { a: parsed.a, b: parsed.b, c: parsed.c, d: parsed.d, is2D: true }
    }
    // An affine projection cannot represent perspective or out-of-plane axes.
    // Reject these rather than inventing apparently valid hit-test coordinates.
    if (style.perspective && style.perspective !== "none") return null
    const rotationParts = (style.rotate || "none").split(/\s+/)
    if (rotationParts.length > 1 && !(rotationParts.length === 2 && rotationParts[0] === "z") && !(rotationParts.length === 4 && Number(rotationParts[0]) === 0 && Number(rotationParts[1]) === 0 && Number(rotationParts[2]) !== 0)) return null
    const zoom = scaleValue(style.zoom || "1") || 1
    const scales = !style.scale || style.scale === "none" ? [1, 1] : style.scale.split(/\s+/).map(scaleValue)
    const rotation = rotationParts[rotationParts.length - 1]
    const angle = Number.parseFloat(rotation) || 0
    const radians = (rotation.endsWith("grad") ? angle * Math.PI / 200 : rotation.endsWith("rad") ? angle : rotation.endsWith("turn") ? angle * Math.PI * 2 : angle * Math.PI / 180) * (rotationParts.length === 4 ? Math.sign(Number(rotationParts[2])) : 1)
    const sx = Number.isFinite(scales[0]) ? scales[0] : 1, sy = scales[1] ?? sx
    const cos = Math.cos(radians), sin = Math.sin(radians)
    const aa = zoom * (cos * sx * transform.a - sin * sy * transform.b)
    const bb = zoom * (sin * sx * transform.a + cos * sy * transform.b)
    const cc = zoom * (cos * sx * transform.c - sin * sy * transform.d)
    const dd = zoom * (sin * sx * transform.c + cos * sy * transform.d)
    ;[a, b, c, d] = [aa * a + cc * b, bb * a + dd * b, aa * c + cc * d, bb * c + dd * d]
    current = current.parentElement ?? (current.getRootNode() as ShadowRoot).host ?? null
  }
  const rect = frame.getBoundingClientRect()
  const element = frame as HTMLElement
  const style = frameStyle
  const width = style ? (Number.parseFloat(style.width) || element.offsetWidth) + (style.boxSizing === "border-box" ? 0 : (Number.parseFloat(style.borderLeftWidth) || 0) + (Number.parseFloat(style.borderRightWidth) || 0) + (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0)) : element.offsetWidth
  const height = style ? (Number.parseFloat(style.height) || element.offsetHeight) + (style.boxSizing === "border-box" ? 0 : (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0) + (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0)) : element.offsetHeight
  const matrix = {
    a, b, c, d,
    x: rect.left - Math.min(0, a * width, c * height, a * width + c * height) + a * (frame.clientLeft + (Number.parseFloat(style?.paddingLeft ?? "0") || 0)) + c * (frame.clientTop + (Number.parseFloat(style?.paddingTop ?? "0") || 0)),
    y: rect.top - Math.min(0, b * width, d * height, b * width + d * height) + b * (frame.clientLeft + (Number.parseFloat(style?.paddingLeft ?? "0") || 0)) + d * (frame.clientTop + (Number.parseFloat(style?.paddingTop ?? "0") || 0)),
  }
  return Object.values(matrix).every(Number.isFinite) ? matrix : null
}

const apply = (m: Matrix, point: Point): Point => ({ x: m.a * point.x + m.c * point.y + m.x, y: m.b * point.x + m.d * point.y + m.y })

function inverse(m: Matrix, point: Point): Point {
  const determinant = m.a * m.d - m.b * m.c
  if (Math.abs(determinant) < 1e-12) return outside()
  const x = point.x - m.x, y = point.y - m.y
  return { x: (m.d * x - m.c * y) / determinant, y: (m.a * y - m.b * x) / determinant }
}

function containingFrame(document: Document): Element | null {
  try { return document.defaultView?.frameElement ?? null } catch { return null }
}

export function framePointToParent(frame: Element, point: Point): Point {
  const m = frameMatrix(frame)
  return m ? apply(m, point) : outside()
}

export function parentPointToFrame(frame: Element, point: Point): Point {
  const m = frameMatrix(frame)
  return m ? inverse(m, point) : outside()
}

export function projectPoint(point: Point, source: Document, target?: Document): Point {
  // Find the common ancestor first. Unrelated/detached documents must never
  // receive partially projected coordinates from a different document tree.
  const ancestors = new Map<Document, Element[]>()
  let current = source
  const upward: Element[] = []
  while (!ancestors.has(current)) {
    ancestors.set(current, [...upward])
    const frame = containingFrame(current)
    if (!frame) break
    upward.push(frame)
    current = frame.ownerDocument
  }
  const downward: Element[] = []
  if (target) {
    current = target
    const seen = new Set<Document>()
    while (!ancestors.has(current)) {
      if (seen.has(current)) return outside()
      seen.add(current)
      const frame = containingFrame(current)
      if (!frame) return outside()
      downward.push(frame)
      current = frame.ownerDocument
    }
  }
  let result = point
  for (const frame of ancestors.get(current) ?? []) {
    const matrix = frameMatrix(frame)
    if (!matrix) return outside()
    result = apply(matrix, result)
  }
  for (const frame of downward.reverse()) {
    const matrix = frameMatrix(frame)
    if (!matrix || Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 1e-12) return outside()
    result = inverse(matrix, result)
  }
  return result
}

export function projectRect(rect: Rect, document: Document): Rect {
  if (!containingFrame(document)) return rect
  let points = [
    { x: rect.left, y: rect.top }, { x: rect.left + rect.width, y: rect.top },
    { x: rect.left, y: rect.top + rect.height }, { x: rect.left + rect.width, y: rect.top + rect.height },
  ]
  const seen = new Set<Document>()
  while (!seen.has(document)) {
    seen.add(document)
    const frame = containingFrame(document)
    if (!frame) break
    const matrix = frameMatrix(frame)
    if (!matrix) return { left: -1, top: -1, width: 0, height: 0 }
    points = points.map((point) => apply(matrix, point))
    document = frame.ownerDocument
  }
  const left = Math.min(...points.map((point) => point.x)), top = Math.min(...points.map((point) => point.y))
  return { left, top, width: Math.max(...points.map((point) => point.x)) - left, height: Math.max(...points.map((point) => point.y)) - top }
}

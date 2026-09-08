import { useSyncExternalStore } from "react"
import { getRectFromDom, isConnectedElement } from "../core/dom"
import { isRectEqual, resolveCommentTarget } from "./dom"
import type { CommentTarget, Rect } from "./types"

type RuntimeSnapshot = {
  hoverElement: Element | null
  hoverRect: Rect | null
  hoverPoint: { x: number; y: number } | null
  rects: ReadonlyMap<string, Rect>
  unresolvedIds: ReadonlySet<string>
}

export class CommentRuntimeStore {
  private readonly ownerDocument: Document
  private readonly ownerWindow: Window
  private readonly elements = new Map<string, Element>()
  private readonly targets = new Map<string, CommentTarget>()
  private readonly rects = new Map<string, Rect>()
  private readonly listeners = new Set<() => void>()
  private frame: number | null = null
  private snapshot: RuntimeSnapshot = {
    hoverElement: null,
    hoverRect: null,
    hoverPoint: null,
    rects: this.rects,
    unresolvedIds: new Set(),
  }

  constructor(ownerDocument: Document, ownerWindow: Window) {
    this.ownerDocument = ownerDocument
    this.ownerWindow = ownerWindow
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    if (this.listeners.size === 1 && (this.elements.size > 0 || this.snapshot.hoverElement)) {
      this.start()
    }
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stop()
    }
  }

  getSnapshot = () => this.snapshot
  getServerSnapshot = () => this.snapshot

  useSnapshot() {
    return useSyncExternalStore(this.subscribe, this.getSnapshot, this.getServerSnapshot)
  }

  setHoverElement(element: Element | null, point: { x: number; y: number } | null = null) {
    const rect = element ? getRectFromDom(element) : null
    if (this.snapshot.hoverElement === element &&
      ((point === null && this.snapshot.hoverPoint === null) ||
        (point !== null && this.snapshot.hoverPoint?.x === point.x && this.snapshot.hoverPoint?.y === point.y)) &&
      ((rect === null && this.snapshot.hoverRect === null) ||
        (rect !== null && this.snapshot.hoverRect !== null && isRectEqual(rect, this.snapshot.hoverRect)))) {
      return
    }
    this.snapshot = { ...this.snapshot, hoverElement: element, hoverRect: rect, hoverPoint: point }
    if (element) this.start()
    else if (this.elements.size === 0) this.stop()
    this.emit()
  }

  attach(id: string, target: CommentTarget, element: Element | null) {
    this.targets.set(id, target)
    const unresolvedIds = new Set(this.snapshot.unresolvedIds)
    if (element) {
      this.elements.set(id, element)
      unresolvedIds.delete(id)
    } else {
      this.elements.delete(id)
      unresolvedIds.add(id)
    }
    this.snapshot = { ...this.snapshot, unresolvedIds }
    if (element) this.start()
    else if (this.elements.size === 0 && !this.snapshot.hoverElement) this.stop()
    this.refresh()
  }

  detach(id: string) {
    this.targets.delete(id)
    this.elements.delete(id)
    this.rects.delete(id)
    const unresolvedIds = new Set(this.snapshot.unresolvedIds)
    unresolvedIds.delete(id)
    this.snapshot = { ...this.snapshot, unresolvedIds }
    this.emit()
  }

  resolve(id: string, target: CommentTarget) {
    const element = resolveCommentTarget(target, this.ownerDocument)
    this.attach(id, target, element)
  }

  getElement(id: string) {
    return this.elements.get(id) ?? null
  }

  getIds() {
    return this.elements.keys()
  }

  private start() {
    if (this.frame !== null || this.listeners.size === 0) return
    const tick = () => {
      this.refresh()
      this.frame = this.ownerWindow.requestAnimationFrame(tick)
    }
    this.frame = this.ownerWindow.requestAnimationFrame(tick)
  }

  private stop() {
    if (this.frame !== null) this.ownerWindow.cancelAnimationFrame(this.frame)
    this.frame = null
  }

  private refresh() {
    let changed = false
    const unresolvedIds = new Set(this.snapshot.unresolvedIds)
    for (const [id, element] of this.elements) {
      if (!isConnectedElement(element)) {
        this.elements.delete(id)
        unresolvedIds.add(id)
        if (this.rects.delete(id)) changed = true
        continue
      }
      const rect = getRectFromDom(element)
      const previous = this.rects.get(id)
      if (!previous || !isRectEqual(previous, rect)) {
        this.rects.set(id, rect)
        changed = true
      }
      unresolvedIds.delete(id)
    }
    if (isConnectedElement(this.snapshot.hoverElement)) {
      const hoverRect = getRectFromDom(this.snapshot.hoverElement)
      if (!this.snapshot.hoverRect || !isRectEqual(hoverRect, this.snapshot.hoverRect)) {
        this.snapshot = { ...this.snapshot, hoverRect }
        changed = true
      }
    }
    if (changed || unresolvedIds.size !== this.snapshot.unresolvedIds.size) {
      this.snapshot = { ...this.snapshot, unresolvedIds }
      this.emit()
    }
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}

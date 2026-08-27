import {
  makeBox,
  makeCard,
  populateCard,
  positionBox,
  positionCard,
  type InspectorBox,
  type InspectorCard,
} from "./text-inspector-dom";
import {
  TypographyInspector,
  type TypographyInfo,
} from "./text-inspector-typography";

const DEFAULT_EXTENSION_HOST_ID = "mesurer-extension-host";
const DEFAULT_OVERLAY_ID = "mesurer-text-inspector-overlay";
const DEFAULT_STYLE_ID = "mesurer-text-inspector-styles";
const DEFAULT_BODY_MODE_CLASS = "mesurer-text-inspect-mode";
let inspectorInstanceCount = 0;
const FILL_HOVER =
  "color-mix(in oklch, oklch(0.62 0.18 255) 8%, transparent)";
const OUTLINE_HOVER =
  "color-mix(in oklch, oklch(0.62 0.18 255) 80%, transparent)";
const FILL_PINNED =
  "color-mix(in oklch, oklch(0.62 0.18 255) 4%, transparent)";
const OUTLINE_PINNED =
  "color-mix(in oklch, oklch(0.62 0.18 255) 35%, transparent)";

const DEFAULT_SKIP_TAGS = [
  "HTML",
  "BODY",
  "SCRIPT",
  "STYLE",
  "META",
  "LINK",
  "NOSCRIPT",
  "IMG",
  "VIDEO",
  "AUDIO",
  "IFRAME",
];

const createInspectorStyles = (
  extensionHostId: string,
  overlayId: string,
  bodyModeClass: string,
) => `
.${bodyModeClass},
.${bodyModeClass} * {
  cursor: help !important;
}
.${bodyModeClass} #${extensionHostId},
.${bodyModeClass} #${extensionHostId} *,
.${bodyModeClass} .mesurer-root,
.${bodyModeClass} .mesurer-root * {
  cursor: auto !important;
}
#${overlayId} .mesurer-ti-card--pinned {
  cursor: grab;
}
#${overlayId} .mesurer-ti-card--pinned:active {
  cursor: grabbing;
}
#${overlayId} .mesurer-ti-close {
  cursor: pointer;
}
#${overlayId} .mesurer-ti-close:hover {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}
#${overlayId} .mesurer-ti-box,
#${overlayId} .mesurer-ti-card {
  opacity: 1;
}
#${overlayId} .mesurer-ti-box[data-state="hidden"],
#${overlayId} .mesurer-ti-card[data-state="hidden"] {
  opacity: 0;
}
#${overlayId} .mesurer-ti-card {
  transform: translateX(-50%);
}
`;

type IdleCallback = () => void;
type IdleScheduler = {
  request: (callback: IdleCallback) => number;
  cancel: (id: number) => void;
};

type Pin = {
  sourceEl: HTMLElement;
  box: InspectorBox;
  card: InspectorCard;
  userPlaced: boolean;
  detach: () => void;
};

type PinSnapshot = {
  sourceEl: HTMLElement;
  left: number;
  top: number;
  userPlaced: boolean;
};

export type TextInspectorAPI = {
  enable: () => void;
  disable: () => void;
  undo: () => boolean;
  redo: () => boolean;
  isEnabled: () => boolean;
  cleanup: () => void;
  destroy: () => void;
  clear: () => void;
  inspect: (element: HTMLElement) => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setPaused: (paused: boolean) => void;
};

export type TextInspectorOptions = {
  id?: string;
  ignoredTags?: readonly string[];
  maxPinned?: number;
  portalTarget?: HTMLElement | ShadowRoot;
  onInspect?: (element: HTMLElement, info: TypographyInfo) => void;
  onPin?: (element: HTMLElement, info: TypographyInfo) => void;
  onUnpin?: (element: HTMLElement) => void;
};

const createIdleScheduler = (window: Window): IdleScheduler => {
  const browser = window as typeof window & {
    requestIdleCallback?: (
      callback: (deadline: IdleDeadline) => void,
      options?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (browser.requestIdleCallback) {
    return {
      request: (callback) =>
        browser.requestIdleCallback!(
          () => callback(),
          { timeout: 250 },
        ),
      cancel: (id) => browser.cancelIdleCallback?.(id),
    };
  }
  return {
    request: (callback) => window.setTimeout(callback, 32),
    cancel: (id) => window.clearTimeout(id),
  };
};

export const createTextInspector = (
  options: TextInspectorOptions = {},
  legacy = false,
): TextInspectorAPI => {
  const portalDocument = options.portalTarget?.ownerDocument;
  const availableDocument =
    portalDocument ??
    (typeof globalThis.document === "undefined" ? null : globalThis.document);
  const availableWindow = availableDocument?.defaultView ??
    (typeof globalThis.window === "undefined" ? null : globalThis.window);
  const document = availableDocument as Document;
  const window = availableWindow as Window;
  const realm = availableWindow as (Window & typeof globalThis) | null;
  const HTMLElementConstructor =
    realm?.HTMLElement ?? globalThis.HTMLElement;
  const SVGElementConstructor = realm?.SVGElement ?? globalThis.SVGElement;
  const extensionHostId = DEFAULT_EXTENSION_HOST_ID;
  const instanceId = (options.id ??
    (legacy
      ? DEFAULT_OVERLAY_ID
      : `mesurer-text-inspector-${++inspectorInstanceCount}`)).replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
  const overlayId = legacy ? DEFAULT_OVERLAY_ID : `${instanceId}-overlay`;
  const styleId = legacy ? DEFAULT_STYLE_ID : `${instanceId}-styles`;
  const bodyModeClass = legacy
    ? DEFAULT_BODY_MODE_CLASS
    : `${instanceId}-mode`;
  const skipTags = new Set(
    (options.ignoredTags ?? DEFAULT_SKIP_TAGS).map((tag) => tag.toUpperCase()),
  );
  const maxPinned = Number.isFinite(options.maxPinned)
    ? Math.max(1, Math.floor(options.maxPinned!))
    : Infinity;
  const inspectorStyles = createInspectorStyles(
    extensionHostId,
    overlayId,
    bodyModeClass,
  );
  const EXTENSION_HOST_ID = extensionHostId;
  const OVERLAY_ID = overlayId;
  const STYLE_ID = styleId;
  const BODY_MODE_CLASS = bodyModeClass;
  const SKIP_TAGS = skipTags;
  const INSPECTOR_STYLES = inspectorStyles;
  const portalIsShadowRoot = options.portalTarget?.nodeType === 11;
  const typography = new TypographyInspector(document, window);
  const pinned: Pin[] = [];
  const history: PinSnapshot[][] = [];
  const future: PinSnapshot[][] = [];

  let enabled = false;
  let paused = false;
  let overlay: HTMLDivElement | null = null;
  let hoverBox: InspectorBox | null = null;
  let hoverCard: InspectorCard | null = null;
  let hoveredEl: HTMLElement | null = null;
  let pointerX = 0;
  let pointerY = 0;
  let frameScheduled = false;
  let pendingElement: HTMLElement | null = null;
  let pendingIdleId = -1;
  let idleScheduler: IdleScheduler | null = null;

  const getIdleScheduler = () => {
    idleScheduler ??= createIdleScheduler(window);
    return idleScheduler;
  };

  const hasDirectText = (el: Element) =>
    Array.from(el.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && !!node.nodeValue?.trim(),
    );

  const isInspectable = (el: Element | null): el is HTMLElement =>
    !!el &&
    el instanceof HTMLElementConstructor &&
    !SKIP_TAGS.has(el.tagName) &&
    !(el instanceof SVGElementConstructor) &&
    hasDirectText(el);

  const isMesurerChrome = (element: Element) =>
    element.id === OVERLAY_ID ||
    element.id === EXTENSION_HOST_ID ||
    element.classList.contains("mesurer-root") ||
    element.classList.contains("mesurer-toolbar-surface") ||
    element.classList.contains("mesurer-menu-surface") ||
    element.classList.contains("mesurer-settings-panel") ||
    element.classList.contains("mesurer-toast-surface") ||
    element.classList.contains("mesurer-ti-card") ||
    element.classList.contains("mesurer-ti-box") ||
    element.hasAttribute("data-mesurer-inspector-ui");

  const composedParent = (node: Node): Node | null => {
    if (node.parentNode) return node.parentNode;
    const root = node.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  };

  const isOverlayNode = (node: Node | null) => {
    for (let current = node; current; current = composedParent(current)) {
      if (current instanceof Element && isMesurerChrome(current)) return true;
    }
    return false;
  };

  const pickElementAt = (x: number, y: number) => {
    return document.elementsFromPoint(x, y).find(
      (el): el is HTMLElement => !isOverlayNode(el) && isInspectable(el),
    ) ?? null;
  };

  const pointerOverMesurerUi = (x: number, y: number) => {
    const hits = [...document.elementsFromPoint(x, y)];
    const shadow = document.getElementById(EXTENSION_HOST_ID)?.shadowRoot;
    if (shadow) hits.push(...shadow.elementsFromPoint(x, y));
    return hits.some((element) => isOverlayNode(element));
  };

  const ensureStyles = () => {
    const append = (root: Document | ShadowRoot) => {
      if (root.querySelector(`#${STYLE_ID}`)) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = INSPECTOR_STYLES;
      root.nodeType === 9
        ? (root as Document).head.appendChild(style)
        : root.appendChild(style);
    };
    append(document);
    if (portalIsShadowRoot) append(options.portalTarget as ShadowRoot);
  };

  const ensureOverlay = () => {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "2147483646",
    });
    (options.portalTarget ?? document.body).appendChild(overlay);
    return overlay;
  };

  const setState = (element: HTMLElement, visible: boolean) => {
    element.dataset.state = visible ? "visible" : "hidden";
  };

  const ensureHover = () => {
    const root = ensureOverlay();
    hoverBox ??= makeBox(document, FILL_HOVER, OUTLINE_HOVER);
    hoverCard ??= makeCard(document, false);
    if (!hoverBox.parentNode) root.appendChild(hoverBox);
    if (!hoverCard.parentNode) root.appendChild(hoverCard);
  };

  const scheduleEnrichment = (element: HTMLElement, fast: TypographyInfo) => {
    if (pendingElement === element) return;
    if (pendingIdleId !== -1) getIdleScheduler().cancel(pendingIdleId);
    pendingElement = element;
    pendingIdleId = getIdleScheduler().request(() => {
      pendingIdleId = -1;
      pendingElement = null;
      if (!enabled) return;
      const full = typography.getFull(element, fast);
      if (hoveredEl !== element || !hoverCard) return;
      populateCard(document, hoverCard, full, false);
      positionCard(window, hoverCard, element.getBoundingClientRect());
      options.onInspect?.(element, full);
    });
  };

  const inspect = (element: HTMLElement) => {
    if (!enabled || !isInspectable(element)) return false;
    ensureHover();
    const rect = element.getBoundingClientRect();
    hoveredEl = element;
    const fast = typography.getFast(element);
    populateCard(document, hoverCard!, fast, false);
    scheduleEnrichment(element, fast);
    positionBox(hoverBox!, rect);
    positionCard(window, hoverCard!, rect);
    setState(hoverBox!, true);
    setState(hoverCard!, true);
    return true;
  };

  const updateHover = () => {
    if (!enabled || paused || pointerOverMesurerUi(pointerX, pointerY)) {
      hideHover();
      return;
    }
    const element = pickElementAt(pointerX, pointerY);
    if (!element) {
      hideHover();
      return;
    }
    if (element !== hoveredEl) inspect(element);
    else {
      const rect = element.getBoundingClientRect();
      positionBox(hoverBox!, rect);
      positionCard(window, hoverCard!, rect);
    }
  };

  const hideHover = () => {
    hoveredEl = null;
    if (hoverBox) setState(hoverBox, false);
    if (hoverCard) setState(hoverCard, false);
  };

  const snapshotPins = (): PinSnapshot[] =>
    pinned.map((pin) => {
      const rect = pin.card.getBoundingClientRect();
      return {
        sourceEl: pin.sourceEl,
        left: pin.userPlaced ? rect.left + rect.width / 2 : 0,
        top: pin.userPlaced ? rect.top : 0,
        userPlaced: pin.userPlaced,
      };
    });

  const recordPinState = () => {
    history.push(snapshotPins());
    future.length = 0;
  };

  const removePin = (pin: Pin, record = true, notify = record) => {
    const index = pinned.indexOf(pin);
    if (index === -1) return;
    if (record) recordPinState();
    pinned.splice(index, 1);
    pin.detach();
    pin.box.remove();
    pin.card.remove();
    if (notify) options.onUnpin?.(pin.sourceEl);
  };

  const clearPins = (notify = false) => {
    while (pinned.length) {
      removePin(pinned[pinned.length - 1], false, notify);
    }
  };

  const attachDrag = (pin: Pin) => {
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let active = false;
    let dragged = false;
    let historyRecorded = false;
    const slop = 6;

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!active) active = Math.abs(dx) > slop || Math.abs(dy) > slop;
      if (!active) return;
      if (!historyRecorded) {
        recordPinState();
        historyRecorded = true;
      }
      dragged = true;
      pin.card.style.left = `${Math.min(
        window.innerWidth - 8,
        Math.max(8, originLeft + dx),
      )}px`;
      pin.card.style.top = `${Math.min(
        window.innerHeight - 8,
        Math.max(8, originTop + dy),
      )}px`;
      pin.userPlaced = true;
    };

    const onEnd = (event: PointerEvent) => {
      if (event.pointerId !== pointerId && pointerId !== -1) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      pointerId = -1;
      active = false;
      historyRecorded = false;
      if (dragged) {
        const swallow = (click: Event) => {
          click.preventDefault();
          click.stopPropagation();
          window.removeEventListener("click", swallow, true);
        };
        window.addEventListener("click", swallow, true);
      }
      dragged = false;
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement | null)?.classList.contains("mesurer-ti-close")) {
        return;
      }
      const rect = pin.card.getBoundingClientRect();
      originLeft = rect.left + rect.width / 2;
      originTop = rect.top;
      startX = event.clientX;
      startY = event.clientY;
      pointerId = event.pointerId;
      active = false;
      dragged = false;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    };

    pin.card.addEventListener("pointerdown", onDown);
    return () => {
      pin.card.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  };

  const createPin = (
    sourceEl: HTMLElement,
    state?: PinSnapshot,
    record = true,
    notify = record,
  ) => {
    const existing = pinned.find((pin) => pin.sourceEl === sourceEl);
    if (existing) {
      const root = ensureOverlay();
      root.append(existing.box, existing.card);
      return;
    }
    if (record) {
      recordPinState();
      if (pinned.length >= maxPinned) removePin(pinned[0], false, true);
    }
    const root = ensureOverlay();
    const box = makeBox(document, FILL_PINNED, OUTLINE_PINNED);
    const card = makeCard(document, true);
    const info = typography.getFull(sourceEl);
    populateCard(document, card, info, true);
    root.append(box, card);
    const pin: Pin = {
      sourceEl,
      box,
      card,
      userPlaced: state?.userPlaced ?? false,
      detach: () => {},
    };
    const rect = sourceEl.getBoundingClientRect();
    positionBox(box, rect);
    positionCard(window, card, rect);
    if (state?.userPlaced) {
      card.style.left = `${state.left}px`;
      card.style.top = `${state.top}px`;
    }
    setState(box, true);
    setState(card, true);
    pinned.push(pin);
    card.querySelector<HTMLButtonElement>(".mesurer-ti-close")?.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        removePin(pin);
      },
    );
    pin.detach = attachDrag(pin);
    if (notify) options.onPin?.(sourceEl, info);
  };

  const restorePins = (states: PinSnapshot[]) => {
    clearPins(false);
    for (const state of states) {
      if (state.sourceEl.isConnected) createPin(state.sourceEl, state, false, false);
    }
  };

  const undo = () => {
    const previous = history.pop();
    if (!previous) return false;
    future.push(snapshotPins());
    restorePins(previous);
    return true;
  };

  const redo = () => {
    const next = future.pop();
    if (!next) return false;
    history.push(snapshotPins());
    restorePins(next);
    return true;
  };

  const clear = () => {
    if (!pinned.length) return;
    recordPinState();
    clearPins(true);
  };

  const syncPins = () => {
    for (const pin of [...pinned]) {
      if (!pin.sourceEl.isConnected) {
        removePin(pin, false);
        continue;
      }
      const rect = pin.sourceEl.getBoundingClientRect();
      positionBox(pin.box, rect);
      if (!pin.userPlaced) positionCard(window, pin.card, rect);
      const visible =
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.left <= window.innerWidth &&
        rect.top <= window.innerHeight;
      setState(pin.box, visible);
      setState(pin.card, visible);
      pin.card.style.pointerEvents = visible ? "auto" : "none";
    }
  };

  const scheduleFrame = () => {
    if (frameScheduled) return;
    frameScheduled = true;
    requestAnimationFrame(() => {
      frameScheduled = false;
      if (!enabled) return;
      updateHover();
      syncPins();
    });
  };

  const onMouseMove = (event: MouseEvent) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    scheduleFrame();
  };

  const onMouseOut = (event: MouseEvent) => {
    if (!event.relatedTarget) hideHover();
  };

  const onScrollOrResize = () => scheduleFrame();

  const isInspectorUIEvent = (event: Event) =>
    event.composedPath().some(
      (node) =>
        node instanceof HTMLElementConstructor &&
        (() => {
          const element = node as HTMLElement;
          return (
            element.id === OVERLAY_ID ||
            element.classList.contains("mesurer-ti-card") ||
            element.classList.contains("mesurer-ti-box") ||
            element.classList.contains("mesurer-ti-close") ||
            element.classList.contains("mesurer-toolbar-surface") ||
            element.classList.contains("mesurer-root") ||
            element.classList.contains("mesurer-menu-surface") ||
            element.classList.contains("mesurer-settings-panel") ||
            element.hasAttribute("data-mesurer-inspector-ui")
          );
        })(),
    );

  const onClick = (event: MouseEvent) => {
    if (
      paused ||
      isInspectorUIEvent(event) ||
      pointerOverMesurerUi(event.clientX, event.clientY)
    ) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.button === 0) {
      const source = pickElementAt(event.clientX, event.clientY);
      if (source) createPin(source);
    }
  };

  const onAuxClick = (event: MouseEvent) => {
    if (
      paused ||
      isInspectorUIEvent(event) ||
      pointerOverMesurerUi(event.clientX, event.clientY)
    ) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const enable = () => {
    if (enabled || !availableDocument || !availableWindow) return;
    enabled = true;
    ensureStyles();
    ensureOverlay();
    document.body.classList.add(BODY_MODE_CLASS);
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseout", onMouseOut, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("auxclick", onAuxClick, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize, true);
  };

  const disable = () => {
    if (!enabled) return;
    enabled = false;
    if (pendingIdleId !== -1) getIdleScheduler().cancel(pendingIdleId);
    pendingIdleId = -1;
    pendingElement = null;
    history.length = 0;
    future.length = 0;
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseout", onMouseOut, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("auxclick", onAuxClick, true);
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize, true);
    hideHover();
    hoverBox?.remove();
    hoverCard?.remove();
    hoverBox = null;
    hoverCard = null;
    clearPins();
    document.body.classList.remove(BODY_MODE_CLASS);
  };

  const setPaused = (next: boolean) => {
    paused = next;
    if (paused) hideHover();
  };

  const cleanup = () => {
    disable();
    overlay?.remove();
    overlay = null;
    if (typeof document !== "undefined") {
      document.getElementById(STYLE_ID)?.remove();
      if (portalIsShadowRoot) {
        (options.portalTarget as ShadowRoot).querySelector(`#${STYLE_ID}`)?.remove();
      }
    }
  };

  return {
    enable,
    disable,
    undo,
    redo,
    canUndo: () => history.length > 0,
    canRedo: () => future.length > 0,
    clear,
    inspect,
    isEnabled: () => enabled,
    setPaused,
    cleanup,
    destroy: cleanup,
  };
};

export const TextInspector = createTextInspector({}, true);

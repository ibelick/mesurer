// Text-style inspector ("Aa" mode) for the mesurer overlay.
//
// Exposes `enable()`, `disable()`, `isEnabled()`, and `cleanup()` from a
// single module-scoped IIFE (`TextInspector`). Pure DOM — no React.
//
// Visual language mirrors the measurer's inspect overlay:
//   - Highlight: absolute-positioned box sized to `getBoundingClientRect()`,
//     with a 8%-tint fill and 4 hairline (1px) edges in the measurer blue.
//     No classes ever touch the page element itself, so layout / repaint /
//     overflow-clip never interacts with the target.
//   - Label: small dark pill (ink-900/90 bg, ink-50 text, tabular nums),
//     positioned under the box like the measurement tag.
//
// Updates are rAF-throttled so mousemove never triggers more than one DOM
// write per frame — that's what made the previous implementation feel
// glitchy when tracking small or densely-nested text.

const EXTENSION_HOST_ID = "mesurer-extension-host";
const OVERLAY_ID = "mesurer-text-inspector-overlay";
const STYLE_ID = "mesurer-text-inspector-styles";
const BODY_MODE_CLASS = "mesurer-text-inspect-mode";

const SKIP_TAGS = new Set([
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
]);

const FONT_WEIGHT_KEYWORD: Record<string, string> = {
  "100": "thin",
  "200": "extralight",
  "300": "light",
  "400": "normal",
  "500": "medium",
  "600": "semibold",
  "700": "bold",
  "800": "extrabold",
  "900": "black",
};

// Measurer tokens — matched 1:1 with `MeasurementBox`.
const FILL_HOVER =
  "color-mix(in oklch, oklch(0.62 0.18 255) 8%, transparent)";
const OUTLINE_HOVER =
  "color-mix(in oklch, oklch(0.62 0.18 255) 80%, transparent)";
const FILL_PINNED =
  "color-mix(in oklch, oklch(0.62 0.18 255) 4%, transparent)";
const OUTLINE_PINNED =
  "color-mix(in oklch, oklch(0.62 0.18 255) 35%, transparent)";

// Minimal page-scoped styles. We lean mostly on inline styles so nothing
// leaks into the page.
const INSPECTOR_STYLES = `
.${BODY_MODE_CLASS},
.${BODY_MODE_CLASS} * {
  cursor: help !important;
}
.${BODY_MODE_CLASS} #${EXTENSION_HOST_ID},
.${BODY_MODE_CLASS} #${EXTENSION_HOST_ID} *,
.${BODY_MODE_CLASS} #${OVERLAY_ID},
.${BODY_MODE_CLASS} #${OVERLAY_ID} * {
  cursor: auto !important;
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-tag--pinned {
  cursor: grab;
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-tag--pinned:active {
  cursor: grabbing;
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-close {
  cursor: pointer;
}
@keyframes mesurer-ti-pop {
  from { transform: translateX(-50%) scale(0.92); opacity: 0; }
  to   { transform: translateX(-50%) scale(1);     opacity: 1; }
}
`;

type TypographyRow = {
  label: string;
  value: string;
  varName: string | null;
};

type TypographyInfo = {
  rows: TypographyRow[];
  tagName: string;
  textSnippet: string;
};

type Pinned = {
  sourceEl: HTMLElement;
  box: HTMLDivElement;
  tag: HTMLDivElement;
  dragOffsetX: number; // tag left - box center (0 until user drags)
  dragOffsetY: number; // tag top - box bottom (0 until user drags)
  userPlaced: boolean;
  detach: () => void;
};

export type TextInspectorAPI = {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  cleanup: () => void;
};

export const TextInspector: TextInspectorAPI = (() => {
  let enabled = false;
  let overlay: HTMLDivElement | null = null;
  let hoverBox: HTMLDivElement | null = null;
  let hoverTag: HTMLDivElement | null = null;
  let hoveredEl: HTMLElement | null = null;
  const pinned: Pinned[] = [];

  // Pointer tracking + rAF throttle.
  let pointerX = 0;
  let pointerY = 0;
  let frameScheduled = false;

  // -------- helpers --------

  const isInspectable = (el: Element | null): el is HTMLElement => {
    if (!el) return false;
    if (!(el instanceof HTMLElement)) return false;
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (el instanceof SVGElement) return false;
    if (!hasDirectTextContent(el)) return false;
    return true;
  };

  const hasDirectTextContent = (el: Element): boolean => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.nodeValue ?? "";
        if (t.trim().length > 0) return true;
      }
    }
    return false;
  };

  const isOverlayChild = (node: Node | null): boolean => {
    if (!node) return false;
    let current: Node | null = node;
    while (current) {
      if (current instanceof HTMLElement) {
        if (current.id === OVERLAY_ID) return true;
        if (current.id === EXTENSION_HOST_ID) return true;
      }
      current = current.parentNode;
    }
    return false;
  };

  const pickElementAt = (x: number, y: number): HTMLElement | null => {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (isOverlayChild(el)) continue;
      if (el.id === EXTENSION_HOST_ID) continue;
      if (isInspectable(el)) return el;
    }
    return null;
  };

  // True only when the pointer is over an actually-interactive element
  // inside the extension's shadow DOM (the mesurer toolbar). Empty host
  // space returns null from `shadowRoot.elementFromPoint`, so we treat
  // that as "over page" and inspect normally.
  const isPointerOverExtensionUI = (x: number, y: number): boolean => {
    const host = document.getElementById(EXTENSION_HOST_ID) as
      | HTMLElement
      | null;
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    const el = shadow.elementFromPoint(x, y);
    if (!el) return false;
    let node: Element | null = el;
    while (node) {
      if (node.classList?.contains("mesurer-toolbar-surface")) return true;
      node = node.parentElement;
    }
    return false;
  };

  const formatPx = (raw: string): string => {
    if (!raw || raw === "normal") return raw || "normal";
    const match = /^(-?[\d.]+)px$/.exec(raw);
    if (!match) return raw;
    const n = Number(match[1]);
    return `${Math.round(n * 10) / 10}px`;
  };

  const firstFontFamily = (families: string): string => {
    const first = families.split(",")[0] ?? "";
    return first.trim().replace(/^["']|["']$/g, "");
  };

  const weightWithKeyword = (weight: string): string => {
    const kw = FONT_WEIGHT_KEYWORD[weight];
    return kw ? `${weight} / ${kw}` : weight;
  };

  const extractVarName = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const match = /var\(\s*(--[a-zA-Z0-9_-]+)/.exec(value);
    return match ? match[1] : null;
  };

  const findVarReference = (
    el: HTMLElement,
    prop: string,
  ): string | null => {
    let node: HTMLElement | null = el;
    while (node) {
      const inline = node.style.getPropertyValue(prop);
      const inlineVar = extractVarName(inline);
      if (inlineVar) return inlineVar;

      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        let rules: CSSRuleList | null = null;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        if (!rules) continue;
        const found = scanRulesForVar(rules, node, prop);
        if (found) return found;
      }

      node = node.parentElement;
    }
    return null;
  };

  const scanRulesForVar = (
    rules: CSSRuleList,
    el: HTMLElement,
    prop: string,
  ): string | null => {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule instanceof CSSMediaRule) {
        try {
          if (!window.matchMedia(rule.media.mediaText).matches) continue;
        } catch {
          continue;
        }
        const found = scanRulesForVar(rule.cssRules, el, prop);
        if (found) return found;
        continue;
      }
      if (rule instanceof CSSSupportsRule) {
        const found = scanRulesForVar(rule.cssRules, el, prop);
        if (found) return found;
        continue;
      }
      if (!(rule instanceof CSSStyleRule)) continue;
      let matches = false;
      try {
        matches = el.matches(rule.selectorText);
      } catch {
        matches = false;
      }
      if (!matches) continue;
      const val = rule.style.getPropertyValue(prop);
      const varName = extractVarName(val);
      if (varName) return varName;
    }
    return null;
  };

  const getTypographyInfo = (el: HTMLElement): TypographyInfo => {
    const cs = window.getComputedStyle(el);
    const family = firstFontFamily(cs.fontFamily || "");
    const size = formatPx(cs.fontSize);
    const weight = weightWithKeyword(cs.fontWeight);
    const line = cs.lineHeight === "normal" ? "normal" : formatPx(cs.lineHeight);
    const tracking =
      cs.letterSpacing === "normal" ? "normal" : formatPx(cs.letterSpacing);

    const rows: TypographyRow[] = [
      { label: "Family", value: family, varName: findVarReference(el, "font-family") },
      { label: "Size", value: size, varName: findVarReference(el, "font-size") },
      { label: "Weight", value: weight, varName: findVarReference(el, "font-weight") },
      { label: "Line", value: line, varName: findVarReference(el, "line-height") },
      { label: "Tracking", value: tracking, varName: findVarReference(el, "letter-spacing") },
    ];

    const direct = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => (n.nodeValue ?? "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ");
    const textSnippet = direct.length > 40 ? `${direct.slice(0, 40)}…` : direct;

    return { rows, tagName: el.tagName.toLowerCase(), textSnippet };
  };

  // -------- DOM primitives (match measurer MeasurementBox) --------

  const makeEdge = (
    side: "top" | "right" | "bottom" | "left",
    color: string,
  ): HTMLDivElement => {
    const edge = document.createElement("div");
    edge.style.position = "absolute";
    edge.style.backgroundColor = color;
    if (side === "top" || side === "bottom") {
      edge.style.left = "0";
      edge.style[side] = "0";
      edge.style.width = "100%";
      edge.style.height = "1px";
    } else {
      edge.style.top = "0";
      edge.style[side] = "0";
      edge.style.width = "1px";
      edge.style.height = "100%";
    }
    return edge;
  };

  const makeBox = (fill: string, outline: string): HTMLDivElement => {
    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.pointerEvents = "none";
    box.style.backgroundColor = fill;
    box.style.boxSizing = "border-box";
    box.appendChild(makeEdge("top", outline));
    box.appendChild(makeEdge("right", outline));
    box.appendChild(makeEdge("bottom", outline));
    box.appendChild(makeEdge("left", outline));
    return box;
  };

  const positionBox = (box: HTMLDivElement, rect: DOMRect) => {
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  };

  const makeTag = (pinned: boolean): HTMLDivElement => {
    const tag = document.createElement("div");
    tag.className = pinned ? "mesurer-ti-tag mesurer-ti-tag--pinned" : "mesurer-ti-tag";
    tag.style.position = "fixed";
    tag.style.pointerEvents = pinned ? "auto" : "none";
    tag.style.background = "rgba(15, 23, 42, 0.9)";
    tag.style.color = "#f8fafc";
    tag.style.borderRadius = "4px";
    tag.style.padding = "4px 6px";
    tag.style.fontSize = "10px";
    tag.style.lineHeight = "1.4";
    tag.style.fontFamily =
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    tag.style.fontVariantNumeric = "tabular-nums";
    tag.style.userSelect = "none";
    tag.style.whiteSpace = "nowrap";
    tag.style.transform = "translateX(-50%)";
    tag.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)";
    if (!pinned) tag.style.transition = "opacity 120ms ease";
    return tag;
  };

  const populateTag = (tag: HTMLDivElement, info: TypographyInfo, pinned: boolean) => {
    tag.innerHTML = "";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "6px";
    header.style.marginBottom = "3px";

    const tagName = document.createElement("span");
    tagName.style.opacity = "0.9";
    tagName.style.color = "#0f172a";
    tagName.style.background = "#f8fafc";
    tagName.style.borderRadius = "3px";
    tagName.style.padding = "0 4px";
    tagName.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
    tagName.style.fontSize = "9px";
    tagName.textContent = info.tagName;
    header.appendChild(tagName);

    if (info.textSnippet) {
      const snippet = document.createElement("span");
      snippet.style.opacity = "0.75";
      snippet.style.overflow = "hidden";
      snippet.style.textOverflow = "ellipsis";
      snippet.style.maxWidth = "220px";
      snippet.style.whiteSpace = "nowrap";
      snippet.textContent = info.textSnippet;
      header.appendChild(snippet);
    }

    if (pinned) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "mesurer-ti-close";
      close.setAttribute("aria-label", "Close");
      close.textContent = "×";
      Object.assign(close.style, {
        all: "unset",
        marginLeft: "auto",
        width: "14px",
        height: "14px",
        lineHeight: "12px",
        textAlign: "center",
        borderRadius: "3px",
        color: "#cbd5e1",
        fontSize: "14px",
        cursor: "pointer",
      } satisfies Partial<CSSStyleDeclaration>);
      header.appendChild(close);
    }

    tag.appendChild(header);

    for (const row of info.rows) {
      const line = document.createElement("div");
      line.style.display = "grid";
      line.style.gridTemplateColumns = "52px 1fr auto";
      line.style.columnGap = "8px";
      line.style.alignItems = "baseline";

      const l = document.createElement("span");
      l.style.opacity = "0.55";
      l.textContent = row.label;

      const v = document.createElement("span");
      v.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
      v.style.overflow = "hidden";
      v.style.textOverflow = "ellipsis";
      v.textContent = row.value;

      line.appendChild(l);
      line.appendChild(v);

      if (row.varName) {
        const varEl = document.createElement("span");
        varEl.style.opacity = "0.55";
        varEl.style.fontFamily =
          "ui-monospace, SFMono-Regular, Menlo, monospace";
        varEl.style.color = "#7dd3fc";
        varEl.textContent = row.varName;
        line.appendChild(varEl);
      }

      tag.appendChild(line);
    }
  };

  // Position the tag just below the box, centered; fall back above if it'd
  // run off the bottom. Clamp horizontally.
  const positionTagFor = (
    tag: HTMLDivElement,
    rect: DOMRect,
    offsetX = 0,
    offsetY = 0,
  ) => {
    // Center below box by default.
    const cx = rect.left + rect.width / 2 + offsetX;
    tag.style.left = `${cx}px`;
    // Measure first so we can flip / clamp.
    const size = tag.getBoundingClientRect();
    let top = rect.bottom + 4 + offsetY;
    if (top + size.height > window.innerHeight - 8) {
      top = rect.top - size.height - 4 + offsetY;
    }
    if (top < 8) top = 8;
    tag.style.top = `${top}px`;

    // Horizontal clamp (after layout).
    const half = size.width / 2;
    const minLeft = 8 + half;
    const maxLeft = window.innerWidth - 8 - half;
    if (cx < minLeft) tag.style.left = `${minLeft}px`;
    else if (cx > maxLeft) tag.style.left = `${maxLeft}px`;
  };

  // -------- overlay + styles --------

  const ensureStyles = () => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = INSPECTOR_STYLES;
    document.head.appendChild(s);
  };

  const removeStyles = () => {
    document.getElementById(STYLE_ID)?.remove();
  };

  const ensureOverlay = (): HTMLDivElement => {
    if (overlay && overlay.isConnected) return overlay;
    const el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.pointerEvents = "none";
    // One notch below the extension host (max-int z-index) so the mesurer
    // toolbar stays painted on top. The host is transparent, so our cards
    // and boxes remain visible across the page underneath the toolbar.
    el.style.zIndex = "2147483646";
    document.body.appendChild(el);
    overlay = el;
    return el;
  };

  const ensureHoverElements = () => {
    const root = ensureOverlay();
    if (!hoverBox) {
      hoverBox = makeBox(FILL_HOVER, OUTLINE_HOVER);
      hoverBox.style.opacity = "0";
      hoverBox.style.transition = "opacity 80ms ease";
      root.appendChild(hoverBox);
    }
    if (!hoverTag) {
      hoverTag = makeTag(false);
      hoverTag.style.opacity = "0";
      root.appendChild(hoverTag);
    }
  };

  // -------- hover tracking --------

  const updateHover = () => {
    if (!enabled) return;

    // If pointer is over the toolbar, hide hover UI but keep the mode on.
    if (isPointerOverExtensionUI(pointerX, pointerY)) {
      hideHover();
      return;
    }

    const el = pickElementAt(pointerX, pointerY);
    if (!el) {
      hideHover();
      return;
    }

    ensureHoverElements();
    const rect = el.getBoundingClientRect();

    if (el !== hoveredEl) {
      hoveredEl = el;
      const info = getTypographyInfo(el);
      populateTag(hoverTag!, info, false);
    }

    positionBox(hoverBox!, rect);
    positionTagFor(hoverTag!, rect);
    hoverBox!.style.opacity = "1";
    hoverTag!.style.opacity = "1";
  };

  const hideHover = () => {
    hoveredEl = null;
    if (hoverBox) hoverBox.style.opacity = "0";
    if (hoverTag) hoverTag.style.opacity = "0";
  };

  // -------- pinned cards --------

  const pinCurrent = (x: number, y: number) => {
    const sourceEl = pickElementAt(x, y);
    if (!sourceEl) return;

    const root = ensureOverlay();
    const info = getTypographyInfo(sourceEl);
    const box = makeBox(FILL_PINNED, OUTLINE_PINNED);
    const tag = makeTag(true);
    populateTag(tag, info, true);
    tag.style.animation = "mesurer-ti-pop 180ms ease-out";
    root.appendChild(box);
    root.appendChild(tag);

    const rect = sourceEl.getBoundingClientRect();
    positionBox(box, rect);
    positionTagFor(tag, rect);

    const entry: Pinned = {
      sourceEl,
      box,
      tag,
      dragOffsetX: 0,
      dragOffsetY: 0,
      userPlaced: false,
      detach: () => {},
    };
    pinned.push(entry);

    const close = tag.querySelector<HTMLButtonElement>(".mesurer-ti-close");
    close?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      removePinned(entry);
    });

    entry.detach = attachDrag(entry);

    // Clear the pop class after animation so re-pins retrigger it.
    window.setTimeout(() => {
      tag.style.animation = "";
    }, 220);
  };

  const attachDrag = (entry: Pinned): (() => void) => {
    const SLOP = 6;
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let didDrag = false;
    let active = false;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!active) active = Math.abs(dx) > SLOP || Math.abs(dy) > SLOP;
      if (!active) return;
      didDrag = true;
      const maxX = Math.max(8, window.innerWidth - 8);
      const maxY = Math.max(8, window.innerHeight - 8);
      const nx = Math.min(maxX, Math.max(8, originLeft + dx));
      const ny = Math.min(maxY, Math.max(8, originTop + dy));
      entry.tag.style.left = `${nx}px`;
      entry.tag.style.top = `${ny}px`;
      entry.userPlaced = true;
    };

    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId && pointerId !== -1) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      pointerId = -1;
      active = false;
      if (didDrag) {
        // Swallow the follow-up click so the close button / drag don't
        // both fire after release.
        const swallow = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          window.removeEventListener("click", swallow, true);
        };
        window.addEventListener("click", swallow, true);
      }
      didDrag = false;
    };

    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      const target = ev.target as HTMLElement | null;
      if (target?.classList.contains("mesurer-ti-close")) return;
      const rect = entry.tag.getBoundingClientRect();
      originLeft = rect.left + rect.width / 2; // because transform is translateX(-50%)
      originTop = rect.top;
      startX = ev.clientX;
      startY = ev.clientY;
      pointerId = ev.pointerId;
      didDrag = false;
      active = false;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    };

    entry.tag.addEventListener("pointerdown", onDown);
    return () => {
      entry.tag.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  };

  const removePinned = (entry: Pinned) => {
    const i = pinned.indexOf(entry);
    if (i === -1) return;
    pinned.splice(i, 1);
    entry.detach();
    entry.box.remove();
    entry.tag.remove();
  };

  const removeAllPinned = () => {
    while (pinned.length > 0) {
      const entry = pinned.pop()!;
      entry.detach();
      entry.box.remove();
      entry.tag.remove();
    }
  };

  // Keep pinned boxes (and non-user-placed tags) in sync with their source
  // elements on scroll / resize / layout change. Runs on the same rAF tick
  // as hover updates so we only touch the DOM once per frame.
  const syncPinned = () => {
    for (const entry of pinned) {
      if (!entry.sourceEl.isConnected) {
        removePinned(entry);
        continue;
      }
      const rect = entry.sourceEl.getBoundingClientRect();
      positionBox(entry.box, rect);
      if (!entry.userPlaced) positionTagFor(entry.tag, rect);
    }
  };

  // -------- rAF throttle --------

  const scheduleFrame = () => {
    if (frameScheduled) return;
    frameScheduled = true;
    requestAnimationFrame(() => {
      frameScheduled = false;
      if (!enabled) return;
      updateHover();
      syncPinned();
    });
  };

  // -------- event handlers --------

  const onMouseMove = (ev: MouseEvent) => {
    pointerX = ev.clientX;
    pointerY = ev.clientY;
    scheduleFrame();
  };

  const onMouseLeaveWindow = (ev: MouseEvent) => {
    if (!ev.relatedTarget) hideHover();
  };

  const onScrollOrResize = () => {
    scheduleFrame();
  };

  const onClickCapture = (ev: MouseEvent) => {
    // Don't interfere with our own overlay (close button, tag drag, etc.).
    const target = ev.target as Element | null;
    if (target?.closest?.(`#${OVERLAY_ID}`)) return;
    // Allow clicks on the mesurer toolbar through so the user can toggle
    // the mode back off.
    if (isPointerOverExtensionUI(ev.clientX, ev.clientY)) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();

    if (ev.button !== 0) return;
    pinCurrent(ev.clientX, ev.clientY);
  };

  const onAuxClickCapture = (ev: MouseEvent) => {
    const target = ev.target as Element | null;
    if (target?.closest?.(`#${OVERLAY_ID}`)) return;
    if (isPointerOverExtensionUI(ev.clientX, ev.clientY)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  };

  // -------- lifecycle --------

  const enable = () => {
    if (enabled) return;
    if (typeof document === "undefined") return;
    enabled = true;
    ensureStyles();
    ensureOverlay();
    document.body.classList.add(BODY_MODE_CLASS);
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseout", onMouseLeaveWindow, true);
    window.addEventListener("click", onClickCapture, true);
    window.addEventListener("auxclick", onAuxClickCapture, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize, true);
  };

  const disable = () => {
    if (!enabled) return;
    enabled = false;
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseout", onMouseLeaveWindow, true);
    window.removeEventListener("click", onClickCapture, true);
    window.removeEventListener("auxclick", onAuxClickCapture, true);
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize, true);
    hideHover();
    if (hoverBox) {
      hoverBox.remove();
      hoverBox = null;
    }
    if (hoverTag) {
      hoverTag.remove();
      hoverTag = null;
    }
    removeAllPinned();
    if (typeof document !== "undefined") {
      document.body.classList.remove(BODY_MODE_CLASS);
    }
  };

  const isEnabled = () => enabled;

  const cleanup = () => {
    disable();
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    removeStyles();
  };

  return { enable, disable, isEnabled, cleanup };
})();

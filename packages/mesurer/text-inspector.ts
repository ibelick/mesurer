// Text-style inspector ("Aa" mode) for the mesurer overlay.
//
// Exposes `enable()`, `disable()`, `isEnabled()`, and `cleanup()` from a
// single module-scoped IIFE (`TextInspector`). The module is pure DOM — no
// React — so it can be toggled from a React toolbar button but owns its own
// lifecycle and event listeners.
//
// Non-goals: not a DevTools clone. Only the 5 typography properties plus
// any CSS custom-property (`var(--x)`) references backing them.

const EXTENSION_HOST_ID = "mesurer-extension-host";

const OVERLAY_ID = "mesurer-text-inspector-overlay";
const STYLE_ID = "mesurer-text-inspector-styles";
const BODY_MODE_CLASS = "mesurer-text-inspect-mode";
const HOVER_OUTLINE_CLASS = "mesurer-text-inspect-hover";
const PINNED_OUTLINE_CLASS = "mesurer-text-inspect-pinned";

// Self-contained CSS. Lives in `document.head` because the hover outline is
// applied to page elements (document scope) and cards are appended to
// `document.body` (also document scope) — the mesurer shadow-DOM stylesheet
// would not reach either. Matches the mesurer toolbar tokens where possible:
// surface bg #fff, border ink-200 (#e2e8f0), text ink-700 (#334155), active
// accent #0d99ff.
const INSPECTOR_STYLES = `
.${BODY_MODE_CLASS},
.${BODY_MODE_CLASS} * {
  cursor: help !important;
}
.${BODY_MODE_CLASS} #${EXTENSION_HOST_ID},
.${BODY_MODE_CLASS} #${EXTENSION_HOST_ID} * {
  cursor: auto !important;
}
.${BODY_MODE_CLASS} #${OVERLAY_ID},
.${BODY_MODE_CLASS} #${OVERLAY_ID} * {
  cursor: auto !important;
}

.${HOVER_OUTLINE_CLASS} {
  box-shadow:
    0 0 0 1px rgba(13, 153, 255, 0.5),
    0 0 0 4px rgba(13, 153, 255, 0.12) !important;
  background-color: rgba(13, 153, 255, 0.05) !important;
  transition:
    box-shadow 120ms ease,
    background-color 120ms ease;
}

.${PINNED_OUTLINE_CLASS} {
  box-shadow:
    0 0 0 1px rgba(13, 153, 255, 0.28),
    0 0 0 3px rgba(13, 153, 255, 0.06) !important;
}

.mesurer-text-inspect-card {
  position: fixed;
  left: 0;
  top: 0;
  min-width: 220px;
  max-width: 320px;
  padding: 8px 10px 10px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #334155;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    sans-serif;
  font-size: 11px;
  line-height: 1.35;
  box-shadow:
    0 0 0.5px rgba(0, 0, 0, 0.18),
    0 3px 8px rgba(0, 0, 0, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: auto;
  z-index: 2147483646;
  user-select: none;
}
.mesurer-text-inspect-card--hover {
  pointer-events: none;
}
.mesurer-text-inspect-card--pop {
  animation: mesurer-text-inspect-pop 180ms ease-out;
}
@keyframes mesurer-text-inspect-pop {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.mesurer-text-inspect-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
}
.mesurer-text-inspect-card__header--drag {
  cursor: grab;
}
.mesurer-text-inspect-card__header--drag:active {
  cursor: grabbing;
}
.mesurer-text-inspect-card__tag {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  background: #0d99ff;
  color: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 500;
  flex-shrink: 0;
}
.mesurer-text-inspect-card__snippet {
  flex: 1;
  color: #64748b;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mesurer-text-inspect-card__close {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  color: #64748b;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}
.mesurer-text-inspect-card__close:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.mesurer-text-inspect-card__grid {
  display: grid;
  grid-template-columns: 60px 1fr;
  column-gap: 10px;
  row-gap: 4px;
}
.mesurer-text-inspect-card__label {
  color: #64748b;
  font-size: 11px;
}
.mesurer-text-inspect-card__value {
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  word-break: break-word;
}
.mesurer-text-inspect-card__var {
  margin-top: 1px;
  color: #0d99ff;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
`;

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

type PinnedCard = {
  card: HTMLDivElement;
  sourceEl: HTMLElement;
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
  let hoverCard: HTMLDivElement | null = null;
  let hoveredEl: HTMLElement | null = null;
  const pinnedCards: PinnedCard[] = [];
  // Map sourceEl -> number of pinned cards referencing it.
  const pinRefCounts = new WeakMap<HTMLElement, number>();

  // -------- helpers --------

  const isExtensionOwnedNode = (node: Node | null): boolean => {
    if (!node) return false;
    // Walk up through assigned slots / shadow roots.
    let current: Node | null = node;
    while (current) {
      if (current instanceof HTMLElement) {
        if (current.id === EXTENSION_HOST_ID) return true;
        if (current.id === OVERLAY_ID) return true;
      }
      const root: Node | null = (current as Node).getRootNode?.() ?? null;
      if (root instanceof ShadowRoot) {
        const host: Element = root.host;
        if (host && host.id === EXTENSION_HOST_ID) return true;
        current = host;
        continue;
      }
      current = current.parentNode;
    }
    return false;
  };

  const hasDirectTextContent = (el: Element): boolean => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.nodeValue ?? "";
        if (text.trim().length > 0) return true;
      }
    }
    return false;
  };

  const isInspectable = (el: Element | null): el is HTMLElement => {
    if (!el) return false;
    if (!(el instanceof HTMLElement)) return false;
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (el instanceof SVGElement) return false;
    if (isExtensionOwnedNode(el)) return false;
    if (!hasDirectTextContent(el)) return false;
    return true;
  };

  const pickElementAt = (x: number, y: number): HTMLElement | null => {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (isExtensionOwnedNode(el)) continue;
      if (isInspectable(el)) return el;
    }
    return null;
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

  // Extract a `var(--name)` reference from a CSS declaration value.
  const extractVarName = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const match = /var\(\s*(--[a-zA-Z0-9_-]+)/.exec(value);
    return match ? match[1] : null;
  };

  // Walk inline style + all matching CSS rules on the element and its
  // ancestors (respecting @media matches, skipping cross-origin sheets) to
  // find the most-specific declaration for `prop` that uses a CSS variable.
  const findVarReference = (
    el: HTMLElement,
    prop: string,
  ): string | null => {
    let node: HTMLElement | null = el;
    while (node) {
      // Inline style first (highest specificity after !important).
      const inline = node.style.getPropertyValue(prop);
      const inlineVar = extractVarName(inline);
      if (inlineVar) return inlineVar;

      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        let rules: CSSRuleList | null = null;
        try {
          rules = sheet.cssRules;
        } catch {
          // Cross-origin stylesheet — skip.
          continue;
        }
        if (!rules) continue;

        const varFromRules = scanRulesForVar(rules, node, prop);
        if (varFromRules) return varFromRules;
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
        const nested = scanRulesForVar(rule.cssRules, el, prop);
        if (nested) return nested;
        continue;
      }

      if (rule instanceof CSSSupportsRule) {
        const nested = scanRulesForVar(rule.cssRules, el, prop);
        if (nested) return nested;
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

      const value = rule.style.getPropertyValue(prop);
      const varName = extractVarName(value);
      if (varName) return varName;
    }
    return null;
  };

  const getTypographyInfo = (el: HTMLElement): TypographyInfo => {
    const cs = window.getComputedStyle(el);

    const familyRaw = cs.fontFamily || "";
    const family = firstFontFamily(familyRaw);
    const size = formatPx(cs.fontSize);
    const weight = weightWithKeyword(cs.fontWeight);
    const line =
      cs.lineHeight === "normal" ? "normal" : formatPx(cs.lineHeight);
    const tracking =
      cs.letterSpacing === "normal"
        ? "normal"
        : formatPx(cs.letterSpacing);

    const rows: TypographyRow[] = [
      {
        label: "Family",
        value: family,
        varName: findVarReference(el, "font-family"),
      },
      {
        label: "Size",
        value: size,
        varName: findVarReference(el, "font-size"),
      },
      {
        label: "Weight",
        value: weight,
        varName: findVarReference(el, "font-weight"),
      },
      {
        label: "Line",
        value: line,
        varName: findVarReference(el, "line-height"),
      },
      {
        label: "Tracking",
        value: tracking,
        varName: findVarReference(el, "letter-spacing"),
      },
    ];

    const directText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => (n.nodeValue ?? "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ");
    const textSnippet =
      directText.length > 40 ? `${directText.slice(0, 40)}…` : directText;

    return {
      rows,
      tagName: el.tagName.toLowerCase(),
      textSnippet,
    };
  };

  // -------- DOM building --------

  const ensureStyles = () => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = INSPECTOR_STYLES;
    document.head.appendChild(style);
  };

  const removeStyles = () => {
    if (typeof document === "undefined") return;
    document.getElementById(STYLE_ID)?.remove();
  };

  const ensureOverlay = (): HTMLDivElement => {
    if (overlay && overlay.isConnected) return overlay;
    const el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.pointerEvents = "none";
    // Just below the extension host (which sits at max int z-index) so the
    // mesurer toolbar still paints on top; the host itself is transparent
    // so our cards remain visible across the page.
    el.style.zIndex = "2147483646";
    document.body.appendChild(el);
    overlay = el;
    return el;
  };

  const buildCard = (
    info: TypographyInfo,
    pinned: boolean,
  ): HTMLDivElement => {
    const card = document.createElement("div");
    card.className = `mesurer-text-inspect-card${
      pinned ? " mesurer-text-inspect-card--pinned" : ""
    }`;

    const header = document.createElement("div");
    header.className = "mesurer-text-inspect-card__header";
    if (pinned) header.classList.add("mesurer-text-inspect-card__header--drag");

    const tag = document.createElement("span");
    tag.className = "mesurer-text-inspect-card__tag";
    tag.textContent = info.tagName;
    header.appendChild(tag);

    const snippet = document.createElement("span");
    snippet.className = "mesurer-text-inspect-card__snippet";
    snippet.textContent = info.textSnippet;
    header.appendChild(snippet);

    if (pinned) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "mesurer-text-inspect-card__close";
      close.setAttribute("aria-label", "Close pinned inspector");
      close.textContent = "×";
      header.appendChild(close);
    }

    card.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "mesurer-text-inspect-card__grid";

    for (const row of info.rows) {
      const label = document.createElement("div");
      label.className = "mesurer-text-inspect-card__label";
      label.textContent = row.label;

      const valueWrap = document.createElement("div");
      valueWrap.className = "mesurer-text-inspect-card__value";
      const val = document.createElement("div");
      val.textContent = row.value;
      valueWrap.appendChild(val);
      if (row.varName) {
        const varEl = document.createElement("div");
        varEl.className = "mesurer-text-inspect-card__var";
        varEl.textContent = row.varName;
        valueWrap.appendChild(varEl);
      }

      grid.appendChild(label);
      grid.appendChild(valueWrap);
    }

    card.appendChild(grid);
    return card;
  };

  const clampCardToViewport = (
    card: HTMLDivElement,
    x: number,
    y: number,
  ) => {
    const PAD = 8;
    const OFFSET = 16;
    const rect = card.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - PAD;
    const maxY = window.innerHeight - rect.height - PAD;
    let left = x + OFFSET;
    let top = y + OFFSET;
    if (left > maxX) left = Math.max(PAD, x - rect.width - OFFSET);
    if (top > maxY) top = Math.max(PAD, y - rect.height - OFFSET);
    if (left < PAD) left = PAD;
    if (top < PAD) top = PAD;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  };

  // -------- hover state --------

  const setHoverTarget = (el: HTMLElement | null) => {
    if (hoveredEl === el) return;
    if (hoveredEl) {
      hoveredEl.classList.remove(HOVER_OUTLINE_CLASS);
    }
    hoveredEl = el;
    if (hoveredEl) {
      hoveredEl.classList.add(HOVER_OUTLINE_CLASS);
    }
  };

  const showHoverCard = (el: HTMLElement, x: number, y: number) => {
    const parent = ensureOverlay();
    const info = getTypographyInfo(el);
    if (hoverCard) hoverCard.remove();
    hoverCard = buildCard(info, false);
    hoverCard.classList.add("mesurer-text-inspect-card--hover");
    parent.appendChild(hoverCard);
    clampCardToViewport(hoverCard, x, y);
  };

  const moveHoverCard = (x: number, y: number) => {
    if (!hoverCard) return;
    clampCardToViewport(hoverCard, x, y);
  };

  const clearHoverCard = () => {
    if (hoverCard) {
      hoverCard.remove();
      hoverCard = null;
    }
    setHoverTarget(null);
  };

  // -------- pinned cards --------

  const incrementPin = (el: HTMLElement) => {
    const count = (pinRefCounts.get(el) ?? 0) + 1;
    pinRefCounts.set(el, count);
    el.classList.add(PINNED_OUTLINE_CLASS);
  };

  const decrementPin = (el: HTMLElement) => {
    const count = (pinRefCounts.get(el) ?? 1) - 1;
    if (count <= 0) {
      pinRefCounts.delete(el);
      el.classList.remove(PINNED_OUTLINE_CLASS);
    } else {
      pinRefCounts.set(el, count);
    }
  };

  const attachPinnedDrag = (card: HTMLDivElement) => {
    const header = card.querySelector<HTMLDivElement>(
      ".mesurer-text-inspect-card__header",
    );
    if (!header) return;

    const SLOP = 6;
    let active = false;
    let didDrag = false;
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let width = 0;
    let height = 0;

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!active) {
        active = Math.abs(dx) > SLOP || Math.abs(dy) > SLOP;
      }
      if (!active) return;
      didDrag = true;
      const maxX = Math.max(8, window.innerWidth - width - 8);
      const maxY = Math.max(8, window.innerHeight - height - 8);
      const nx = Math.min(maxX, Math.max(8, originX + dx));
      const ny = Math.min(maxY, Math.max(8, originY + dy));
      card.style.left = `${nx}px`;
      card.style.top = `${ny}px`;
    };

    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId && pointerId !== -1) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      pointerId = -1;
      active = false;
      if (didDrag) {
        // Swallow the click that fires after a drag-end.
        const swallow = (clickEv: Event) => {
          clickEv.preventDefault();
          clickEv.stopPropagation();
          window.removeEventListener("click", swallow, true);
        };
        window.addEventListener("click", swallow, true);
      }
      didDrag = false;
    };

    header.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const target = ev.target as HTMLElement | null;
      if (target?.classList.contains("mesurer-text-inspect-card__close")) {
        return;
      }
      const rect = card.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      width = rect.width;
      height = rect.height;
      startX = ev.clientX;
      startY = ev.clientY;
      pointerId = ev.pointerId;
      active = false;
      didDrag = false;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    });
  };

  const pinCard = (sourceEl: HTMLElement, x: number, y: number) => {
    const parent = ensureOverlay();
    const info = getTypographyInfo(sourceEl);
    const card = buildCard(info, true);
    card.classList.add("mesurer-text-inspect-card--pop");
    parent.appendChild(card);
    clampCardToViewport(card, x, y);

    const entry: PinnedCard = { card, sourceEl };
    pinnedCards.push(entry);
    incrementPin(sourceEl);

    const close = card.querySelector<HTMLButtonElement>(
      ".mesurer-text-inspect-card__close",
    );
    close?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      removePinned(entry);
    });

    attachPinnedDrag(card);

    // Drop the scale-pop class after animation runs so re-adds retrigger it.
    window.setTimeout(() => {
      card.classList.remove("mesurer-text-inspect-card--pop");
    }, 220);
  };

  const removePinned = (entry: PinnedCard) => {
    const idx = pinnedCards.indexOf(entry);
    if (idx === -1) return;
    pinnedCards.splice(idx, 1);
    entry.card.remove();
    decrementPin(entry.sourceEl);
  };

  const removeAllPinned = () => {
    while (pinnedCards.length > 0) {
      const entry = pinnedCards.pop()!;
      entry.card.remove();
      decrementPin(entry.sourceEl);
    }
  };

  // -------- event handlers --------

  // The extension host (`#mesurer-extension-host`) is a fixed, inset-0 div
  // that sits above the page and — with `pointer-events: auto` — ends up as
  // `event.target` for virtually every mouse event. Bailing on
  // `isExtensionOwnedNode(target)` therefore suppresses inspection
  // everywhere. Instead, check whether the pointer is over an element inside
  // the extension's shadow DOM that is actually interactive. The mesurer
  // overlay inside that shadow is `pointer-events: none`, so when the
  // cursor is over empty host space, `shadow.elementFromPoint()` returns
  // null / a non-interactive wrapper — we treat that as "page" and inspect.
  // When it's over the toolbar (the only interactive shadow subtree), we
  // skip the card and let the click through so the user can toggle the
  // mode back off.
  const isPointerOverExtensionUI = (x: number, y: number): boolean => {
    if (typeof document === "undefined") return false;
    const host = document.getElementById(EXTENSION_HOST_ID) as
      | HTMLElement
      | null;
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    const el = shadow.elementFromPoint(x, y);
    if (!el) return false;
    // `.mesurer-root` is the pointer-events:none overlay wrapper. Only
    // descendants that opt back in to pointer events (the toolbar) count
    // as "extension UI" for our purposes.
    let node: Element | null = el;
    while (node) {
      if (node.classList?.contains("mesurer-toolbar-surface")) return true;
      node = node.parentElement;
    }
    return false;
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (isPointerOverExtensionUI(ev.clientX, ev.clientY)) {
      setHoverTarget(null);
      if (hoverCard) {
        hoverCard.remove();
        hoverCard = null;
      }
      return;
    }

    const el = pickElementAt(ev.clientX, ev.clientY);
    if (!el) {
      clearHoverCard();
      return;
    }

    setHoverTarget(el);
    if (!hoverCard) {
      showHoverCard(el, ev.clientX, ev.clientY);
    } else {
      // Re-render if the hovered element changed identity (cheap string diff
      // on tagName + snippet avoids rebuilding on every mouse wiggle).
      const existingTag = hoverCard.dataset.tag;
      const info = getTypographyInfo(el);
      const key = `${info.tagName}|${info.textSnippet}|${info.rows
        .map((r) => `${r.label}:${r.value}:${r.varName ?? ""}`)
        .join("|")}`;
      if (existingTag !== key) {
        hoverCard.remove();
        hoverCard = buildCard(info, false);
        hoverCard.classList.add("mesurer-text-inspect-card--hover");
        hoverCard.dataset.tag = key;
        ensureOverlay().appendChild(hoverCard);
      }
      moveHoverCard(ev.clientX, ev.clientY);
    }
  };

  const onMouseOut = (ev: MouseEvent) => {
    const related = ev.relatedTarget as Node | null;
    if (!related) clearHoverCard();
  };

  const onClickCapture = (ev: MouseEvent) => {
    // Don't swallow clicks aimed at our own pinned-card UI (close button,
    // header drag, etc.) — those are `pointer-events: auto` divs appended
    // to our document-level overlay.
    const target = ev.target as Element | null;
    if (target?.closest?.(`#${OVERLAY_ID}`)) return;

    // Let clicks on the toolbar (shadow-DOM hit test) through so the user
    // can toggle the mode back off.
    if (isPointerOverExtensionUI(ev.clientX, ev.clientY)) return;

    // Swallow page navigation / interaction so links don't fire.
    ev.preventDefault();
    ev.stopImmediatePropagation();

    if (ev.button !== 0) return;
    const el = pickElementAt(ev.clientX, ev.clientY);
    if (!el) return;
    pinCard(el, ev.clientX, ev.clientY);
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
    window.addEventListener("mouseout", onMouseOut, true);
    window.addEventListener("click", onClickCapture, true);
    window.addEventListener("auxclick", onAuxClickCapture, true);
  };

  const disable = () => {
    if (!enabled) return;
    enabled = false;
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseout", onMouseOut, true);
    window.removeEventListener("click", onClickCapture, true);
    window.removeEventListener("auxclick", onAuxClickCapture, true);
    clearHoverCard();
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

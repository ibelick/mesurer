// Text-style inspector ("Aa" mode) for the mesurer overlay.
//
// Exposes `enable()`, `disable()`, `isEnabled()`, and `cleanup()` from a
// single module-scoped IIFE (`TextInspector`). Pure DOM — no React.
//
// ─────────────────────────────────────────────────────────────
// ANIMATION STORYBOARD
//
//   First hover (nothing visible yet):
//     0ms    box fades in + scales 0.98 → 1            (160ms, ease-out)
//     60ms   card fades in + translateY 4px → 0 +
//            scales 0.97 → 1                           (180ms, ease-out)
//
//   Retarget (card already visible, pointer moves to another element):
//     0ms    box + card snap to new position instantly
//            no re-entrance. Sonner principle: the second
//            tooltip feels instant.
//
//   Pin (click):
//     0ms    pinned box fades in
//     0ms    pinned card pops: scale 0.96 → 1 +
//            translateY(2px) → 0 + opacity 0 → 1       (220ms, ease-out)
//
//   Pin close (× or disable):
//     0ms    card + box collapse: scale 1 → 0.97 +
//            opacity 1 → 0                             (140ms, ease-out)
//
//   Close button press:
//     scale(0.92) on :active                           (80ms, ease-out)
//
//   Continuous updates (mousemove, scroll, resize, pin sync):
//     No transition — pointer tracking must land on the
//     exact frame. rAF-throttled so we write once per tick.
//
//   prefers-reduced-motion: all transitions collapse to opacity
//     only, no transform.
// ─────────────────────────────────────────────────────────────
//
// Visual language mirrors the measurer's menu surface:
//   - Card: solid white, ink-200 (#e2e8f0) 1px border, 8px radius,
//     matching `.mesurer-menu-surface` shadow.
//   - Highlight: fill + 4 hairline edges in the measurer blue.
//   - Dark tag badge + truncated snippet + close button in header.
//   - Two-column grid (label | monospace value · var-ref) for rows.

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

// Ink tokens mirror `styles.css` so the card reads as first-party mesurer.
const INK_50 = "#f8fafc";
const INK_200 = "#e2e8f0";
const INK_500 = "#64748b";
const INK_900 = "#0f172a";

// --- Motion system (see storyboard at the top of the file). -------------
//
// Named timing + easing so the whole animation system is readable at the
// top of the file. Durations stay under the 300ms ceiling Emil recommends
// for UI; easing is a "strong ease-out" curve from easing.dev that punches
// more than the stock CSS `ease-out`.
const TIMING = {
  boxEnter: 160, // hover box appears
  tagEnter: 180, // hover card appears (60ms lag after the box)
  tagEnterDelay: 60,
  pinEnter: 220, // pinned card pops in
  exitFast: 140, // pin close / mode disable
  closeTap: 80, // close-button press feedback
} as const;

const EASE = {
  out: "cubic-bezier(0.23, 1, 0.32, 1)",
  inOut: "cubic-bezier(0.77, 0, 0.175, 1)",
} as const;

// Minimal page-scoped styles. Transitions (not keyframes) so any hover
// retarget or rapid close interrupts smoothly.
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
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-card--pinned {
  cursor: grab;
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-card--pinned:active {
  cursor: grabbing;
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-close {
  cursor: pointer;
  transition: background-color 120ms ${EASE.out}, color 120ms ${EASE.out}, transform ${TIMING.closeTap}ms ${EASE.out};
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-close:hover {
  background: rgba(15, 23, 42, 0.06);
  color: ${INK_900};
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-close:active {
  transform: scale(0.92);
}

/* Entrance / exit state classes — CSS transitions, not keyframes, so a
   rapid retarget or close can interrupt smoothly. */
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-box {
  transition: opacity ${TIMING.boxEnter}ms ${EASE.out}, transform ${TIMING.boxEnter}ms ${EASE.out};
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-box[data-state="hidden"] {
  opacity: 0;
  transform: scale(0.98);
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-box[data-state="visible"] {
  opacity: 1;
  transform: scale(1);
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-card {
  transform-origin: top center;
  transition:
    opacity ${TIMING.tagEnter}ms ${EASE.out},
    transform ${TIMING.tagEnter}ms ${EASE.out};
  will-change: transform, opacity;
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-card[data-state="hidden"] {
  opacity: 0;
  transform: translate(-50%, 4px) scale(0.97);
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-card[data-state="visible"] {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-card--pinned {
  transition:
    opacity ${TIMING.pinEnter}ms ${EASE.out},
    transform ${TIMING.pinEnter}ms ${EASE.out};
}
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-card--pinned[data-state="hidden"] {
  opacity: 0;
  transform: translate(-50%, 2px) scale(0.96);
}

/* Retarget: when the card is already visible and the pointer moves to a
   new element, disable the entrance transition for a single frame so the
   card snaps rather than re-animating. */
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-box[data-instant],
.${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-card[data-instant] {
  transition-duration: 0ms !important;
}

/* Respect reduced-motion: keep the fade for comprehension, drop transform. */
@media (prefers-reduced-motion: reduce) {
  .${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-box,
  .${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-card {
    transition: opacity 120ms linear !important;
    transform: translate(-50%, 0) scale(1) !important;
  }
  .${BODY_MODE_CLASS} #${OVERLAY_ID} .mesurer-ti-box {
    transform: scale(1) !important;
  }
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

  const TYPO_PROPS = [
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
  ] as const;
  type TypoProp = (typeof TYPO_PROPS)[number];

  // Cache of typography info per element. Live across hovers so mousing
  // back over a previously-seen element is O(1). A WeakMap lets the GC
  // drop entries if the page swaps DOM.
  const typographyCache = new WeakMap<HTMLElement, TypographyInfo>();

  // Accessible stylesheet rule cache. Computing the accessible rules list
  // once per enable() is dramatically cheaper than re-reading
  // `document.styleSheets[i].cssRules` on every hover target switch.
  // Invalidated whenever the total sheet count changes.
  type FlatRule = { rule: CSSStyleRule; mediaOk: boolean };
  let ruleCache: FlatRule[] | null = null;
  let ruleCacheSheetCount = -1;

  const buildRuleCache = (): FlatRule[] => {
    const out: FlatRule[] = [];
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      let rules: CSSRuleList | null = null;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!rules) continue;
      collectRules(rules, out, true);
    }
    return out;
  };

  const collectRules = (
    rules: CSSRuleList,
    out: FlatRule[],
    mediaOk: boolean,
  ) => {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule instanceof CSSMediaRule) {
        let inner = mediaOk;
        try {
          inner = mediaOk && window.matchMedia(rule.media.mediaText).matches;
        } catch {
          inner = false;
        }
        collectRules(rule.cssRules, out, inner);
        continue;
      }
      if (rule instanceof CSSSupportsRule) {
        collectRules(rule.cssRules, out, mediaOk);
        continue;
      }
      if (rule instanceof CSSStyleRule) out.push({ rule, mediaOk });
    }
  };

  const getRuleCache = (): FlatRule[] => {
    const count = document.styleSheets.length;
    if (!ruleCache || count !== ruleCacheSheetCount) {
      ruleCache = buildRuleCache();
      ruleCacheSheetCount = count;
    }
    return ruleCache;
  };

  // One pass up the ancestor chain, one pass through all cached rules,
  // resolving var refs for all 5 typography properties at once.
  const findVarReferencesBatch = (
    el: HTMLElement,
  ): Record<TypoProp, string | null> => {
    const out: Record<string, string | null> = {
      "font-family": null,
      "font-size": null,
      "font-weight": null,
      "line-height": null,
      "letter-spacing": null,
    };
    let remaining: number = TYPO_PROPS.length;

    const tryAssign = (prop: TypoProp, val: string | null | undefined) => {
      if (out[prop] !== null) return;
      const name = extractVarName(val);
      if (!name) return;
      out[prop] = name;
      remaining--;
    };

    const rules = getRuleCache();

    let node: HTMLElement | null = el;
    while (node && remaining > 0) {
      // 1. Inline styles win.
      for (const prop of TYPO_PROPS) {
        if (out[prop] !== null) continue;
        tryAssign(prop, node.style.getPropertyValue(prop));
      }
      if (remaining === 0) break;

      // 2. Matching stylesheet rules.
      for (let i = 0; i < rules.length && remaining > 0; i++) {
        const { rule, mediaOk } = rules[i];
        if (!mediaOk) continue;
        let matches = false;
        try {
          matches = node.matches(rule.selectorText);
        } catch {
          matches = false;
        }
        if (!matches) continue;
        for (const prop of TYPO_PROPS) {
          if (out[prop] !== null) continue;
          tryAssign(prop, rule.style.getPropertyValue(prop));
        }
      }

      node = node.parentElement;
    }

    return out as Record<TypoProp, string | null>;
  };

  // Fast path: just computed styles + snippet. No stylesheet walk.
  const getFastTypographyInfo = (el: HTMLElement): TypographyInfo => {
    const cs = window.getComputedStyle(el);
    const family = firstFontFamily(cs.fontFamily || "");
    const size = formatPx(cs.fontSize);
    const weight = weightWithKeyword(cs.fontWeight);
    const line = cs.lineHeight === "normal" ? "normal" : formatPx(cs.lineHeight);
    const tracking =
      cs.letterSpacing === "normal" ? "normal" : formatPx(cs.letterSpacing);

    const rows: TypographyRow[] = [
      { label: "Family", value: family, varName: null },
      { label: "Size", value: size, varName: null },
      { label: "Weight", value: weight, varName: null },
      { label: "Line", value: line, varName: null },
      { label: "Tracking", value: tracking, varName: null },
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

  // Full info = fast info + var-reference enrichment. Cached per element.
  const getFullTypographyInfo = (el: HTMLElement): TypographyInfo => {
    const cached = typographyCache.get(el);
    if (cached && cached.rows.every((r) => r.varName !== undefined)) return cached;
    const base = cached ?? getFastTypographyInfo(el);
    const vars = findVarReferencesBatch(el);
    const rows = base.rows.map((r) => ({
      ...r,
      varName:
        r.label === "Family"
          ? vars["font-family"]
          : r.label === "Size"
          ? vars["font-size"]
          : r.label === "Weight"
          ? vars["font-weight"]
          : r.label === "Line"
          ? vars["line-height"]
          : vars["letter-spacing"],
    }));
    const full: TypographyInfo = { ...base, rows };
    typographyCache.set(el, full);
    return full;
  };

  // Schedule the expensive var-ref enrichment out-of-band. If the user is
  // still hovering the same element when we finish, patch the tag in place.
  type IdleCb = (handle: { didTimeout: boolean; timeRemaining: () => number }) => void;
  const idleApi: {
    request: (cb: IdleCb) => number;
    cancel: (id: number) => void;
  } = (() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: IdleCb, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      return {
        request: (cb: IdleCb) => w.requestIdleCallback!(cb, { timeout: 250 }),
        cancel: (id: number) => w.cancelIdleCallback?.(id),
      };
    }
    return {
      request: (cb: IdleCb) =>
        window.setTimeout(
          () => cb({ didTimeout: true, timeRemaining: () => 0 }),
          32,
        ) as unknown as number,
      cancel: (id: number) => window.clearTimeout(id),
    };
  })();

  let pendingEnrichEl: HTMLElement | null = null;
  let pendingEnrichId = -1;

  const scheduleEnrichment = (el: HTMLElement) => {
    if (pendingEnrichEl === el) return;
    if (pendingEnrichId !== -1) idleApi.cancel(pendingEnrichId);
    pendingEnrichEl = el;
    pendingEnrichId = idleApi.request(() => {
      pendingEnrichId = -1;
      pendingEnrichEl = null;
      if (!enabled) return;
      const full = getFullTypographyInfo(el);
      if (hoveredEl === el && hoverTag) {
        populateTag(hoverTag, full, false);
        // Re-position because enriched content may be a little wider.
        const rect = el.getBoundingClientRect();
        if (hoverBox) positionTagFor(hoverTag, rect);
      }
    });
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
    box.className = "mesurer-ti-box";
    box.dataset.state = "hidden";
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
    tag.className = pinned
      ? "mesurer-ti-card mesurer-ti-card--pinned"
      : "mesurer-ti-card";
    tag.dataset.state = "hidden";
    tag.style.position = "fixed";
    tag.style.pointerEvents = pinned ? "auto" : "none";
    // Match `.mesurer-menu-surface` — solid white + ink-200 border, soft
    // drop shadow. Reads as a first-party mesurer surface rather than a
    // floating OS tooltip.
    tag.style.background = "#ffffff";
    tag.style.color = INK_900;
    tag.style.border = `1px solid ${INK_200}`;
    tag.style.borderRadius = "8px";
    tag.style.padding = "10px 12px";
    tag.style.fontSize = "11px";
    tag.style.lineHeight = "1.5";
    tag.style.fontFamily =
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    tag.style.fontVariantNumeric = "tabular-nums";
    tag.style.userSelect = "none";
    tag.style.whiteSpace = "nowrap";
    tag.style.minWidth = "220px";
    tag.style.maxWidth = "320px";
    // Shadow matches `.mesurer-menu-surface`.
    tag.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.08)";
    return tag;
  };

  const populateTag = (tag: HTMLDivElement, info: TypographyInfo, pinned: boolean) => {
    tag.innerHTML = "";

    // Header: <tag> badge + snippet + (close if pinned)
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.marginBottom = "8px";
    header.style.paddingBottom = "6px";
    header.style.borderBottom = `1px solid ${INK_200}`;

    const tagName = document.createElement("span");
    tagName.style.color = INK_50;
    tagName.style.background = INK_900;
    tagName.style.borderRadius = "4px";
    tagName.style.padding = "1px 5px";
    tagName.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
    tagName.style.fontSize = "10px";
    tagName.style.fontWeight = "500";
    tagName.textContent = info.tagName;
    header.appendChild(tagName);

    if (info.textSnippet) {
      const snippet = document.createElement("span");
      snippet.style.color = INK_500;
      snippet.style.overflow = "hidden";
      snippet.style.textOverflow = "ellipsis";
      snippet.style.whiteSpace = "nowrap";
      snippet.style.flex = "1";
      snippet.style.minWidth = "0";
      snippet.style.fontSize = "10px";
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
        marginLeft: info.textSnippet ? "0" : "auto",
        flex: "0 0 auto",
        width: "16px",
        height: "16px",
        lineHeight: "14px",
        textAlign: "center",
        borderRadius: "4px",
        color: INK_500,
        fontSize: "14px",
      } satisfies Partial<CSSStyleDeclaration>);
      header.appendChild(close);
    }

    tag.appendChild(header);

    // Rows: label (left) + value (monospace) + optional var ref
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "auto 1fr";
    grid.style.columnGap = "12px";
    grid.style.rowGap = "3px";
    grid.style.alignItems = "baseline";

    for (const row of info.rows) {
      const l = document.createElement("span");
      l.style.color = INK_500;
      l.style.fontSize = "11px";
      l.textContent = row.label;

      const v = document.createElement("span");
      v.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
      v.style.fontSize = "11px";
      v.style.color = INK_900;
      v.style.overflow = "hidden";
      v.style.textOverflow = "ellipsis";
      v.style.whiteSpace = "nowrap";

      if (row.varName) {
        const val = document.createElement("span");
        val.textContent = row.value;
        v.appendChild(val);
        const sep = document.createElement("span");
        sep.style.color = INK_200;
        sep.style.margin = "0 6px";
        sep.textContent = "·";
        v.appendChild(sep);
        const varEl = document.createElement("span");
        varEl.style.color = "#0369a1";
        varEl.textContent = row.varName;
        v.appendChild(varEl);
      } else {
        v.textContent = row.value;
      }

      grid.appendChild(l);
      grid.appendChild(v);
    }

    tag.appendChild(grid);
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
      root.appendChild(hoverBox);
    }
    if (!hoverTag) {
      hoverTag = makeTag(false);
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

    // If the card was already visible and we're just retargeting to a new
    // element, this is a "subsequent tooltip" — no re-animation. Position
    // writes to `left/top/width/height` aren't transitioned, so it snaps
    // naturally. The only thing we need to do is swap content + position.
    if (el !== hoveredEl) {
      hoveredEl = el;
      const cached = typographyCache.get(el);
      if (cached) {
        populateTag(hoverTag!, cached, false);
      } else {
        populateTag(hoverTag!, getFastTypographyInfo(el), false);
        scheduleEnrichment(el);
      }
    }

    positionBox(hoverBox!, rect);
    positionTagFor(hoverTag!, rect);

    // First reveal (coming from hidden) runs the 160/180ms entrance
    // transition. Retargets are already visible — setting state="visible"
    // again is a no-op.
    hoverBox!.dataset.state = "visible";
    hoverTag!.dataset.state = "visible";
  };

  const hideHover = () => {
    hoveredEl = null;
    if (hoverBox) hoverBox.dataset.state = "hidden";
    if (hoverTag) hoverTag.dataset.state = "hidden";
  };

  // -------- pinned cards --------

  const pinCurrent = (x: number, y: number) => {
    const sourceEl = pickElementAt(x, y);
    if (!sourceEl) return;

    const root = ensureOverlay();
    // Pinned cards are "sticky" — user will stare at them. Always do the
    // full var scan here (cached if already done from a previous hover).
    const info = getFullTypographyInfo(sourceEl);
    const box = makeBox(FILL_PINNED, OUTLINE_PINNED);
    const tag = makeTag(true);
    populateTag(tag, info, true);
    root.appendChild(box);
    root.appendChild(tag);

    const rect = sourceEl.getBoundingClientRect();
    positionBox(box, rect);
    positionTagFor(tag, rect);

    // Force a style flush so the first paint lands in the hidden state,
    // then flip to visible on the next frame — CSS transitions take it
    // from there. Using transitions (not keyframes) means a rapid close
    // interrupts the pop smoothly instead of restarting from zero.
    void box.offsetHeight;
    void tag.offsetHeight;
    requestAnimationFrame(() => {
      box.dataset.state = "visible";
      tag.dataset.state = "visible";
    });

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

    // Asymmetric exit: faster than enter. Override transition inline
    // before flipping to hidden so the enter-duration class doesn't
    // apply. After the fade completes, remove from the DOM.
    const fast = `opacity ${TIMING.exitFast}ms ${EASE.out}, transform ${TIMING.exitFast}ms ${EASE.out}`;
    entry.box.style.transition = fast;
    entry.tag.style.transition = fast;
    entry.box.dataset.state = "hidden";
    entry.tag.dataset.state = "hidden";

    const cleanup = () => {
      entry.box.remove();
      entry.tag.remove();
    };
    // transitionend fires per property — the first one is enough.
    entry.tag.addEventListener("transitionend", cleanup, { once: true });
    // Safety net if the node is disconnected before the transition fires.
    window.setTimeout(cleanup, TIMING.exitFast + 60);
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

  // Robust "is this event from our UI?" check. We can't rely on
  // `target.closest(...)` because some pages re-target events across
  // shadow-root boundaries, causing the close button's click to be
  // retargeted above our overlay. `composedPath()` walks the full event
  // path including any shadow trees, so the overlay is always found.
  const eventIsFromInspectorUI = (ev: Event): boolean => {
    const path = ev.composedPath?.() ?? [];
    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.id === OVERLAY_ID) return true;
      const cls = node.classList;
      if (!cls) continue;
      if (
        cls.contains("mesurer-ti-card") ||
        cls.contains("mesurer-ti-box") ||
        cls.contains("mesurer-ti-close")
      ) {
        return true;
      }
    }
    return false;
  };

  const onClickCapture = (ev: MouseEvent) => {
    // Don't interfere with our own overlay (close button, tag drag, etc.).
    if (eventIsFromInspectorUI(ev)) return;
    // Allow clicks on the mesurer toolbar through so the user can toggle
    // the mode back off.
    if (isPointerOverExtensionUI(ev.clientX, ev.clientY)) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();

    if (ev.button !== 0) return;
    pinCurrent(ev.clientX, ev.clientY);
  };

  const onAuxClickCapture = (ev: MouseEvent) => {
    if (eventIsFromInspectorUI(ev)) return;
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
    if (pendingEnrichId !== -1) {
      idleApi.cancel(pendingEnrichId);
      pendingEnrichId = -1;
      pendingEnrichEl = null;
    }
    ruleCache = null;
    ruleCacheSheetCount = -1;
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

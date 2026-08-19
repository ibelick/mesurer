const MESURER_STYLE_ID = "mesurer-styles";

type StyleTarget = Document | ShadowRoot;

const injectedTargets = new WeakSet<StyleTarget>();

const isDocument = (target: StyleTarget): target is Document =>
  target.nodeType === 9;

const isShadowRoot = (target: StyleTarget): target is ShadowRoot =>
  target.nodeType === 11;

const getStyleTarget = (
  target?: HTMLElement | ShadowRoot,
): StyleTarget | null => {
  if (typeof document === "undefined") return null;
  if (!target) return document;
  if (isShadowRoot(target as StyleTarget)) return target as ShadowRoot;

  const rootNode = target.getRootNode();
  if (rootNode.nodeType === 11) return rootNode as ShadowRoot;

  return target.ownerDocument ?? document;
};

const adoptSheet = (styleTarget: ShadowRoot, cssText: string) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  styleTarget.adoptedStyleSheets = [...styleTarget.adoptedStyleSheets, sheet];
};

export function ensureMeasurerStyles(
  cssText: string,
  target?: HTMLElement | ShadowRoot,
) {
  if (typeof document === "undefined") return;
  if (!cssText) return;

  const styleTarget = getStyleTarget(target);
  if (!styleTarget) return;
  if (injectedTargets.has(styleTarget)) return;
  if (styleTarget.querySelector(`#${MESURER_STYLE_ID}`)) {
    injectedTargets.add(styleTarget);
    return;
  }

  if (isShadowRoot(styleTarget)) {
    try {
      adoptSheet(styleTarget, cssText);
      injectedTargets.add(styleTarget);
      return;
    } catch {
      // Some pages block constructed stylesheets; fall back to a style tag.
    }
  }

  const ownerDocument = isDocument(styleTarget)
    ? styleTarget
    : styleTarget.ownerDocument;
  if (!ownerDocument) return;
  const style = ownerDocument.createElement("style");
  style.id = MESURER_STYLE_ID;
  style.textContent = cssText;

  if (isShadowRoot(styleTarget)) {
    styleTarget.appendChild(style);
  } else {
    ownerDocument.head.appendChild(style);
  }
  injectedTargets.add(styleTarget);
}

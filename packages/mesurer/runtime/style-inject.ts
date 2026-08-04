const MESURER_STYLE_ID = "mesurer-styles";

type StyleTarget = Document | ShadowRoot;

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

export function ensureMeasurerStyles(
  cssText: string,
  target?: HTMLElement | ShadowRoot,
) {
  if (typeof document === "undefined") return;
  if (!cssText) return;

  const styleTarget = getStyleTarget(target);
  if (!styleTarget) return;
  if (styleTarget.querySelector(`#${MESURER_STYLE_ID}`)) return;

  const ownerDocument = isDocument(styleTarget)
    ? styleTarget
    : styleTarget.ownerDocument;
  if (!ownerDocument) return;
  const style = ownerDocument.createElement("style");
  style.id = MESURER_STYLE_ID;
  style.textContent = cssText;

  if (isShadowRoot(styleTarget)) {
    styleTarget.appendChild(style);
    return;
  }

  ownerDocument.head.appendChild(style);
}

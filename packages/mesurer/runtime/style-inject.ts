const MESURER_STYLE_ID = "mesurer-styles";

type StyleTarget = Document | ShadowRoot;

const getStyleTarget = (
  target?: HTMLElement | ShadowRoot,
): StyleTarget | null => {
  if (typeof document === "undefined") return null;
  if (!target) return document;
  if (target instanceof ShadowRoot) return target;

  const rootNode = target.getRootNode();
  if (rootNode instanceof ShadowRoot) return rootNode;

  return document;
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

  const style = document.createElement("style");
  style.id = MESURER_STYLE_ID;
  style.textContent = cssText;

  if (styleTarget instanceof ShadowRoot) {
    styleTarget.appendChild(style);
    return;
  }

  styleTarget.head.appendChild(style);
}

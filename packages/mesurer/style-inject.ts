import type { MeasurerStyleTarget } from "./api";

const MESURER_STYLE_ID = "mesurer-styles";

const styleRefCounts = new WeakMap<
  Node,
  { count: number; node: HTMLStyleElement }
>();

const resolveStyleHost = (target?: MeasurerStyleTarget | null) => {
  if (typeof document === "undefined") return null;
  if (!target) return document.head ?? document.documentElement;
  if (target instanceof Document) return target.head ?? target.documentElement;
  return target;
};

export function ensureMeasurerStyles(
  cssText: string,
  target?: MeasurerStyleTarget | null,
) {
  const host = resolveStyleHost(target);
  if (!host || !cssText) return () => {};

  let entry = styleRefCounts.get(host);
  if (!entry) {
    const existing = host.querySelector(`#${MESURER_STYLE_ID}`);
    const style =
      existing instanceof HTMLStyleElement
        ? existing
        : document.createElement("style");

    style.id = MESURER_STYLE_ID;
    style.textContent = cssText;

    if (!style.parentNode) {
      host.appendChild(style);
    }

    entry = { count: 0, node: style };
    styleRefCounts.set(host, entry);
  }

  entry.count += 1;

  return () => {
    const current = styleRefCounts.get(host);
    if (!current) return;

    current.count -= 1;
    if (current.count > 0) return;

    current.node.remove();
    styleRefCounts.delete(host);
  };
}

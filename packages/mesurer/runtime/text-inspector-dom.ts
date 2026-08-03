import type { TypographyInfo } from "./text-inspector-typography";

const INK_50 = "#f8fafc";
const INK_200 = "#e2e8f0";
const INK_500 = "#64748b";
const INK_900 = "#0f172a";

export type InspectorBox = HTMLDivElement;
export type InspectorCard = HTMLDivElement;

export const makeEdge = (
  document: Document,
  side: "top" | "right" | "bottom" | "left",
  color: string,
) => {
  const edge = document.createElement("div");
  Object.assign(edge.style, {
    position: "absolute",
    backgroundColor: color,
    ...(side === "top" || side === "bottom"
      ? { left: "0", [side]: "0", width: "100%", height: "1px" }
      : { top: "0", [side]: "0", width: "1px", height: "100%" }),
  });
  return edge;
};

export const makeBox = (
  document: Document,
  fill: string,
  outline: string,
): InspectorBox => {
  const box = document.createElement("div");
  Object.assign(box.style, {
    position: "fixed",
    zIndex: "0",
    pointerEvents: "none",
    backgroundColor: fill,
    boxSizing: "border-box",
  });
  box.className = "mesurer-ti-box";
  box.dataset.state = "hidden";
  for (const side of ["top", "right", "bottom", "left"] as const) {
    box.appendChild(makeEdge(document, side, outline));
  }
  return box;
};

export const positionBox = (box: InspectorBox, rect: DOMRect) => {
  Object.assign(box.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
};

export const makeCard = (document: Document, pinned: boolean): InspectorCard => {
  const card = document.createElement("div");
  Object.assign(card.style, {
    position: "fixed",
    zIndex: "1",
    pointerEvents: pinned ? "auto" : "none",
    background: "#ffffff",
    color: INK_900,
    borderRadius: "13px",
    padding: "10px 12px",
    fontSize: "11px",
    lineHeight: "1.5",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontVariantNumeric: "tabular-nums",
    userSelect: "none",
    whiteSpace: "nowrap",
    width: "320px",
    minWidth: "320px",
    maxWidth: "320px",
    boxSizing: "border-box",
    boxShadow:
      "0px 0px 0.5px rgba(0, 0, 0, 0.18), 0px 3px 8px rgba(0, 0, 0, 0.1), 0px 1px 3px rgba(0, 0, 0, 0.1)",
  });
  card.className = pinned
    ? "mesurer-ti-card mesurer-ti-card--pinned"
    : "mesurer-ti-card";
  card.dataset.state = "hidden";
  return card;
};

export const populateCard = (
  document: Document,
  card: InspectorCard,
  info: TypographyInfo,
  pinned: boolean,
) => {
  card.replaceChildren();
  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
    paddingBottom: "6px",
  });

  const tag = document.createElement("span");
  Object.assign(tag.style, {
    color: INK_50,
    background: INK_900,
    borderRadius: "4px",
    padding: "1px 5px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "10px",
    fontWeight: "500",
  });
  tag.textContent = info.tagName;
  header.appendChild(tag);

  if (info.textSnippet) {
    const snippet = document.createElement("span");
    Object.assign(snippet.style, {
      color: INK_500,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      flex: "1",
      minWidth: "0",
      fontSize: "10px",
    });
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
    });
    header.appendChild(close);
  }
  card.appendChild(header);

  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    columnGap: "12px",
    rowGap: "3px",
    alignItems: "baseline",
  });

  for (const row of info.rows) {
    const label = document.createElement("span");
    label.style.color = INK_500;
    label.style.fontSize = "11px";
    label.textContent = row.label;

    const value = document.createElement("span");
    Object.assign(value.style, {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "11px",
      color: INK_900,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    if (!row.varName) {
      value.textContent = row.value;
    } else {
      const variable = document.createElement("span");
      variable.textContent = row.value;
      const separator = document.createElement("span");
      separator.style.color = INK_200;
      separator.style.margin = "0 6px";
      separator.textContent = "·";
      const name = document.createElement("span");
      name.style.color = "#0369a1";
      name.textContent = row.varName;
      value.append(variable, separator, name);
    }
    grid.append(label, value);
  }
  card.appendChild(grid);
};

export const positionCard = (
  window: Window,
  card: InspectorCard,
  rect: DOMRect,
  offsetX = 0,
  offsetY = 0,
) => {
  const center = rect.left + rect.width / 2 + offsetX;
  card.style.left = `${center}px`;
  const size = card.getBoundingClientRect();
  let top = rect.bottom + 4 + offsetY;
  if (top + size.height > window.innerHeight - 8) {
    top = rect.top - size.height - 4 + offsetY;
  }
  card.style.top = `${Math.max(8, top)}px`;

  const half = size.width / 2;
  card.style.left = `${Math.min(
    Math.max(center, 8 + half),
    window.innerWidth - 8 - half,
  )}px`;
};

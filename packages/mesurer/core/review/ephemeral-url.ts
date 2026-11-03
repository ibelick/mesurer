import { serializeReviewState } from "./codec"
import type { ReviewAnnotation, ReviewState } from "./model"
import type { ReviewSnapshotCapture } from "./snapshot"

type ReviewViewerPayload = {
  state: ReviewState
  screenshotDataUrl: string
  /** The capture as a document, for a page with images that could not be read into the screenshot. */
  liveSnapshot?: string
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ""
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

const base64ToBytes = (value: string) => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

const blobToDataUrl = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return `data:${blob.type || "image/png"};base64,${bytesToBase64(bytes)}`
}

const encodePayload = (payload: ReviewViewerPayload) =>
  bytesToBase64(new TextEncoder().encode(JSON.stringify(payload)))

const transformAnnotation = (annotation: ReviewAnnotation, origin: { x: number; y: number }, scale: number): ReviewAnnotation => {
  const point = (value: { x: number; y: number }) => ({ x: (value.x - origin.x) * scale, y: (value.y - origin.y) * scale })
  const rect = (value: { left: number; top: number; width: number; height: number }) => ({
    left: (value.left - origin.x) * scale,
    top: (value.top - origin.y) * scale,
    width: value.width * scale,
    height: value.height * scale,
  })
  if (annotation.type === "arrow") return { ...annotation, start: point(annotation.start), end: point(annotation.end), ...(annotation.control ? { control: point(annotation.control) } : {}) }
  if (annotation.type === "pen") return { ...annotation, points: annotation.points.map(point) }
  if (annotation.type === "rectangle") return { ...annotation, rect: rect(annotation.rect) }
  if (annotation.type === "text") return { ...annotation, x: (annotation.x - origin.x) * scale, y: (annotation.y - origin.y) * scale, ...(annotation.boxWidth ? { boxWidth: annotation.boxWidth * scale } : {}) }
  if (annotation.type === "guide") return { ...annotation, position: (annotation.position - (annotation.orientation === "vertical" ? origin.x : origin.y)) * scale }
  if (annotation.kind === "element") return { ...annotation, rect: rect(annotation.rect) }
  return {
    ...annotation,
    rectA: rect(annotation.rectA),
    rectB: rect(annotation.rectB),
    connectors: annotation.connectors.map((connector) => ({ ...connector, x1: (connector.x1 - origin.x) * scale, x2: (connector.x2 - origin.x) * scale, y1: (connector.y1 - origin.y) * scale, y2: (connector.y2 - origin.y) * scale })),
    ...(annotation.horizontal ? { horizontal: { ...annotation.horizontal, x1: (annotation.horizontal.x1 - origin.x) * scale, x2: (annotation.horizontal.x2 - origin.x) * scale, y: (annotation.horizontal.y - origin.y) * scale } } : {}),
    ...(annotation.vertical ? { vertical: { ...annotation.vertical, x: (annotation.vertical.x - origin.x) * scale, y1: (annotation.vertical.y1 - origin.y) * scale, y2: (annotation.vertical.y2 - origin.y) * scale } } : {}),
  }
}

const createViewerHtml = (encodedPayload: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mesurer review</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f4f4f5; color: #18181b; }
    header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; background: rgba(255,255,255,.94); border-bottom: 1px solid #e4e4e7; backdrop-filter: blur(10px); }
    header strong { font-size: 14px; }
    header span { color: #71717a; font-size: 12px; }
    main { padding: 24px; }
    .stage { position: relative; width: min(100%, 1440px); margin: 0 auto; overflow: hidden; background: white; box-shadow: 0 12px 40px rgba(24,24,27,.12); }
    .stage img { display: block; width: 100%; height: auto; }
    .stage .live { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; pointer-events: none; }
    .annotations { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    .layout-guides { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
    .layout-guide { position: absolute; display: grid; pointer-events: none; }
    .layout-guide > i { display: block; background: var(--guide-color); opacity: var(--guide-opacity); }
    .text-annotations { position: absolute; inset: 0; pointer-events: none; }
    .annotation-text { position: absolute; white-space: pre-wrap; pointer-events: none; transform-origin: center center; }
    .comments { position: absolute; inset: 0; pointer-events: none; }
    .comment-pin { position: absolute; width: 24px; height: 24px; transform: translate(-50%, -50%); border: 2px solid white; border-radius: 999px; background: #0d99ff; color: white; box-shadow: 0 2px 8px rgba(0,0,0,.25); cursor: pointer; pointer-events: auto; font: 700 11px ui-monospace, monospace; }
    .comment-card { position: absolute; z-index: 1; width: 240px; padding: 10px; border: 1px solid #d4d4d8; border-radius: 8px; background: white; box-shadow: 0 8px 24px rgba(24,24,27,.16); pointer-events: auto; font-size: 12px; }
    .comment-card[hidden] { display: none; }
    .comment-card strong { display: block; margin-bottom: 6px; }
    .comment-card p { margin: 0 0 8px; white-space: pre-wrap; }
    .comment-card small { color: #71717a; }
    .comment-message { margin-top: 10px; }
    .comment-message header { position: static; padding: 0; border: 0; background: transparent; font-size: 11px; }
    .comment-reply { display: flex; gap: 6px; margin-top: 12px; }
    .comment-reply textarea { min-width: 0; flex: 1; resize: vertical; border: 1px solid #d4d4d8; border-radius: 6px; padding: 6px; font: inherit; font-size: 12px; }
    .comment-reply button { align-self: end; border: 0; border-radius: 6px; padding: 7px 9px; background: #18181b; color: white; cursor: pointer; font-size: 11px; }
    details { width: min(100%, 1440px); margin: 16px auto 0; padding: 12px 16px; border: 1px solid #e4e4e7; border-radius: 8px; background: white; }
    summary { cursor: pointer; font-size: 13px; font-weight: 600; }
    pre { max-height: 480px; overflow: auto; white-space: pre-wrap; font: 11px/1.5 ui-monospace, monospace; }
  </style>
</head>
<body>
  <header><strong id="title">Mesurer review</strong><span id="meta"></span></header>
  <main>
    <section class="stage" id="stage"><img id="screenshot" alt="Captured Mesurer review snapshot"><div class="layout-guides" id="layout-guides"></div><svg class="annotations" id="annotations" aria-label="Review annotations"></svg><div class="text-annotations" id="text-annotations"></div><div class="comments" id="comments"></div></section>
    <details><summary>Review state</summary><pre id="state"></pre></details>
  </main>
  <script>
    (() => {
      const decode = (value) => {
        const binary = atob(value);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      };
      const payload = decode(${JSON.stringify(encodedPayload)});
      const state = payload.state;
      const version = state.versions[state.versions.length - 1];
      const snapshot = version.snapshot;
      const screenshot = document.getElementById("screenshot");
      const annotations = document.getElementById("annotations");
      const layoutGuides = document.getElementById("layout-guides");
      const textAnnotations = document.getElementById("text-annotations");
      const comments = document.getElementById("comments");
      const title = document.getElementById("title");
      const meta = document.getElementById("meta");
      const stateOutput = document.getElementById("state");
      title.textContent = state.page.title || state.page.url;
      meta.textContent = "Version " + version.number + " · " + state.review.comments.length + " comments · " + state.review.annotations.length + " annotations";
      screenshot.src = payload.screenshotDataUrl;
      if (payload.liveSnapshot) {
        // Over the screenshot, which keeps the stage's size and shows through if this cannot load.
        const live = document.createElement("iframe");
        live.className = "live";
        live.id = "live-snapshot";
        live.title = "Captured page";
        live.setAttribute("sandbox", "");
        live.src = URL.createObjectURL(new Blob([payload.liveSnapshot], { type: "image/svg+xml" }));
        screenshot.after(live);
      }
      stateOutput.textContent = JSON.stringify(state, null, 2);
      const width = snapshot.viewport.width || 1;
      const height = snapshot.viewport.height || 1;
      annotations.setAttribute("viewBox", "0 0 " + width + " " + height);
      (state.review.workspace?.layoutGuides || []).filter((guide) => guide.visible).forEach((guide) => {
        const element = document.createElement("div");
        element.className = "layout-guide";
        element.style.setProperty("--guide-color", guide.color);
        element.style.setProperty("--guide-opacity", String(guide.opacity));
        const horizontal = guide.kind === "rows";
        const grid = guide.kind === "grid";
        const size = Math.max(0, guide.size);
        const dimension = horizontal ? "height" : "width";
        if (guide.align !== "stretch" && !grid) {
          element.style[dimension] = Math.min(size, horizontal ? height : width) + "px";
          element.style[horizontal ? "width" : "height"] = "100%";
          element.style[horizontal ? "left" : "top"] = "0";
          element.style[horizontal ? "top" : "left"] = guide.align === "center"
            ? "calc(50% - " + Math.min(size, horizontal ? height : width) / 2 + "px)"
            : guide.align === "max"
              ? "calc(100% - " + Math.min(size, horizontal ? height : width) + "px)"
              : "0";
        } else {
          element.style.inset = "0";
        }
        element.style.gap = guide.gutter + "px";
        if (grid) {
          element.style.gridTemplateColumns = "repeat(" + guide.count + ", minmax(0, 1fr))";
          element.style.gridTemplateRows = "repeat(" + guide.count + ", minmax(0, 1fr))";
        } else if (horizontal) {
          element.style.gridTemplateRows = "repeat(" + guide.count + ", minmax(0, 1fr))";
          element.style.gridTemplateColumns = "1fr";
        } else {
          element.style.gridTemplateColumns = "repeat(" + guide.count + ", minmax(0, 1fr))";
          element.style.gridTemplateRows = "1fr";
        }
        const cells = grid ? guide.count * guide.count : guide.count;
        for (let index = 0; index < cells; index += 1) element.append(document.createElement("i"));
        layoutGuides.append(element);
      });
      const svg = (name, attributes) => {
        const element = document.createElementNS("http://www.w3.org/2000/svg", name);
        Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
        return element;
      };
       const line = (x1, y1, x2, y2, color, strokeWidth, dash) => {
         annotations.append(svg("line", { x1, y1, x2, y2, stroke: color || "#0d99ff", "stroke-width": strokeWidth || 2, "stroke-dasharray": dash || "" }));
       };
       const midpoint = (start, end) => ({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 });
       const quadraticPoint = (start, node, end, t) => {
         const control = { x: 2 * node.x - (start.x + end.x) / 2, y: 2 * node.y - (start.y + end.y) / 2 };
         const mt = 1 - t;
         return { x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x, y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y };
       };
       const arrowHead = (start, node, end, width) => {
         const from = quadraticPoint(start, node, end, 0.82);
         const length = Math.max(12, width * 8);
         const tangentLength = Math.hypot(end.x - from.x, end.y - from.y) || 1;
         const tx = (end.x - from.x) / tangentLength;
         const ty = (end.y - from.y) / tangentLength;
         const wing = length * 0.5;
         const nx = -ty;
         const ny = tx;
         return (end.x - tx * length + nx * wing) + "," + (end.y - ty * length + ny * wing) + " " + end.x + "," + end.y + " " + (end.x - tx * length - nx * wing) + "," + (end.y - ty * length - ny * wing);
       };
       const reviewAnnotations = [...state.review.annotations];
       state.review.workspace?.heldDistances.forEach((distance) => {
         if (!reviewAnnotations.some((annotation) => annotation.type === "measurement" && annotation.kind === "distance" && annotation.id === distance.id)) {
           reviewAnnotations.push({ type: "measurement", kind: "distance", ...distance });
         }
       });
       reviewAnnotations.forEach((annotation) => {
         if (annotation.type === "arrow") {
           const control = annotation.control || midpoint(annotation.start, annotation.end);
           const bezierControl = { x: 2 * control.x - (annotation.start.x + annotation.end.x) / 2, y: 2 * control.y - (annotation.start.y + annotation.end.y) / 2 };
           if (annotation.control) {
             annotations.append(svg("path", { d: "M " + annotation.start.x + " " + annotation.start.y + " Q " + bezierControl.x + " " + bezierControl.y + " " + annotation.end.x + " " + annotation.end.y, fill: "none", stroke: annotation.color, "stroke-width": annotation.width, "stroke-linecap": "round" }));
           } else {
             line(annotation.start.x, annotation.start.y, annotation.end.x, annotation.end.y, annotation.color, annotation.width);
           }
           annotations.append(svg("polyline", { points: arrowHead(annotation.start, control, annotation.end, annotation.width), fill: "none", stroke: annotation.color, "stroke-width": annotation.width, "stroke-linecap": "round", "stroke-linejoin": "round" }));
        } else if (annotation.type === "pen") {
          annotations.append(svg("polyline", { points: annotation.points.map((point) => point.x + "," + point.y).join(" "), fill: "none", stroke: annotation.color, "stroke-width": annotation.width, "stroke-linecap": "round", "stroke-linejoin": "round" }));
        } else if (annotation.type === "text") {
          const textStyle = annotation.style || state.review.textStyle || { font: "sans-serif", color: "#000000" };
          const fontFamily = textStyle.font === "handwritten"
            ? '"Segoe Script", "Bradley Hand", "Apple Chancery", cursive'
            : textStyle.font === "code"
              ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
              : textStyle.font === "serif"
                ? 'ui-serif, Georgia, "Times New Roman", serif'
                : 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
          const text = document.createElement("div");
          text.className = "annotation-text";
          text.textContent = annotation.text;
          text.style.left = annotation.x + "px";
          text.style.top = annotation.y + "px";
          text.style.color = textStyle.color;
          text.style.fontFamily = fontFamily;
          text.style.fontSize = (16 * (annotation.scale || 1)) + "px";
          text.style.lineHeight = (24 * (annotation.scale || 1)) + "px";
          if (annotation.boxWidth) text.style.width = annotation.boxWidth + "px";
          if (annotation.rotation) text.style.transform = "rotate(" + annotation.rotation + "deg)";
          textAnnotations.append(text);
        } else if (annotation.type === "guide") {
          if (annotation.orientation === "vertical") line(annotation.position, 0, annotation.position, height, "#0d99ff", 1, "6 4");
          else line(0, annotation.position, width, annotation.position, "#0d99ff", 1, "6 4");
        } else if (annotation.type === "rectangle") {
          annotations.append(svg("rect", { x: annotation.rect.left, y: annotation.rect.top, width: annotation.rect.width, height: annotation.rect.height, fill: "none", stroke: annotation.color, "stroke-width": annotation.width, "stroke-dasharray": "4 3" }));
        } else if (annotation.kind === "element") {
          annotations.append(svg("rect", { x: annotation.rect.left, y: annotation.rect.top, width: annotation.rect.width, height: annotation.rect.height, fill: "none", stroke: "#0d99ff", "stroke-width": 2, "stroke-dasharray": "4 3" }));
        } else {
          annotation.connectors.forEach((connector) => line(connector.x1, connector.y1, connector.x2, connector.y2, "#0d99ff", 1));
          if (annotation.horizontal) line(annotation.horizontal.x1, annotation.horizontal.y, annotation.horizontal.x2, annotation.horizontal.y, "#0d99ff", 2);
          if (annotation.vertical) line(annotation.vertical.x, annotation.vertical.y1, annotation.vertical.x, annotation.vertical.y2, "#0d99ff", 2);
        }
      });
      state.review.comments.forEach((comment, index) => {
        const pin = document.createElement("button");
        pin.className = "comment-pin";
        pin.type = "button";
        pin.textContent = String(index + 1);
        pin.style.left = (comment.position.x / width * 100) + "%";
        pin.style.top = (comment.position.y / height * 100) + "%";
        pin.setAttribute("aria-label", "Comment " + (index + 1));
        const card = document.createElement("aside");
        card.className = "comment-card";
        card.hidden = true;
        card.style.left = (comment.position.x / width * 100) + "%";
        card.style.top = (comment.position.y / height * 100) + "%";
        const heading = document.createElement("strong");
        heading.textContent = comment.status === "resolved" ? "Resolved comment" : "Comment";
        const messages = document.createElement("div");
        const renderMessages = () => {
          messages.replaceChildren();
          const threadMessages = comment.messages.length > 0
            ? comment.messages
            : [{ id: "initial", role: "user", text: comment.text, createdAt: comment.createdAt }];
          threadMessages.forEach((message) => {
            const item = document.createElement("div");
            item.className = "comment-message";
            const meta = document.createElement("header");
            meta.textContent = "You · " + new Date(message.createdAt).toLocaleString();
            const body = document.createElement("p");
            body.textContent = message.text;
            item.append(meta, body);
            messages.append(item);
          });
        };
        renderMessages();
        const reply = document.createElement("form");
        reply.className = "comment-reply";
        const input = document.createElement("textarea");
        input.rows = 2;
        input.placeholder = "Reply...";
        input.setAttribute("aria-label", "Reply to comment");
        const send = document.createElement("button");
        send.type = "submit";
        send.textContent = "Reply";
        reply.append(input, send);
        reply.addEventListener("submit", (event) => {
          event.preventDefault();
          const text = input.value.trim();
          if (!text) return;
          comment.messages.push({ id: "reply-" + Date.now(), role: "user", text, createdAt: Date.now() });
          comment.text = comment.messages[0]?.text || text;
          input.value = "";
          renderMessages();
        });
        card.append(heading, messages, reply);
        pin.addEventListener("click", () => { card.hidden = !card.hidden; });
        comments.append(pin, card);
      });
    })();
  </script>
</body>
</html>`

export type EphemeralReviewUrl = {
  url: string
  state: ReviewState
  html: string
}

export const createEphemeralReviewUrl = async (
  state: ReviewState,
  capture: ReviewSnapshotCapture,
  ownerWindow: Window,
): Promise<EphemeralReviewUrl> => {
  // Demo viewer: this standalone HTML intentionally mirrors the comment card until the viewer is React-backed.
  const screenshotDataUrl = await blobToDataUrl(capture.blob)
  const nextState: ReviewState = {
    ...state,
    versions: state.versions.map((version, index) =>
      index === state.versions.length - 1
        ? {
            ...version,
            snapshot: {
              ...version.snapshot,
              screenshot: {
                id: `screenshot-${version.id}`,
                mimeType: capture.mimeType,
                width: capture.width,
                height: capture.height,
              },
              ...(capture.cssWidth && capture.cssHeight
                ? { viewport: { ...version.snapshot.viewport, width: capture.cssWidth, height: capture.cssHeight } }
                : {}),
            },
          }
        : version,
    ),
  }
  const origin = capture.origin ?? { x: 0, y: 0 }
  const positionedState: ReviewState = {
    ...nextState,
    review: {
      ...nextState.review,
       comments: nextState.review.comments.map((comment) => ({
        ...comment,
        position: {
          x: (comment.position.x - origin.x) * (capture.scale ?? 1),
          y: (comment.position.y - origin.y) * (capture.scale ?? 1),
        },
       })),
       annotations: nextState.review.annotations.map((annotation) => transformAnnotation(annotation, origin, capture.scale ?? 1)),
    },
  }
  const payload = encodePayload({
    state: positionedState,
    screenshotDataUrl,
    ...(capture.live ? { liveSnapshot: capture.live } : {}),
  })
  const html = createViewerHtml(payload)
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }))
  return { url, state: positionedState, html }
}

export const revokeEphemeralReviewUrl = (url: string, ownerWindow: Window) => {
  void ownerWindow
  URL.revokeObjectURL(url)
}

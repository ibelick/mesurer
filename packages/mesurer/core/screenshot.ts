import type { ResizeHandle } from "./text-transform";

export const MIN_SCREENSHOT_SELECTION = 4;

export type ScreenshotRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const normalizeScreenshotRect = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  viewport: { width: number; height: number },
): ScreenshotRect => {
  const left = Math.max(0, Math.min(start.x, end.x, viewport.width));
  const top = Math.max(0, Math.min(start.y, end.y, viewport.height));
  const right = Math.max(0, Math.min(Math.max(start.x, end.x), viewport.width));
  const bottom = Math.max(
    0,
    Math.min(Math.max(start.y, end.y), viewport.height),
  );
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

export const clampScreenshotRect = (
  rect: ScreenshotRect,
  viewport: { width: number; height: number },
  minSize = MIN_SCREENSHOT_SELECTION,
): ScreenshotRect => {
  const width = Math.max(minSize, Math.min(rect.width, viewport.width));
  const height = Math.max(minSize, Math.min(rect.height, viewport.height));
  const left = Math.max(0, Math.min(rect.left, viewport.width - width));
  const top = Math.max(0, Math.min(rect.top, viewport.height - height));
  return { left, top, width, height };
};

export const moveScreenshotRect = (
  rect: ScreenshotRect,
  dx: number,
  dy: number,
  viewport: { width: number; height: number },
): ScreenshotRect =>
  clampScreenshotRect(
    { ...rect, left: rect.left + dx, top: rect.top + dy },
    viewport,
  );

export const resizeScreenshotRect = (
  start: ScreenshotRect,
  handle: ResizeHandle,
  pointer: { x: number; y: number },
  viewport: { width: number; height: number },
): ScreenshotRect => {
  let left = start.left;
  let top = start.top;
  let right = start.left + start.width;
  let bottom = start.top + start.height;
  const x = Math.max(0, Math.min(pointer.x, viewport.width));
  const y = Math.max(0, Math.min(pointer.y, viewport.height));
  if (handle.includes("w")) left = x;
  if (handle.includes("e")) right = x;
  if (handle.includes("n")) top = y;
  if (handle.includes("s")) bottom = y;
  return normalizeScreenshotRect(
    { x: left, y: top },
    { x: right, y: bottom },
    viewport,
  );
};

export const pointInScreenshotRect = (
  rect: ScreenshotRect,
  point: { x: number; y: number },
) =>
  point.x >= rect.left &&
  point.x <= rect.left + rect.width &&
  point.y >= rect.top &&
  point.y <= rect.top + rect.height;

export const cropPngToViewportRect = async (
  blob: Blob,
  rect: ScreenshotRect,
  viewport: { width: number; height: number },
  ownerDocument: Document,
): Promise<Blob> => {
  const bitmap = await createImageBitmap(blob);
  const scaleX = bitmap.width / viewport.width;
  const scaleY = bitmap.height / viewport.height;
  const sx = Math.max(0, Math.round(rect.left * scaleX));
  const sy = Math.max(0, Math.round(rect.top * scaleY));
  const sw = Math.max(
    1,
    Math.min(bitmap.width - sx, Math.round(rect.width * scaleX)),
  );
  const sh = Math.max(
    1,
    Math.min(bitmap.height - sy, Math.round(rect.height * scaleY)),
  );
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not crop screenshot");
  }
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((cropped) => {
      if (cropped) resolve(cropped);
      else reject(new Error("Could not crop screenshot"));
    }, "image/png");
  });
};

export const copyPngToClipboard = async (
  png: Blob | Promise<Blob>,
  clipboard?: Clipboard | null,
) => {
  const target = clipboard ?? globalThis.navigator?.clipboard;
  if (!target?.write) {
    throw new Error("Clipboard is not available");
  }
  await target.write([new ClipboardItem({ "image/png": png })]);
};

export const createScreenshotFilename = (now = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `mesurer-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
};

export const downloadPng = (
  png: Blob,
  filename: string,
  ownerDocument: Document,
  ownerWindow: Window,
) => {
  const url = URL.createObjectURL(png);
  const link = ownerDocument.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.position = "fixed";
  link.style.left = "-9999px";
  ownerDocument.documentElement.append(link);
  link.click();
  ownerWindow.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
};

export const hideNodesForCapture = (nodes: Array<HTMLElement | null>) => {
  const previous = nodes.flatMap((node) => {
    if (!node) return [];
    const visibility = node.style.getPropertyValue("visibility");
    const priority = node.style.getPropertyPriority("visibility");
    node.style.setProperty("visibility", "hidden", "important");
    return [{ node, visibility, priority }];
  });

  return () => {
    previous.forEach(({ node, visibility, priority }) => {
      if (visibility) node.style.setProperty("visibility", visibility, priority);
      else node.style.removeProperty("visibility");
    });
  };
};

export const waitForNextPaint = (targetWindow: Window) =>
  new Promise<void>((resolve) => {
    targetWindow.requestAnimationFrame(() => {
      targetWindow.requestAnimationFrame(() => resolve());
    });
  });

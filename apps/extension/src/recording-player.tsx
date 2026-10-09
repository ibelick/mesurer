import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ScreenRecordingEditor } from "../../../packages/mesurer/components/screen-recording";
import { TooltipLayerContext } from "../../../packages/mesurer/components/tooltip";
import { encodeGifClip, encodeMp4Clip, isFullClipExport, reencodeVideoClip } from "../../../packages/mesurer/core/screen-recording";
import type { RecordingExportFormat, RecordingExportOptions, RecordingExportResult } from "../../../packages/mesurer/hooks/screen-recording-export";
import { deleteRecording, readRecording } from "./recording-db";

const root = document.getElementById("root");
const params = new URLSearchParams(location.search);
const id = params.get("id");
const initialTheme = params.get("theme");
if (root && (initialTheme === "light" || initialTheme === "dark" || initialTheme === "system")) {
  root.setAttribute("data-theme", initialTheme);
  document.documentElement.setAttribute("data-theme", initialTheme);
}

const createFilename = (format: RecordingExportFormat) => `mesurer-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`;

const Player = ({ blob, duration }: { blob: Blob; duration: number }) => {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "mesurer:recording-theme") {
        const theme = event.data.theme;
        if (theme === "light" || theme === "dark" || theme === "system") {
          document.getElementById("root")?.setAttribute("data-theme", theme);
          document.documentElement.setAttribute("data-theme", theme);
        }
      }
      if (event.data?.type === "mesurer:recording-anchor" && (event.data.side === "top" || event.data.side === "bottom")) {
        document.getElementById("root")?.setAttribute("data-anchor", event.data.side);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  useEffect(() => {
    const rootNode = document.getElementById("root");
    if (!rootNode) return;
    const report = () => {
      const card = rootNode.querySelector("section");
      if (!(card instanceof HTMLElement)) return;
      const rect = card.getBoundingClientRect();
      if (rect.height < 32) return;
      const expanded = card.getAttribute("data-expanded") === "true";
      const width = expanded ? 36 * 16 : 22 * 16;
      const menu = rootNode.querySelector("[role='menu']");
      const menuExtra = menu instanceof HTMLElement && menu.offsetHeight > 0 ? Math.ceil(menu.offsetHeight + 8) : 0;
      window.parent.postMessage(
        {
          type: "mesurer:recording-frame-size",
          width,
          height: Math.ceil(rect.height),
          menuExtra,
        },
        "*",
      );
    };
    let reportFrame: number | null = null;
    let transitionTimer: number | null = null;
    let transitioning = false;
    const scheduleReport = () => {
      if (reportFrame !== null) return;
      reportFrame = window.requestAnimationFrame(() => {
        reportFrame = null;
        if (!transitioning) report();
      });
    };
    const observer = new ResizeObserver(scheduleReport);
    const watch = () => {
      const card = rootNode.querySelector("section");
      if (card) {
        observer.disconnect();
        observer.observe(card);
      }
      scheduleReport();
    };
    watch();
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => record.type === "attributes" && record.attributeName === "data-expanded")) {
        transitioning = true;
        if (transitionTimer !== null) window.clearTimeout(transitionTimer);
        transitionTimer = window.setTimeout(() => {
          transitioning = false;
          report();
        }, 220);
      }
      watch();
    });
    mutations.observe(rootNode, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-expanded"] });
    return () => {
      if (reportFrame !== null) window.cancelAnimationFrame(reportFrame);
      if (transitionTimer !== null) window.clearTimeout(transitionTimer);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [url]);
  if (!url) return null;
  const exportClip = async (start: number, end: number, options: RecordingExportOptions = {}): Promise<RecordingExportResult> => {
    const format = options.format ?? "webm";
    const scale = Math.min(3, Math.max(1, options.scale ?? 1));
    if (format === "webm" && scale === 1 && isFullClipExport(start, end, duration)) {
      return { blob, filename: createFilename(format) };
    }
    if (format === "gif") {
      return {
        blob: await encodeGifClip(document, url, start, end, scale),
        filename: createFilename(format),
      };
    }
    if (format === "mp4") {
      return { blob: await encodeMp4Clip(document, window, url, start, end, scale), filename: createFilename(format) };
    }
    const mimeType = "video/webm";
    return {
      blob: await reencodeVideoClip(document, window, url, start, end, scale, mimeType),
      filename: createFilename(format),
    };
  };
  return (
    <TooltipLayerContext.Provider value={layer}>
      <div ref={setLayer} className="mesurer-toolbar-tooltips" />
      <ScreenRecordingEditor
        url={url}
        duration={duration}
        ownerDocument={document}
        onDiscard={() => {
          void deleteRecording(id!).catch(() => undefined).finally(() => window.parent.postMessage({ type: "mesurer:recording-discard", id }, "*"));
        }}
        onExport={exportClip}
      />
    </TooltipLayerContext.Provider>
  );
};

if (root && id) {
  const duration = Number(new URLSearchParams(location.search).get("duration")) || 0.1;
  void readRecording(id).then(
    (blob) => createRoot(root).render(<Player blob={blob} duration={duration} />),
    () => window.parent.postMessage({ type: "mesurer:recording-discard", id }, "*"),
  );
}

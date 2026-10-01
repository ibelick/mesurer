import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ScreenRecordingEditor } from "../../../packages/mesurer/components/screen-recording-editor";
import { TooltipLayerContext } from "../../../packages/mesurer/components/tooltip";
import { isFullClipExport, reencodeVideoClip } from "../../../packages/mesurer/core/screen-recording";
import type { RecordingExportFormat, RecordingExportOptions, RecordingExportResult } from "../../../packages/mesurer/hooks/screen-recording-export";
import { deleteRecording, readRecording } from "./recording-db";

const root = document.getElementById("root");
const id = new URLSearchParams(location.search).get("id");

const createFilename = (format: RecordingExportFormat) => `mesurer-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`;

const Player = ({ blob, duration }: { blob: Blob; duration: number }) => {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  if (!url) return null;
  const exportClip = async (start: number, end: number, options: RecordingExportOptions = {}): Promise<RecordingExportResult> => {
    const format = options.format ?? "webm";
    const scale = Math.min(3, Math.max(1, options.scale ?? 1));
    if (format === "webm" && scale === 1 && isFullClipExport(start, end, duration)) {
      return { blob, filename: createFilename(format) };
    }
    const mimeType = format === "mp4" ? "video/mp4" : "video/webm";
    return {
      blob: await reencodeVideoClip(document, window, url, start, end, scale, mimeType),
      filename: createFilename(format),
    };
  };
  return (
    <TooltipLayerContext.Provider value={layer}>
      <div ref={setLayer} className="mesurer-toolbar-tooltips" />
      <div className="msr:p-3">
        <ScreenRecordingEditor
          url={url}
          duration={duration}
          ownerDocument={document}
          onDiscard={() => {
            void deleteRecording(id!).catch(() => undefined).finally(() => window.parent.postMessage({ type: "mesurer:recording-discard", id }, "*"));
          }}
          onExport={exportClip}
        />
      </div>
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

import { tabCaptureRectToVideoCrop } from "../../../packages/mesurer/core/screen-recording";
import { OFFSCREEN_RECORDING_ABORT_MESSAGE, OFFSCREEN_RECORDING_PREPARE_MESSAGE, OFFSCREEN_RECORDING_START_MESSAGE, OFFSCREEN_RECORDING_STOP_MESSAGE, RECORDING_PREPARED_MESSAGE, RECORDING_READY_MESSAGE, RECORDING_STARTED_MESSAGE } from "./messages";
import { saveRecording } from "./recording-db";

let session: { stream: MediaStream; output: MediaStream; source: HTMLVideoElement; recorder: MediaRecorder; canvas: HTMLCanvasElement; chunks: Blob[]; startedAt: number; tabId: number; timer: number } | null = null;
let preparedCapture: { stream: MediaStream; source: HTMLVideoElement; tabId: number } | null = null;
let startupId = 0;

const releaseCapture = (capture: { stream: MediaStream; source: HTMLVideoElement }) => {
  capture.stream.getTracks().forEach((track) => track.stop());
  capture.source.pause();
  capture.source.srcObject = null;
  capture.source.remove();
};

const releaseSession = (current: NonNullable<typeof session>) => {
  clearInterval(current.timer);
  current.output.getTracks().forEach((track) => track.stop());
  releaseCapture(current);
  current.canvas.remove();
};

const getStream = async (streamId: string) => {
  const constraints = [
    {
      audio: false,
      video: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    },
  ] as unknown as MediaStreamConstraints[];
  let lastError: unknown;
  for (const constraint of constraints) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraint);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Tab capture permission was denied");
};

const stop = async () => {
  if (!session) throw new Error("No recording in progress");
  const current = session;
  session = null;
  clearInterval(current.timer);
  let blob: Blob;
  try {
    blob = await new Promise<Blob>((resolve, reject) => {
      current.recorder.onstop = () => resolve(new Blob(current.chunks, { type: current.recorder.mimeType || "video/webm" }));
      current.recorder.onerror = () => reject(new Error("Recording failed"));
      if (current.recorder.state === "recording") current.recorder.stop();
      else resolve(new Blob(current.chunks, { type: "video/webm" }));
    });
  } finally {
    releaseSession(current);
  }
  const id = crypto.randomUUID();
  await saveRecording(id, blob);
  current.source.remove();
  current.canvas.remove();
  void chrome.runtime.sendMessage({ type: RECORDING_READY_MESSAGE, id, tabId: current.tabId, duration: Math.max(0.1, (performance.now() - current.startedAt) / 1000) }).catch(() => undefined);
};

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === OFFSCREEN_RECORDING_PREPARE_MESSAGE) {
    const currentStartupId = ++startupId;
    void getStream(message.streamId).then(async (stream) => {
      if (currentStartupId !== startupId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const source = document.createElement("video");
      source.autoplay = true;
      source.muted = true;
      source.playsInline = true;
      source.srcObject = stream;
      document.body.append(source);
      const metadata = new Promise<void>((resolve, reject) => {
        source.onloadedmetadata = () => resolve();
        source.onerror = () => reject(new Error("Could not read tab capture"));
      });
      await source.play();
      if (source.readyState < 1) await metadata;
      if (currentStartupId !== startupId) {
        releaseCapture({ stream, source });
        return;
      }
      if (preparedCapture) releaseCapture(preparedCapture);
      preparedCapture = { stream, source, tabId: message.tabId };
      // Let Chrome finish installing its sharing UI and resizing the tab before selection.
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      if (currentStartupId === startupId) {
        void chrome.runtime.sendMessage({ type: RECORDING_PREPARED_MESSAGE, tabId: message.tabId }).catch(() => undefined);
      }
    }).catch((error) => {
      if (currentStartupId === startupId) {
        void chrome.runtime.sendMessage({ type: RECORDING_PREPARED_MESSAGE, tabId: message.tabId, error: error instanceof Error ? error.message : "Recording failed" }).catch(() => undefined);
      }
    });
  } else if (message?.type === OFFSCREEN_RECORDING_START_MESSAGE) {
    const capture = preparedCapture;
    preparedCapture = null;
    if (!capture || capture.tabId !== message.tabId) {
      void chrome.runtime.sendMessage({ type: RECORDING_STARTED_MESSAGE, tabId: message.tabId, error: "Recording capture was not prepared" }).catch(() => undefined);
      return;
    }
    const { stream, source } = capture;
    try {
      const crop = tabCaptureRectToVideoCrop(
        message.rect,
        source.videoWidth,
        source.videoHeight,
        message.viewport,
      );
      const { sx, sy, sw, sh } = crop;
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      document.body.append(canvas);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Recording is unavailable");
      const output = canvas.captureStream(60);
      const recorder = new MediaRecorder(output, { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      const captureTrack = output.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
      const draw = () => {
        if (session?.source !== source) return;
        context.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
        captureTrack.requestFrame?.();
      };
      const timer = window.setInterval(draw, 1000 / 60);
      session = { stream, output, source, recorder, canvas, chunks, startedAt: performance.now(), tabId: message.tabId, timer };
      recorder.start(250);
      draw();
      void chrome.runtime.sendMessage({ type: RECORDING_STARTED_MESSAGE, tabId: message.tabId }).catch(() => undefined);
    } catch (error) {
      releaseCapture(capture);
      void chrome.runtime.sendMessage({ type: RECORDING_STARTED_MESSAGE, tabId: message.tabId, error: error instanceof Error ? error.message : "Recording failed" }).catch(() => undefined);
    }
  } else if (message?.type === OFFSCREEN_RECORDING_STOP_MESSAGE) {
    const tabId = session?.tabId;
    void stop().catch((error) => void chrome.runtime.sendMessage({ type: RECORDING_READY_MESSAGE, tabId, error: error instanceof Error ? error.message : "Recording failed" }).catch(() => undefined));
  } else if (message?.type === OFFSCREEN_RECORDING_ABORT_MESSAGE) {
    startupId += 1;
    if (preparedCapture) {
      releaseCapture(preparedCapture);
      preparedCapture = null;
    }
    if (session) {
      const current = session;
      session = null;
      if (current.recorder.state === "recording") current.recorder.stop();
      releaseSession(current);
    }
  }
});

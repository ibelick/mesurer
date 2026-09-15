const CAPTURE_VISIBLE_MESSAGE = "mesurer:capture-visible";

type CaptureOk = { ok: true; dataUrl: string };
type CaptureFail = { ok: false; error?: string };
type CaptureResponse = CaptureOk | CaptureFail;

type ChromeRuntime = {
  id?: string;
  lastError?: { message?: string };
  sendMessage: (
    message: { type: string },
    responseCallback: (response: CaptureResponse) => void,
  ) => void;
};

const getExtensionRuntime = (): ChromeRuntime | undefined => {
  const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } })
    .chrome?.runtime;
  if (!runtime?.id || !runtime.sendMessage) return undefined;
  return runtime;
};

const captureViaExtension = (runtime: ChromeRuntime) =>
  new Promise<Blob>((resolve, reject) => {
    try {
      runtime.sendMessage({ type: CAPTURE_VISIBLE_MESSAGE }, (response) => {
        if (runtime.lastError?.message) {
          reject(new Error(runtime.lastError.message));
          return;
        }
        if (!response?.ok || !response.dataUrl) {
          reject(
            new Error(
              !response || response.ok
                ? "Capture failed"
                : (response.error ?? "Capture failed"),
            ),
          );
          return;
        }
        void fetch(response.dataUrl)
          .then((result) => result.blob())
          .then(resolve, reject);
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Capture failed"));
    }
  });

type TabCapture = {
  stream: MediaStream;
  video: HTMLVideoElement;
};

const tabCaptures = new WeakMap<Window, TabCapture>();

const getLiveTabCapture = (ownerWindow: Window) => {
  const current = tabCaptures.get(ownerWindow);
  const track = current?.stream.getVideoTracks()[0];
  if (!current || !track || track.readyState !== "live") {
    tabCaptures.delete(ownerWindow);
    return undefined;
  }
  return current;
};

export const releaseScreenshotCapture = (ownerWindow: Window) => {
  const current = tabCaptures.get(ownerWindow);
  if (!current) return;

  tabCaptures.delete(ownerWindow);
  current.video.pause();
  current.video.srcObject = null;
  current.stream.getTracks().forEach((track) => track.stop());
};

const startTabCapture = async (
  ownerDocument: Document,
  ownerWindow: Window,
) => {
  const existing = getLiveTabCapture(ownerWindow);
  if (existing) return existing;

  const media = ownerWindow.navigator.mediaDevices;
  if (!media?.getDisplayMedia) {
    throw new Error("Screenshot capture is unavailable");
  }

  const stream = await media.getDisplayMedia({
    audio: false,
    video: true,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
  } as DisplayMediaStreamOptions);

  const track = stream.getVideoTracks()[0];
  if (!track) {
    stream.getTracks().forEach((next) => next.stop());
    throw new Error("Capture failed");
  }

  try {
    const video = ownerDocument.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
    }

    const capture: TabCapture = { stream, video };
    tabCaptures.set(ownerWindow, capture);
    track.addEventListener(
      "ended",
      () => {
        if (tabCaptures.get(ownerWindow) === capture) {
          tabCaptures.delete(ownerWindow);
        }
      },
      { once: true },
    );
    return capture;
  } catch (error) {
    stream.getTracks().forEach((next) => next.stop());
    throw error;
  }
};

const captureViaDisplayMedia = async (
  ownerDocument: Document,
  ownerWindow: Window,
) => {
  const { video } = await startTabCapture(ownerDocument, ownerWindow);
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Capture failed");
  context.drawImage(video, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => {
      if (next) resolve(next);
      else reject(new Error("Capture failed"));
    }, "image/png");
  });
};

export const prepareScreenshotCapture = async (
  ownerDocument: Document,
  ownerWindow: Window,
) => {
  if (getExtensionRuntime()) return;
  await startTabCapture(ownerDocument, ownerWindow);
};

export const captureVisibleTabPng = async (
  ownerDocument: Document,
  ownerWindow: Window,
) => {
  const runtime = getExtensionRuntime();
  if (runtime) return captureViaExtension(runtime);
  return captureViaDisplayMedia(ownerDocument, ownerWindow);
};

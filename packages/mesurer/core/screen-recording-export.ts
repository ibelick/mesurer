import { correctWebmDuration } from "./screen-recording-webm"

export function resolveRecordingDuration(mediaDuration: number, elapsedSeconds: number): number {
  const media = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : 0
  const elapsed = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0
  if (media <= 0 && elapsed <= 0) return 0.1
  if (media <= 0) return Math.max(elapsed, 0.1)
  if (elapsed <= 0) return media
  // MediaRecorder often reports only the first clusters. Keep the recorded length.
  if (media < elapsed * 0.9) return elapsed
  return Math.min(media, elapsed)
}

export function isFullClipExport(
  startTime: number,
  endTime: number,
  duration: number,
  tolerance = 0.05,
): boolean {
  return startTime <= tolerance && endTime >= duration - tolerance
}

export async function readBlobVideoDuration(blob: Blob, ownerDocument: Document): Promise<number> {
  const url = URL.createObjectURL(blob)
  const video = ownerDocument.createElement("video")
  video.preload = "metadata"
  video.muted = true
  try {
    return await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => {
        resolve(video.duration)
      }
      video.onerror = () => reject(new Error("Could not read recording"))
      video.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
    video.removeAttribute("src")
  }
}

export async function seekVideoElement(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.max(0, time)
  if (target <= 0 && video.readyState >= 1) {
    video.currentTime = 0
    return
  }
  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => resolve()
    const onError = () => reject(new Error("Could not seek recording"))
    video.addEventListener("seeked", onSeeked, { once: true })
    video.addEventListener("error", onError, { once: true })
    if (video.readyState < 1) {
      video.addEventListener(
        "loadedmetadata",
        () => {
          video.currentTime = target
        },
        { once: true },
      )
    } else {
      video.currentTime = target
    }
  })
}

/** Prefer current-tab capture on Chromium; fall back to standard display media elsewhere. */
export async function requestDisplayMediaStream(ownerWindow: Window): Promise<MediaStream> {
  const fallback: DisplayMediaStreamOptions = {
    audio: false,
    video: true,
  }
  const chromium: DisplayMediaStreamOptions = {
    audio: false,
    video: { displaySurface: "browser" },
    preferCurrentTab: true,
    selfBrowserSurface: "include",
  } as DisplayMediaStreamOptions

  try {
    return await ownerWindow.navigator.mediaDevices.getDisplayMedia(chromium)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return await ownerWindow.navigator.mediaDevices.getDisplayMedia(fallback)
  }
}

export async function reencodeVideoClip(
  ownerDocument: Document,
  ownerWindow: Window,
  sourceUrl: string,
  startTime: number,
  endTime: number,
  scale: number,
  mimeType: string | undefined,
): Promise<Blob> {
  const source = ownerDocument.createElement("video")
  source.muted = true
  source.playsInline = true
  source.src = sourceUrl
  source.preload = "auto"

  await new Promise<void>((resolve, reject) => {
    const ready = () => source.videoWidth > 0 && source.videoHeight > 0
    const finish = () => {
      if (!ready()) return
      resolve()
    }
    source.onloadedmetadata = finish
    source.onloadeddata = finish
    source.onresize = finish
    source.onerror = () => reject(new Error("Could not trim recording"))
    if (ready()) resolve()
  })
  await seekVideoElement(source, startTime)
  if (source.videoWidth <= 0 || source.videoHeight <= 0) {
    await new Promise<void>((resolve) => {
      if (typeof source.requestVideoFrameCallback === "function") {
        source.requestVideoFrameCallback(() => resolve())
        return
      }
      ownerWindow.requestAnimationFrame(() => resolve())
    })
  }

  const canvas = ownerDocument.createElement("canvas")
  canvas.width = Math.max(1, Math.round(source.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(source.videoHeight * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Could not trim recording")

  const stream = canvas.captureStream(30)
  const captureTrack = stream.getVideoTracks()[0]
  const requestFrame =
    captureTrack && "requestFrame" in captureTrack
      ? (captureTrack as MediaStreamTrack & { requestFrame?: () => void }).requestFrame
      : undefined

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []

  return await new Promise<Blob>((resolve, reject) => {
    let stopped = false
    const onTimeUpdate = () => {
      if (source.currentTime >= endTime) finish()
    }
    const finish = () => {
      if (stopped) return
      stopped = true
      source.removeEventListener("timeupdate", onTimeUpdate)
      source.pause()
      try {
        recorder.stop()
      } catch {
        reject(new Error("Could not trim recording"))
      }
    }

    const drawFrame = () => {
      if (stopped) return
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      requestFrame?.call(captureTrack)
      if (source.currentTime >= endTime || source.ended) {
        finish()
        return
      }
      if (typeof source.requestVideoFrameCallback === "function") {
        source.requestVideoFrameCallback(() => drawFrame())
      } else {
        ownerWindow.requestAnimationFrame(drawFrame)
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      const recorded = new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" })
      void correctWebmDuration(recorded, Math.max(0.1, endTime - startTime)).then(resolve, reject)
    }
    recorder.onerror = () => reject(new Error("Could not trim recording"))

    source.addEventListener("timeupdate", onTimeUpdate)

    recorder.start(100)
    void source.play().then(
      () => drawFrame(),
      () => {
        source.removeEventListener("timeupdate", onTimeUpdate)
        reject(new Error("Could not trim recording"))
      },
    )
  })
}

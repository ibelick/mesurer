import { seekVideoElement } from "./screen-recording-export"
import { muxH264Mp4 } from "./mp4-boxes"

type EncoderCtor = new (init: { output: (chunk: any, metadata?: any) => void; error: (error: Error) => void }) => any

const encoderCtor = (ownerWindow: Window) => (ownerWindow as Window & { VideoEncoder?: EncoderCtor }).VideoEncoder
const codecs = ["avc1.42001E", "avc1.42001F", "avc1.4D001F", "avc1.64001F"]
const even = (value: number) => Math.max(2, Math.round(value) & ~1)

export async function supportedMp4Config(ownerWindow: Window, width: number, height: number): Promise<any | null> {
  const Encoder = encoderCtor(ownerWindow)
  if (!Encoder) return null
  const dimensions = { width: even(width), height: even(height) }
  for (const codec of codecs) {
    try {
      const result = await (Encoder as any).isConfigSupported({ codec, ...dimensions, bitrate: 4_000_000, framerate: 30, avc: { format: "avc" } })
      if (result?.supported) return result.config
    } catch { /* Try the next browser-supported AVC profile. */ }
  }
  return null
}

export async function supportsMp4Encoding(ownerWindow: Window, width: number, height: number): Promise<boolean> {
  return Boolean(await supportedMp4Config(ownerWindow, width, height))
}

export async function encodeMp4Clip(ownerDocument: Document, ownerWindow: Window, sourceUrl: string, startTime: number, endTime: number, scale: number): Promise<Blob> {
  const source = ownerDocument.createElement("video")
  source.muted = true; source.playsInline = true; source.preload = "auto"; source.src = sourceUrl
  try {
    await new Promise<void>((resolve, reject) => {
      const ready = () => source.videoWidth > 0 && source.videoHeight > 0 && source.readyState >= 2
      const finish = () => ready() && resolve()
      source.onloadedmetadata = finish; source.onloadeddata = finish; source.onerror = () => reject(new Error("Could not export MP4"))
      if (ready()) resolve()
    })
    const canvas = ownerDocument.createElement("canvas")
    canvas.width = even(source.videoWidth * scale); canvas.height = even(source.videoHeight * scale)
    const context = canvas.getContext("2d"); const Encoder = encoderCtor(ownerWindow)
    if (!context || !Encoder) throw new Error("MP4 export is unavailable")
    const samples: Array<{ data: Uint8Array; key: boolean; timestamp: number }> = []; let avcConfig: Uint8Array | undefined; let failure: Error | undefined
    const config = await supportedMp4Config(ownerWindow, canvas.width, canvas.height)
    if (!config) throw new Error("MP4 export is unavailable")
    const encoder = new Encoder({ output: (chunk, metadata) => { const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data); samples.push({ data, key: chunk.type === "key", timestamp: chunk.timestamp }); const description = metadata?.decoderConfig?.description; if (description) avcConfig = new Uint8Array(description) }, error: (error) => { failure = error } })
    encoder.configure(config)
    const VideoFrameCtor = (ownerWindow as Window & { VideoFrame?: any }).VideoFrame
    if (!VideoFrameCtor) throw new Error("MP4 export is unavailable")
    let frameIndex = 0
    for (const time of Array.from({ length: Math.max(1, Math.ceil((endTime - startTime) * 30)) }, (_, index) => startTime + index / 30)) {
      await seekVideoElement(source, Math.min(endTime, time)); context.drawImage(source, 0, 0, canvas.width, canvas.height)
      const frame = new VideoFrameCtor(canvas, { timestamp: Math.round(frameIndex++ * 1_000_000 / 30) }); encoder.encode(frame, { keyFrame: frameIndex === 1 || frameIndex % 60 === 0 }); frame.close()
    }
    await encoder.flush(); encoder.close()
    if (failure || !avcConfig || samples.length === 0) throw failure ?? new Error("Could not export MP4")
    return new Blob([new Uint8Array(muxH264Mp4(canvas.width, canvas.height, samples, avcConfig))], { type: "video/mp4" })
  } finally { source.pause(); source.removeAttribute("src"); source.load() }
}

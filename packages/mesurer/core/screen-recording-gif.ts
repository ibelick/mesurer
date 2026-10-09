import { seekVideoElement } from "./screen-recording-export"

export const GIF_FRAME_RATE = 12

export function gifFrameTimes(startTime: number, endTime: number, frameRate = GIF_FRAME_RATE): number[] {
  const frameCount = Math.max(1, Math.ceil((endTime - startTime) * frameRate))
  return Array.from({ length: frameCount }, (_, index) => Math.min(endTime, startTime + index / frameRate))
}

const createPalette = () => {
  const colors = new Uint8Array(256 * 3)
  for (let index = 0; index < 256; index += 1) {
    const offset = index * 3
    colors[offset] = Math.round(((index >> 5) & 7) * 255 / 7)
    colors[offset + 1] = Math.round(((index >> 2) & 7) * 255 / 7)
    colors[offset + 2] = (index & 3) * 85
  }
  return colors
}

const indexPixels = (rgba: Uint8ClampedArray) => {
  const indexed = new Uint8Array(rgba.length / 4)
  for (let pixel = 0; pixel < indexed.length; pixel += 1) {
    const offset = pixel * 4
    indexed[pixel] = (rgba[offset] & 0xe0) | ((rgba[offset + 1] & 0xe0) >> 3) | (rgba[offset + 2] >> 6)
  }
  return indexed
}

const encodeLzw = (pixels: Uint8Array) => {
  const minimumCodeSize = 8
  const clearCode = 1 << minimumCodeSize
  const endCode = clearCode + 1
  const bytes: number[] = []
  let currentByte = 0
  let bitCount = 0
  const codeSize = minimumCodeSize + 1
  let nextCode = endCode + 1
  let dictionary = new Map<number, number>()
  const writeCode = (code: number) => {
    currentByte |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) {
      bytes.push(currentByte & 0xff)
      currentByte >>= 8
      bitCount -= 8
    }
  }
  const reset = () => {
    dictionary = new Map<number, number>()
    nextCode = endCode + 1
  }
  writeCode(clearCode)
  let prefix = pixels[0] ?? 0
  for (let index = 1; index < pixels.length; index += 1) {
    const value = pixels[index]
    const key = (prefix << 8) | value
    const existing = dictionary.get(key)
    if (existing !== undefined) {
      prefix = existing
      continue
    }
    writeCode(prefix)
    if (nextCode < 500) {
      dictionary.set(key, nextCode)
      nextCode += 1
    } else {
      writeCode(clearCode)
      reset()
    }
    prefix = value
  }
  writeCode(prefix)
  writeCode(endCode)
  if (bitCount > 0) bytes.push(currentByte & 0xff)
  return bytes
}

const writeWord = (output: number[], value: number) => {
  output.push(value & 0xff, (value >> 8) & 0xff)
}

const writeSubBlocks = (output: number[], bytes: number[]) => {
  for (let offset = 0; offset < bytes.length; offset += 255) {
    const chunk = bytes.slice(offset, offset + 255)
    output.push(chunk.length, ...chunk)
  }
  output.push(0)
}

const startGif = (width: number, height: number) => {
  const output: number[] = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
  writeWord(output, width)
  writeWord(output, height)
  output.push(0xf7, 0, 0, ...createPalette())
  output.push(0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00)
  return output
}

const appendFrame = (output: number[], width: number, height: number, pixels: Uint8Array, delay: number) => {
  output.push(0x21, 0xf9, 0x04, 0x00)
  writeWord(output, delay)
  output.push(0, 0, 0x2c)
  writeWord(output, 0)
  writeWord(output, 0)
  writeWord(output, width)
  writeWord(output, height)
  output.push(0)
  output.push(8)
  writeSubBlocks(output, encodeLzw(pixels))
}

export async function encodeGifClip(ownerDocument: Document, sourceUrl: string, startTime: number, endTime: number, scale: number): Promise<Blob> {
  const source = ownerDocument.createElement("video")
  source.muted = true
  source.playsInline = true
  source.preload = "auto"
  source.src = sourceUrl
  try {
    await new Promise<void>((resolve, reject) => {
      const ready = () => source.videoWidth > 0 && source.videoHeight > 0 && source.readyState >= 2
      const finish = () => ready() && resolve()
      source.onloadedmetadata = finish
      source.onloadeddata = finish
      source.onresize = finish
      source.onerror = () => reject(new Error("Could not export GIF"))
      if (ready()) resolve()
    })
    const canvas = ownerDocument.createElement("canvas")
    canvas.width = Math.max(1, Math.round(source.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(source.videoHeight * scale))
    if (canvas.width > 0xffff || canvas.height > 0xffff) throw new Error("Could not export GIF")
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("Could not export GIF")
    const output = startGif(canvas.width, canvas.height)
    const delay = Math.max(1, Math.round(100 / GIF_FRAME_RATE))
    for (const time of gifFrameTimes(startTime, endTime)) {
      await seekVideoElement(source, time)
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      appendFrame(output, canvas.width, canvas.height, indexPixels(context.getImageData(0, 0, canvas.width, canvas.height).data), delay)
    }
    output.push(0x3b)
    return new Blob([new Uint8Array(output)], { type: "image/gif" })
  } finally {
    source.pause()
    source.removeAttribute("src")
    source.load()
  }
}

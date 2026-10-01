const EBML_ID = 0x1a45dfa3
const SEGMENT_ID = 0x18538067
const INFO_ID = 0x1549a966
const TIMECODE_SCALE_ID = 0x2ad7b1
const DURATION_ID = 0x4489
const CLUSTER_ID = 0x1f43b675
const MASTER_IDS = new Set([EBML_ID, SEGMENT_ID, INFO_ID])

const readElementId = (bytes: Uint8Array, offset: number) => {
  const first = bytes[offset]
  if (first === undefined || first === 0) return null
  let length = 1
  let mask = 0x80
  while (length <= 4 && (first & mask) === 0) {
    mask >>= 1
    length += 1
  }
  if (offset + length > bytes.length) return null
  let id = 0
  for (let index = 0; index < length; index += 1) id = id * 256 + bytes[offset + index]
  return { length, id }
}

const readElementSize = (bytes: Uint8Array, offset: number) => {
  const first = bytes[offset]
  if (first === undefined || first === 0) return null
  let length = 1
  let mask = 0x80
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1
    length += 1
  }
  if (offset + length > bytes.length) return null
  const marker = mask - 1
  let unknown = (first & marker) === marker
  let value = first & marker
  for (let index = 1; index < length; index += 1) {
    const byte = bytes[offset + index]
    if (byte !== 0xff) unknown = false
    value = value * 256 + byte
  }
  return { length, value, unknown }
}

const readUint = (bytes: Uint8Array, offset: number, size: number) => {
  let value = 0
  for (let index = 0; index < size; index += 1) value = value * 256 + bytes[offset + index]
  return value
}

/**
 * MediaRecorder writes a WebM duration that can cover only the first clusters.
 * Replace a shorter duration with the recorded length so export plays the whole clip.
 */
export function writeWebmDuration(bytes: Uint8Array, durationSeconds: number): boolean {
  if (!(durationSeconds > 0)) return false
  let timecodeScale = 1_000_000
  let durationOffset = -1
  let durationSize = 0

  const walk = (start: number, end: number, inInfo: boolean) => {
    let cursor = start
    while (cursor + 2 < end && durationOffset < 0) {
      const id = readElementId(bytes, cursor)
      if (!id) return
      cursor += id.length
      const size = readElementSize(bytes, cursor)
      if (!size) return
      cursor += size.length
      const dataStart = cursor
      if (id.id === CLUSTER_ID) return
      if (id.id === TIMECODE_SCALE_ID && !size.unknown && size.value > 0 && size.value <= 8) {
        timecodeScale = readUint(bytes, dataStart, size.value)
      }
      if (id.id === DURATION_ID && inInfo && !size.unknown && (size.value === 4 || size.value === 8)) {
        durationOffset = dataStart
        durationSize = size.value
        return
      }
      const dataEnd = size.unknown ? end : dataStart + size.value
      if (size.unknown || MASTER_IDS.has(id.id)) {
        walk(dataStart, dataEnd, inInfo || id.id === INFO_ID)
        if (durationOffset >= 0) return
      }
      if (size.unknown) return
      cursor = dataEnd
    }
  }

  walk(0, bytes.length, false)
  if (durationOffset < 0 || timecodeScale <= 0) return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const current = durationSize === 8
    ? view.getFloat64(durationOffset)
    : view.getFloat32(durationOffset)
  const next = durationSeconds * (1_000_000_000 / timecodeScale)
  if (Number.isFinite(current) && current >= next - (1_000_000_000 / timecodeScale) * 0.05) return false
  if (durationSize === 8) view.setFloat64(durationOffset, next)
  else view.setFloat32(durationOffset, next)
  return true
}

export async function correctWebmDuration(blob: Blob, durationSeconds: number): Promise<Blob> {
  if (!(durationSeconds > 0) || !blob.type.includes("webm")) return blob
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (!writeWebmDuration(bytes, durationSeconds)) return blob
  return new Blob([bytes], { type: blob.type || "video/webm" })
}

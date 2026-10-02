type Sample = { data: Uint8Array; key: boolean; timestamp: number }

const u16 = (value: number) => new Uint8Array([(value >> 8) & 255, value & 255])
const u32 = (value: number) => new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255])
const text = (value: string) => new TextEncoder().encode(value)
const join = (...parts: Uint8Array[]) => {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { output.set(part, offset); offset += part.length }
  return output
}
const box = (type: string, ...payload: Uint8Array[]) => join(u32(8 + payload.reduce((sum, part) => sum + part.length, 0)), text(type), ...payload)
const fullBox = (type: string, version: number, flags: number, ...payload: Uint8Array[]) => box(type, new Uint8Array([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...payload)
const zeros = (length: number) => new Uint8Array(length)

export function muxH264Mp4(width: number, height: number, samples: Sample[], avcConfig: Uint8Array, timescale = 90_000): Uint8Array {
  const durations = samples.map((sample, index) => index + 1 < samples.length
    ? Math.max(1, Math.round((samples[index + 1].timestamp - sample.timestamp) * timescale / 1_000_000))
    : Math.max(1, Math.round(timescale / 30)))
  const duration = durations.reduce((sum, value) => sum + value, 0)
  const mdatPayload = join(...samples.map((sample) => sample.data))
  const ftyp = box("ftyp", text("isom"), u32(0x200), text("isomiso2avc1mp41"))
  const mvhd = fullBox("mvhd", 0, 0, zeros(8), u32(timescale), u32(duration), u32(0x00010000), u16(0x0100), zeros(10), u32(0x00010000), zeros(12), u32(0x00010000), zeros(12), u32(2))
  const tkhd = fullBox("tkhd", 0, 7, zeros(8), u32(1), zeros(4), u32(duration), zeros(8), u16(0), u16(0), u16(0), u16(0), u32(0x00010000), zeros(12), u32(0x00010000), zeros(12), u32(width << 16), u32(height << 16))
  const mdhd = fullBox("mdhd", 0, 0, zeros(8), u32(timescale), u32(duration), u16(0x55c4), u16(0))
  const hdlr = fullBox("hdlr", 0, 0, zeros(4), text("vide"), zeros(12), text("Mesurer Video\0"))
  const vmhd = fullBox("vmhd", 0, 1, zeros(8))
  const dref = fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1))
  const avc1 = box("avc1", zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(0x00480000), u32(0x00480000), zeros(4), u16(1), zeros(32), u16(0x0018), u16(0xffff), box("avcC", avcConfig))
  const stsd = fullBox("stsd", 0, 0, u32(1), avc1)
  const runs: Array<{ count: number; delta: number }> = []
  for (const delta of durations) { const last = runs[runs.length - 1]; if (last?.delta === delta) last.count += 1; else runs.push({ count: 1, delta }) }
  const stts = fullBox("stts", 0, 0, u32(runs.length), ...runs.map((run) => join(u32(run.count), u32(run.delta))))
  const stsc = fullBox("stsc", 0, 0, u32(1), u32(1), u32(samples.length), u32(1))
  const stsz = fullBox("stsz", 0, 0, u32(0), u32(samples.length), ...samples.map((sample) => u32(sample.data.length)))
  const stss = samples.some((sample) => !sample.key) ? fullBox("stss", 0, 0, u32(samples.filter((sample) => sample.key).length), ...samples.flatMap((sample, index) => sample.key ? [u32(index + 1)] : [])) : null
  const stbl = box("stbl", stsd, stts, stsc, stsz, stss ?? new Uint8Array())
  const minf = box("minf", vmhd, box("dinf", dref), stbl)
  const trak = box("trak", tkhd, box("mdia", mdhd, hdlr, minf))
  const moov = box("moov", mvhd, trak)
  const chunkOffset = ftyp.length + moov.length + 20 + 8
  const stco = fullBox("stco", 0, 0, u32(1), u32(chunkOffset))
  const patchedStbl = box("stbl", stsd, stts, stsc, stsz, stco, stss ?? new Uint8Array())
  const patchedMoov = box("moov", mvhd, box("trak", tkhd, box("mdia", mdhd, hdlr, box("minf", vmhd, box("dinf", dref), patchedStbl))))
  return join(ftyp, patchedMoov, box("mdat", mdatPayload))
}

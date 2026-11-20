// Every npm download of the package since it was first published. The npm API answers at most
// 18 months per request, so the whole span is asked in parts.
const DAY = 86_400_000;

const day = (time: number) => new Date(time).toISOString().slice(0, 10);

export async function npmDownloadTotal(): Promise<number | null> {
  try {
    const signal = AbortSignal.timeout(8000);
    const registry = await fetch("https://registry.npmjs.org/mesurer", { signal });
    if (!registry.ok) return null;
    const body = (await registry.json()) as { time?: { created?: string } };
    const created = Date.parse(body.time?.created ?? "");
    if (!Number.isFinite(created)) return null;
    let total = 0;
    for (let start = created; start < Date.now(); start += 540 * DAY) {
      const end = Math.min(start + 539 * DAY, Date.now());
      const response = await fetch(`https://api.npmjs.org/downloads/range/${day(start)}:${day(end)}/mesurer`, { signal });
      if (!response.ok) return null;
      const range = (await response.json()) as { downloads?: { downloads?: number }[] };
      if (!Array.isArray(range.downloads)) return null;
      total += range.downloads.reduce((sum, entry) => sum + (entry.downloads ?? 0), 0);
    }
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}

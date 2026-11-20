// The same npm total the site build counts. The browser keeps it for a day so the homepage
// can move on without a new deploy, and asks again after that.
const DAY = 86_400_000;
const CACHE_KEY = "mesurer.npm-downloads";

type CachedDownloads = {
  total: number;
  at: number;
};

const day = (time: number) => new Date(time).toISOString().slice(0, 10);

export function readDownloadCache(now = Date.now()): { total: number; fresh: boolean } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedDownloads>;
    if (typeof cached.total !== "number" || typeof cached.at !== "number" || cached.total <= 0) return null;
    return { total: cached.total, fresh: now - cached.at <= DAY };
  } catch {
    return null;
  }
}

export function writeDownloadCache(total: number, now = Date.now()) {
  try {
    const cached: CachedDownloads = { total, at: now };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // A private window or a full store still shows the total for this visit.
  }
}

export async function fetchNpmDownloads(): Promise<number | null> {
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

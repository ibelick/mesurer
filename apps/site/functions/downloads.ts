import { npmDownloadTotal } from "./npm-count";

// One total for every visitor. The edge keeps it for 12 hours, then one request counts npm again.
const CACHE_SECONDS = 12 * 60 * 60;

interface DownloadContext {
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
}

export async function onRequestGet({ request, waitUntil }: DownloadContext): Promise<Response> {
  const cacheKey = new Request(new URL("/downloads", request.url), { method: "GET" });
  const hit = await caches.default.match(cacheKey);
  if (hit) return hit;

  const total = await npmDownloadTotal();
  if (total == null) {
    return Response.json({ total: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  const response = Response.json({ total }, { headers: { "cache-control": `public, max-age=${CACHE_SECONDS}` } });
  waitUntil(caches.default.put(cacheKey, response.clone()));
  return response;
}

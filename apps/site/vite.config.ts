import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// LOCAL TESTING ONLY. Keeps the reviews the extension saves, for as long as the dev server runs,
// so a review made on any site opens here. It stands in for the review API.
const localReviews = (): Plugin => {
  const reviews = new Map<string, string>();
  return {
    name: "mesurer-local-reviews",
    configureServer(server) {
      server.middlewares.use("/__reviews", (request, response) => {
        const id = (request.url ?? "").split("?")[0].slice(1);
        if (request.method === "PUT") {
          const chunks: Buffer[] = [];
          request.on("data", (chunk: Buffer) => chunks.push(chunk));
          request.on("end", () => {
            reviews.set(id, Buffer.concat(chunks).toString("utf8"));
            response.statusCode = 204;
            response.end();
          });
          return;
        }
        const html = reviews.get(id);
        response.statusCode = html === undefined ? 404 : 200;
        response.setHeader("content-type", "text/plain; charset=utf-8");
        response.end(html ?? "");
      });
    },
  };
};

// Every npm download of the package since it was first published. The npm API answers at most
// 18 months per request, so the whole span is asked in parts. Null when npm cannot be reached: the
// page then shows the count it was last built with.
const DAY = 86_400_000;
const npmDownloads = async (): Promise<number | null> => {
  try {
    const signal = AbortSignal.timeout(5000);
    const registry = await fetch("https://registry.npmjs.org/mesurer", { signal }).then((response) => response.json());
    const day = (time: number) => new Date(time).toISOString().slice(0, 10);
    let total = 0;
    for (let start = Date.parse(registry.time.created); start < Date.now(); start += 540 * DAY) {
      const end = Math.min(start + 539 * DAY, Date.now());
      const range = await fetch(`https://api.npmjs.org/downloads/range/${day(start)}:${day(end)}/mesurer`, { signal }).then((response) => response.json());
      total += range.downloads.reduce((sum: number, entry: { downloads: number }) => sum + entry.downloads, 0);
    }
    return total > 0 ? total : null;
  } catch {
    return null;
  }
};

export default defineConfig(async ({ command }) => ({
  plugins: [tailwindcss(), react(), localReviews()],
  define: {
    __MESURER_DOWNLOADS__: JSON.stringify(await npmDownloads()),
    __MESURER_SNAPDOM_CAPTURE__: "true",
    // The test pages run the extension's content script from source, with saving a review on.
    __MESURER_REVIEW__: "true",
    // The built site has no saving of reviews: what only it needs is compiled out. The dev
    // server keeps it, for the tests.
    ...(command === "build" ? { "globalThis.__MESURER_NO_REVIEW__": "true" } : null),
  },
  resolve: {
    alias: {
      mesurer: fileURLToPath(
        new URL("../../packages/mesurer/index.ts", import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    exclude: ["mesurer"],
  },
  server: {
    strictPort: true,
  },
}));

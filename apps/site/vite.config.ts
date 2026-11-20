import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { npmDownloadTotal } from "./functions/npm-count";

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

export default defineConfig(async ({ command }) => ({
  plugins: [tailwindcss(), react(), localReviews()],
  define: {
    __MESURER_DOWNLOADS__: JSON.stringify(await npmDownloadTotal()),
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

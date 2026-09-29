import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const port = 4179;

const routes = [
  { path: "/", ready: "#landing-title" },
  { path: "/docs", ready: "#doc-title" },
  { path: "/docs/props", ready: "#doc-title" },
  { path: "/docs/shortcuts", ready: "#doc-title" },
  { path: "/changelog", ready: "#doc-title" },
  { path: "/privacy", ready: "#doc-title" },
  { path: "/terms", ready: "#doc-title" },
];

const outFile = (route) =>
  route === "/" ? join(dist, "index.html") : join(dist, route.slice(1), "index.html");

const server = await preview({
  root,
  preview: { host: "127.0.0.1", port, strictPort: true },
});

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  window.__MESURER_PRERENDER__ = true;
});

try {
  const files = [];
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:${port}${route.path}`, { waitUntil: "load" });
    await page.waitForSelector(route.ready, { timeout: 15_000 });
    await page.evaluate(() => {
      const keepLast = (selector) => {
        const nodes = [...document.querySelectorAll(selector)];
        nodes.slice(0, -1).forEach((node) => node.remove());
      };
      const wantedTitle = document.title;
      let keptTitle = false;
      for (const title of document.querySelectorAll("title")) {
        if (!keptTitle && title.textContent === wantedTitle) {
          keptTitle = true;
          continue;
        }
        title.remove();
      }
      keepLast('meta[name="description"]');
      keepLast('link[rel="canonical"]');
      keepLast('meta[property="og:url"]');
      keepLast('meta[property="og:title"]');
    });
    const html = await page.content();
    if (!html.includes("<h1")) {
      throw new Error(`Prerender produced no heading for ${route.path}`);
    }
    files.push({ file: outFile(route.path), html, path: route.path });
  }
  for (const { file, html, path } of files) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
    console.log(`prerendered ${path} -> ${relative(root, file)}`);
  }
} finally {
  await browser.close();
  await server.close();
}

import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
const bundle = resolve("dist/mesurer/skills/mesurer/assets/launcher.global.js");
const fixture = `<!doctype html><html><head><style>body{margin:0;font:16px sans-serif}#target{position:absolute;left:360px;top:280px;width:200px;height:80px;background:#eee}button{color:red}</style></head><body><button id="target">Review this button</button></body></html>`;

test.beforeEach(async ({ page }) => {
  await page.route("https://fixture.test/**", route => route.fulfill({ contentType: "text/html", body: fixture }));
  await page.goto("https://fixture.test/first");
  await page.addScriptTag({ path: bundle });
});

test("mounts without Chrome APIs, isolates styles, is idempotent and can stop/restart", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Annotate tools (2)" })).toBeVisible();
  const before = await page.locator("#target").evaluate(el => ({ width: el.getBoundingClientRect().width, color: getComputedStyle(el).color }));
  expect(before).toEqual({ width: 200, color: "rgb(255, 0, 0)" });
  await page.addScriptTag({ path: bundle });
  await expect(page.locator("#mesurer-codex-host")).toHaveCount(1);
  await page.evaluate(() => (window as any).__MESURER_CODEX__.stop());
  await expect(page.locator("#mesurer-codex-host")).toHaveCount(0);
  await page.evaluate(() => (window as any).__MESURER_CODEX__.start());
  await expect(page.getByRole("button", { name: "Annotate tools (2)" })).toBeVisible();
});

test("exports actual comments with page context and isolates SPA routes", async ({ page }) => {
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Comments (M)" }).click();
  await page.mouse.click(460, 320);
  await page.getByRole("textbox", { name: "Comment", exact: true }).fill("Increase this button's contrast");
  await page.getByRole("button", { name: "Send comment" }).click();
  const feedback = () => page.evaluate(() => (window as any).__MESURER_CODEX__.feedback());
  await expect.poll(async () => (await feedback()).text).toContain("Increase this button's contrast");
  expect(await feedback()).toMatchObject({ url: "https://fixture.test/first", viewport: { width: 1280, height: 800 } });
  expect((await feedback()).text).toContain("#target");
  await page.evaluate(() => history.pushState({}, "", "/second"));
  await expect.poll(async () => (await feedback()).text).not.toContain("Increase this button's contrast");
  await page.evaluate(() => history.pushState({}, "", "/first"));
  await expect.poll(async () => (await feedback()).text).toContain("Increase this button's contrast");
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test("recovers a detached host and does not auto-inject after a full navigation", async ({ page }) => {
  await expect(page.locator("#mesurer-codex-host")).toHaveCount(1);
  await page.evaluate(() => document.getElementById("mesurer-codex-host")?.remove());
  await expect(page.locator("#mesurer-codex-host")).toHaveCount(1);
  await page.goto("https://fixture.test/next");
  await expect(page.locator("#mesurer-codex-host")).toHaveCount(0);
});

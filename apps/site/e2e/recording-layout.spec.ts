import { expect, test } from "@playwright/test";

// Opt into Chrome's real tab capture to reproduce rendering-scale regressions:
// MESURER_TEST_NATIVE_CAPTURE=1 pnpm --filter mesurer-site exec playwright test e2e/recording-layout.spec.ts
const nativeCapture = process.env.MESURER_TEST_NATIVE_CAPTURE === "1";

test.use({
  viewport: { width: 1680, height: 952 },
  headless: !nativeCapture,
  launchOptions: {
    args: nativeCapture ? [
      "--auto-select-tab-capture-source-by-title=Build precise software with your coding agent | Mesurer",
      "--enable-experimental-web-platform-features",
    ] : [],
  },
});

test("starting a tab recording preserves the live marketing hero layout", async ({ page }) => {
  if (!nativeCapture) {
    await page.addInitScript(() => {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1680;
        canvas.height = 952;
        canvas.getContext("2d")!.fillRect(0, 0, canvas.width, canvas.height);
        return canvas.captureStream(30);
      };
    });
  }
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const hero = page.locator("main#overview > div > section:nth-of-type(1) > div");
  await expect(hero).toBeVisible();
  const before = await hero.boundingBox();
  await page.getByRole("button", { name: "Show Mesurer toolbar" }).click();
  await page.getByRole("button", { name: "Capture menu" }).click();
  await page.getByRole("menuitem", { name: /Screen record/ }).click();
  await page.mouse.move(480, 160);
  await page.mouse.down();
  await page.mouse.move(1100, 500, { steps: 4 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByRole("button", { name: /^Stop recording/ })).toBeVisible();
  const during = await hero.boundingBox();
  expect(during?.width).toBe(before?.width);
  expect(during?.height).toBe(before?.height);
  await expect(page.locator("[data-mesurer-recording-crop]")).toHaveCount(0);
  await expect(page.locator("body > canvas")).toHaveAttribute("width", "620");
  await expect(page.locator("body > canvas")).toHaveAttribute("height", "340");
  await page.getByRole("button", { name: /^Stop recording/ }).click();
  await expect(page.locator("body > video, body > canvas")).toHaveCount(0);
});

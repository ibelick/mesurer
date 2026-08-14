import { expect, test } from "@playwright/test";

test("placed guides remain visible while host-app clicks pass through", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const guidesButton = page.getByRole("button", { name: "Guides (G)" });
  const underlyingButton = page.getByRole("button", {
    name: "Underlying app button",
  });
  const extensionHost = page.locator("#mesurer-extension-host");
  const overlay = extensionHost.locator(".mesurer-root > div").first();

  await expect(guidesButton).toBeVisible();
  await guidesButton.click();
  await expect(overlay).toHaveCSS("pointer-events", "auto");

  await page.mouse.click(300, 200);
  await page.mouse.click(150, 250);
  await page.keyboard.press("g");

  await expect(overlay).toHaveCSS("pointer-events", "none");
  await expect(overlay).toHaveCSS("opacity", "1");
  await expect(overlay.locator(":scope > div")).toHaveCount(2);
  await expect(extensionHost).toHaveCSS("pointer-events", "none");

  const box = await underlyingButton.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(300, box!.y + box!.height / 2);
  await expect(page.getByTestId("underlying-click-count")).toHaveText("1");

  await guidesButton.click();
  await expect(overlay).toHaveCSS("pointer-events", "auto");
});

test("font inspector mode participates in undo and redo history", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const textInspectorButton = page.getByRole("button", {
    name: "Text inspector (A)",
  });

  await textInspectorButton.click();
  await expect(page.locator("body")).toHaveClass(/mesurer-text-inspector-\d+-mode/);

  await page.keyboard.press("Control+Z");
  await expect(page.locator("body")).not.toHaveClass(/mesurer-text-inspector-\d+-mode/);

  await page.keyboard.press("Control+Shift+Z");
  await expect(page.locator("body")).toHaveClass(/mesurer-text-inspector-\d+-mode/);

  await page.mouse.move(100, 100);
  await page.mouse.move(300, 280);
  await page.mouse.click(300, 280);
  const pinnedCard = page.locator(".mesurer-ti-card--pinned");
  await expect(pinnedCard).toHaveCount(1);

  await page.keyboard.press("Control+Z");
  await expect(pinnedCard).toHaveCount(0);

  await page.keyboard.press("Control+Shift+Z");
  await expect(pinnedCard).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(pinnedCard).toHaveCount(0);
});

test("font inspector refreshes styles and brings repeated pins to front", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Text inspector (A)" }).click();

  await page.mouse.click(300, 280);
  await page.mouse.click(300, 560);
  const pinnedCards = page.locator(".mesurer-ti-card--pinned");
  await expect(pinnedCards).toHaveCount(2);
  await expect(pinnedCards.last()).toContainText("Secondary app button");

  await page.mouse.click(300, 280);
  await expect(pinnedCards).toHaveCount(2);
  await expect(pinnedCards.last()).toContainText("Underlying app button");

  await page.locator("button").filter({ hasText: "Underlying" }).evaluate((button) => {
    (button as HTMLElement).style.fontSize = "24px";
  });
  await page.mouse.move(100, 100);
  await page.mouse.move(300, 280);
  await expect(
    page.locator(".mesurer-ti-card:not(.mesurer-ti-card--pinned)"),
  ).toContainText("24px");
});

test("removing a source element silently removes its pinned card", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Text inspector (A)" }).click();
  await page.mouse.click(300, 280);

  const pinnedCards = page.locator(".mesurer-ti-card--pinned");
  await expect(pinnedCards).toHaveCount(1);
  await page.locator("button").filter({ hasText: "Underlying" }).evaluate((button) => {
    button.remove();
  });
  await page.mouse.move(100, 100);
  await expect(pinnedCards).toHaveCount(0);
});

test("x-ray mode outlines the page without hiding the toolbar", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const xrayButton = page.getByRole("button", { name: "X-ray (X)" });
  await xrayButton.click();

  await expect(xrayButton.locator("svg path")).toHaveCount(1);
  await expect(page.locator("body")).toHaveClass(/xray-mode/);
  await expect(xrayButton).toHaveCSS("background-color", "rgb(13, 153, 255)");
  await expect(xrayButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Select (S)" })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("marketing site renders the current x-ray toolbar icon", async ({ page }) => {
  await page.goto("/");

  const xrayButton = page.getByRole("button", { name: "X-ray (X)" });
  await expect(xrayButton).toBeVisible();
  await expect(xrayButton.locator("svg path")).toHaveCount(1);
});

test("native color picker shows color formats", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return Promise.resolve({ sRGBHex: "#ff0000" });
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");

  await page.getByRole("button", { name: "Color picker (P)" }).click();

  const picker = page.locator(".mesurer-color-picker");
  await expect(picker).toBeVisible();
  await expect(picker).toContainText("#ff0000");
  await expect(picker).toContainText("hex");
  await expect(picker).toContainText("rgb");
  await expect(picker).toContainText("oklch");
  await expect(picker).not.toContainText("Copied");
});

test("P opens the native color picker", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return Promise.resolve({ sRGBHex: "#00ff00" });
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Color picker (P)" })).toBeVisible();
  await page.keyboard.press("p");

  await expect(page.locator(".mesurer-color-picker")).toContainText("#00ff00");
});

test("settings button opens and dismisses its popover", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const settings = page.getByRole("button", { name: "Settings" });
  await settings.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
});

test("Cmd/Ctrl comma opens settings", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Settings (⌘/Ctrl+,)" })).toBeVisible();
  await page.keyboard.press("Control+,");

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
});

test("settings preferences survive a reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  const hoverSwitch = page.getByRole("switch", { name: "Hover highlight" });
  await hoverSwitch.click();
  await expect(hoverSwitch).toHaveAttribute("aria-checked", "false");

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("switch", { name: "Hover highlight" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("migrates v1 workspace state", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist=1");
  await page.evaluate(() => {
    localStorage.setItem("mesurer-state", JSON.stringify({
      version: 1,
      enabled: true,
      toolMode: "none",
      rulersVisible: false,
      guideOrientation: "vertical",
      guides: [{ id: "legacy-guide", orientation: "vertical", position: 180 }],
      selectedGuideIds: [],
      measurements: [],
      activeMeasurement: null,
      heldDistances: [],
    }));
  });
  await page.reload();

  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
});

test("ignores malformed persisted workspace data", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    localStorage.setItem("mesurer-state", JSON.stringify({
      version: 2,
      settings: { colorPickerFormats: ["invalid", "hex"] },
      workspace: {
        enabled: true,
        toolMode: "invalid",
        guides: [{ broken: true }],
      },
    }));
  });
  await page.reload();

  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(0);
});

test("syncs settings between tabs", async ({ page }) => {
  const secondPage = await page.context().newPage();
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await secondPage.goto("/e2e/fixtures/guide-overlay.html");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Hover highlight" }).click();

  await secondPage.getByRole("button", { name: "Settings" }).click();
  await expect(secondPage.getByRole("switch", { name: "Hover highlight" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await secondPage.close();
});

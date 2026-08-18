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
  await expect(picker).toContainText("rgb");
  await expect(picker).toContainText("oklch");
  await expect(picker).not.toContainText("Copied!");
});

test("falls back to default color formats when persisted formats are invalid", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return Promise.resolve({ sRGBHex: "#ff0000" });
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    localStorage.setItem("mesurer-settings", JSON.stringify({
      version: 2,
      settings: { colorPickerFormats: ["invalid"] },
      workspace: null,
    }));
  });
  await page.reload();
  await page.getByRole("button", { name: "Color picker (P)" }).click();

  const picker = page.locator(".mesurer-color-picker");
  await expect(picker).toContainText("#ff0000");
  await expect(picker).toContainText("rgb");
  await expect(picker).toContainText("oklch");
});

test("falls back to the default swatch for an invalid persisted color", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    localStorage.setItem("mesurer-settings", JSON.stringify({
      version: 2,
      settings: { highlightColor: "not-a-color" },
      workspace: null,
    }));
  });
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Select" }).click();
  const swatch = dialog.locator("input[aria-label='Color color picker']").locator("..");
  await expect(swatch).toHaveCSS(
    "background-color",
    "oklch(0.62 0.18 255)",
  );
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
  await page.keyboard.press("Escape");
  await expect(page.locator(".mesurer-color-picker")).toHaveCount(0);
});

test("settings button opens and dismisses its popover", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const settings = page.getByRole("button", { name: "Settings" });
  await settings.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
});

test("settings opens on the active feature tab", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const settings = page.getByRole("button", { name: "Settings (⌘/Ctrl+,)" });

  await settings.click();
  await expect(page.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Guides (G)" }).click();
  await settings.click();
  await expect(page.getByRole("tab", { name: "Guides" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Select" }).click();
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Select (S)" }).click();
  await settings.click();
  await expect(page.getByRole("tab", { name: "Select" })).toHaveAttribute("aria-selected", "true");
});

test("guide sliders do not drag the toolbar", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Guides" }).click();

  const toolbar = page.locator(".mesurer-toolbar-surface");
  const slider = page.getByRole("slider", { name: "Weight" });
  const sliderContainer = page.locator('[data-slider-container="true"]').filter({ has: slider });
  const before = await toolbar.boundingBox();
  const sliderBox = await slider.boundingBox();
  const sliderContainerBox = await sliderContainer.boundingBox();
  expect(before).not.toBeNull();
  expect(sliderBox).not.toBeNull();
  expect(sliderContainerBox).not.toBeNull();
   expect(sliderBox!.width).toBe(12);
   expect(sliderBox!.height).toBe(12);
  await page.mouse.move(sliderContainerBox!.x + 8, sliderContainerBox!.y + sliderContainerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(sliderContainerBox!.x + sliderContainerBox!.width - 8, sliderContainerBox!.y + sliderContainerBox!.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect(slider).toHaveAttribute("aria-valuenow", "4");
  const valueInput = page.locator("input[aria-label='Weight value']");
  await valueInput.click();
  await valueInput.selectText();
  await valueInput.pressSequentially("3px");
  await expect(valueInput).toHaveValue("3px");
  await valueInput.press("Enter");
  await expect(valueInput).toHaveValue("3px");
  const after = await toolbar.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x).toBe(before!.x);
  expect(after!.y).toBe(before!.y);
});

test("guide pattern renders as a real dashed line", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Guides" }).click();
  await page.getByRole("radio", { name: "Dashed guide pattern" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);

  const line = page.locator("[data-mesurer-guide] > div");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveCSS("background-image", /repeating-linear-gradient/);
  await expect(line).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("guides mode never selects page elements", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Select (S)" }).click();
  const target = page.getByRole("button", { name: "Underlying app button" });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await page.mouse.click(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);

  await page.getByRole("button", { name: "Guides (G)" }).click();
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(0);
  await page.mouse.click(300, 200);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(0);
});

test("Escape closes settings without clearing the workspace", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist=1");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
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
  await page.getByRole("tab", { name: "Select" }).click();
  const hoverSwitch = page.getByRole("switch", { name: "Hover" });
  await hoverSwitch.click();
  await expect(hoverSwitch).toHaveAttribute("aria-checked", "false");

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Select" }).click();
  await expect(page.getByRole("switch", { name: "Hover" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("persist on reload keeps the workspace", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings (⌘/Ctrl+,)" }).click();
  await page.getByRole("tab", { name: "General" }).click();
  await page.getByRole("switch", { name: "Reload persistence" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);

  await page.reload();
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
});

test("near-edge rulers reveal when the pointer approaches the edge", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings (⌘/Ctrl+,)" }).click();
  await page.getByRole("tab", { name: "Rulers" }).click();
  await page.getByRole("switch", { name: "Edge reveal" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Rulers (R)" }).click();

  const rulers = page.locator("[data-mesurer-rulers]");
  await expect(rulers).toHaveCSS("opacity", "0");
  await page.mouse.move(20, 20);
  await expect(rulers).toHaveCSS("opacity", "1");
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
  await page.getByRole("tab", { name: "Select" }).click();
  await page.getByRole("switch", { name: "Hover" }).click();

  await secondPage.getByRole("button", { name: "Settings" }).click();
  await secondPage.getByRole("tab", { name: "Select" }).click();
  await expect(secondPage.getByRole("switch", { name: "Hover" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await secondPage.close();
});

test("keeps persisted workspaces independent between tabs", async ({ page }) => {
  const secondPage = await page.context().newPage();
  await page.goto("/e2e/fixtures/guide-overlay.html?persist");
  await secondPage.goto("/e2e/fixtures/guide-overlay.html?persist");

  const firstTabId = await page.evaluate(() => sessionStorage.getItem("mesurer:tab-id"));
  const secondTabId = await secondPage.evaluate(() => sessionStorage.getItem("mesurer:tab-id"));
  expect(firstTabId).not.toBe(secondTabId);
  await page.evaluate((tabId) => {
    localStorage.setItem(`mesurer-state:${tabId}`, JSON.stringify({ version: 2, settings: {}, workspace: null }));
  }, firstTabId);
  await secondPage.evaluate((tabId) => {
    localStorage.setItem(`mesurer-state:${tabId}`, JSON.stringify({ version: 2, settings: {}, workspace: null }));
  }, secondTabId);
  await expect.poll(async () =>
    page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("mesurer-state:"))),
  ).toHaveLength(2);
  await secondPage.close();
});

test("ruler-created guides snap to regular guides", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);

  await page.getByRole("button", { name: "Rulers" }).click();
  await page.waitForTimeout(50);
  await page.mouse.move(9, 200, { steps: 5 });
  await page.mouse.down();
  await page.mouse.move(304, 200, { steps: 20 });
  await page.mouse.up();

  const guides = page.locator("[data-mesurer-guide]");
  await expect(guides).toHaveCount(2);
  const first = await guides.nth(0).boundingBox();
  const second = await guides.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(Math.abs(first!.x - second!.x)).toBeLessThanOrEqual(1);
});

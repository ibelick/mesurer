import { expect, test, type Page } from "@playwright/test";

const activateSelect = async (page: Page) => {
  const button = page.getByRole("button", { name: "Inspect (I)" });
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
};

test("starts with the Select tool active", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("switches tool groups with global commands and defaults", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();

  await page.keyboard.press("2");
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.keyboard.press("1");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("switching to annotation tools clears inspection overlays", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "X-ray (X)" }).click();

  await page.keyboard.press("2");

  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.keyboard.press("1");
  await expect(page.getByRole("button", { name: "X-ray (X)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("Escape closes the guide orientation menu without exiting the active tool", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();

  await page.getByRole("button", { name: "Guide orientation menu" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.press("Escape");

  await expect(menu).toBeHidden();
  await expect(page.getByRole("button", { name: "Guides (G)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("remembers the last tool after reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  const arrows = page.getByRole("button", { name: "Arrows (D)" });
  await arrows.click();
  await expect(arrows).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByRole("button", { name: "Arrows (D)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("falls back to Select for an invalid stored tool", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    localStorage.setItem("mesurer-settings", JSON.stringify({
      version: 2,
      settings: { lastToolMode: "invalid" },
      workspace: null,
    }));
  });
  await page.reload();

  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Select tool can inspect SVG elements", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
  await page.getByTestId("svg-rect").click({ force: true });

  await expect(page.locator("[data-mesurer-selected-measurement]")).toContainText("200 x 80");
});

const expectSettingsSectionPinned = async (page: Page, id: string) => {
  const panel = page.locator(".mesurer-settings-panel");
  const section = panel.locator(`[data-mesurer-settings-section="${id}"]`);
  await expect(section).toHaveAttribute("data-focused", "true");
  await expect
    .poll(async () => {
      const panelBox = await panel.boundingBox();
      const sectionBox = await section.boundingBox();
      if (!panelBox || !sectionBox) return Number.POSITIVE_INFINITY;
      return sectionBox.y - panelBox.y;
    })
    .toBeLessThan(12);
};

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

test("Selection mode draws a selection rectangle while dragging", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();

  await page.mouse.move(180, 180);
  await page.mouse.down();
  await page.mouse.move(420, 360, { steps: 4 });

  const rectangle = page.locator('[data-mesurer-overlay-marquee="true"]');
  await expect(rectangle).toHaveCount(1);
  const box = await rectangle.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  await page.mouse.up();
  await expect(rectangle).toHaveCount(0);
});

test("font inspector mode participates in undo and redo history", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const textInspectorButton = page.getByRole("button", {
    name: "Typography (A)",
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
  await page.getByRole("button", { name: "Typography (A)" }).click();

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

test("text inspector does not inspect settings", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Typography (A)" }).click();
  await page.getByRole("button", { name: "Settings" }).click();

  const heading = page.getByRole("heading", { name: "Guides" });
  await heading.hover();
  await expect(page.locator(".mesurer-ti-card:not(.mesurer-ti-card--pinned)")).toHaveCount(0);

  await heading.click();
  await expect(page.locator(".mesurer-ti-card--pinned")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
});

test("removing a source element silently removes its pinned card", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Typography (A)" }).click();
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
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
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

  await page.getByRole("button", { name: "Sample color (P)" }).click();

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
  await page.getByRole("button", { name: "Sample color (P)" }).click();

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
  const swatch = dialog.locator("[aria-label='Selection settings'] input[aria-label='Color color picker']").locator("..");
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
  await expect(page.getByRole("button", { name: "Sample color (P)" })).toBeVisible();
  await page.keyboard.press("p");

  await expect(page.locator(".mesurer-color-picker")).toContainText("#00ff00");
  await page.keyboard.press("Escape");
  await expect(page.locator(".mesurer-color-picker")).toHaveCount(0);
});

test("C starts screenshot region selection", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toBeVisible();
  await page.keyboard.press("c");
  const selection = page.getByRole("application", { name: "Screenshot selection" });
  await expect(selection).toBeVisible();
  await page.mouse.move(120, 140);
  await page.mouse.down();
  await page.mouse.move(280, 220);
  await expect(selection).toContainText("160 × 80");
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect(selection).toHaveCount(0);
});

test("cancelling screenshot pointer input does not capture", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toBeVisible();
  await page.keyboard.press("c");
  const selection = page.getByRole("application", { name: "Screenshot selection" });
  await expect(selection).toBeVisible();
  await page.mouse.move(120, 140);
  await page.mouse.down();
  await page.mouse.move(280, 220);
  await selection.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId: 1,
      }),
    );
  });
  await page.mouse.up();
  await expect(selection).toHaveCount(0);
  await expect(page.locator(".mesurer-screenshot-preview")).toHaveCount(0);
});

test("screenshot selection captures and copies the selected region", async ({ page }) => {
  await page.addInitScript(() => {
    const onePixelPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "test-extension",
          lastError: undefined,
          sendMessage: (_message: unknown, callback: (response: unknown) => void) =>
            callback({ ok: true, dataUrl: onePixelPng }),
        },
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write: () => Promise.resolve() },
    });
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toBeVisible();
  await page.keyboard.press("c");
  const selection = page.getByRole("application", { name: "Screenshot selection" });
  await expect(selection).toBeVisible();
  await page.mouse.move(120, 140);
  await page.mouse.down();
  await page.mouse.move(280, 220);
  await page.mouse.up();
  await expect(page.getByRole("status", { name: "Screenshot copied" })).toBeVisible();
  await expect(selection).toHaveCount(0);
});

test("screenshot settings support download-only capture", async ({ page }) => {
  await page.addInitScript(() => {
    const onePixelPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "test-extension",
          lastError: undefined,
          sendMessage: (_message: unknown, callback: (response: unknown) => void) =>
            callback({ ok: true, dataUrl: onePixelPng }),
        },
      },
    });
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("switch", { name: "Copy" }).click();
  await expect(dialog.getByRole("switch", { name: "Copy" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(dialog.getByRole("switch", { name: "Download" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("c");
  const selection = page.getByRole("application", { name: "Screenshot selection" });
  await expect(selection).toBeVisible();
  await page.mouse.move(280, 220);
  await page.mouse.down();
  await page.mouse.move(120, 140);
  const downloadPromise = page.waitForEvent("download");
  await page.mouse.up();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^mesurer-.*\.png$/);
});

test("disabling Mesurer closes screenshot selection", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toBeVisible();
  await page.keyboard.press("c");
  const selection = page.getByRole("application", { name: "Screenshot selection" });
  await expect(selection).toBeVisible();
  await page.keyboard.press("m");
  await expect(selection).toHaveCount(0);
});

test("settings button opens and dismisses its popover", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const settings = page.getByRole("button", { name: "Settings" });
  await settings.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
});

test("settings opens with all sections visible", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const settings = page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ });

  await settings.click();
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Guides (G)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "guides");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Inspect (I)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "selection");
});

test("opening settings with a tool active pins that tool section", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return new Promise(() => undefined);
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const settings = page.getByRole("button", { name: "Settings" });

  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Arrows (D)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "arrows");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Text (T)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "text");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Select (S)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "selection");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Select and inspect tools (1)" }).click();
  await page.getByRole("button", { name: "Sample color (P)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "color");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Screenshot (C)" }).click();
  await page.keyboard.press("Control+,");
  await expectSettingsSectionPinned(page, "screenshot");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Rulers (R)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "rulers");
});

test("color format multi-select supports keyboard navigation", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });
  const trigger = dialog.getByRole("combobox", { name: "Color formats" });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await trigger.press("Enter");

  const listbox = dialog.getByRole("listbox", { name: "Color formats" });
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole("option", { name: "hex" })).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(listbox.getByRole("option", { name: "hsl" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("guide sliders do not drag the toolbar", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.getByRole("button", { name: "Settings" }).click();

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
  await page.getByRole("radio", { name: "Dashed guide pattern" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);

  const line = page.locator("[data-mesurer-guide] > div");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveCSS("background-image", /repeating-linear-gradient/);
  await expect(line).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("placing a guide after a held pointer does not retain drag state", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();

  await page.mouse.move(300, 200);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.mouse.click(420, 200);

  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(2);
});

test("placed guides stay visible and update while settings is open", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);

  const line = page.locator("[data-mesurer-guide] > div");
  await expect(line).toHaveCount(1);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(line).toHaveCount(1);
  await expect(page.locator("[data-mesurer-guide]")).toBeVisible();

  await page.getByRole("radio", { name: "Dashed guide pattern" }).click();
  await expect(line).toHaveCSS("background-image", /repeating-linear-gradient/);
});

test("guide settings show a live preview when no guides are placed", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();

  const guides = page.locator("[data-mesurer-guide]");
  await expect(guides).toHaveCount(2);

  await page.getByRole("radio", { name: "Dashed guide pattern" }).click();
  await expect(guides.locator(":scope > div").first()).toHaveCSS(
    "background-image",
    /repeating-linear-gradient/,
  );

  await expect(guides).toHaveCount(2);
});

test("selection stays visible while settings is open", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
   await activateSelect(page);
  const target = page.getByRole("button", { name: "Underlying app button" });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await page.mouse.click(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
  await page.getByRole("switch", { name: "Hover" }).click();
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
});

test("rulers stay visible while settings is open", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Rulers (R)" }).click();
  await expect(page.locator("[data-mesurer-rulers]")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator("[data-mesurer-rulers]")).toBeVisible();
  await expect(page.locator("[data-mesurer-rulers]")).toHaveCSS("opacity", "1");
});

test("guides mode never selects page elements", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
   await activateSelect(page);
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
  await expect(page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ })).toBeVisible();
  await page.keyboard.press("Control+,");

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
});

test("settings preferences survive a reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  const hoverSwitch = page.getByRole("switch", { name: "Hover" });
  await hoverSwitch.click();
  await expect(hoverSwitch).toHaveAttribute("aria-checked", "false");

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("switch", { name: "Hover" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("persist on reload keeps the workspace", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ }).click();
  await page.getByRole("switch", { name: "Persist" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);

  await page.reload();
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
});

test("near-edge rulers reveal when the pointer approaches the edge", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ }).click();
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
  await page.getByRole("switch", { name: "Hover" }).click();

  await secondPage.getByRole("button", { name: "Settings" }).click();
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
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(secondPage.getByRole("button", { name: "Settings" })).toBeVisible();

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
  await expect(page.getByRole("button", { name: "Guides (G)" })).toBeVisible();
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);

  await page.getByRole("button", { name: "Rulers" }).click();
  const verticalRuler = page.locator('[data-mesurer-rulers="true"] > div').nth(1);
  await expect(verticalRuler).toBeVisible();
  const rulerBox = await verticalRuler.boundingBox();
  expect(rulerBox).not.toBeNull();
  const rulerX = rulerBox!.x + rulerBox!.width / 2;
  await verticalRuler.dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    clientX: rulerX,
    clientY: 200,
  });
  await verticalRuler.dispatchEvent("pointermove", {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: 304,
    clientY: 200,
  });
  await verticalRuler.dispatchEvent("pointerup", {
    button: 0,
    pointerId: 1,
    clientX: 304,
    clientY: 200,
  });

  const guides = page.locator("[data-mesurer-guide]");
  await expect(guides).toHaveCount(2);
  const first = await guides.nth(0).boundingBox();
  const second = await guides.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(Math.abs(first!.x - second!.x)).toBeLessThanOrEqual(1);
});

test("shows layout gap and padding when spacing is enabled", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
   await activateSelect(page);

  const target = page.getByTestId("layout-flex");
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const details = page.locator("[data-mesurer-layout-details]");
  await expect(details).toBeVisible();
  await expect(details).toContainText("gap");
  await expect(details).toContainText("8px");
  await expect(details).toContainText("padding");
  await expect(details).toContainText("16px");
});

test("hides layout details when spacing is disabled", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Spacing" }).click();
  await page.keyboard.press("Escape");
   await activateSelect(page);

  const target = page.getByTestId("layout-flex");
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  await expect(page.locator("[data-mesurer-layout-details]")).toHaveCount(0);
});

test("cycles through nested elements on repeated clicks", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Element snap" }).click();
  await page.keyboard.press("Escape");
   await activateSelect(page);

  const target = page.getByTestId("nested-target");
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  await page.mouse.click(x, y);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toContainText("160 x 80");

  await page.mouse.click(x, y);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toContainText("200 x 120");
});

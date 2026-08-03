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
  await expect(page.locator("body")).toHaveClass(/mesurer-text-inspect-mode/);

  await page.keyboard.press("Control+Z");
  await expect(page.locator("body")).not.toHaveClass(/mesurer-text-inspect-mode/);

  await page.keyboard.press("Control+Shift+Z");
  await expect(page.locator("body")).toHaveClass(/mesurer-text-inspect-mode/);

  await page.mouse.move(300, 280);
  await page.mouse.click(300, 280);
  const pinnedCard = page.locator(".mesurer-ti-card--pinned");
  await expect(pinnedCard).toHaveCount(1);

  await page.keyboard.press("Control+Z");
  await expect(pinnedCard).toHaveCount(0);

  await page.keyboard.press("Control+Shift+Z");
  await expect(pinnedCard).toHaveCount(1);
});

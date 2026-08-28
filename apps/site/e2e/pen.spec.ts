import { expect, test, type Page } from "@playwright/test";

const strokes = (page: Page) => page.locator('[data-mesurer-pen="true"]');

const activatePen = async (page: Page) => {
  await page.getByRole("button", { name: "Pen (N)" }).click();
};

const activateSelection = async (page: Page) => {
  await page.getByRole("button", { name: "Selection (O)" }).click();
};

const drawStroke = async (page: Page) => {
  await page.mouse.move(120, 160);
  await page.mouse.down();
  await page.mouse.move(180, 190, { steps: 4 });
  await page.mouse.move(260, 170, { steps: 4 });
  await page.mouse.up();
};

test("draws a freehand stroke with a transient preview", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);

  await page.mouse.move(120, 160);
  await page.mouse.down();
  await page.mouse.move(180, 190, { steps: 3 });
  await expect(page.locator("[data-mesurer-pen-preview='true']")).toHaveCount(1);
  await expect(strokes(page)).toHaveCount(0);
  await page.mouse.up();

  await expect(strokes(page)).toHaveCount(1);
  await expect(page.locator("[data-mesurer-pen-preview='true']")).toHaveCount(0);
  await expect(strokes(page)).toHaveAttribute("stroke-width", "2");
});

test("does not create a stroke from a click", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await page.mouse.click(120, 160);
  await expect(strokes(page)).toHaveCount(0);
});

test("supports undo and redo", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);

  await page.keyboard.press("Control+z");
  await expect(strokes(page)).toHaveCount(0);
  await page.keyboard.press("Control+Shift+z");
  await expect(strokes(page)).toHaveCount(1);
});

test("selects a stroke and shows a transform frame", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);
  await activateSelection(page);
  await page.mouse.click(180, 190);
  await expect(page.locator('[data-mesurer-pen-frame="true"]')).toHaveCount(1);
  await expect(page.locator('[data-mesurer-pen-handle="se"]')).toHaveCount(1);
});

test("moves, resizes, and rotates a selected stroke", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);
  const path = strokes(page);
  const before = await path.getAttribute("d");
  await activateSelection(page);
  await page.mouse.click(180, 190);
  const frame = page.locator('[data-mesurer-pen-frame="true"]');
  const frameBox = await frame.boundingBox();
  if (!frameBox) throw new Error("pen frame was not rendered");
  await page.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + frameBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(frameBox.x + frameBox.width / 2 + 30, frameBox.y + frameBox.height / 2 + 20);
  await page.mouse.up();
  const moved = await path.getAttribute("d");
  expect(moved).not.toBe(before);

  const resizedFrame = page.locator('[data-mesurer-pen-frame="true"]');
  const resizedFrameBox = await resizedFrame.boundingBox();
  if (!resizedFrameBox) throw new Error("pen frame was not rendered");
  await page.mouse.move(resizedFrameBox.x + resizedFrameBox.width, resizedFrameBox.y + resizedFrameBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizedFrameBox.x + resizedFrameBox.width + 25, resizedFrameBox.y + resizedFrameBox.height / 2);
  await page.mouse.up();
  const resized = await path.getAttribute("d");
  expect(resized).not.toBe(moved);

  const rotate = page.locator('[data-mesurer-pen-handle="rotate"]');
  const rotateBox = await rotate.boundingBox();
  if (!rotateBox) throw new Error("rotate handle was not rendered");
  await page.mouse.move(rotateBox.x + rotateBox.width / 2, rotateBox.y + rotateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(rotateBox.x + 40, rotateBox.y + 20);
  await page.mouse.up();
  await expect(page.locator(`[data-mesurer-pen-transform="${await path.getAttribute("data-mesurer-pen-id")}"]`)).toHaveAttribute("transform", /rotate/);
  expect(await path.getAttribute("d")).toBe(resized);
});

test("mirrors a stroke when resizing past the opposite edge", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);
  await activateSelection(page);
  await page.mouse.click(180, 190);

  const resize = page.locator('[data-mesurer-pen-handle="se"]');
  const resizeBox = await resize.boundingBox();
  if (!resizeBox) throw new Error("resize handle was not rendered");
  await page.mouse.move(resizeBox.x, resizeBox.y);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x - 180, resizeBox.y - 80);
  await page.mouse.up();

  const path = await strokes(page).getAttribute("d");
  expect(path).toContain("M 120 160");
  expect(path).toMatch(/-\d|\b\d{1,2} /);
});

test("deletes a selected stroke and restores it with undo", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);
  await activateSelection(page);
  await page.mouse.click(180, 190);
  await page.keyboard.press("Delete");
  await expect(strokes(page)).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(strokes(page)).toHaveCount(1);
});

test("persists strokes after reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist");
  await activatePen(page);
  await drawStroke(page);
  await expect(strokes(page)).toHaveCount(1);

  await page.reload();
  await expect(strokes(page)).toHaveCount(1);
});

test("cancels an active stroke on Escape and mode changes", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await page.mouse.move(120, 160);
  await page.mouse.down();
  await page.mouse.move(180, 190, { steps: 3 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(strokes(page)).toHaveCount(0);

  await activatePen(page);
  await page.mouse.move(120, 160);
  await page.mouse.down();
  await page.mouse.move(180, 190, { steps: 3 });
  await page.getByRole("button", { name: "Selection (O)" }).click();
  await page.mouse.up();
  await expect(strokes(page)).toHaveCount(0);
});

test("cancels an active stroke on pointercancel", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  const overlay = page.locator(".mesurer-root > div").first();
  await page.mouse.move(120, 160);
  await page.mouse.down();
  await page.mouse.move(180, 190, { steps: 3 });
  await overlay.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect(strokes(page)).toHaveCount(0);
});

import { expect, test, type Page } from "@playwright/test";

const strokes = (page: Page) => page.locator('[data-mesurer-pen="true"]');

const activatePen = async (page: Page) => {
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toBeVisible();
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );
  await page.getByRole("button", { name: "Pen (N)" }).click();
};

const activateSelection = async (page: Page) => {
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toBeVisible();
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );
  await page.getByRole("button", { name: "Select (S)" }).click();
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

test("marquee-selects text and pen annotations in Selection mode", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);

  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(300, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Select both");
  await page.keyboard.press("Control+Enter");

  await activateSelection(page);
  await page.mouse.move(80, 120);
  await page.mouse.down();
  await page.mouse.move(380, 240, { steps: 4 });
  await expect(page.locator('[data-mesurer-overlay-marquee="true"]')).toHaveCount(1);
  await page.mouse.up();

  await expect(page.locator('[data-mesurer-text-frame="true"]')).toHaveCount(1);
  await expect(page.locator('[data-mesurer-pen-frame="true"]')).toHaveCount(1);
  await expect(page.locator('[data-mesurer-group-frame="true"]')).toHaveCount(1);

  await page.mouse.move(320, 185);
  await page.mouse.down();
  await page.mouse.move(350, 215, { steps: 3 });
  await page.mouse.up();

  await expect(page.locator('[data-mesurer-text="true"]')).toHaveAttribute("style", /left: 330px/);
  await expect(strokes(page)).toHaveAttribute("d", /M 150 190/);

});

test("Cmd+A selects every overlay annotation in Selection mode", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);
  await page.mouse.move(420, 320);
  await page.mouse.down();
  await page.mouse.move(500, 340, { steps: 3 });
  await page.mouse.up();

  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(300, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Select all");
  await page.keyboard.press("Control+Enter");

  await activateSelection(page);
  await page.keyboard.press("Control+a");

  await expect(page.locator('[data-mesurer-group-frame="true"]')).toHaveCount(1);
  await expect(page.locator('[data-mesurer-text-frame="true"]')).toHaveCount(1);
  await expect(page.locator('[data-mesurer-pen-frame="true"]')).toHaveCount(2);
});

test("uses plain click for one item and Shift-click for multiple items", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);
  await page.mouse.move(420, 320);
  await page.mouse.down();
  await page.mouse.move(500, 340, { steps: 3 });
  await page.mouse.up();
  await page.mouse.move(600, 360);
  await page.mouse.down();
  await page.mouse.move(680, 380, { steps: 3 });
  await page.mouse.up();

  await activateSelection(page);
  await page.mouse.click(180, 190);
  await expect(page.locator('[data-mesurer-pen-frame="true"]')).toHaveCount(1);
  await expect(page.locator('[data-mesurer-group-frame="true"]')).toHaveCount(0);

  await page.keyboard.down("Shift");
  await page.mouse.click(460, 330);
  await page.keyboard.up("Shift");
  await expect(page.locator('[data-mesurer-pen-frame="true"]')).toHaveCount(2);
  await expect(page.locator('[data-mesurer-group-frame="true"]')).toHaveCount(1);

  await page.mouse.click(640, 370);
  await expect(page.locator('[data-mesurer-pen-frame="true"]')).toHaveCount(1);
  await expect(page.locator('[data-mesurer-group-frame="true"]')).toHaveCount(0);

  await page.mouse.click(760, 500);
  await expect(page.locator('[data-mesurer-pen-frame="true"]')).toHaveCount(0);
});

test("Shift+marquee adds to the current selection", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);
  await page.mouse.move(420, 320);
  await page.mouse.down();
  await page.mouse.move(500, 340, { steps: 3 });
  await page.mouse.up();
  await page.mouse.move(600, 360);
  await page.mouse.down();
  await page.mouse.move(680, 380, { steps: 3 });
  await page.mouse.up();

  await activateSelection(page);
  await page.mouse.click(180, 190);
  await expect(page.locator('[data-mesurer-pen-frame="true"]')).toHaveCount(1);

  await page.keyboard.down("Shift");
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(720, 400, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await expect(page.locator('[data-mesurer-pen-frame="true"]')).toHaveCount(3);
  await expect(page.locator('[data-mesurer-group-frame="true"]')).toHaveCount(1);
});

test("rotates multiple annotations from the parent handle", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);
  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(300, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Rotate both");
  await page.keyboard.press("Control+Enter");
  await activateSelection(page);
  await page.mouse.move(80, 120);
  await page.mouse.down();
  await page.mouse.move(380, 240, { steps: 4 });
  await page.mouse.up();

  const rotate = page.locator('[data-mesurer-group-handle="rotate"]');
  const penPath = page.locator('[data-mesurer-pen="true"]');
  const beforePath = await penPath.getAttribute("d");
  const box = await rotate.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2 + 20, { steps: 4 });
  await page.mouse.up();

  await expect(page.locator('[data-mesurer-text="true"]')).toHaveAttribute("style", /rotate\(/);
  await expect.poll(() => penPath.getAttribute("d")).not.toBe(beforePath);
});

test("resizes multiple annotations after rotation", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);
  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(300, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Resize both");
  await page.keyboard.press("Control+Enter");
  await activateSelection(page);
  await page.mouse.move(80, 120);
  await page.mouse.down();
  await page.mouse.move(380, 240, { steps: 4 });
  await page.mouse.up();

  const rotate = page.locator('[data-mesurer-group-handle="rotate"]');
  const rotateBox = await rotate.boundingBox();
  expect(rotateBox).not.toBeNull();
  await page.mouse.move(rotateBox!.x + rotateBox!.width / 2, rotateBox!.y + rotateBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(rotateBox!.x + rotateBox!.width / 2 + 45, rotateBox!.y + rotateBox!.height / 2 + 25, { steps: 4 });
  await page.mouse.up();

  const resize = page.locator('[data-mesurer-group-handle="se"]');
  const box = await resize.boundingBox();
  expect(box).not.toBeNull();
  const before = await page.locator('[data-mesurer-pen="true"]').getAttribute("d");
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => page.locator('[data-mesurer-pen="true"]').getAttribute("d")).not.toBe(before);
});

test("resizes a rotated multi-selection from one edge", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activatePen(page);
  await drawStroke(page);
  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(300, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Edge resize");
  await page.keyboard.press("Control+Enter");
  await activateSelection(page);
  await page.mouse.move(80, 120);
  await page.mouse.down();
  await page.mouse.move(400, 250, { steps: 4 });
  await page.mouse.up();

  const rotate = page.locator('[data-mesurer-group-handle="rotate"]');
  const rotateBox = await rotate.boundingBox();
  expect(rotateBox).not.toBeNull();
  await page.mouse.move(rotateBox!.x + rotateBox!.width / 2, rotateBox!.y + rotateBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(rotateBox!.x + rotateBox!.width / 2 + 45, rotateBox!.y + rotateBox!.height / 2 + 25, { steps: 4 });
  await page.mouse.up();

  const frame = page.locator('[data-mesurer-group-frame="true"]');
  const before = await frame.evaluate((node) => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }));
  const edge = page.locator('[data-mesurer-group-handle="e"]');
  const edgeBox = await edge.boundingBox();
  expect(edgeBox).not.toBeNull();
  const angle = await frame.evaluate((node) => Number.parseFloat((node as HTMLElement).style.transform.match(/-?\d+(?:\.\d+)?/)?.[0] ?? "0"));
  const radians = angle * Math.PI / 180;
  const x = edgeBox!.x + edgeBox!.width / 2;
  const y = edgeBox!.y + edgeBox!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + Math.cos(radians) * 60, y + Math.sin(radians) * 60, { steps: 4 });
  await page.mouse.up();

  const after = await frame.evaluate((node) => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }));
  expect(after.width).toBeGreaterThan(before.width);
  expect(after.height).toBeGreaterThan(before.height);
  expect(after.width / after.height).toBeCloseTo(before.width / before.height, 1);
  const parentBox = await frame.boundingBox();
  const children = page.locator('[data-mesurer-text-frame="true"], [data-mesurer-pen-frame="true"]');
  const childBoxes = await Promise.all(Array.from({ length: await children.count() }, (_, index) => children.nth(index).boundingBox()));
  expect(parentBox).not.toBeNull();
  for (const child of childBoxes) {
    expect(child).not.toBeNull();
    if (!child) continue;
    expect(child.x).toBeGreaterThanOrEqual(parentBox!.x - 2);
    expect(child.y).toBeGreaterThanOrEqual(parentBox!.y - 2);
    expect(child.x + child.width).toBeLessThanOrEqual(parentBox!.x + parentBox!.width + 2);
    expect(child.y + child.height).toBeLessThanOrEqual(parentBox!.y + parentBox!.height + 2);
  }

  await page.mouse.click(780, 520);
  await expect(page.locator('[data-mesurer-group-frame="true"]')).toHaveCount(0);
  await expect(page.locator('[data-mesurer-text-frame="true"], [data-mesurer-pen-frame="true"]')).toHaveCount(0);
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
  await page.getByRole("button", { name: "Select (S)" }).click();
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

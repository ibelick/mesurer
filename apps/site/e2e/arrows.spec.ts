import { devices, expect, test, type Page } from "@playwright/test";

const activateArrows = async (page: Page) => {
  await page.getByRole("button", { name: "Arrows (D)" }).click();
};

const drawArrow = async (
  page: Page,
  start = { x: 120, y: 160 },
  end = { x: 320, y: 260 },
) => {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
};

test("draws an arrow with a transient preview", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);

  await page.mouse.move(120, 160);
  await page.mouse.down();
  await page.mouse.move(320, 260, { steps: 5 });
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(1);
  await expect(page.locator('[data-mesurer-arrow-node="preview"]')).toHaveCount(0);
  await page.mouse.up();

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(0);
  await expect(page.locator('[data-mesurer-arrow-node="true"]')).toHaveCount(0);
});

test("does not create an arrow from only the first click", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await page.mouse.click(120, 160);

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
});

test("does not create an arrow from only two clicks", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await page.mouse.click(120, 160);
  await page.mouse.click(220, 150);

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(1);
});

test("draws a curved arrow with three clicks", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await page.mouse.click(120, 160);
  await page.mouse.click(220, 150);
  await page.mouse.click(320, 260);

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute(
    "d",
    "M 120 160 Q 220 90 320 260",
  );
});

test("supports undo, redo, and deleting the selected arrow", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);

  await page.keyboard.press("Control+z");
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);
  await page.mouse.click(180, 190);
  await page.keyboard.press("Delete");
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
});

test("returns to object selection mode and moves an arrow by its shaft", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await expect(page.getByRole("button", { name: "Selection (O)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.mouse.move(180, 190);
  await page.mouse.down();
  await page.mouse.move(270, 240, { steps: 4 });
  await page.mouse.up();

  const arrow = page.locator('[data-mesurer-arrow="true"]');
  await expect(arrow).toHaveAttribute("d", "M 210 210 Q 310 260 410 310");
});

test("selects an arrow from the expanded shaft touch zone", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);

  await page.mouse.click(180, 196);
  await expect(page.locator('[data-mesurer-arrow-node="true"]')).toHaveCount(3);
});

test("resizes an arrow from its endpoint handle", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);

  await page.mouse.click(220, 210);
  const endHandle = page.locator('circle[data-mesurer-arrow-handle="end"][data-mesurer-arrow-hit="true"]');
  const box = await endHandle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(380, 300, { steps: 4 });
  await page.mouse.up();

  const arrow = page.locator('[data-mesurer-arrow="true"]');
  await expect(arrow).toHaveAttribute("d", "M 120 160 Q 250 230 380 300");
});

test("resizes an arrow from its start endpoint", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);

  await page.mouse.click(220, 210);
  const startHandle = page.locator('circle[data-mesurer-arrow-handle="start"][data-mesurer-arrow-hit="true"]');
  const box = await startHandle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(80, 120, { steps: 4 });
  await page.mouse.up();

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute(
    "d",
    /^M 80 120 /,
  );
});

test("bends an arrow with its middle node", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);

  await page.mouse.click(220, 210);
  const controlHandle = page.locator('[data-mesurer-arrow-handle="control"][data-mesurer-arrow-hit="true"]');
  const box = await controlHandle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(220, 150, { steps: 4 });
  await page.mouse.up();

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute(
    "d",
    "M 120 160 Q 220 90 320 260",
  );
});

test("selects an existing arrow before deleting it", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await page.mouse.click(220, 210);
  await page.keyboard.press("Delete");

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
});

test("supports multiple arrows", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page, { x: 120, y: 160 }, { x: 320, y: 260 });
  await activateArrows(page);
  await drawArrow(page, { x: 420, y: 160 }, { x: 620, y: 260 });

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(2);
});

test("persists arrows after reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist");
  await activateArrows(page);
  await drawArrow(page);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);
});

test("does not persist arrows when persistence is disabled", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
});

test("keeps arrows anchored to the page while scrolling", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist");
  await activateArrows(page);
  await drawArrow(page);

  await page.evaluate(() => {
    document.body.style.minHeight = "2000px";
    window.scrollTo(0, 100);
  });
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute(
    "d",
    "M 120 60 Q 220 110 320 160",
  );
});

test("persists arrow edits after reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist");
  await activateArrows(page);
  await drawArrow(page);

  await page.mouse.move(180, 190);
  await page.mouse.down();
  await page.mouse.move(270, 240, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute(
    "d",
    "M 210 210 Q 310 260 410 310",
  );

  await page.reload();
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute(
    "d",
    "M 210 210 Q 310 260 410 310",
  );
});

test("undoes and redoes arrow edits", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await page.mouse.move(180, 190);
  await page.mouse.down();
  await page.mouse.move(270, 240, { steps: 4 });
  await page.mouse.up();

  await page.keyboard.press("Control+z");
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute(
    "d",
    "M 120 160 Q 220 210 320 260",
  );
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute(
    "d",
    "M 210 210 Q 310 260 410 310",
  );
});

test("escape cancels an active arrow drawing", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await page.mouse.move(120, 160);
  await page.mouse.down();
  await page.mouse.move(320, 260, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Selection (O)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("escape restores an arrow edit", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await page.mouse.move(180, 190);
  await page.mouse.down();
  await page.mouse.move(270, 240, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute(
    "d",
    "M 120 160 Q 220 210 320 260",
  );
});

test("escape cancels the current interaction without clearing arrows", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);
  await expect(page.locator("[data-mesurer-arrow-node]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Selection (O)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test.describe("touch input", () => {
  test("creates an arrow with touch taps", async ({ browser }) => {
    const context = await browser.newContext({ ...devices["Pixel 5"] });
    const page = await context.newPage();
    await page.goto("/e2e/fixtures/guide-overlay.html");
    await activateArrows(page);
    await page.touchscreen.tap(120, 160);
    await page.touchscreen.tap(220, 150);
    await page.touchscreen.tap(320, 260);

    await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);
    await context.close();
  });
});

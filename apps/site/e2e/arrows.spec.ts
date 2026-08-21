import { expect, test, type Page } from "@playwright/test";

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
  await page.mouse.move(320, 260);
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(1);
  await page.mouse.up();

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(0);
});

test("does not create an arrow from a click", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await page.mouse.click(120, 160);

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
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

  await page.mouse.move(220, 210);
  await page.mouse.down();
  await page.mouse.move(270, 240, { steps: 4 });
  await page.mouse.up();

  const arrow = page.locator('[data-mesurer-arrow="true"]');
  await expect(arrow).toHaveAttribute("x1", "170");
  await expect(arrow).toHaveAttribute("y1", "190");
  await expect(arrow).toHaveAttribute("x2", "370");
  await expect(arrow).toHaveAttribute("y2", "290");
});

test("resizes an arrow from its endpoint handle", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);

  await page.mouse.click(220, 210);
  const endHandle = page.locator('[data-mesurer-arrow-handle="end"]');
  const box = await endHandle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(380, 300, { steps: 4 });
  await page.mouse.up();

  const arrow = page.locator('[data-mesurer-arrow="true"]');
  await expect(arrow).toHaveAttribute("x2", "380");
  await expect(arrow).toHaveAttribute("y2", "300");
});

test("selects an existing arrow before deleting it", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await page.mouse.click(220, 210);
  await page.keyboard.press("Delete");

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
});

test("persists arrows after reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist");
  await activateArrows(page);
  await drawArrow(page);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);
});

test("escape cancels an arrow preview and clears committed arrows", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
});

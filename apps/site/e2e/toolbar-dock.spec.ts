import { expect, test, type Locator, type Page } from "@playwright/test";

const setDock = async (page: Page, dock: "free" | "snap") => {
  const settings = page.getByRole("dialog", { name: "Settings" });
  if (!(await settings.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Settings" }).click();
  }
  await page.getByLabel("Toolbar dock").selectOption(dock);
  await page.keyboard.press("Escape");
};

const dragBy = async (page: Page, toolbar: Locator, dx: number, dy: number) => {
  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  const startX = box.x + box.width / 2;
  const startY = box.y + 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(320);
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
});

test("free mode keeps the toolbar wherever it is dropped", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();

  await dragBy(page, toolbar, 300, 200);
  const box = await toolbar.boundingBox();
  expect(box?.x).toBeGreaterThan(200);
  expect(box?.y).toBeGreaterThan(150);
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
});

test("snap mode glues to the left edge and slides vertically along it", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");

  // Pull the toolbar away from the top edge and close to the left edge.
  const box = await toolbar.boundingBox();
  await dragBy(page, toolbar, 40 - (box?.x ?? 0), 300 - (box?.y ?? 0));
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  const glued = await toolbar.boundingBox();
  expect(glued?.x).toBe(16);
  // Released glued toolbars settle in the middle of the edge.
  expect(Math.abs((glued?.y ?? 0) + (glued?.height ?? 0) / 2 - 350)).toBeLessThan(2);

  // Moving along the glued edge changes only the vertical position, while the pointer is down.
  const grab = await toolbar.boundingBox();
  const startX = (grab?.x ?? 0) + (grab?.width ?? 0) / 2;
  const startY = (grab?.y ?? 0) + (grab?.height ?? 0) / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY - 80, { steps: 10 });
  const slid = await toolbar.boundingBox();
  expect(slid?.x).toBe(16);
  expect(slid?.y).toBeLessThan(glued?.y ?? 0);
  await page.mouse.up();
  await page.waitForTimeout(320);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");

  // The glue survives a reload.
  await page.reload();
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await expect.poll(async () => (await toolbar.boundingBox())?.x).toBe(16);
});

test("pulling a glued toolbar away from the edge releases it", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");

  const box = await toolbar.boundingBox();
  await dragBy(page, toolbar, 40 - (box?.x ?? 0), 300 - (box?.y ?? 0));
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");

  await dragBy(page, toolbar, 400, 0);
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  const free = await toolbar.boundingBox();
  expect(free?.x).toBeGreaterThan(300);
});

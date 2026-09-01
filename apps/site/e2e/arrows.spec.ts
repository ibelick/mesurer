import { devices, expect, test, type Page } from "@playwright/test";

const activateArrows = async (page: Page) => {
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toBeVisible();
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );
  const button = page.getByRole("button", { name: "Arrows (D)" });
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
};
const activateSelection = async (page: Page) => {
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toBeVisible();
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );
  const button = page.getByRole("button", { name: "Select (S)" });
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
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

test("uses the arrow color from settings", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  const arrows = page.getByRole("dialog", { name: "Settings" }).locator("section[aria-label='Arrow settings']");
  await arrows.getByLabel("Color hex value").fill("FF0000");
  await page.keyboard.press("Escape");

  await activateArrows(page);
  await drawArrow(page);
  await activateSelection(page);

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute("stroke", /#ff0000/i);
});

test("updates existing arrows when the arrow color changes", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await activateSelection(page);

  await page.getByRole("button", { name: "Settings" }).click();
  const arrows = page.getByRole("dialog", { name: "Settings" }).locator("section[aria-label='Arrow settings']");
  await arrows.getByLabel("Color hex value").fill("00AAFF");
  await page.keyboard.press("Escape");

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute("stroke", /#00aaff/i);
});

test("opens settings on the arrows section from the Arrows tool", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await page.getByRole("button", { name: "Settings" }).click();

  const panel = page.locator(".mesurer-settings-panel");
  const section = panel.locator('[data-mesurer-settings-section="arrows"]');
  await expect(section).toHaveAttribute("data-focused", "true");
  await expect
    .poll(async () => {
      const panelBox = await panel.boundingBox();
      const sectionBox = await section.boundingBox();
      if (!panelBox || !sectionBox) return Number.POSITIVE_INFINITY;
      return sectionBox.y - panelBox.y;
    })
    .toBeLessThan(12);
});

test("snaps arrow endpoints to nearby element edges", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);

  await page.mouse.move(235, 290);
  await page.mouse.down();
  await page.mouse.move(500, 290, { steps: 5 });
  await page.mouse.up();

  const arrow = page.locator('[data-mesurer-arrow="true"]');
  await expect(arrow).toHaveCount(1);
  const d = await arrow.getAttribute("d");
  const startX = d?.match(/^M\s+([\d.]+)/)?.[1];
  expect(Number(startX)).toBeCloseTo(240, 0);
});

test("does not snap arrows when arrow snap is disabled", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  const arrows = page.getByRole("dialog", { name: "Settings" }).locator("section[aria-label='Arrow settings']");
  await arrows.getByRole("switch", { name: "Snap" }).click();
  await page.keyboard.press("Escape");

  await activateArrows(page);
  await page.mouse.move(235, 290);
  await page.mouse.down();
  await page.mouse.move(500, 290, { steps: 5 });
  await page.mouse.up();

  const arrow = page.locator('[data-mesurer-arrow="true"]');
  await expect(arrow).toHaveCount(1);
  const d = await arrow.getAttribute("d");
  const startX = d?.match(/^M\s+([\d.]+)/)?.[1];
  expect(Number(startX)).toBeCloseTo(235, 0);
});

test("does not create an arrow from only the first click", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await page.mouse.click(120, 160);

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
});

test("cancels an incomplete arrow when switching tools", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  const arrows = page.getByRole("dialog", { name: "Settings" }).locator("section[aria-label='Arrow settings']");
  await arrows.getByRole("switch", { name: "Click to place" }).click();
  await page.keyboard.press("Escape");

  await activateArrows(page);
  await page.mouse.click(120, 160);
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(1);

  await page.getByRole("button", { name: "Select (S)" }).click();
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(0);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);

  await activateArrows(page);
  await page.mouse.click(120, 160);
  await page.getByRole("button", { name: "Text (T)" }).click();
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(0);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
});

test("cancels an incomplete arrow when switching tools by shortcut", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  const arrows = page.getByRole("dialog", { name: "Settings" }).locator("section[aria-label='Arrow settings']");
  await arrows.getByRole("switch", { name: "Click to place" }).click();
  await page.keyboard.press("Escape");

  await activateArrows(page);
  await page.mouse.click(120, 160);
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(1);

  await page.keyboard.press("s");
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(0);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);

  await activateArrows(page);
  await page.mouse.click(120, 160);
  await page.keyboard.press("t");
  await expect(page.locator("[data-mesurer-arrow-preview]")).toHaveCount(0);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
});

test("draws a straight arrow with two clicks when click to place is enabled", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  const arrows = page.getByRole("dialog", { name: "Settings" }).locator("section[aria-label='Arrow settings']");
  await arrows.getByRole("switch", { name: "Click to place" }).click();
  await page.keyboard.press("Escape");

  await activateArrows(page);
  await page.mouse.click(120, 160);
  await page.mouse.click(320, 260);

  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(1);
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveAttribute(
    "d",
    "M 120 160 Q 220 210 320 260",
  );
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
  await activateSelection(page);
  await page.mouse.click(180, 190);
  await page.keyboard.press("Delete");
  await expect(page.locator('[data-mesurer-arrow="true"]')).toHaveCount(0);
});

test("switches to Select after drawing an arrow", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await activateSelection(page);
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
  await activateSelection(page);

  await page.mouse.click(180, 196);
  await expect(page.locator('[data-mesurer-arrow-node="true"]')).toHaveCount(3);
  await expect(page.locator('[data-mesurer-arrow-frame="true"]')).toHaveCount(1);
});

test("selects an arrow by clicking its visible arrowhead", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await activateSelection(page);

  await page.mouse.click(308, 254);
  await expect(page.locator('[data-mesurer-arrow-frame="true"]')).toHaveCount(1);
});

test("resizes an arrow from its endpoint handle", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => window.scrollTo(0, 0));
  await activateArrows(page);
  await drawArrow(page);
  await activateSelection(page);

  await page.mouse.click(220, 210);
  const endHandle = page.locator('circle[data-mesurer-arrow-handle="end"][data-mesurer-arrow-hit="true"]');
  const box = await endHandle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(380, 300, { steps: 4 });
  await page.mouse.up();

  const arrow = page.locator('[data-mesurer-arrow="true"]');
  await expect(arrow).toHaveAttribute("d", "M 120 160 Q 260 230 400 300");
});

test("resizes an arrow from its start endpoint", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await activateSelection(page);

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
  await activateSelection(page);

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

test("moves an arrow node reliably after rotation", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page);
  await activateSelection(page);
  await page.mouse.click(220, 210);

  const rotate = page.locator('[data-mesurer-arrow-handle="rotate"]');
  const rotateBox = await rotate.boundingBox();
  expect(rotateBox).not.toBeNull();
  await page.mouse.move(rotateBox!.x + rotateBox!.width / 2, rotateBox!.y + rotateBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(rotateBox!.x + rotateBox!.width / 2 + 30, rotateBox!.y + rotateBox!.height / 2 + 40, { steps: 4 });
  await page.mouse.up();

  const before = await page.locator('[data-mesurer-arrow="true"]').getAttribute("d");
  const end = page.locator('circle[data-mesurer-arrow-handle="end"][data-mesurer-arrow-hit="true"]');
  const endBox = await end.boundingBox();
  expect(endBox).not.toBeNull();
  await page.mouse.move(endBox!.x + endBox!.width / 2, endBox!.y + endBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox!.x + 40, endBox!.y + 20, { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => page.locator('[data-mesurer-arrow="true"]').getAttribute("d")).not.toBe(before);
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

test("rotates multiple arrows from the parent handle", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await drawArrow(page, { x: 120, y: 160 }, { x: 320, y: 260 });
  await activateArrows(page);
  await drawArrow(page, { x: 420, y: 160 }, { x: 620, y: 260 });
  await activateSelection(page);
  await page.keyboard.press("Control+a");
  const arrows = page.locator('[data-mesurer-arrow="true"]');
  const before = await arrows.evaluateAll((items) => items.map((item) => item.getAttribute("d")));
  const rotate = page.locator('[data-mesurer-group-handle="rotate"]');
  const box = await rotate.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 50, box!.y + box!.height / 2 + 30, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => arrows.evaluateAll((items) => items.map((item) => item.getAttribute("d")))).not.toEqual(before);
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
  await activateSelection(page);

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
  await activateSelection(page);
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
  await expect(page.getByRole("button", { name: "Arrows (D)" })).toHaveAttribute(
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
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("escape exits the active tool without switching groups", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateArrows(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Arrows (D)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Arrows (D)" })).toHaveAttribute(
    "aria-pressed",
    "false",
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

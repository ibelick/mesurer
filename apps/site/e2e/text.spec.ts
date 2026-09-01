import { expect, test, type Page } from "@playwright/test";

const textItems = (page: Page) =>
  page.locator('[data-mesurer-text="true"]');

const activateText = async (page: Page) => {
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toBeVisible();
  const button = page.getByRole("button", { name: "Text (T)" });
  if (!(await button.isVisible())) {
    const inspect = page.getByRole("button", { name: "Inspect (I)" });
    if (await inspect.isVisible()) await expect(inspect).toBeVisible();
    await page.getByRole("button", { name: "Annotate tools (2)" }).click();
    await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
      "data-value",
      "annotate",
    );
  }
  await button.click();
};

test("writes text anywhere on the page", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.keyboard.press("2");
  await activateText(page);
  await page.mouse.click(220, 180);
  const input = page.getByRole("textbox", { name: "Text annotation" });
  await input.pressSequentially("Review this D G X P S");
  await input.press("Enter");
  await input.pressSequentially("second line");
  await expect(page.getByRole("button", { name: "Text (T)" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveCount(1);
  await expect(textItems(page)).toHaveText("Review this D G X P S\nsecond line");
  await expect(page.locator("[data-mesurer-text-frame]")).toHaveCount(1);
  await expect(page.locator('[data-mesurer-text-id]')).toHaveAttribute("data-mesurer-text-id", /.+/);
});

test("activates text with T and Escape cancels the draft", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.getByRole("button", { name: "Select (S)" }).click();
  await page.keyboard.press("t");
  await expect(page.getByRole("button", { name: "Text (T)" })).toHaveAttribute("aria-pressed", "true");
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Keep me");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveText("Keep me");
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("undoes and redoes text annotations", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Undo me");
  await page.keyboard.press("Control+Enter");

  await page.keyboard.press("Control+z");
  await expect(textItems(page)).toHaveCount(0);
  await page.keyboard.press("Control+Shift+z");
  await expect(textItems(page)).toHaveText("Undo me");
});

test("persists text annotations after reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Keep me");
  await page.keyboard.press("Control+Enter");

  await page.reload();
  await expect(textItems(page)).toHaveText("Keep me");
});

test("moves a selected text annotation", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Move me");
  await page.keyboard.press("Escape");

  const text = textItems(page);
  const before = await text.boundingBox();
  expect(before).not.toBeNull();
  const startX = before!.x + before!.width / 2;
  const startY = before!.y + before!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 50, { steps: 4 });
  await page.mouse.up();

  const after = await text.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x).toBeGreaterThan(before!.x + 60);
  expect(after!.y).toBeGreaterThan(before!.y + 30);
});

test("shows a selection box when clicking text in Selection mode", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Select me");
  await page.keyboard.press("Control+Enter");

  await page.getByRole("button", { name: "Select (S)" }).click();
  await textItems(page).click();

  await expect(page.locator("[data-mesurer-text-frame]")).toHaveCount(1);
});

test("double-clicks a text annotation to edit it in place", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Original");
  await page.keyboard.press("Escape");

  await textItems(page).dblclick();
  const input = page.getByRole("textbox", { name: "Text annotation" });
  await expect(input).toHaveText("Original");
  await input.fill("Edited");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveCount(1);
  await expect(textItems(page)).toHaveText("Edited");
});

test("clicks a text annotation to edit it in Text mode", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Edit me");
  await page.keyboard.press("Escape");

  await activateText(page);
  const text = textItems(page);
  const box = await text.boundingBox();
  if (!box) throw new Error("Text annotation is not visible");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole("textbox", { name: "Text annotation" })).toHaveText("Edit me");
});

test("appends text when editing an existing annotation", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Original");
  await page.keyboard.press("Escape");

  await activateText(page);
  const text = textItems(page);
  const box = await text.boundingBox();
  if (!box) throw new Error("Text annotation is not visible");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const input = page.getByRole("textbox", { name: "Text annotation" });
  await input.press("End");
  await input.pressSequentially(" appended");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveText("Original appended");
});

test("inserts text where an existing annotation is clicked", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Original");
  await page.keyboard.press("Escape");

  await activateText(page);
  const text = textItems(page);
  const box = await text.boundingBox();
  if (!box) throw new Error("Text annotation is not visible");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole("textbox", { name: "Text annotation" }).pressSequentially(" inserted");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveText("Orig insertedinal");
});

test("keeps a long line horizontal until Enter adds a line", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  const input = page.getByRole("textbox", { name: "Text annotation" });
  await input.pressSequentially("A".repeat(80));
  const oneLine = await input.boundingBox();
  expect(oneLine).not.toBeNull();

  await input.press("Enter");
  const twoLines = await input.boundingBox();
  expect(twoLines).not.toBeNull();
  expect(twoLines!.height).toBeGreaterThan(oneLine!.height);
});

test("rewrites existing text with a new line", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Original");
  await page.keyboard.press("Control+Enter");

  await textItems(page).click();
  const input = page.getByRole("textbox", { name: "Text annotation" });
  await input.fill("Rewritten");
  await input.press("Enter");
  await input.pressSequentially("second line");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveText("Rewritten\nsecond line");
  await expect(page.locator("[data-mesurer-text-frame]")).toHaveCount(0);
});

test("rewrites existing text with multiple new lines", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Original");
  await page.keyboard.press("Control+Enter");

  await textItems(page).click();
  const input = page.getByRole("textbox", { name: "Text annotation" });
  await input.fill("First");
  await input.press("Enter");
  await input.pressSequentially("Second");
  await input.press("Enter");
  await input.pressSequentially("Third");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveText("First\nSecond\nThird");
});

test("replaces all existing text and starts again", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Original");
  await page.keyboard.press("Control+Enter");

  await textItems(page).click();
  const input = page.getByRole("textbox", { name: "Text annotation" });
  await input.fill("");
  await input.pressSequentially("Rewritten");
  await input.press("Enter");
  await input.pressSequentially("again");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveText("Rewritten\nagain");
});

test("keeps text when clicking elsewhere", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Keep me");

  await page.mouse.click(420, 280);
  await expect(textItems(page)).toHaveText("Keep me");
  await expect(page.getByRole("textbox", { name: "Text annotation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("clicking away commits text and switches to Select", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("First");

  await page.mouse.click(420, 280);
  await expect(page.getByRole("textbox", { name: "Text annotation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await activateText(page);
  await page.mouse.click(420, 280);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Second");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveCount(2);
  await expect(textItems(page).nth(0)).toHaveText("First");
  await expect(textItems(page).nth(1)).toHaveText("Second");
});

test("does not duplicate text when clicking an existing annotation", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Once");
  await page.keyboard.press("Escape");

  await activateText(page);
  await textItems(page).click();
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveCount(1);
  await expect(textItems(page)).toHaveText("Once");
});

test("does not duplicate text when clicking it after a new draft starts", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Once");
  await page.mouse.click(420, 280);
  await textItems(page).click();
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveCount(1);
  await expect(textItems(page)).toHaveText("Once");
});

test("does not duplicate text when reclicking the active editor", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  const input = page.getByRole("textbox", { name: "Text annotation" });
  await input.fill("Once");
  await input.click();
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveCount(1);
  await expect(textItems(page)).toHaveText("Once");
});

test("resizes a selected text annotation", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Resize me");
  await page.keyboard.press("Escape");

  const before = await textItems(page).boundingBox();
  expect(before).not.toBeNull();
  const handle = page.locator('[data-mesurer-text-handle="se"]');
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 80, handleBox!.y + 50, { steps: 4 });
  await page.mouse.up();

  const after = await textItems(page).boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBeGreaterThan(before!.width + 20);
  expect(after!.height).toBeGreaterThan(before!.height + 8);
  await expect(textItems(page)).not.toHaveCSS("font-size", "16px");
});

test("widens a text box from the side without scaling type", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Side resize wraps this line");
  await page.keyboard.press("Escape");

  const before = await textItems(page).boundingBox();
  expect(before).not.toBeNull();
  const frame = page.locator('[data-mesurer-text-frame="true"]');
  const frameBox = await frame.boundingBox();
  expect(frameBox).not.toBeNull();
  await page.mouse.move(frameBox!.x + frameBox!.width, frameBox!.y + frameBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(frameBox!.x + frameBox!.width + 90, frameBox!.y + frameBox!.height / 2, { steps: 4 });
  await page.mouse.up();

  const after = await textItems(page).boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBeGreaterThan(before!.width + 40);
  await expect(textItems(page)).toHaveCSS("font-size", "16px");
});

test("wraps text when the side handles shrink the box", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Wrap this long annotation line");
  await page.keyboard.press("Escape");

  const before = await textItems(page).boundingBox();
  expect(before).not.toBeNull();
  const handle = page.locator('[data-mesurer-text-handle="w"]');
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + before!.width - 48, handleBox!.y + handleBox!.height / 2, { steps: 4 });
  await page.mouse.up();

  const after = await textItems(page).boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBeLessThan(before!.width - 20);
  expect(after!.height).toBeGreaterThan(before!.height + 8);
  await expect(textItems(page)).toHaveCSS("font-size", "16px");
});

test("deletes a selected text annotation with Backspace", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Remove me");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveCount(1);
  await page.keyboard.press("Backspace");
  await expect(textItems(page)).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(textItems(page)).toHaveText("Remove me");
});

test("rotates a selected text annotation", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Rotate me");
  await page.keyboard.press("Escape");

  const handle = page.locator('[data-mesurer-text-handle="rotate"]');
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 60, handleBox!.y + 40, { steps: 4 });
  await page.mouse.up();

  await expect(textItems(page)).toHaveCSS("transform", /matrix/);
});

test("applies the text font from settings", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel("Font").selectOption("code");
  await page.keyboard.press("Escape");

  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Code face");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveAttribute("style", /ui-monospace/);
});

test("updates existing text when the text color changes", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Color me");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Settings" }).click();
  const text = page.getByRole("dialog", { name: "Settings" }).locator("section[aria-label='Text settings']");
  await text.getByLabel("Color hex value").fill("FF0000");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveCSS("color", "rgb(255, 0, 0)");
});

test("opens settings on the text section from the Text tool", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateText(page);
  await page.getByRole("button", { name: "Settings" }).click();

  const panel = page.locator(".mesurer-settings-panel");
  const section = panel.locator('[data-mesurer-settings-section="text"]');
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

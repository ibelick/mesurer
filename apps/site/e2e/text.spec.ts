import { expect, test, type Page } from "@playwright/test";

const textItems = (page: Page) =>
  page.locator('[data-mesurer-text="true"]');

test("writes text anywhere on the page", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(220, 180);
  const input = page.getByRole("textbox", { name: "Text annotation" });
  await expect(input).toHaveAttribute("rows", "1");
  await input.pressSequentially("Review this D G X P S");
  await input.press("Enter");
  await input.pressSequentially("second line");
  await expect(page.getByRole("button", { name: "Text (T)" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveCount(1);
  await expect(textItems(page)).toHaveText("Review this D G X P S\nsecond line");
  await expect(textItems(page)).not.toHaveClass(/msr:outline/);
  await expect(page.locator('[data-mesurer-text-id]')).toHaveAttribute("data-mesurer-text-id", /.+/);
});

test("activates text with T and Escape cancels the draft", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.getByRole("button", { name: "Selection (O)" }).click();
  await page.keyboard.press("t");
  await expect(page.getByRole("button", { name: "Text (T)" })).toHaveAttribute("aria-pressed", "true");
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Keep me");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveText("Keep me");
  await expect(page.getByRole("button", { name: "Selection (O)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("undoes and redoes text annotations", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Text (T)" }).click();
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
  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Keep me");
  await page.keyboard.press("Control+Enter");

  await page.reload();
  await expect(textItems(page)).toHaveText("Keep me");
});

test("moves a selected text annotation", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Move me");
  await page.keyboard.press("Escape");

  const text = textItems(page);
  const before = await text.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(before!.x + 4, before!.y + 4);
  await page.mouse.down();
  await page.mouse.move(before!.x + 84, before!.y + 54, { steps: 4 });
  await page.mouse.up();

  const after = await text.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x).toBeGreaterThan(before!.x + 60);
  expect(after!.y).toBeGreaterThan(before!.y + 30);
});

test("double-clicks a text annotation to edit it in place", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Original");
  await page.keyboard.press("Escape");

  await textItems(page).dblclick();
  const input = page.getByRole("textbox", { name: "Text annotation" });
  await expect(input).toHaveValue("Original");
  await input.fill("Edited");
  await page.keyboard.press("Escape");

  await expect(textItems(page)).toHaveCount(1);
  await expect(textItems(page)).toHaveText("Edited");
});

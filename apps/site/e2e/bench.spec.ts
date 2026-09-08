import { expect, test } from "@playwright/test";

test("loads the stress bench at both slash variants", async ({ page }) => {
  for (const path of ["/bench", "/bench/"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Test every edge case." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Test the four viewport corners" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Animated targets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sticky header and overlapping cards" })).toBeVisible();
    await expect(page.getByTitle("Complex embedded application")).toBeVisible();
    await expect(page.getByRole("button", { name: "Comments (M)" })).toBeVisible();
  }
});

test("inspect tool can select an element inside the iframe", async ({ page }) => {
  await page.goto("/bench");
  const frame = page.getByTitle("Complex embedded application");
  await frame.scrollIntoViewIfNeeded();
  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.click(box.x + 40, box.y + 92);
  const selected = page.locator("[data-mesurer-selected-measurement] > div");
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
  const target = await frame.contentFrame()?.getByRole("heading", { name: "Iframe application" }).boundingBox();
  const selection = await selected.first().boundingBox();
  expect(target).not.toBeNull();
  expect(selection).not.toBeNull();
  if (target && selection) {
    expect(Math.abs(selection.x - target.x)).toBeLessThan(3);
    expect(Math.abs(selection.y - target.y)).toBeLessThan(3);
  }
});

test("inspect tool can hover an element inside the iframe", async ({ page }) => {
  await page.goto("/bench");
  const frame = page.getByTitle("Complex embedded application");
  await frame.scrollIntoViewIfNeeded();
  const target = await frame.contentFrame()?.getByRole("heading", { name: "Iframe application" }).boundingBox();
  expect(target).not.toBeNull();
  if (!target) return;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  const hover = page.locator("[data-mesurer-hover='true']");
  await expect(hover).toBeVisible();
  const hoverBox = await hover.boundingBox();
  expect(hoverBox).not.toBeNull();
  if (hoverBox) {
    expect(Math.abs(hoverBox.x - target.x)).toBeLessThan(3);
    expect(Math.abs(hoverBox.y - target.y)).toBeLessThan(3);
  }
});

test("inspect tool can reach a nested iframe", async ({ page }) => {
  await page.goto("/bench");
  const frame = page.getByTitle("Complex embedded application");
  await frame.scrollIntoViewIfNeeded();
  const nested = frame.contentFrame()?.frameLocator('iframe[title="Nested child iframe"]').getByRole("button", { name: "nested iframe target" });
  await expect(nested!).toBeVisible();
  await nested!.scrollIntoViewIfNeeded();
  const target = await nested!.boundingBox();
  expect(target).not.toBeNull();
  if (!target) return;
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
});

test("comments in an iframe resolve after reload", async ({ page }) => {
  await page.goto("/bench");
  const frame = page.getByTitle("Complex embedded application");
  await frame.scrollIntoViewIfNeeded();
  const target = frame.contentFrame()?.getByRole("heading", { name: "Iframe application" });
  await expect(target!).toBeVisible();
  await page.getByRole("button", { name: /Settings/ }).click();
  await page.getByRole("switch", { name: "Persist" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Comments (M)" }).click();
  const box = await target!.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole("textbox", { name: "Comment" }).fill("Iframe target survives reload.");
  await page.getByRole("button", { name: "Send comment" }).click();
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTitle("Complex embedded application")).toBeVisible();
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);
});

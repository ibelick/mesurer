import { expect, test, type Page } from "@playwright/test";

const activateComments = async (page: Page) => {
  const annotate = page.getByRole("button", { name: "Annotate tools (2)" });
  if (await annotate.isVisible()) await annotate.click();
  await page.getByRole("button", { name: "Comments (M)" }).click();
}

test("creates a comment attached to the selected DOM element", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  const input = page.getByRole("textbox", { name: "Comment" });
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await page.keyboard.press("m");
  await expect(input).toBeVisible();
  await input.fill("The nested button needs more contrast.");
  await page.getByRole("button", { name: "Send comment" }).click();

  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText(
    "The nested button needs more contrast.",
  );

  await page.getByRole("textbox", { name: "Reply to comment" }).fill("I will revisit the color token.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText(
    "I will revisit the color token.",
  );

  await page.keyboard.press("Escape");
  await page.locator("[data-mesurer-comment-pin]").hover();
  const hoverCard = page.locator("[data-mesurer-comment-hover-card]");
  await expect(hoverCard).toContainText("just now");
  await expect(hoverCard).toContainText("1 reply");
  const hoverBox = await hoverCard.boundingBox();
  if (!hoverBox) throw new Error("Comment hover card is not visible");
  const hoverCommentBox = await hoverCard.getByText("The nested button needs more contrast.").boundingBox();
  if (!hoverCommentBox) throw new Error("Hover comment is not visible");
  await page.locator("[data-mesurer-comment-pin]").click();
  const openCard = page.locator("[data-mesurer-comment-popover]");
  const openBox = await openCard.boundingBox();
  if (!openBox) throw new Error("Comment card is not visible");
  const openCommentBox = await openCard.getByText("The nested button needs more contrast.").boundingBox();
  if (!openCommentBox) throw new Error("Open comment is not visible");
  expect(openBox.width).toBeCloseTo(hoverBox.width, 0);
  expect(openCommentBox.x).toBeCloseTo(hoverCommentBox.x, 0);
  expect(openCommentBox.y).toBeCloseTo(hoverCommentBox.y, 0);
  await openCard.getByRole("button", { name: "Comment actions" }).nth(1).click();
  await page.locator("[data-mesurer-comment-overflow-menu]").getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await expect(openCard).toContainText("The nested button needs more contrast.");
  await expect(openCard).not.toContainText("I will revisit the color token.");
  await page.getByRole("button", { name: "Close comment" }).click();
  await expect(openCard).toHaveCount(0);
});

test("copies all comments with DOM context to the agent clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Inspect this element.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  await page.getByRole("button", { name: "Comment menu" }).click();
  await page.getByRole("menuitem", { name: "Copy to agent" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  expect(copied).toContain("# Mesurer Comments");
  expect(copied).toContain("Inspect this element.");
  expect(copied).toContain("Nested inner button");
  expect(copied).toContain("<button");
});

test("persists the comment thread after reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Keep this feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.reload();

  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);
  await page.locator("[data-mesurer-comment-pin]").click();
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText(
    "Keep this feedback.",
  );
});

test("deletes a comment thread", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Remove this feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.getByRole("button", { name: "Delete comment" }).click();
  await expect(page.getByRole("dialog", { name: "Delete comment" })).toBeVisible();
  await page.getByRole("button", { name: "Yes" }).click();

  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(0);
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);
});

test("can cancel comment deletion and edit the user message", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Original feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.getByRole("button", { name: "Delete comment" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Delete comment" })).toHaveCount(0);
  await page.getByRole("button", { name: "Delete comment" }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);

  await page.locator("[data-mesurer-comment-popover]").getByRole("button", { name: "Comment actions" }).click();
  await page.locator("[data-mesurer-comment-overflow-menu]").getByRole("menuitem", { name: "Edit" }).click();
  const editor = page.getByRole("textbox", { name: "Edit comment" });
  await editor.fill("Updated feedback.");
  await editor.press("Enter");
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText("Updated feedback.");
});

test("shows overflow actions for more than two comments on one element", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  for (const [x, y] of [[550, 440], [600, 500], [680, 450]]) {
    await page.mouse.move(10, 10);
    await page.waitForTimeout(150);
    await page.mouse.click(x, y);
    await page.getByRole("textbox", { name: "Comment" }).fill(`Feedback ${x}-${y}.`);
    await page.getByRole("textbox", { name: "Comment" }).press("Enter");
    await page.keyboard.press("Escape");
  }

  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(3);
  await page.locator("[data-mesurer-comment-pin]").first().hover();
  await expect(page.locator("[data-mesurer-comment-hover-card]").getByRole("button", { name: "Comment actions" })).toHaveCount(0);
  await page.locator("[data-mesurer-comment-pin]").first().click();
  await page.locator("[data-mesurer-comment-popover]").hover();
  await page.locator("[data-mesurer-comment-popover]").getByRole("button", { name: "Comment actions" }).first().click();
  await expect(page.locator("[data-mesurer-comment-overflow-menu]")).toContainText("Edit");
  await expect(page.locator("[data-mesurer-comment-overflow-menu]")).toContainText("Delete");
  await page.getByRole("button", { name: "Delete comment" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(2);
});

test("closes an open thread with Escape and keeps comment pins clickable when minimized", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Keep this pin available.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();
  await page.locator("[data-mesurer-comment-pin]").click();
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText(
    "Keep this pin available.",
  );
});

test("moves a comment to a different DOM element", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Move this feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  const pin = page.locator("[data-mesurer-comment-pin]");
  const pinBox = await pin.boundingBox();
  if (!pinBox) throw new Error("Comment pin is not visible");
  await page.mouse.move(pinBox.x + pinBox.width / 2, pinBox.y + pinBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(300, 560, { steps: 5 });
  await expect(page.locator("[data-mesurer-comment-highlight]")).toBeVisible();
  await page.mouse.up();
  const movedPin = await pin.boundingBox();
  expect(movedPin).not.toBeNull();
  expect(movedPin!.x + movedPin!.width / 2).toBeCloseTo(300, 0);
  expect(movedPin!.y + movedPin!.height / 2).toBeCloseTo(560, 0);

  await page.getByRole("button", { name: "Comment menu" }).click();
  await page.getByRole("menuitem", { name: "Copy to agent" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Secondary app button");
  expect(copied).toContain("Move this feedback.");
});

import { expect, test, type Page } from "@playwright/test";

const activateComments = async (page: Page) => {
  const annotate = page.getByRole("button", { name: "Annotate tools (2)" });
  if (await annotate.isVisible()) await annotate.click();
  await page.getByRole("button", { name: "Comments (M)" }).click();
}

const clickCenter = async (page: Page, locator: ReturnType<Page["locator"]>) => {
  const box = await locator.boundingBox()
  if (!box) throw new Error("Expected clickable element to be visible")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
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
  await page.locator("[data-mesurer-comment-pin]").click();
  const openCard = page.locator("[data-mesurer-comment-popover]");
  const openBox = await openCard.boundingBox();
  if (!openBox) throw new Error("Comment card is not visible");
  expect(openBox.width).toBeCloseTo(hoverBox.width, 0);
  expect(openBox.x).toBeCloseTo(hoverBox.x, 0);
  expect(openBox.y).toBeCloseTo(hoverBox.y, 0);
  await openCard.getByRole("button", { name: "Comment actions" }).nth(1).click();
  await page.locator("[data-mesurer-comment-overflow-menu]").getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await expect(openCard).toContainText("The nested button needs more contrast.");
  await expect(openCard).not.toContainText("I will revisit the color token.");
  await page.getByRole("button", { name: "Close comment" }).click();
  await expect(openCard).toHaveCount(0);
});

test("adds a new comment on an existing node as a reply", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(580, 500);
  await page.getByRole("textbox", { name: "Comment" }).fill("First note.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.keyboard.press("Escape");

  await page.mouse.click(540, 440);
  await page.getByRole("textbox", { name: "Comment" }).fill("Follow-up note.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);
  const card = page.locator("[data-mesurer-comment-popover]");
  await expect(card).toContainText("First note.");
  await expect(card).toContainText("Follow-up note.");
  await expect(card.getByText("You")).toHaveCount(2);
});

test("closes the input when clicking elsewhere instead of moving it", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await expect(page.getByRole("textbox", { name: "Comment" })).toBeFocused();
  await page.mouse.click(240, 240);
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);
});

test("closes an open comment card and reopens it from the pin", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Review this element.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  const pin = page.locator("[data-mesurer-comment-pin]");
  await pin.click();
  await expect(page.locator("[data-mesurer-comment-popover]")).toBeVisible();
  await page.mouse.click(240, 240);
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);
  await pin.click();
  await expect(page.locator("[data-mesurer-comment-popover]")).toBeVisible();
});

test("shows every comment and opens a thread from the list", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("First feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.keyboard.press("Escape");

  await page.mouse.click(300, 560);
  await page.getByRole("textbox", { name: "Comment" }).fill("Second feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Comment menu" }).click();
  await page.getByRole("menuitem", { name: /Show all comments/ }).click();
  const panel = page.getByRole("dialog", { name: "Comments" });
  await expect(panel).toContainText("First feedback.");
  await expect(panel).toContainText("Second feedback.");
  const search = panel.getByRole("searchbox", { name: "Search comments" });
  await search.fill("Second");
  await expect(panel).not.toContainText("First feedback.");
  await expect(panel).toContainText("Second feedback.");
  await search.fill("");
  await panel.getByRole("button", { name: /You .*First feedback/ }).click();
  await expect(panel).toBeVisible();
  await expect(page.getByRole("button", { name: "Comments (M)" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Annotate tools (2)" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText("First feedback.");
  await page.getByRole("button", { name: "Comment menu" }).click();
  await expect(panel).toHaveCount(0);
});

test("deletes a comment from the all comments menu", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Delete from the list.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.getByRole("button", { name: "Comment menu" }).click();
  await page.getByRole("menuitem", { name: /Show all comments/ }).click();

  const panel = page.getByRole("dialog", { name: "Comments" });
  await panel.getByRole("button", { name: /Actions for comment: Delete from the list/ }).click();
  await expect(page.getByRole("menu", { name: "Comment actions" })).toBeVisible();
  await page.mouse.click(100, 300);
  await expect(page.getByRole("menu", { name: "Comment actions" })).toHaveCount(0);
  await panel.getByRole("button", { name: /Actions for comment: Delete from the list/ }).click();
  await clickCenter(page, page.getByRole("menuitem", { name: "Delete" }));
  await clickCenter(page, page.getByRole("dialog", { name: "Delete comment" }).getByRole("button", { name: "Yes" }));
  await expect(panel).not.toContainText("Delete from the list.");
});

test("deletes all comments from the comments list menu", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Remove every comment.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  await page.getByRole("button", { name: "Comment menu" }).click();
  await page.getByRole("menuitem", { name: /Show all comments/ }).click();
  const panel = page.getByRole("dialog", { name: "Comments" });
  await panel.getByRole("button", { name: "Comment list actions" }).click();
  await clickCenter(page, page.getByRole("menuitem", { name: "Delete all comments" }));
  const confirmation = page.getByRole("dialog", { name: "Delete comment" });
  await expect(confirmation).toContainText("delete all comments");
  await clickCenter(page, confirmation.getByRole("button", { name: "Yes" }));
  await expect(panel).toContainText("No comments yet.");
});

test("copies concise comments with DOM context to the agent clipboard", async ({ page, context }) => {
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
  expect(copied).toContain("[<button>Nested inner button</button> selector:");
  expect(copied).not.toContain("### Computed Styles");
  expect(copied).not.toContain("```html");
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
  await page.locator("[data-mesurer-comment-popover]").getByRole("button", { name: "Comment actions" }).click();
  await page.locator("[data-mesurer-comment-overflow-menu]").getByRole("menuitem", { name: "Delete" }).click();
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

test("shows overflow actions for more than two replies on one element", async ({ page }) => {
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

  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);
  await page.locator("[data-mesurer-comment-pin]").first().hover();
  await expect(page.locator("[data-mesurer-comment-hover-card]").getByRole("button", { name: "Comment actions" })).toHaveCount(0);
  await page.locator("[data-mesurer-comment-pin]").first().click();
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText("Feedback 550-440.");
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText("Feedback 600-500.");
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText("Feedback 680-450.");
  await page.locator("[data-mesurer-comment-popover]").hover();
  await page.locator("[data-mesurer-comment-popover]").getByRole("button", { name: "Comment actions" }).first().click();
  await expect(page.locator("[data-mesurer-comment-overflow-menu]")).toContainText("Edit");
  await expect(page.locator("[data-mesurer-comment-overflow-menu]")).toContainText("Delete");
  await page.locator("[data-mesurer-comment-overflow-menu]").getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);
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
  await page.mouse.click(300, 560);
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);
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
  const movingCard = page.locator("[data-mesurer-comment-popover]");
  await expect(movingCard).toBeVisible();
  const movingCardBox = await movingCard.boundingBox();
  if (!movingCardBox) throw new Error("Moving comment card is not visible");
  const movingPinBox = await pin.boundingBox();
  if (!movingPinBox) throw new Error("Moving comment pin is not visible");
  expect(movingCardBox.x).toBeGreaterThanOrEqual(8);
  expect(movingCardBox.y).toBeGreaterThanOrEqual(8);
  expect(movingCardBox.x - (movingPinBox.x + movingPinBox.width)).toBeCloseTo(4, 0);
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

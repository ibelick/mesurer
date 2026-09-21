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
  await expect(page.locator("[data-mesurer-comment-draft-target]")).toBeVisible();
  await expect(input).toBeFocused();
  await page.keyboard.press("m");
  await expect(input).toBeVisible();
  await input.fill("The nested button needs more contrast.");
  await page.getByRole("button", { name: "Send comment" }).click();

  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);
  await page.locator("[data-mesurer-comment-pin]").click();
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
  await openCard.getByRole("button", { name: "Comment actions" }).nth(2).click();
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
  await page.locator("[data-mesurer-comment-pin]").click();

  await page.getByRole("textbox", { name: "Reply to comment" }).fill("Follow-up note.");
  await page.getByRole("textbox", { name: "Reply to comment" }).press("Enter");

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

test("nudges an active comment input before closing on a second outside click", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Draft comment.");
  await page.mouse.click(240, 240);
  await expect(page.locator("[data-mesurer-comment-popover]")).toBeVisible();
  await expect(page.locator(".mesurer-comment-nudge")).toBeVisible();
  await page.mouse.click(240, 240);
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Thread comment.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.locator("[data-mesurer-comment-pin]").click();

  await page.getByRole("textbox", { name: "Reply to comment" }).fill("Reply text.");
  await page.mouse.click(240, 240);
  await expect(page.locator("[data-mesurer-comment-popover]")).toBeVisible();
  await page.mouse.click(240, 240);
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);

  await page.locator("[data-mesurer-comment-pin]").click();
  await page.locator("[data-mesurer-comment-popover]").getByRole("button", { name: "Comment actions" }).nth(1).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Edit comment" }).fill("Edited text.");
  await page.mouse.click(240, 240);
  await expect(page.locator("[data-mesurer-comment-popover]")).toBeVisible();
  await page.mouse.click(240, 240);
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);
});

test("closes a submitted comment so the next click starts a new comment", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Review this element.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);

  await page.mouse.click(240, 240);
  await expect(page.getByRole("textbox", { name: "Comment" })).toBeVisible();
});

test("closes an open comment card and reopens it from the pin", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Review this element.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  const pin = page.locator("[data-mesurer-comment-pin]");
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);
  await pin.click();
  await expect(page.locator("[data-mesurer-comment-popover]")).toBeVisible();
  await page.mouse.click(240, 240);
  await expect(page.locator("[data-mesurer-comment-popover]")).toHaveCount(0);
  await pin.click();
  await expect(page.locator("[data-mesurer-comment-popover]")).toBeVisible();
});

test("resolves a comment and reopens it from the resolved filter", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Resolve this review.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  const pin = page.locator("[data-mesurer-comment-pin]");
  await expect(pin).toHaveCount(1);
  await pin.click();
  const card = page.locator("[data-mesurer-comment-popover]");
  await page.getByRole("button", { name: "Mark comment as resolved" }).click();
  await expect(card).toBeVisible();
  await expect(pin).toHaveCSS("opacity", "0.45");

  await card.getByRole("button", { name: "Comment actions" }).first().click();
  await page.locator("[data-mesurer-comment-overflow-menu]").getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("dialog", { name: "Delete comment" })).toBeVisible();
  await page.mouse.click(240, 240);
  await expect(page.getByRole("dialog", { name: "Delete comment" })).toHaveCount(0);
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Reopen comment" }).click();
  await expect(card).toBeVisible();
  await expect(pin).toHaveCSS("opacity", "1");

  await card.getByRole("button", { name: "Mark comment as resolved" }).click();
  await card.getByRole("button", { name: "Comment actions" }).first().click();
  await page.locator("[data-mesurer-comment-overflow-menu]").getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await expect(card).toHaveCount(0);
  await expect(pin).toHaveCount(0);
});

test("keeps the thread open when using card actions", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Keep this thread open.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.locator("[data-mesurer-comment-pin]").click();

  const card = page.locator("[data-mesurer-comment-popover]");
  await card.getByRole("button", { name: "Comment actions" }).first().click();
  await expect(page.locator("[data-mesurer-comment-overflow-menu]")).toBeVisible();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Mark comment as resolved" }).click();
  await expect(card).toBeVisible();
  await card.getByRole("textbox", { name: "Reply to comment" }).fill("Still here.");
  await card.getByRole("button", { name: "Send reply" }).click();
  await expect(card).toContainText("Still here.");
  await card.getByRole("button", { name: "Close comment" }).click();
  await expect(card).toHaveCount(0);
});

test("resolves a comment from the comments list", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Resolve from the list.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);

  await page.getByRole("button", { name: "Comment menu" }).click();
  await page.getByRole("menuitem", { name: /Show all comments/ }).click();
  const panel = page.getByRole("dialog", { name: "Comments" });
  await panel.getByRole("button", { name: "Mark comment as resolved" }).click();
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(0);

  await panel.getByRole("button", { name: "Comment list actions" }).click();
  await page.getByRole("menuitemradio", { name: "Resolved" }).click();
  await expect(panel.getByRole("button", { name: "Reopen comment" })).toBeVisible();
});

test("shows every comment and opens a thread from the list", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("First feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  await page.mouse.click(300, 560);
  await page.getByRole("textbox", { name: "Comment" }).fill("Second feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  const toolbar = page.locator(".mesurer-toolbar-surface");
  const toolbarBefore = await toolbar.boundingBox();
  expect(toolbarBefore).not.toBeNull();
  await page.getByRole("button", { name: "Comment menu" }).click();
  await page.getByRole("menuitem", { name: /Show all comments/ }).click();
  const panel = page.getByRole("dialog", { name: "Comments" });
  await expect(panel).toContainText("First feedback.");
  const toolbarAfter = await toolbar.boundingBox();
  expect(toolbarAfter).not.toBeNull();
  if (toolbarBefore && toolbarAfter) {
    expect(toolbarAfter.width).toBeLessThanOrEqual(toolbarBefore.width + 1);
    expect(toolbarAfter.height).toBeLessThanOrEqual(toolbarBefore.height + 1);
  }
  await expect(panel).toContainText("Second feedback.");
  const search = panel.getByRole("searchbox", { name: "Search comments" });
  await search.fill("Second");
  await expect(panel).not.toContainText("First feedback.");
  await expect(panel).toContainText("Second feedback.");
  await search.fill("");
  await panel.getByText("First feedback.", { exact: true }).click();
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
   await page.getByRole("menuitem", { name: "Delete" }).click();
   await page.getByRole("dialog", { name: "Delete comment" }).getByRole("button", { name: "Yes" }).click();
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
   await page.getByRole("menuitem", { name: "Delete all comments" }).click();
  const confirmation = page.getByRole("dialog", { name: "Delete comment" });
  await expect(confirmation).toContainText("delete all comments");
   await confirmation.getByRole("button", { name: "Yes" }).click();
   await expect(panel).toContainText("No open comments.");
 });

test("resolves all comments from the comments list menu", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Resolve every comment.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  await page.getByRole("button", { name: "Comment menu" }).click();
  await page.getByRole("menuitem", { name: /Show all comments/ }).click();
  const panel = page.getByRole("dialog", { name: "Comments" });
  await panel.getByRole("button", { name: "Comment list actions" }).click();
  await page.getByRole("menuitem", { name: "Resolve all comments" }).click();

  await expect(panel).toContainText("No open comments.");
  await panel.getByRole("button", { name: "Comment list actions" }).click();
  await page.getByRole("menuitemradio", { name: "Resolved" }).click();
  await expect(panel.getByRole("button", { name: "Reopen comment" })).toBeVisible();
});

test("copies concise comments with DOM context to the agent clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Inspect this element.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  await page.keyboard.press("ControlOrMeta+k");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).not.toBe("");
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  expect(copied).not.toContain("Mesurer Comments");
  expect(copied).toContain("URL: ");
  const viewport = await page.evaluate(() => `Viewport: ${window.innerWidth} × ${window.innerHeight} CSS px`);
  expect(copied).toContain(viewport);
  expect(copied).toContain("Inspect this element.");
  expect(copied).toContain("[<button>Nested inner button</button> selector:");
  expect(copied).not.toContain("### Computed Styles");
  expect(copied).not.toContain("```html");

  await page.getByRole("button", { name: "Comment menu" }).click();
  const copyMenuItem = page.getByRole("menuitem", { name: /Copy comments/ });
  await expect(copyMenuItem.locator("svg")).toHaveCount(1);
});

test("copies only unresolved comments to the agent clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Resolved feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.locator("[data-mesurer-comment-pin]").click();
  await page.getByRole("button", { name: "Mark comment as resolved" }).click();
  await page.getByRole("button", { name: "Close comment" }).click();

  await page.mouse.click(300, 560);
  await page.getByRole("textbox", { name: "Comment" }).fill("Open feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  await page.keyboard.press("ControlOrMeta+k");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).not.toBe("");
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  expect(copied).toContain("Open feedback.");
  expect(copied).not.toContain("Resolved feedback.");
});

test("copies a comment target selector from the thread menu", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Copy this selector.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.locator("[data-mesurer-comment-pin]").click();
  await page.locator("[data-mesurer-comment-popover]").getByRole("button", { name: "Comment actions" }).first().click();
  await page.getByRole("menuitem", { name: "Copy selector" }).click();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("button");
  await expect(page.locator("[data-mesurer-comment-overflow-menu]")).toHaveCount(0);
  await expect(page.locator("[data-mesurer-comment-popover]")).toBeVisible();
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

test("resolves a persisted target inside an open Shadow DOM root", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const shadowButton = page.getByRole("button", { name: "Shadow comment button" });
  const shadowBox = await shadowButton.boundingBox();
  expect(shadowBox).not.toBeNull();
  const target = await page.evaluate((point) => {
    const button = document.querySelector("[data-testid='shadow-comment-host']")?.shadowRoot?.querySelector("button");
    if (!button) throw new Error("Expected Shadow DOM button");
    return (window as any).__mesurerCommentTargetTest.captureCommentTarget(button, point, window);
  }, { x: shadowBox!.x + shadowBox!.width / 2, y: shadowBox!.y + shadowBox!.height / 2 });
  expect(target.shadowPath).toEqual(["div#shadow-comment-host"]);
  await page.reload();

  await expect.poll(() => page.evaluate((persistedTarget) => {
    const element = (window as any).__mesurerCommentTargetTest.resolveCommentTarget(persistedTarget);
    return element?.textContent;
  }, target)).toBe("Shadow comment button");
});

test("resolves targets in distinct ID-less Shadow DOM hosts", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const targets = await page.evaluate(() => {
    const hosts = [document.createElement("div"), document.createElement("div")];
    const buttons = hosts.map((host, index) => {
      document.body.append(host);
      const root = host.attachShadow({ mode: "open" });
      const button = document.createElement("button");
      button.textContent = `Shadow target ${index}`;
      root.append(button);
      return button;
    });
    const testApi = (window as any).__mesurerCommentTargetTest;
    return buttons.map((button) => {
      const target = testApi.captureCommentTarget(button, { x: 0, y: 0 }, window);
      return { path: target.shadowPath, text: testApi.resolveCommentTarget(target)?.textContent };
    });
  });

  expect(targets[0].path).not.toEqual(targets[1].path);
  expect(targets.map((target) => target.text)).toEqual(["Shadow target 0", "Shadow target 1"]);
});

test("re-resolves a comment after its target is replaced", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await clickCenter(page, page.getByRole("button", { name: "Underlying app button" }));
  await page.getByRole("textbox", { name: "Comment" }).fill("Keep replacement feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);

  await page.getByRole("button", { name: "Underlying app button" }).evaluate((button) => {
    button.replaceWith(button.cloneNode(true));
  });
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);
  await page.locator("[data-mesurer-comment-pin]").click();
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText(
    "Keep replacement feedback.",
  );
});

test("deletes a comment thread", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Remove this feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.locator("[data-mesurer-comment-pin]").click();
  await page.locator("[data-mesurer-comment-popover]").getByRole("button", { name: "Comment actions" }).first().click();
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
  await page.locator("[data-mesurer-comment-pin]").click();
  await page.locator("[data-mesurer-comment-popover]").getByRole("button", { name: "Comment actions" }).first().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Delete comment" })).toHaveCount(0);
  await page.locator("[data-mesurer-comment-popover]").getByRole("button", { name: "Comment actions" }).first().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);

  await page.locator("[data-mesurer-comment-popover]").getByRole("button", { name: "Comment actions" }).nth(1).click();
  await page.locator("[data-mesurer-comment-overflow-menu]").getByRole("menuitem", { name: "Edit" }).click();
  const editor = page.getByRole("textbox", { name: "Edit comment" });
  await editor.fill("Updated feedback.");
  await editor.press("Enter");
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText("Updated feedback.");
});

test("keeps separate comments on the same element", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  const target = page.getByRole("button", { name: "Nested inner button" });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  if (!targetBox) return;
  const points = [
    { x: targetBox.x + 20, y: targetBox.y + targetBox.height / 2 },
    { x: targetBox.x + 70, y: targetBox.y + targetBox.height / 2 },
    { x: targetBox.x + 120, y: targetBox.y + targetBox.height / 2 },
  ];
  for (const [index, point] of points.entries()) {
    await page.mouse.move(10, 10);
    await page.waitForTimeout(150);
    await page.mouse.click(point.x, point.y);
    await page.getByRole("textbox", { name: "Comment" }).fill(`Feedback ${index}.`);
    await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  }

  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(3);
  const pins = page.locator("[data-mesurer-comment-pin]");
  const firstPinBox = await pins.nth(0).boundingBox();
  const secondPinBox = await pins.nth(1).boundingBox();
  expect(firstPinBox).not.toBeNull();
  expect(secondPinBox).not.toBeNull();
  if (firstPinBox && secondPinBox) {
    expect(firstPinBox.x !== secondPinBox.x || firstPinBox.y !== secondPinBox.y).toBe(true);
  }
  await pins.first().hover();
  await expect(page.locator("[data-mesurer-comment-hover-card]")).toContainText("Feedback 0.");
  await expect(page.locator("[data-mesurer-comment-hover-card]")).not.toContainText("Feedback 1.");
  await pins.first().click();
  await expect(page.locator("[data-mesurer-comment-popover]")).toContainText("Feedback 0.");
  await expect(page.locator("[data-mesurer-comment-popover]")).not.toContainText("Feedback 1.");
});

test("shows overflow actions for more than two replies on one thread", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateComments(page);

  await page.mouse.click(550, 440);
  await page.getByRole("textbox", { name: "Comment" }).fill("Thread root.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.locator("[data-mesurer-comment-pin]").click();

  for (const reply of ["Reply one.", "Reply two.", "Reply three."]) {
    await page.getByRole("textbox", { name: "Reply to comment" }).fill(reply);
    await page.getByRole("textbox", { name: "Reply to comment" }).press("Enter");
  }

  const card = page.locator("[data-mesurer-comment-popover]");
  await expect(card).toContainText("Reply three.");
  await card.hover();
  await card.getByRole("button", { name: "Comment actions" }).nth(1).click();
  await expect(page.locator("[data-mesurer-comment-overflow-menu]")).toContainText("Edit");
  await expect(page.locator("[data-mesurer-comment-overflow-menu]")).toContainText("Delete");
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

  await page.mouse.click(300, 560);
  await page.getByRole("textbox", { name: "Comment" }).fill("Existing feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Move this feedback.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");

  const pin = page.locator("[data-mesurer-comment-pin]").nth(1);
  await pin.click();
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
  expect(movedPin!.x + movedPin!.width / 2).toBeCloseTo(318, 0);
  expect(movedPin!.y + movedPin!.height / 2).toBeCloseTo(560, 0);
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(2);

  await page.getByRole("button", { name: "Comment menu" }).click();
  await page.getByRole("menuitem", { name: /Copy comments/ }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Secondary app button");
  expect(copied).toContain("Existing feedback.");
  expect(copied).toContain("Move this feedback.");
});

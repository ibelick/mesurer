import { expect, test } from "@playwright/test";

test("loads the stress bench at both slash variants", async ({ page }) => {
  for (const path of ["/bench", "/bench/"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Test every edge case." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "UI Skills opening section" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "CLI card lookalike" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Test the four viewport corners" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Animated targets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sticky header and overlapping cards" })).toBeVisible();
    await expect(page.getByTitle("Complex embedded application")).toBeVisible();
    await expect(page.getByRole("button", { name: "Comments (M)" })).toBeVisible();
  }
});

test("CLI card fixture keeps its dense controls functional", async ({ page }) => {
  await page.goto("/bench");

  await page.getByRole("button", { name: /skills init --preset interface/ }).dispatchEvent("click");
  await expect(page.getByText("output / 02")).toBeVisible();
  await page.getByRole("button", { name: "Copy selected command" }).dispatchEvent("click");
  await expect(page.getByRole("button", { name: "Copy selected command" })).toHaveText("copied");

  const input = page.getByRole("textbox", { name: "CLI command input" });
  await input.evaluate((element) => {
    if (!(element instanceof HTMLInputElement)) return;
    element.value = "skills check --target ./bench";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(input).toHaveValue("skills check --target ./bench");
});

test("UI Skills opening fixture keeps both reference cards inspectable", async ({ page }) => {
  await page.goto("/bench");

  await expect(page.getByRole("heading", { name: "Curated skills for design engineering" })).toBeVisible();
  await expect(page.getByText("Run the UI Skills CLI from your terminal.")).toBeVisible();
  await expect(page.getByText("Connect your agent to the UI Skills catalog.")).toBeVisible();
  await page.getByRole("button", { name: "Copy command" }).dispatchEvent("click");
  await expect(page.locator('[data-card-href="/cli"] [data-copy-icon="check"]')).toBeVisible();
  await expect(page.locator('a[aria-label="Open CLI installation guide"]')).toHaveAttribute("href", "/cli");
  await expect(page.locator('a[aria-label="Open MCP installation guide"]')).toHaveAttribute("href", "/mcp/docs");
});

test("inspect resolves text inside a pointer-transparent card description", async ({ page }) => {
  await page.goto("/bench");
  const target = page.getByText("CLI", { exact: true });
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  await expect(page.locator("[data-mesurer-hover='true']")).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toHaveAttribute("title", /div:nth-of-type\(1\)/);
});

test("inspect resolves every UI Skills card target to its visual bounds", async ({ page }) => {
  const targets: Array<{
    name: string;
    selector: string;
    point?: (box: { x: number; y: number; width: number; height: number }) => { x: number; y: number };
    tolerance?: number;
  }> = [
    { name: "CLI text", selector: '[data-card-href="/cli"] .bench-uiskills-card-description div:first-child' },
    { name: "CLI card link", selector: 'a[aria-label="Open CLI installation guide"]' },
    { name: "CLI command row", selector: '[data-command-row="npx ui-skills"]' },
    { name: "CLI copy button", selector: '[data-card-href="/cli"] button[aria-label="Copy command"]', point: (box) => ({ x: box.x + 2, y: box.y + 2 }) },
    { name: "CLI copy icon", selector: '[data-card-href="/cli"] button[aria-label="Copy command"] svg', point: (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }), tolerance: 6 },
    { name: "MCP text", selector: '[data-card-href="/mcp/docs"] .bench-uiskills-card-description div:first-child' },
    { name: "MCP logo", selector: '[data-card-href="/mcp/docs"] .bench-uiskills-agent-track-inner img' },
  ]

  for (const targetCase of targets) {
    await page.goto("/bench");
    const target = page.locator(targetCase.selector).first();
    await expect(target, targetCase.name).toBeVisible();
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    expect(box, targetCase.name).not.toBeNull();
    if (!box) continue;

    const point = targetCase.point?.(box) ?? { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(point.x, point.y);
    const hover = page.locator("[data-mesurer-hover='true']");
    await expect(hover, `${targetCase.name} hover`).toBeVisible();
    await expect.poll(async () => {
      const hoverBox = await hover.boundingBox();
      if (!hoverBox) return Number.POSITIVE_INFINITY;
      return Math.max(Math.abs(hoverBox.x - box.x), Math.abs(hoverBox.y - box.y), Math.abs(hoverBox.width - box.width), Math.abs(hoverBox.height - box.height));
    }, { message: `${targetCase.name} hover bounds` }).toBeLessThan(targetCase.tolerance ?? 3);

    await page.mouse.click(point.x, point.y);
    const selected = page.locator("[data-mesurer-selected-measurement] > div").first();
    await expect(selected, `${targetCase.name} selection`).toBeVisible();
    await expect.poll(async () => {
      const selectedBox = await selected.boundingBox();
      if (!selectedBox) return Number.POSITIVE_INFINITY;
      return Math.max(Math.abs(selectedBox.x - box.x), Math.abs(selectedBox.y - box.y), Math.abs(selectedBox.width - box.width), Math.abs(selectedBox.height - box.height));
    }, { message: `${targetCase.name} selection bounds` }).toBeLessThan(targetCase.tolerance ?? 3);
  }
});

test("renders the initial workspace state", async ({ page }) => {
  await page.goto("/bench");

  await expect(page.getByRole("heading", { name: "Initial workspace" })).toBeVisible();
  await expect(page.locator('[data-mesurer-guide="true"]')).toBeVisible();
  await expect(page.locator('[data-mesurer-arrow="true"][data-mesurer-arrow-id="bench-initial-arrow"]')).toBeVisible();
  await expect(page.locator('[data-mesurer-pen="true"][data-mesurer-pen-id="bench-initial-pen"]')).toBeVisible();
  await expect(page.locator('[data-mesurer-text="true"][data-mesurer-text-id="bench-initial-text"]')).toContainText("Seeded annotation");
});

test("renders functional dialog, popover, and menu examples", async ({ page }) => {
  await page.goto("/bench");
  await expect(page.getByRole("heading", { name: "Dialog, popover, and menu" })).toBeVisible();

  await page.getByRole("button", { name: "Toggle popover" }).dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: "Bench popover" })).toBeVisible();
  await expect(page.locator("body > .bench-popover")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Bench popover" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open actions" }).dispatchEvent("click");
  await expect(page.getByRole("menu", { name: "Bench actions" })).toBeVisible();
  await expect(page.locator("body > .bench-action-menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Archive target" }).dispatchEvent("click");
  await expect(page.getByRole("menu", { name: "Bench actions" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open confirmation" }).dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: "Bench confirmation dialog" })).toBeVisible();
  await page.locator(".bench-dialog-backdrop").dispatchEvent("mousedown");
  await expect(page.getByRole("dialog", { name: "Bench confirmation dialog" })).toHaveCount(0);
});

test("switching to Inspect does not dismiss an open portaled surface", async ({ page }) => {
  await page.goto("/bench");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Toggle popover" }).dispatchEvent("click");
  const popover = page.getByRole("dialog", { name: "Bench popover" });
  await expect(popover).toBeVisible();

  await page.getByRole("button", { name: "Select and inspect tools (1)" }).click();
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute("data-value", "inspect");
  await expect(popover).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(popover).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Open confirmation" }).dispatchEvent("click");
  const dialog = page.getByRole("dialog", { name: "Bench confirmation dialog" });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Select and inspect tools (1)" }).click();
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  if (dialogBox) {
    await page.mouse.click(dialogBox.x + dialogBox.width / 2, dialogBox.y + dialogBox.height / 2);
    await expect(page.locator("[data-mesurer-inspect-info-card]")).toBeVisible();
  }
});

test("clicking the Mesurer toolbar does not dismiss a hostile page menu", async ({
  page,
}) => {
  await page.goto("/bench");
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await page.evaluate(() => {
    window.addEventListener(
      "pointerdown",
      (event) => {
        const menu = document.querySelector('[role="menu"][aria-label="Bench actions"]');
        if (!(menu instanceof HTMLElement)) return;
        const path = event.composedPath();
        if (path.includes(menu)) return;
        const trigger = document.querySelector('[aria-haspopup="menu"]');
        if (trigger && path.includes(trigger)) return;
        menu.dataset.hostileDismissed = "true";
        menu.remove();
      },
      true,
    );
  });

  await page.getByRole("button", { name: "Open actions" }).dispatchEvent("click");
  const menu = page.getByRole("menu", { name: "Bench actions" });
  await expect(menu).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(menu).toBeVisible();

  await page.getByRole("heading", { name: "Test every edge case." }).dispatchEvent("pointerdown");
  await expect(menu).toHaveCount(0);
});

test("inspecting a focus-dismissed model selector keeps it open", async ({ page }) => {
  await page.goto("/bench");
  const trigger = page.getByRole("button", { name: "Open model selector" });
  await trigger.evaluate((element) => {
    if (!(element instanceof HTMLButtonElement)) return;
    element.scrollIntoView({ block: "center", behavior: "instant" });
    element.focus();
    element.click();
  });
  const listbox = page.getByRole("listbox", { name: "Model selector" });
  await expect(listbox).toBeVisible();
  await expect(trigger).toBeFocused();

  const box = await listbox.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(listbox).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(listbox).toBeVisible();
});

test("inspect mode keeps the default cursor and ignores page controls", async ({ page }) => {
  await page.goto("/bench");
  const checkbox = page.locator(".bench-native-elements input[type='checkbox']");
  await checkbox.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const box = await checkbox.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("[data-mesurer-overlay]")).toHaveCSS("cursor", "default");

  await expect(checkbox).not.toBeChecked();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(checkbox).not.toBeChecked();
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toBeVisible();
});

test("inspect tool can select a portaled popover", async ({ page }) => {
  await page.goto("/bench");
  const trigger = page.getByRole("button", { name: "Toggle popover" });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.dispatchEvent("click");
  const popover = page.getByRole("dialog", { name: "Bench popover" });
  await expect(popover).toBeVisible();
  const box = await popover.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toBeVisible();
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
  expect(target).not.toBeNull();
  await expect.poll(async () => {
    const selection = await selected.first().boundingBox();
    if (!target || !selection) return Number.POSITIVE_INFINITY;
    return Math.max(Math.abs(selection.x - target.x), Math.abs(selection.y - target.y));
  }).toBeLessThan(3);
});

test("x-ray mode outlines accessible iframe content", async ({ page }) => {
  await page.goto("/bench");
  await page.getByRole("button", { name: "X-ray (X)" }).click();

  const frame = page.frameLocator('iframe[title="Complex embedded application"]');
  await expect(frame.locator("body")).toHaveClass(/xray-mode/);
  await expect(frame.locator("h1")).toHaveCSS("outline-style", "solid");
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

test("inspect tool can reach an iframe inside Shadow DOM", async ({ page }) => {
  await page.goto("/bench");
  const embeddedFrame = page.getByTitle("Complex embedded application").contentFrame();
  const frame = embeddedFrame?.locator("#shadow-frame-host iframe[title='Shadow child iframe']");
  expect(frame).toBeDefined();
  if (!frame) return;
  await frame.scrollIntoViewIfNeeded();
  const target = frame.contentFrame()?.getByRole("button", { name: "shadow iframe target" });
  await expect(target!).toBeVisible();
  const box = await target!.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toHaveAttribute("title", /button/);
});

test("inspect selection follows an animated target", async ({ page }) => {
  await page.goto("/bench");
  const target = page.getByRole("button", { name: "orbiting target" });
  await expect(target).toBeVisible();
  await target.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  if (!targetBox) return;
  await page.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  const selected = page.locator("[data-mesurer-selected-measurement] > div").first();
  await expect(selected).toBeVisible();
  // Live tracking updates on animation frames, so compare until the overlay
  // converges within one frame of the continuously moving target.
  await expect.poll(async () => {
    const selectionBox = await selected.boundingBox();
    const currentTargetBox = await target.boundingBox();
    if (!selectionBox || !currentTargetBox) return Number.POSITIVE_INFINITY;
    return Math.max(
      Math.abs(selectionBox.x - currentTargetBox.x),
      Math.abs(selectionBox.y - currentTargetBox.y),
    );
  }).toBeLessThan(10);
});

test("inspect selection remains after moving the pointer away", async ({ page }) => {
  await page.goto("/bench");
  const target = page.getByRole("button", { name: "orbiting target" });
  await target.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const selected = page.locator("[data-mesurer-selected-measurement] > div").first();
  await expect(selected).toBeVisible();
  await page.mouse.move(700, 700);
  await page.waitForTimeout(250);
  await expect(selected).toBeVisible();
});

test("comment draft follows an animated target", async ({ page }) => {
  await page.goto("/bench");
  const target = page.getByRole("button", { name: "orbiting target" });
  await expect(target).toBeVisible();
  await target.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Comments (M)" }).click();
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  if (!targetBox) return;
  await page.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  const composer = page.getByRole("textbox", { name: "Comment" });
  await expect(composer).toBeVisible();
  const composerBox = await composer.boundingBox();
  const draft = page.locator("[data-mesurer-comment-draft-target]");
  await expect(draft).toBeVisible();
  expect(composerBox).not.toBeNull();
  if (!composerBox) return;
  await expect.poll(async () => {
    const draftBox = await draft.boundingBox();
    const currentTargetBox = await target.boundingBox();
    const currentComposerBox = await composer.boundingBox();
    if (!draftBox || !currentTargetBox || !currentComposerBox) return Number.POSITIVE_INFINITY;
    return Math.max(
      Math.abs(draftBox.x - currentTargetBox.x),
      Math.abs(draftBox.y - currentTargetBox.y),
      Math.abs(composerBox.x - currentComposerBox.x),
      Math.abs(composerBox.y - currentComposerBox.y),
    );
  }, { timeout: 2_000 }).toBeLessThan(4);
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

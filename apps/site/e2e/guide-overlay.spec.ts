import { expect, test, type Locator, type Page } from "@playwright/test";

const activateSelect = async (page: Page) => {
  const button = page.getByRole("button", { name: "Inspect (I)" });
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
};

test("starts with the Select tool active", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("inspect clicks do not steal focus from a page field", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
  const field = page.getByRole("textbox", { name: "Page field" });
  await field.focus();
  await expect(field).toBeFocused();

  await page.mouse.click(120, 160);
  await expect(field).toBeFocused();
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toBeVisible();
});

test("does not reset host-page border styles", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  await expect
    .poll(() =>
      page.getByTestId("host-border-control").evaluate((element) => {
        const style = getComputedStyle(element);
        return `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`;
      }),
    )
    .toBe("3px dashed rgb(17, 24, 39)");
});

test("Mesurer surfaces and controls use their intended borders", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: /Settings/ }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.borderTopWidth} ${style.borderTopStyle}`;
  })).toBe("0px solid");
  const select = dialog.locator("select").first();
  await expect.poll(() => select.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.borderTopWidth} ${style.borderTopStyle}`;
  })).toBe("1px solid");
});

test("does not trigger shortcuts for CSS-hidden controls", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.addStyleTag({
    content: `
      [data-tool-id="screenshot"],
      [data-tool-id="rulers"] { display: none !important; }
      [data-tool-id="settings"] { visibility: hidden !important; }
    `,
  });

  await page.keyboard.press("c");
  await expect(page.getByRole("application", { name: "Screenshot selection" })).toHaveCount(0);

  await page.keyboard.press("r");
  await expect(page.locator("[data-mesurer-rulers]")).toHaveCount(0);

  await page.keyboard.press("Control+,");
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
});

test("disables feature controls and their shortcuts", async ({ page }) => {
  await page.goto("/e2e/fixtures/feature-flags.html");

  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rulers (R)" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Settings/ })).toHaveCount(0);

  await page.keyboard.press("c");
  await expect(page.getByRole("application", { name: "Screenshot selection" })).toHaveCount(0);

  await page.keyboard.press("r");
  await expect(page.locator("[data-mesurer-rulers]")).toHaveCount(0);

  await page.keyboard.press("Control+,");
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
});

test("Inspect shows typography details in the info card", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateSelect(page);
  await expect(page.getByRole("button", { name: "Typography (A)" })).toHaveCount(0);

  const target = page.getByRole("button", { name: "Underlying app button" });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await page.mouse.click(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);

  const card = page.locator("[data-mesurer-inspect-info-card]");
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 255, 255)");
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).cursor)).toBe("default");
  await expect.poll(() => card.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.borderTopWidth} ${style.borderTopStyle}`;
  })).toBe("0px solid");
  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();
  const hitTarget = await card.evaluate((node, point) => {
    const root = node.getRootNode();
    const element = root instanceof ShadowRoot ? root.elementFromPoint(point.x, point.y) : document.elementFromPoint(point.x, point.y);
    return { matched: element?.closest("[data-mesurer-inspect-info-card]") !== null, tag: element?.tagName, className: element?.className };
  }, { x: cardBox!.x + cardBox!.width / 2, y: cardBox!.y + cardBox!.height / 2 });
  expect(hitTarget.matched).toBe(true);
  await card.hover();
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
  await expect(page.locator("[data-mesurer-hover='true']")).toHaveCount(0);
  await expect(card).toContainText("Family");
  const familyValue = card.getByRole("button", { name: "Arial" });
  await expect(familyValue).toBeVisible();
  await expect(card).toContainText("Size");
  await expect(card).toContainText("Weight");
  await expect(card).toContainText("Line");
  await expect(card).toContainText("Tracking");
});

test("Option+S pins the current distance overlay", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateSelect(page);

  const selectedTarget = page.getByRole("button", { name: "Underlying app button" });
  const selectedBox = await selectedTarget.boundingBox();
  expect(selectedBox).not.toBeNull();
  await page.mouse.click(selectedBox!.x + selectedBox!.width / 2, selectedBox!.y + selectedBox!.height / 2);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);

  const hoverTarget = page.getByRole("button", { name: "Secondary app button" });
  const hoverBox = await hoverTarget.boundingBox();
  expect(hoverBox).not.toBeNull();
  await page.keyboard.down("Alt");
  await page.mouse.move(hoverBox!.x + hoverBox!.width / 2, hoverBox!.y + hoverBox!.height / 2);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await page.keyboard.press("s");
  await expect(page.locator("[data-mesurer-held-distance]")).toHaveCount(1);
  await page.keyboard.up("Alt");
  await expect(page.locator("[data-mesurer-held-distance]")).toHaveCount(1);
});

test("Inspect value tooltip appears on hover", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateSelect(page);
  const target = page.getByRole("button", { name: "Underlying app button" });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await page.mouse.click(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);

  const card = page.locator("[data-mesurer-inspect-info-card]");
  const familyValue = card.getByRole("button", { name: "Arial" });
  const familyBox = await familyValue.boundingBox();
  expect(familyBox).not.toBeNull();
  const familyPoint = { x: familyBox!.x + familyBox!.width / 2, y: familyBox!.y + familyBox!.height / 2 };
  await expect.poll(() => card.evaluate((node, point) => {
    const root = node.getRootNode();
    const element = root instanceof ShadowRoot ? root.elementFromPoint(point.x, point.y) : document.elementFromPoint(point.x, point.y);
    return { tag: element?.tagName, text: element?.textContent };
  }, familyPoint)).toMatchObject({ tag: "BUTTON", text: "Arial" });
  await page.mouse.move(20, 20);
  await page.mouse.move(familyPoint.x, familyPoint.y);
  await expect.poll(() => card.locator("[role='tooltip']").evaluateAll((nodes) =>
    nodes.filter((node) => node.className.includes("opacity-100")).length,
  )).toBe(1);
  await expect.poll(() => card.locator("[role='tooltip']").evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node).opacity),
  )).toContain("1");
  await familyValue.click();
  await expect.poll(() => card.locator("[role='tooltip']").evaluateAll((nodes) =>
    nodes.filter((node) => node.textContent === "Copied!" && getComputedStyle(node).opacity === "1").length,
  )).toBe(1);
  const sizeValue = card.getByRole("button", { name: "13.3px" });
  await sizeValue.hover();
  await expect.poll(() => card.locator("[role='tooltip']").evaluateAll((nodes) =>
    nodes.filter((node) => node.textContent === "Copied!" && getComputedStyle(node).opacity === "1").length,
  )).toBe(0);
  await expect.poll(() => card.locator("[role='tooltip']").evaluateAll((nodes) =>
    nodes.filter((node) => node.textContent === "Click to copy" && getComputedStyle(node).opacity === "1").length,
  )).toBe(1);
  await page.mouse.move(20, 20);
  await expect.poll(() => card.locator("[role='tooltip']").evaluateAll((nodes) =>
    nodes.filter((node) => getComputedStyle(node).opacity === "1").length,
  )).toBe(0);
});

test("does not run shortcuts while typing in a page field", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Inspect (I)" }).click();
  const field = page.getByLabel("Page field");
  await field.click();
  await field.press("2");
  await expect(field).toHaveValue("2");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("programmatic page focus releases Mesurer keyboard ownership", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Inspect (I)" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mesurer-keyboard-owned", "1");

  const field = page.getByLabel("Page field");
  await field.evaluate((element) => (element as HTMLInputElement).focus());

  await expect(field).toBeFocused();
  await expect(page.locator("html")).not.toHaveAttribute("data-mesurer-keyboard-owned");
  await field.pressSequentially("Programmatic focus works");
  await expect(field).toHaveValue("Programmatic focus works");
});

test("Escape exits the tool without stealing focus from a page field", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const field = page.getByLabel("Page field");
  await field.focus();
  await page.keyboard.press("Escape");
  await expect(field).toBeFocused();
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("double Escape does not minimize while a page field has focus", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const field = page.getByLabel("Page field");
  await field.focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(field).toBeFocused();
  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
});

test("disables global shortcuts from Settings", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Shortcuts" }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("2");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveCount(0);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Shortcuts" }).click();
  await page.keyboard.press("Escape");
});

test("minimizes to one button and restores the workspace", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();

  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveCount(0);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);

  await page.keyboard.press("2");
  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveCount(0);

  await page.getByRole("button", { name: "Show Mesurer toolbar" }).click();
  await expect(page.getByRole("button", { name: "Guides (G)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
});

test("dragging a toolbar tool moves the toolbar without selecting the tool", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-surface");
  const guides = page.getByRole("button", { name: "Guides (G)" });
  await expect(guides).toHaveAttribute("aria-pressed", "false");
  const before = await toolbar.boundingBox();
  expect(before).not.toBeNull();
  const box = await guides.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 48, startY + 36, { steps: 8 });
  await page.mouse.up();
  const after = await toolbar.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x).toBeGreaterThan(before!.x + 20);
  expect(after!.y).toBeGreaterThan(before!.y + 20);
  await expect(guides).toHaveAttribute("aria-pressed", "false");
  await guides.click();
  await expect(guides).toHaveAttribute("aria-pressed", "true");
});

test("dragging from tabs, Settings, and submenus moves the toolbar", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-surface");

  const dragFrom = async (target: Locator, label: string) => {
    await target.scrollIntoViewIfNeeded();
    const before = await toolbar.boundingBox();
    const box = await target.boundingBox();
    expect(before, `${label} before`).not.toBeNull();
    expect(box, `${label} target`).not.toBeNull();
    if (!before || !box) return;
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 48, startY + 36, { steps: 8 });
    await page.mouse.up();
    const after = await toolbar.boundingBox();
    expect(after, `${label} after`).not.toBeNull();
    if (after) {
      expect(Math.max(Math.abs(after.x - before.x), Math.abs(after.y - before.y)), `${label} movement`).toBeGreaterThan(20);
    }
  };

  await dragFrom(page.getByRole("button", { name: "Select and inspect tools (1)" }), "Inspect tab");
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute("data-value", "inspect");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute("data-value", "annotate");

  const settings = page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ });
  await settings.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await dragFrom(settings, "Settings button");
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);

  await page.getByRole("button", { name: "Select and inspect tools (1)" }).click();
  const guideMenu = page.getByRole("button", { name: "Guide orientation menu" });
  await guideMenu.click();
  await expect(page.getByRole("menuitem", { name: "Horizontal" })).toBeVisible();
  await dragFrom(guideMenu, "Guide menu trigger");
  await expect(page.getByRole("menuitem", { name: "Horizontal" })).toHaveCount(0);
});

test("interrupting minimize restore does not stretch the toolbar", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await page.getByRole("button", { name: "Inspect (I)" }).focus();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();
  const restore = page.getByRole("button", { name: "Show Mesurer toolbar" });
  await expect(restore).toBeVisible();

  await restore.click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(restore).toBeVisible();
  await expect.poll(async () => (await toolbar.boundingBox())?.width ?? 0).toBeLessThan(80);

  await restore.click();
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();
  await restore.click();
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
  await expect.poll(async () => (await toolbar.boundingBox())?.width ?? 0).toBeGreaterThan(200);
});

test("dragging the minimized button does not restore the toolbar", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();

  const restore = page.getByRole("button", { name: "Show Mesurer toolbar" });
  await expect(restore).toBeVisible();
  const box = await restore.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 48, startY + 36);
  await page.mouse.up();

  await expect(restore).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveCount(0);

  await restore.click();
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
});

test("minimized Mesurer does not inspect the page", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();

  const target = page.getByRole("button", { name: "Underlying app button" });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);
  await page.mouse.click(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);

  await expect(page.locator("[data-mesurer-inspect-info-card]")).toHaveCount(0);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(0);
  await expect(page.locator("[data-mesurer-hover='true']")).toHaveCount(0);
});

test("initialState seeds annotations and toolbar state", async ({ page }) => {
  await page.goto("/e2e/fixtures/initial-state.html");

  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toBeVisible();
  await expect(page.locator('[data-mesurer-arrow="true"][data-mesurer-arrow-id="initial-arrow"]')).toHaveCount(1);
  await expect(page.locator('[data-mesurer-text="true"][data-mesurer-text-id="initial-text"]')).toContainText("Initial annotation");
});

test("double Escape minimizes Mesurer", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Inspect (I)" }).focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveCount(0);
});

test("Escape minimizes after the tool has already been dismissed", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Inspect (I)" }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toBeVisible();
});

test("Escape minimizes when idle even if rulers were left on", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Rulers (R)" }).click({ force: true });
  await expect(page.getByRole("button", { name: "Rulers (R)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Rulers (R)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toBeVisible();
});

test("Escape minimizes after inspect selection with a delayed second press", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await activateSelect(page);
  const target = page.getByRole("button", { name: "Underlying app button" });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await page.mouse.click(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toBeVisible();
});

test("Escape exits annotate Select on the first press", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("double Escape minimizes after clicking the page in annotate Select", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.mouse.click(300, 200);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toBeVisible();
});

test("Escape turns off X-ray and rulers with the active inspect tool", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "X-ray (X)" }).click();
  await page.getByRole("button", { name: "Rulers (R)" }).click();
  await expect(page.getByRole("button", { name: "X-ray (X)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Rulers (R)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "X-ray (X)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Rulers (R)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("double Escape minimizes after closing Settings", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Color hex value").first().focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveCount(0);
});

test("switches tool groups with global commands and defaults", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();

  await page.keyboard.press("2");
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.keyboard.press("1");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("switches tool groups when a Mesurer control has focus", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Inspect (I)" }).focus();

  await page.keyboard.press("2");
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );

  await page.keyboard.press("1");
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "inspect",
  );
});

test("handles a native and bridged tool shortcut only once", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    const init = {
      key: "d",
      code: "KeyD",
      location: 0,
      repeat: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    };
    window.dispatchEvent(new KeyboardEvent("keydown", init));
    window.postMessage(
      {
        type: "__MESURER_KEYBOARD_BRIDGE__",
        eventType: "keydown",
        ...init,
      },
      location.origin,
    );
  });

  await expect(page.getByRole("button", { name: "Arrows (D)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Arrows (D)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("switches tool groups with number-row keys on an AZERTY layout", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const inspect = page.getByRole("button", { name: "Inspect (I)" });
  await inspect.focus();

  await inspect.dispatchEvent("keydown", { key: "é", code: "" });
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );

  await page.getByRole("button", { name: "Select (S)" }).dispatchEvent("keydown", {
    key: "&",
    code: "",
  });
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "inspect",
  );
});

test("switching to annotation tools clears inspection overlays", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "X-ray (X)" }).click();

  await page.keyboard.press("2");

  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );
  await expect(page.getByRole("button", { name: "Select (S)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.keyboard.press("1");
  await expect(page.getByRole("button", { name: "X-ray (X)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("Escape closes the guide orientation menu without exiting the active tool", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();

  await page.getByRole("button", { name: "Guide orientation menu" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.press("Escape");

  await expect(menu).toBeHidden();
  await expect(page.getByRole("button", { name: "Guides (G)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("guide orientation menu does not reveal annotate tools", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.getByRole("button", { name: "Guide orientation menu" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Select (S)" })).toBeHidden();
  await page.getByRole("menu").getByText("Horizontal", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Select (S)" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Guides (G)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("remembers the last tool after reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  const arrows = page.getByRole("button", { name: "Arrows (D)" });
  await arrows.click();
  await expect(arrows).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByRole("button", { name: "Arrows (D)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("falls back to Select for an invalid stored tool", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    localStorage.setItem("mesurer-settings", JSON.stringify({
      version: 2,
      settings: { lastToolMode: "invalid" },
      workspace: null,
    }));
  });
  await page.reload();

  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Select tool can inspect SVG elements", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
  await page.getByTestId("svg-rect").click({ force: true });

  await expect(page.locator("[data-mesurer-inspect-info-card]")).toContainText("200 x 80");
  await expect(page.getByText("200 x 80", { exact: true })).toHaveCount(1);
});

const expectSettingsSectionPinned = async (page: Page, id: string) => {
  const panel = page.locator(".mesurer-settings-panel");
  const section = panel.locator(`[data-mesurer-settings-section="${id}"]`);
  await expect(section).toHaveAttribute("data-focused", "true");
  await expect
    .poll(async () => {
      const panelBox = await panel.boundingBox();
      const sectionBox = await section.boundingBox();
      if (!panelBox || !sectionBox) return Number.POSITIVE_INFINITY;
      return sectionBox.y - panelBox.y;
    })
    .toBeLessThan(12);
};

test("placed guides remain visible while host-app clicks pass through", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const guidesButton = page.getByRole("button", { name: "Guides (G)" });
  const underlyingButton = page.getByRole("button", {
    name: "Underlying app button",
  });
  const extensionHost = page.locator("#mesurer-extension-host");
  const overlay = extensionHost.locator(".mesurer-root > div").first();

  await expect(guidesButton).toBeVisible();
  await guidesButton.click();
  await expect(overlay).toHaveCSS("pointer-events", "auto");

  await page.mouse.click(300, 200);
  await page.mouse.click(150, 250);
  await page.keyboard.press("g");

  await expect(overlay).toHaveCSS("pointer-events", "none");
  await expect(overlay).toHaveCSS("opacity", "1");
  await expect(overlay.locator(":scope > div")).toHaveCount(2);
  await expect(extensionHost).toHaveCSS("pointer-events", "none");

  const box = await underlyingButton.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(300, box!.y + box!.height / 2);
  await expect(page.getByTestId("underlying-click-count")).toHaveText("1");

  await guidesButton.click();
  await expect(overlay).toHaveCSS("pointer-events", "auto");
});

test("Selection mode draws a selection rectangle while dragging", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();

  await page.mouse.move(180, 180);
  await page.mouse.down();
  await page.mouse.move(420, 360, { steps: 4 });

  const rectangle = page.locator('[data-mesurer-overlay-marquee="true"]');
  await expect(rectangle).toHaveCount(1);
  const box = await rectangle.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  await page.mouse.up();
  await expect(rectangle).toHaveCount(0);
});

test("x-ray mode outlines the page without hiding the toolbar", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const xrayButton = page.getByRole("button", { name: "X-ray (X)" });
  await xrayButton.click();

  await expect(xrayButton.locator("svg path")).toHaveCount(1);
  await expect(page.locator("body")).toHaveClass(/xray-mode/);
  await expect(xrayButton).toHaveCSS("background-color", "rgb(13, 153, 255)");
  await expect(xrayButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("marketing site starts with the minimized Mesurer toolbar", async ({ page }) => {
  await page.goto("/");

  const restoreButton = page.getByRole("button", { name: "Show Mesurer toolbar" });
  await expect(restoreButton).toBeVisible();
  await expect(restoreButton.locator("svg")).toBeVisible();
});

test("native color picker shows color formats", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return Promise.resolve({ sRGBHex: "#ff0000" });
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");

  await page.getByRole("button", { name: "Sample color (P)" }).click();

  const picker = page.locator(".mesurer-color-picker");
  await expect(picker).toBeVisible();
  await expect(picker).toContainText("#ff0000");
  await expect(picker).toContainText("rgb");
  await expect(picker).toContainText("oklch");
  await expect(picker).not.toContainText("Copied!");

  await page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
});

test("opening a toolbar menu closes the color picker card", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return Promise.resolve({ sRGBHex: "#ff0000" });
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");

  await page.getByRole("button", { name: "Sample color (P)" }).click();
  await expect(page.locator(".mesurer-color-picker")).toBeVisible();
  await page.getByRole("button", { name: "Guide orientation menu" }).click();

  await expect(page.locator(".mesurer-color-picker")).toHaveCount(0);
  await expect(page.getByRole("menu")).toBeVisible();
});

test("falls back to default color formats when persisted formats are invalid", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return Promise.resolve({ sRGBHex: "#ff0000" });
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    localStorage.setItem("mesurer-settings", JSON.stringify({
      version: 2,
      settings: { colorPickerFormats: ["invalid"] },
      workspace: null,
    }));
  });
  await page.reload();
  await page.getByRole("button", { name: "Sample color (P)" }).click();

  const picker = page.locator(".mesurer-color-picker");
  await expect(picker).toContainText("#ff0000");
  await expect(picker).toContainText("rgb");
  await expect(picker).toContainText("oklch");
});

test("falls back to the default swatch for an invalid persisted color", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    localStorage.setItem("mesurer-settings", JSON.stringify({
      version: 2,
      settings: { highlightColor: "not-a-color" },
      workspace: null,
    }));
  });
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  const swatch = dialog.locator("[aria-label='Inspect settings'] input[aria-label='Color color picker']").locator("..");
  await expect(swatch).toHaveCSS(
    "background-color",
    "oklch(0.62 0.18 255)",
  );
});

test("settings color fields update hex and opacity values", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();

  const selection = page.getByRole("region", { name: "Inspect settings" });
  const hex = selection.getByRole("textbox", { name: "Color hex value" });
  const opacity = selection.getByRole("textbox", { name: "Color opacity value" });
  const nativeColor = selection.getByLabel("Color color picker");

  await hex.fill("#FF0000");
  await expect(hex).toHaveValue("FF0000");
  await expect(nativeColor).toHaveValue("#ff0000");

  await opacity.fill("50");
  await expect(opacity).toHaveValue("50%");
  await expect(hex).toHaveValue("FF0000");

  await nativeColor.evaluate((input: HTMLInputElement) => {
    input.value = "#00ff00";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(hex).toHaveValue("00FF00");
  await expect(opacity).toHaveValue("50%");
});

test("copies the selected inspect node selector from settings", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/e2e/fixtures/guide-overlay.html");

  await activateSelect(page);
  const target = page.getByRole("button", { name: "Underlying app button" });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await page.getByRole("button", { name: "Settings" }).click();

  const inspect = page.getByRole("region", { name: "Inspect settings" });
  const mode = inspect.getByRole("combobox", { name: "Info card mode" });
  await expect(mode).toHaveValue("click");
  await page.keyboard.press("Escape");
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);
  await expect(page.locator("[data-mesurer-inspect-selector]")).toHaveCount(0);
  await page.mouse.click(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);
  await expect(page.locator("[data-mesurer-inspect-selector]")).toContainText("button");
  await expect(page.locator("[data-mesurer-selector-copied]")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("button");
});

test("P opens the native color picker", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return Promise.resolve({ sRGBHex: "#00ff00" });
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Sample color (P)" })).toBeVisible();
  await page.keyboard.press("p");

  await expect(page.locator(".mesurer-color-picker")).toContainText("#00ff00");
  await page.keyboard.press("Escape");
  await expect(page.locator(".mesurer-color-picker")).toHaveCount(0);
});

test("C starts screenshot region selection", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toBeVisible();
  await page.keyboard.press("c");
  const selection = page.getByRole("application", { name: "Screenshot selection" });
  await expect(selection).toBeVisible();
  await page.mouse.move(120, 140);
  await page.mouse.down();
  await page.mouse.move(280, 220);
  await expect(selection).toContainText("160 × 80");
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect(selection).toHaveCount(0);
});

test("cancelling screenshot pointer input does not capture", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toBeVisible();
  await page.keyboard.press("c");
  const selection = page.getByRole("application", { name: "Screenshot selection" });
  await expect(selection).toBeVisible();
  await page.mouse.move(120, 140);
  await page.mouse.down();
  await page.mouse.move(280, 220);
  await selection.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId: 1,
      }),
    );
  });
  await page.mouse.up();
  await expect(selection).toHaveCount(0);
  await expect(page.locator(".mesurer-screenshot-preview")).toHaveCount(0);
});

test("screenshot selection captures and copies the selected region", async ({ page }) => {
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 30;
    const context = canvas.getContext("2d");
    context?.fillRect(0, 0, canvas.width, canvas.height);
    const capturePng = canvas.toDataURL("image/png");
    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "test-extension",
          lastError: undefined,
          sendMessage: (_message: unknown, callback: (response: unknown) => void) =>
            callback({ ok: true, dataUrl: capturePng }),
        },
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
       value: {
         write: async (items: ClipboardItems) => {
           const blob = await items[0].getType("image/png");
           const bitmap = await createImageBitmap(blob);
           (window as Window & { __mesurerCaptureSize?: { width: number; height: number } }).__mesurerCaptureSize = {
             width: bitmap.width,
             height: bitmap.height,
           };
           bitmap.close();
         },
       },
    });
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toBeVisible();
  await page.keyboard.press("c");
  const selection = page.getByRole("application", { name: "Screenshot selection" });
  await expect(selection).toBeVisible();
  await page.mouse.move(120, 140);
  await page.mouse.down();
  await page.mouse.move(280, 220);
  await page.mouse.up();
  await expect(page.getByRole("status", { name: "Screenshot copied" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __mesurerCaptureSize?: { width: number; height: number } }).__mesurerCaptureSize))
    .not.toBeUndefined();
  const captureSize = await page.evaluate(() => (window as Window & { __mesurerCaptureSize?: { width: number; height: number } }).__mesurerCaptureSize);
  expect(captureSize).toBeDefined();
  if (!captureSize) return;
  const expectedSize = await page.evaluate(() => ({
    width: Math.max(1, Math.round((160 * 40) / window.innerWidth)),
    height: Math.max(1, Math.round((80 * 30) / window.innerHeight)),
  }));
  expect(captureSize).toEqual(expectedSize);
  await expect(selection).toHaveCount(0);
});

test("screenshot settings support download-only capture", async ({ page }) => {
  await page.addInitScript(() => {
    const onePixelPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "test-extension",
          lastError: undefined,
          sendMessage: (_message: unknown, callback: (response: unknown) => void) =>
            callback({ ok: true, dataUrl: onePixelPng }),
        },
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write: () => Promise.resolve() },
    });
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        (window as Window & { __mesurerDownload?: string }).__mesurerDownload =
          this.download;
      }
      click.call(this);
    };
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("switch", { name: "Copy" }).click();
  await expect(dialog.getByRole("switch", { name: "Copy" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(dialog.getByRole("switch", { name: "Download" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Screenshot (C)" }).click();
  const selection = page.getByRole("application", { name: "Screenshot selection" });
  await expect(selection).toBeVisible();
  await page.mouse.move(280, 220);
  await page.mouse.down();
  await page.mouse.move(120, 140);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __mesurerDownload?: string }).__mesurerDownload))
    .toMatch(/^mesurer-.*\.png$/);
});

test("disabling Mesurer closes screenshot selection", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Screenshot (C)" })).toBeVisible();
  await page.keyboard.press("c");
  const selection = page.getByRole("application", { name: "Screenshot selection" });
  await expect(selection).toBeVisible();
  await page.keyboard.press("m");
  await expect(selection).toHaveCount(0);
});

test("settings button opens and dismisses its popover", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const settings = page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ });
  await settings.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(settings).toHaveAttribute("aria-pressed", "true");
  await settings.click();
  await expect(settings).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);

  await settings.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.mouse.click(16, 400);
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
  await expect(settings).toHaveAttribute("aria-pressed", "false");

  await settings.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.locator("[data-testid='host-border-control']").click({ force: true });
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);

  await settings.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
});

test("settings opens with all sections visible", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const settings = page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ });

  await settings.click();
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Guides (G)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "guides");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Inspect (I)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "inspect");
});

test("Appearance setting switches the Mesurer theme", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: /Settings/ }).click();

  const appearance = page.getByRole("combobox", { name: "Appearance" });
  await appearance.selectOption("dark");
  await expect(page.locator("[data-mesurer-root]")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".mesurer-toolbar-chrome")).toHaveCSS("background-color", "rgb(50, 50, 50)");
  await expect.poll(() => page.locator("[data-mesurer-root]").evaluate((element) => getComputedStyle(element).getPropertyValue("--msr-accent").trim())).toBe("#0c8ce9");
  await expect(page.locator(".mesurer-toolbar-divider").first()).toHaveCSS("background-color", "rgb(74, 74, 74)");
  await expect(page.locator("[data-mesurer-settings-panel]")).toHaveCSS("background-color", "rgb(58, 58, 58)");
  const firstSwitch = page.getByRole("switch").first();
  if (await firstSwitch.getAttribute("aria-checked") === "true") await firstSwitch.click();
  await expect(page.locator('.mesurer-switch-track[data-checked="false"]').first()).toHaveCSS("background-color", "rgb(65, 65, 65)");
  const dangerButton = page.getByRole("button", { name: "Clear workspace" });
  await dangerButton.hover();
  await expect(dangerButton).toHaveCSS("background-color", "rgb(63, 32, 32)");
  await expect(dangerButton).toHaveCSS("color", "rgb(248, 113, 113)");

  await page.getByRole("button", { name: /Settings/ }).click();
  await page.getByRole("button", { name: "Comment menu" }).click();
  await expect(page.getByRole("menu")).toHaveCSS("background-color", "rgb(58, 58, 58)");

  await page.getByRole("button", { name: /Settings/ }).click();
  await appearance.selectOption("light");
  await expect(page.locator("[data-mesurer-root]")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".mesurer-toolbar-chrome")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("opening settings with a tool active pins that tool section", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return new Promise(() => undefined);
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const settings = page.getByRole("button", { name: "Settings" });

  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Arrows (D)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "arrows");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Text (T)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "text");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Select (S)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "inspect");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Select and inspect tools (1)" }).click();
  await page.getByRole("button", { name: "Sample color (P)" }).click();
  await settings.click();
  await expectSettingsSectionPinned(page, "color");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Screenshot (C)" }).click();
  await page.keyboard.press("Control+,");
  await expectSettingsSectionPinned(page, "screenshot");
});

test("color format multi-select supports keyboard navigation", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });
  const trigger = dialog.getByRole("combobox", { name: "Color formats" });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await trigger.press("Enter");

  const listbox = dialog.getByRole("listbox", { name: "Color formats" });
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole("option", { name: "hex" })).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(listbox.getByRole("option", { name: "hsl" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(listbox).toBeVisible();
  await page.getByRole("heading", { name: "Color picker" }).click({ position: { x: 5, y: 5 } });
  await expect(listbox).toBeHidden();
});

test("color picker settings apply selected and copy formats", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return Promise.resolve({ sRGBHex: "#ff0000" });
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();

  const colorSettings = page.getByRole("region", { name: "Color settings" });
  const formats = colorSettings.getByRole("combobox", { name: "Color formats" });
  await formats.click();
  const formatOptions = colorSettings.getByRole("listbox", { name: "Color formats" });
  await formatOptions.getByRole("option", { name: "rgb" }).click();
  await formatOptions.getByRole("option", { name: "oklch" }).click();
  await formatOptions.getByRole("option", { name: "hsl" }).click();
  await colorSettings.getByRole("combobox", { name: "Copy" }).selectOption("hsl");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Sample color (P)" }).click();

  const picker = page.locator(".mesurer-color-picker");
  await expect(picker).toContainText("hsl");
  await expect(picker).toContainText("#ff0000");
  await expect(picker).not.toContainText("rgb");
  await expect(picker).not.toContainText("oklch");
  await expect.poll(() => picker.evaluate((element) => getComputedStyle(element).cursor)).toBe("default");
  const colorValue = picker.getByRole("button").first();
  await expect.poll(() => colorValue.evaluate((element) => getComputedStyle(element).cursor)).toBe("default");
  await colorValue.click();
  await expect(picker).toBeVisible();
  await page.mouse.click(700, 700);
  await expect(picker).toHaveCount(0);
});

test("guide sliders do not drag the toolbar", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.getByRole("button", { name: "Settings" }).click();

  const toolbar = page.locator(".mesurer-toolbar-surface");
  const slider = page.getByRole("slider", { name: "Weight" });
  const sliderContainer = page.locator('[data-slider-container="true"]').filter({ has: slider });
  const before = await toolbar.boundingBox();
  const sliderBox = await slider.boundingBox();
  const sliderContainerBox = await sliderContainer.boundingBox();
  expect(before).not.toBeNull();
  expect(sliderBox).not.toBeNull();
  expect(sliderContainerBox).not.toBeNull();
   expect(sliderBox!.width).toBe(12);
   expect(sliderBox!.height).toBe(12);
  await page.mouse.move(sliderContainerBox!.x + 8, sliderContainerBox!.y + sliderContainerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(sliderContainerBox!.x + sliderContainerBox!.width - 8, sliderContainerBox!.y + sliderContainerBox!.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect(slider).toHaveAttribute("aria-valuenow", "4");
  const valueInput = page.locator("input[aria-label='Weight value']");
  await valueInput.click();
  await valueInput.selectText();
  await valueInput.pressSequentially("3px");
  await expect(valueInput).toHaveValue("3px");
  await valueInput.press("Enter");
  await expect(valueInput).toHaveValue("3px");
  const after = await toolbar.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x).toBe(before!.x);
  expect(after!.y).toBe(before!.y);
});

test("guide pattern renders as a real dashed line", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Dashed guide pattern" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);

  const line = page.locator("[data-mesurer-guide] > div");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveCSS("background-image", /repeating-linear-gradient/);
  await expect(line).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("placing a guide after a held pointer does not retain drag state", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();

  await page.mouse.move(300, 200);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.mouse.click(420, 200);

  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(2);
});

test("placed guides stay visible and update while settings is open", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);

  const line = page.locator("[data-mesurer-guide] > div");
  await expect(line).toHaveCount(1);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(line).toHaveCount(1);
  await expect(page.locator("[data-mesurer-guide]")).toBeVisible();

  await page.getByRole("radio", { name: "Dashed guide pattern" }).click();
  await expect(line).toHaveCSS("background-image", /repeating-linear-gradient/);
});

test("guide context menu removes one guide", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);

  const guide = page.locator("[data-mesurer-guide]").first();
  await guide.click({ button: "right", position: { x: 7, y: 200 } });
  await expect(page.getByRole("menuitem", { name: "Remove guide" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Remove guide" }).click();
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(0);
});

test("guide context menu removes selected guides", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);
  await page.mouse.click(500, 200, { modifiers: ["Shift"] });

  const guides = page.locator("[data-mesurer-guide]");
  await expect(guides).toHaveCount(2);
  await guides.nth(0).click({ modifiers: ["Shift"], position: { x: 7, y: 200 } });
  await guides.nth(1).click({ button: "right", position: { x: 7, y: 200 } });
  await expect(page.getByRole("menuitem", { name: "Remove guides" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Remove guides" }).click();
  await expect(guides).toHaveCount(0);
});

test("guide context menu closes with Escape", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);

  const guide = page.locator("[data-mesurer-guide]").first();
  await guide.click({ button: "right", position: { x: 7, y: 200 } });
  const menu = page.getByRole("menuitem", { name: "Remove guide" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("comments and guide menus do not stay open together", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Comments (M)" }).click();
  await page.mouse.click(620, 480);
  await page.getByRole("textbox", { name: "Comment" }).fill("Initial comment");
  await page.getByRole("button", { name: "Send comment" }).click();
  await expect(page.locator("[data-mesurer-comment-pin]")).toHaveCount(1);

  await page.getByRole("button", { name: "Select and inspect tools (1)" }).click();
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);

  const guide = page.locator("[data-mesurer-guide]").first();
  await guide.click({ button: "right", position: { x: 7, y: 200 } });
  await expect(page.getByRole("menuitem", { name: "Remove guide" })).toBeVisible();

  await page.getByRole("button", { name: "Comment menu" }).click();
  await page.getByRole("menuitem", { name: "Show all comments" }).click();
  await expect(page.getByRole("dialog", { name: "Comments" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Remove guide" })).toHaveCount(0);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Comments" })).toHaveCount(0);

  await page.getByRole("button", { name: "Comment menu" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Show all comments" })).toBeVisible();
});

test("comment dropdown and guide menus do not stay open together", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Comment menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Show all comments" })).toBeVisible();

  await page.getByRole("button", { name: "Guides (G)" }).click();
  await expect(page.getByRole("menuitem", { name: "Show all comments" })).toHaveCount(0);
  await page.getByRole("button", { name: "Guide orientation menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Horizontal" })).toBeVisible();

  await page.getByRole("button", { name: "Comment menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Horizontal" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Show all comments" })).toBeVisible();
});

test("guide and comment submenus close on outside click and trigger reclick", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const commentMenu = page.getByRole("button", { name: "Comment menu" });
  await commentMenu.click();
  await expect(page.getByRole("menuitem", { name: "Show all comments" })).toBeVisible();
  await commentMenu.click();
  await expect(page.getByRole("menuitem", { name: "Show all comments" })).toHaveCount(0);

  await commentMenu.click();
  await expect(page.getByRole("menuitem", { name: "Show all comments" })).toBeVisible();
  await page.mouse.click(240, 240);
  await expect(page.getByRole("menuitem", { name: "Show all comments" })).toHaveCount(0);

  await page.getByRole("button", { name: "Guides (G)" }).click();
  const guideMenu = page.getByRole("button", { name: "Guide orientation menu" });
  await guideMenu.click();
  await expect(page.getByRole("menuitem", { name: "Horizontal" })).toBeVisible();
  await guideMenu.click();
  await expect(page.getByRole("menuitem", { name: "Horizontal" })).toHaveCount(0);

  await guideMenu.click();
  await expect(page.getByRole("menuitem", { name: "Horizontal" })).toBeVisible();
  await page.mouse.click(240, 240);
  await expect(page.getByRole("menuitem", { name: "Horizontal" })).toHaveCount(0);

  const settings = page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ });
  await settings.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await settings.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
});

test("layout guides overlay the page from the toolbar menu", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Layout guides (L)" }).click();
  const dialog = page.getByRole("dialog", { name: "Layout guides" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Layout guide" })).toBeVisible();
  await expect(page.locator("[data-mesurer-layout-guides]")).toBeVisible();
  await expect(page.locator("[data-mesurer-layout-band]")).toHaveCount(5);

  await dialog.getByRole("button", { name: "Add layout guide" }).click();
  await expect(dialog.getByText("5 columns")).toHaveCount(2);

  await dialog.getByText("5 columns").first().click();
  await dialog.getByLabel("Layout guide type").selectOption("grid");
  await expect(page.locator("[data-mesurer-layout-guides]")).toBeVisible();

  await dialog.getByRole("button", { name: "Back to layout guides" }).click();
  await page.getByRole("button", { name: "Layout guides (L)" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-mesurer-layout-guides]")).toBeVisible();
});

test("toolbar tools close Settings", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();

  await page.getByRole("button", { name: "Guides (G)" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
});

test("guide settings show a live preview when no guides are placed", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();

  const guides = page.locator("[data-mesurer-guide]");
  await expect(guides).toHaveCount(2);

  await page.getByRole("radio", { name: "Dashed guide pattern" }).click();
  await expect(guides.locator(":scope > div").first()).toHaveCSS(
    "background-image",
    /repeating-linear-gradient/,
  );

  await expect(guides).toHaveCount(2);
});

test("selection stays visible while settings is open", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
   await activateSelect(page);
  const target = page.getByRole("button", { name: "Underlying app button" });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await page.mouse.click(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
  await page.getByRole("switch", { name: "Hover" }).click();
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);
});

test("rulers stay visible while settings is open", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Rulers (R)" }).click();
  await expect(page.locator("[data-mesurer-rulers]")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator("[data-mesurer-rulers]")).toBeVisible();
  await expect(page.locator("[data-mesurer-rulers]")).toHaveCSS("opacity", "1");
});

test("guides mode never selects page elements", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
   await activateSelect(page);
  const target = page.getByRole("button", { name: "Underlying app button" });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await page.mouse.click(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(1);

  await page.getByRole("button", { name: "Guides (G)" }).click();
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(0);
  await page.mouse.click(300, 200);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
  await expect(page.locator("[data-mesurer-selected-measurement]")).toHaveCount(0);
});

test("Escape closes settings without clearing the workspace", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist=1");
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
});

test("Cmd/Ctrl comma opens settings", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ })).toBeVisible();
  await page.keyboard.press("Control+,");

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
});

test("settings preferences survive a reload", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  const hoverSwitch = page.getByRole("switch", { name: "Hover" });
  await hoverSwitch.click();
  await expect(hoverSwitch).toHaveAttribute("aria-checked", "false");

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("switch", { name: "Hover" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("persist on reload keeps the workspace", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ }).click();
  await page.getByRole("switch", { name: "Persist" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);

  await page.reload();
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
});

test("near-edge rulers reveal when the pointer approaches the edge", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: /Settings \((?:⌘ ,|Ctrl \+ ,)\)/ }).click();
  await page.getByRole("switch", { name: "Edge reveal" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Rulers (R)" }).click();

  const rulers = page.locator("[data-mesurer-rulers]");
  await expect(rulers).toHaveCSS("opacity", "0");
  await page.mouse.move(20, 20);
  await expect(rulers).toHaveCSS("opacity", "1");
});

test("migrates v1 workspace state", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?persist=1");
  await page.evaluate(() => {
    localStorage.setItem("mesurer-state", JSON.stringify({
      version: 1,
      enabled: true,
      toolMode: "none",
      rulersVisible: false,
      guideOrientation: "vertical",
      guides: [{ id: "legacy-guide", orientation: "vertical", position: 180 }],
      selectedGuideIds: [],
      measurements: [],
      activeMeasurement: null,
      heldDistances: [],
    }));
  });
  await page.reload();

  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);
});

test("ignores malformed persisted workspace data", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    localStorage.setItem("mesurer-state", JSON.stringify({
      version: 2,
      settings: { colorPickerFormats: ["invalid", "hex"] },
      workspace: {
        enabled: true,
        toolMode: "invalid",
        guides: [{ broken: true }],
      },
    }));
  });
  await page.reload();

  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(0);
});

test("syncs settings between tabs", async ({ page }) => {
  const secondPage = await page.context().newPage();
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await secondPage.goto("/e2e/fixtures/guide-overlay.html");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Hover" }).click();

  await secondPage.getByRole("button", { name: "Settings" }).click();
  await expect(secondPage.getByRole("switch", { name: "Hover" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await secondPage.close();
});

test("keeps persisted workspaces independent between tabs", async ({ page }) => {
  const secondPage = await page.context().newPage();
  await page.goto("/e2e/fixtures/guide-overlay.html?persist");
  await secondPage.goto("/e2e/fixtures/guide-overlay.html?persist");
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(secondPage.getByRole("button", { name: "Settings" })).toBeVisible();

  const firstTabId = await page.evaluate(() => sessionStorage.getItem("mesurer:tab-id"));
  const secondTabId = await secondPage.evaluate(() => sessionStorage.getItem("mesurer:tab-id"));
  expect(firstTabId).not.toBe(secondTabId);
  await page.evaluate((tabId) => {
    localStorage.setItem(`mesurer-state:${tabId}`, JSON.stringify({ version: 2, settings: {}, workspace: null }));
  }, firstTabId);
  await secondPage.evaluate((tabId) => {
    localStorage.setItem(`mesurer-state:${tabId}`, JSON.stringify({ version: 2, settings: {}, workspace: null }));
  }, secondTabId);
  await expect.poll(async () =>
    page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("mesurer-state:"))),
  ).toHaveLength(2);
  await secondPage.close();
});

test("ruler-created guides snap to regular guides", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Guides (G)" })).toBeVisible();
  await page.getByRole("button", { name: "Guides (G)" }).click();
  await page.mouse.click(300, 200);
  await expect(page.locator("[data-mesurer-guide]")).toHaveCount(1);

  await page.getByRole("button", { name: "Rulers" }).click();
  const verticalRuler = page.locator('[data-mesurer-rulers="true"] > div').nth(1);
  await expect(verticalRuler).toBeVisible();
  const rulerBox = await verticalRuler.boundingBox();
  expect(rulerBox).not.toBeNull();
  const rulerX = rulerBox!.x + rulerBox!.width / 2;
  await verticalRuler.dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    clientX: rulerX,
    clientY: 200,
  });
  await verticalRuler.dispatchEvent("pointermove", {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: 304,
    clientY: 200,
  });
  await verticalRuler.dispatchEvent("pointerup", {
    button: 0,
    pointerId: 1,
    clientX: 304,
    clientY: 200,
  });

  const guides = page.locator("[data-mesurer-guide]");
  await expect(guides).toHaveCount(2);
  const first = await guides.nth(0).boundingBox();
  const second = await guides.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(Math.abs(first!.x - second!.x)).toBeLessThanOrEqual(1);
});

test("shows layout gap and padding when spacing is enabled", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
   await activateSelect(page);

  const target = page.getByTestId("layout-flex");
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const details = page.locator("[data-mesurer-layout-details]");
  await expect(details).toBeVisible();
  await expect(details).toContainText("gap");
  await expect(details).toContainText("8px");
  await expect(details).toContainText("padding");
  await expect(details).toContainText("16px");
});

test("hides layout details when spacing is disabled", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Spacing" }).click();
  await page.keyboard.press("Escape");
   await activateSelect(page);

  const target = page.getByTestId("layout-flex");
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  await expect(page.locator("[data-mesurer-layout-details]")).toHaveCount(0);
});

test("cycles through nested elements on repeated clicks", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Element snap" }).click();
  await page.keyboard.press("Escape");
   await activateSelect(page);

  const target = page.getByTestId("nested-target");
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  await page.mouse.click(x, y);
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toContainText("160 x 80");

  await page.mouse.click(x, y);
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toContainText("200 x 120");
});

test("does not run shortcuts while a page prompt has focus", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?prompt");
  const prompt = page.getByTestId("page-prompt");
  await expect(prompt).toBeVisible();
  await prompt.focus();

  await page.keyboard.press("2");
  await expect(prompt).toHaveValue("2");
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "inspect",
  );
});

test("toolbar tools remain usable when a page prompt refocuses itself", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?prompt");
  const prompt = page.getByTestId("page-prompt");
  await prompt.focus();

  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Text (T)" }).click();
  await expect(page.getByRole("button", { name: "Text (T)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.keyboard.press("g");
  await expect(page.getByRole("button", { name: "Guides (G)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Show Mesurer toolbar" })).toBeVisible();
  await prompt.click();
  await prompt.pressSequentially("Still editable");
  await expect(prompt).toHaveValue("Still editable");
});

test("tool group shortcuts remain usable after clicking the page", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Arrows (D)" }).click();
  await page.mouse.click(420, 180);

  await page.keyboard.press("1");
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "inspect",
  );
});

test("Text editor keeps focus when a page prompt refocuses itself", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html?prompt");
  const prompt = page.getByTestId("page-prompt");
  await prompt.focus();

  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(420, 180);

  const editor = page.getByRole("textbox", { name: "Text annotation" });
  await expect(editor).toBeFocused();
  await editor.pressSequentially("Mesurer text works");
  await expect(editor).toHaveText("Mesurer text works");
  await expect(prompt).toHaveValue("");
});

import { expect, test, type Locator, type Page } from "@playwright/test";

const BREAKPOINT_STYLES = `
  @media (min-width: 640px) { body { outline-color: red; } }
  @media (max-width: 1023.98px) { body { outline-color: blue; } }
  @media (width >= 80rem) { body { outline-color: green; } }
`;

const open = async (page: Page) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.addStyleTag({ content: BREAKPOINT_STYLES });
  await page.getByRole("button", { name: "Responsive (B)" }).click();
  const inspector = page.getByRole("dialog", { name: "Responsive preview" });
  await expect(inspector).toBeVisible();
  return inspector;
};

const frames = (page: Page) => page.locator("iframe[data-mesurer-responsive-frame]");

// The size the page in a preview believes its screen is.
const frameSize = (page: Page, index = 0) =>
  page.frameLocator("iframe[data-mesurer-responsive-frame]").nth(index).locator("html").evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

// How much smaller than its real size a preview is drawn.
const frameScale = async (page: Page, index = 0) =>
  (await frames(page).nth(index).boundingBox())!.width / (await frameSize(page, index)).width;

const addSize = (inspector: Locator, device: string) =>
  inspector.getByRole("combobox", { name: "Add a size" }).selectOption({ label: device });

test("opens the page in a phone-sized preview, and keeps Mesurer out of it", async ({ page }) => {
  const inspector = await open(page);
  await expect(page.getByRole("button", { name: "Responsive (B)" })).toHaveAttribute("aria-pressed", "true");
  await expect(frames(page)).toHaveCount(1);
  await expect(inspector.getByRole("combobox", { name: "Size", exact: true })).toHaveValue("iphone-15");
  await expect.poll(() => frameSize(page)).toEqual({ width: 393, height: 852 });

  const frame = page.frameLocator("iframe[data-mesurer-responsive-frame]").first();
  await expect(frame.locator("body")).toBeVisible();
  await expect(frame.locator("[data-mesurer-root]")).toHaveCount(0);
});

test("keeps the page behind from scrolling while it is open", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.minHeight = "3000px";
  });
  await page.getByRole("button", { name: "Responsive (B)" }).click();
  const inspector = page.getByRole("dialog", { name: "Responsive preview" });
  await expect(inspector).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
  await page.mouse.move(40, 500);
  await page.mouse.wheel(0, 600);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // And gives the page back the way it was.
  await page.keyboard.press("Escape");
  await expect(inspector).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("auto");
});

test("changes a preview's size from its menu and its fields", async ({ page }) => {
  const inspector = await open(page);
  const size = inspector.getByRole("combobox", { name: "Size", exact: true });
  await size.selectOption({ label: "iPhone X" });
  await expect.poll(() => frameSize(page)).toEqual({ width: 375, height: 812 });
  await expect(inspector.getByRole("region", { name: "iPhone X, 375 × 812" })).toBeVisible();

  const width = inspector.getByRole("textbox", { name: "Width" });
  await width.fill("500");
  await width.blur();
  await expect.poll(() => frameSize(page)).toEqual({ width: 500, height: 812 });
  // A size no device has.
  await expect(size).toHaveValue("");
  await expect(inspector.getByRole("region", { name: "Custom, 500 × 812" })).toBeVisible();

  const height = inspector.getByRole("textbox", { name: "Height" });
  await height.fill("600");
  await height.blur();
  await expect.poll(() => frameSize(page)).toEqual({ width: 500, height: 600 });

  // Out of bounds comes back within them.
  await width.fill("50");
  await width.blur();
  await expect.poll(async () => (await frameSize(page)).width).toBe(240);

  // A preview has one menu, and nothing to turn it or zoom it on its own.
  await expect(inspector.getByRole("region").getByRole("combobox")).toHaveCount(1);
  await expect(inspector.getByRole("button", { name: "Rotate" })).toHaveCount(0);
});

test("shows several sizes side by side, added and removed one at a time", async ({ page }) => {
  // Mesurer reaches into the frames of the page it is on: none of that may fail on a preview.
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const inspector = await open(page);
  // The only preview stays.
  await expect(inspector.getByRole("button", { name: "Remove preview" })).toBeDisabled();

  await addSize(inspector, "iPad · 820 × 1180");
  await expect(frames(page)).toHaveCount(2);
  await expect.poll(() => frameSize(page, 1)).toEqual({ width: 820, height: 1180 });
  // The first one was not reloaded or resized by the second.
  await expect.poll(() => frameSize(page, 0)).toEqual({ width: 393, height: 852 });
  // The menu is ready for another.
  await expect(inspector.getByRole("combobox", { name: "Add a size" })).toHaveValue("");

  await inspector.getByRole("region", { name: /^iPhone 15,/ }).getByRole("button", { name: "Remove preview" }).click();
  await expect(frames(page)).toHaveCount(1);
  await expect.poll(() => frameSize(page, 0)).toEqual({ width: 820, height: 1180 });
  expect(errors).toEqual([]);
});

test("draws every preview at one scale, in a row that scrolls sideways", async ({ page }) => {
  const inspector = await open(page);
  await addSize(inspector, "Laptop · 1280 × 800");
  await addSize(inspector, "Full HD · 1920 × 1080");
  await expect(frames(page)).toHaveCount(3);
  await expect.poll(() => frameSize(page, 2)).toEqual({ width: 1920, height: 1080 });

  const scales = [await frameScale(page, 0), await frameScale(page, 1), await frameScale(page, 2)];
  expect(scales[0]).toBeLessThan(1);
  expect(scales[1]).toBeCloseTo(scales[0], 3);
  expect(scales[2]).toBeCloseTo(scales[0], 3);
  // Fitting is the zoom it starts on, and says what it comes to.
  const zoom = inspector.getByRole("combobox", { name: "Zoom", exact: true });
  await expect(zoom).toHaveValue("");
  await expect(zoom.locator("option:checked")).toHaveText(`Fit · ${Math.round(scales[0] * 100)}%`);

  // The largest fits whole in the window, and the row holds the rest.
  const viewport = page.viewportSize()!;
  const largest = (await frames(page).nth(2).boundingBox())!;
  expect(largest.width).toBeLessThanOrEqual(viewport.width);
  expect(largest.y + largest.height).toBeLessThanOrEqual(viewport.height);
  const row = await inspector.locator("section").first().evaluate((section) => {
    const scroller = section.parentElement!.parentElement!;
    return { scrolls: scroller.scrollWidth > scroller.clientWidth, left: scroller.scrollLeft, pageX: window.scrollX };
  });
  expect(row.scrolls).toBe(true);
  // The one just added was brought into view, and the page did not move.
  expect(row.left).toBeGreaterThan(0);
  expect(row.pageX).toBe(0);
});

test("draws the previews at a chosen zoom, and scrolls to what no longer fits", async ({ page }) => {
  const inspector = await open(page);
  await addSize(inspector, "iPad · 820 × 1180");
  const zoom = inspector.getByRole("combobox", { name: "Zoom", exact: true });

  await zoom.selectOption({ label: "100%" });
  await expect.poll(() => frameScale(page, 0)).toBeCloseTo(1, 3);
  await expect.poll(() => frameScale(page, 1)).toBeCloseTo(1, 3);
  // The page still sees the same screen.
  await expect.poll(() => frameSize(page, 1)).toEqual({ width: 820, height: 1180 });
  // Taller than the window now, so the stage scrolls down to the rest.
  const scrolls = await inspector.locator("section").first().evaluate((section) => {
    const scroller = section.parentElement!.parentElement!;
    return scroller.scrollHeight > scroller.clientHeight;
  });
  expect(scrolls).toBe(true);

  await zoom.selectOption({ label: "50%" });
  await expect.poll(() => frameScale(page, 0)).toBeCloseTo(0.5, 3);

  // Kept for the next time it opens, and fitting comes back when asked for.
  await page.keyboard.press("Escape");
  await page.keyboard.press("b");
  await expect(zoom).toHaveValue("0.5");
  await zoom.selectOption({ index: 0 });
  const fitted = await frameScale(page, 1);
  expect(fitted).not.toBeCloseTo(0.5, 2);
  await expect(zoom.locator("option:checked")).toHaveText(`Fit · ${Math.round(fitted * 100)}%`);
});

test("stops adding at six previews", async ({ page }) => {
  const inspector = await open(page);
  for (let count = 1; count < 6; count++) await addSize(inspector, "iPhone SE · 375 × 667");
  await expect(frames(page)).toHaveCount(6);
  await expect(inspector.getByRole("combobox", { name: "Add a size" })).toBeDisabled();
});

test("offers the page's own breakpoints among the sizes, to add one or to set a preview to", async ({ page }) => {
  const inspector = await open(page);
  const add = inspector.getByRole("combobox", { name: "Add a size" });
  // min-width 640, the first width past max-width 1023.98, and 80rem, ahead of the devices.
  await expect(add.locator("optgroup").first()).toHaveAttribute("label", "Breakpoints");
  await expect(add.locator("optgroup[label='Breakpoints'] option")).toHaveText(["640px", "1024px", "1280px"]);

  // A breakpoint is a width: the new preview is as tall as the first.
  await add.selectOption({ label: "1024px" });
  await expect(frames(page)).toHaveCount(2);
  await expect.poll(() => frameSize(page, 1)).toEqual({ width: 1024, height: 852 });
  await expect(inspector.getByRole("region", { name: "1024px, 1024 × 852" })).toBeVisible();

  // And a preview set to one keeps its height.
  const size = inspector.getByRole("region", { name: /^iPhone 15,/ }).getByRole("combobox", { name: "Size", exact: true });
  await size.selectOption({ label: "640px" });
  await expect.poll(() => frameSize(page, 0)).toEqual({ width: 640, height: 852 });
  await expect(inspector.getByRole("region", { name: "640px, 640 × 852" }).getByRole("combobox", { name: "Size", exact: true })).toHaveValue("breakpoint-640");
});

test("lists only devices on a page with no breakpoints", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    for (const sheet of [...document.styleSheets]) (sheet.ownerNode as Element | null)?.remove();
  });
  await page.getByRole("button", { name: "Responsive (B)" }).click();
  const add = page.getByRole("dialog", { name: "Responsive preview" }).getByRole("combobox", { name: "Add a size" });
  expect(await add.locator("optgroup").evaluateAll((groups) => groups.map((group) => group.getAttribute("label")))).toEqual(["Phones", "Tablets", "Desktops"]);
});

test("resizes a preview by dragging its edges", async ({ page }) => {
  const inspector = await open(page);
  const scale = await frameScale(page);
  const edge = await inspector.getByRole("separator", { name: "Resize width" }).boundingBox();
  await page.mouse.move(edge!.x + edge!.width / 2, edge!.y + edge!.height / 2);
  await page.mouse.down();
  await page.mouse.move(edge!.x + edge!.width / 2 + 60, edge!.y + edge!.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  expect((await frameSize(page)).width).toBeCloseTo(393 + 60 / scale, -1);
  expect((await frameSize(page)).height).toBe(852);

  const bottom = await inspector.getByRole("separator", { name: "Resize height" }).boundingBox();
  await page.mouse.move(bottom!.x + bottom!.width / 2, bottom!.y + bottom!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bottom!.x + bottom!.width / 2, bottom!.y + bottom!.height / 2 - 100, { steps: 6 });
  await page.mouse.up();
  expect((await frameSize(page)).height).toBeLessThan(852);
});

test("closes with Escape, its button, B, or a press beside the previews", async ({ page }) => {
  const inspector = await open(page);
  const toggle = page.getByRole("button", { name: "Responsive (B)" });
  // With no tool in hand, so a press on the stage is a press on the stage.
  const inspect = page.getByRole("button", { name: "Inspect (I)" });
  if ((await inspect.getAttribute("aria-pressed")) === "true") await inspect.click();

  await page.keyboard.press("Escape");
  await expect(inspector).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await page.keyboard.press("b");
  await expect(inspector).toBeVisible();
  await inspector.getByRole("button", { name: "Close responsive preview" }).click();
  await expect(inspector).toHaveCount(0);

  await page.keyboard.press("b");
  await expect(inspector).toBeVisible();
  await page.keyboard.press("b");
  await expect(inspector).toHaveCount(0);

  await toggle.click();
  await expect(inspector).toBeVisible();
  await page.mouse.click(60, 600);
  await expect(inspector).toHaveCount(0);
});

test("reopens with the previews as they were left", async ({ page }) => {
  const inspector = await open(page);
  await inspector.getByRole("combobox", { name: "Size", exact: true }).selectOption({ label: "Pixel 8" });
  await addSize(inspector, "iPad mini · 744 × 1133");

  await page.keyboard.press("b");
  await expect(inspector).toHaveCount(0);
  await page.keyboard.press("b");
  await expect(frames(page)).toHaveCount(2);
  await expect.poll(() => frameSize(page, 0)).toEqual({ width: 412, height: 915 });
  await expect.poll(() => frameSize(page, 1)).toEqual({ width: 744, height: 1133 });
});

test("inspects an element inside a preview, at the size it has there", async ({ page }) => {
  const inspector = await open(page);
  await inspector.getByRole("combobox", { name: "Size", exact: true }).selectOption({ label: "Laptop" });
  await expect.poll(() => frameSize(page)).toEqual({ width: 1280, height: 800 });
  const inspect = page.getByRole("button", { name: "Inspect (I)" });
  if ((await inspect.getAttribute("aria-pressed")) !== "true") await inspect.click();
  // A tool in hand leaves the previews open.
  await expect(inspector).toBeVisible();

  const scale = await frameScale(page);
  expect(scale).toBeLessThan(1);
  const target = page.frameLocator("iframe[data-mesurer-responsive-frame]").first().getByRole("button", { name: "Nested inner button" });
  // Where it is drawn, in the scaled preview, and the size the page gives it there.
  const drawn = (await target.boundingBox())!;
  const real = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  });
  expect(drawn.width).toBeCloseTo(real.width * scale, 0);

  const point = { x: drawn.x + drawn.width / 2, y: drawn.y + drawn.height / 2 };
  await page.mouse.move(point.x, point.y, { steps: 4 });
  // The highlight is drawn on the element, where it is on screen.
  const hover = (await page.locator("[data-mesurer-hover='true']").first().boundingBox())!;
  expect(hover.x).toBeCloseTo(drawn.x, 0);
  expect(hover.y).toBeCloseTo(drawn.y, 0);
  expect(hover.width).toBeCloseTo(drawn.width, 0);
  expect(hover.height).toBeCloseTo(drawn.height, 0);

  await page.mouse.click(point.x, point.y);
  const card = page.locator("[data-mesurer-inspect-info-card]");
  await expect(card).toBeVisible();
  // And the card tells the size it has on that screen, not the size it is drawn at.
  await expect(card).toContainText(`${real.width} x ${real.height}`);
  await expect(card).not.toContainText(`${Math.round(drawn.width)} x ${Math.round(drawn.height)}`);
});

test("puts the page's annotations away while the previews are open, and leaves for a tool that draws on the page", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  // An arrow and a note on the page, where the previews will be.
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Arrows (D)" }).click();
  await page.mouse.move(500, 300);
  await page.mouse.down();
  await page.mouse.move(800, 420, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(620, 240);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("On the page");
  await page.keyboard.press("Escape");
  const arrows = page.locator("[data-mesurer-arrow]");
  const notes = page.locator("[data-mesurer-text]");
  await expect(arrows).toHaveCount(1);
  await expect(notes).toHaveCount(1);

  // Its button is in the other tool group just now: the shortcut reaches it from either.
  await page.keyboard.press("b");
  const inspector = page.getByRole("dialog", { name: "Responsive preview" });
  await expect(inspector).toBeVisible();
  await expect(arrows).toHaveCount(0);
  await expect(notes).toHaveCount(0);

  // Nothing is in the way of the page in a preview: with no tool in hand it is used as a page.
  await inspector.getByRole("combobox", { name: "Size", exact: true }).selectOption({ label: "Laptop" });
  const frame = page.frameLocator("iframe[data-mesurer-responsive-frame]").first();
  await frame.getByRole("button", { name: "Underlying app button" }).click();
  await expect(frame.getByTestId("underlying-click-count")).toHaveText("1");
  await expect(page.getByTestId("underlying-click-count")).toHaveText("0");

  // A tool that draws on the page goes back to it, with what was drawn there.
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Arrows (D)" }).click();
  await expect(inspector).toHaveCount(0);
  await expect(arrows).toHaveCount(1);
  await expect(notes).toHaveCount(1);
});

test("leaves the previews for the guides and the rulers, which measure the page", async ({ page }) => {
  const inspector = await open(page);
  await page.keyboard.press("g");
  await expect(inspector).toHaveCount(0);

  await page.keyboard.press("b");
  await expect(inspector).toBeVisible();
  await page.getByRole("button", { name: "Guide orientation menu" }).click();
  await page.getByRole("menuitem", { name: "Rulers" }).click();
  await expect(inspector).toHaveCount(0);
});

test("leaves the page behind the previews alone: nothing in it is inspected", async ({ page }) => {
  const inspector = await open(page);
  const inspect = page.getByRole("button", { name: "Inspect (I)" });
  if ((await inspect.getAttribute("aria-pressed")) !== "true") await inspect.click();

  // Over the stage, beside the preview, where the page's own button is underneath.
  const behind = (await page.getByRole("button", { name: "Underlying app button" }).boundingBox())!;
  const frame = (await frames(page).first().boundingBox())!;
  const point = { x: behind.x + 12, y: behind.y + behind.height / 2 };
  expect(point.x < frame.x || point.x > frame.x + frame.width || point.y < frame.y || point.y > frame.y + frame.height).toBe(true);

  await page.mouse.move(point.x, point.y, { steps: 4 });
  await expect(page.locator("[data-mesurer-hover='true']")).toHaveCount(0);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toHaveCount(0);
  await expect(page.getByTestId("underlying-click-count")).toHaveText("0");
  await expect(inspector).toBeVisible();
});

test("drops what was selected on the page when the previews open", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const inspect = page.getByRole("button", { name: "Inspect (I)" });
  if ((await inspect.getAttribute("aria-pressed")) !== "true") await inspect.click();
  const target = (await page.getByTestId("nested-target").boundingBox())!;
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toBeVisible();

  await page.keyboard.press("b");
  await expect(page.getByRole("dialog", { name: "Responsive preview" })).toBeVisible();
  await expect(page.locator("[data-mesurer-inspect-info-card]")).toHaveCount(0);
});

test("scrolls the preview under the pointer while a tool has the pointer", async ({ page }) => {
  const inspector = await open(page);
  const inspect = page.getByRole("button", { name: "Inspect (I)" });
  if ((await inspect.getAttribute("aria-pressed")) !== "true") await inspect.click();
  const frame = page.frameLocator("iframe[data-mesurer-responsive-frame]").first();
  await frame.locator("body").evaluate((body) => { body.style.minHeight = "4000px"; });
  const box = (await frames(page).first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => frame.locator("html").evaluate(() => window.scrollY)).toBeGreaterThan(100);
  // The page behind stays where it is.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(inspector).toBeVisible();
});

test("opens on a page that has a frame from another origin", async ({ page }) => {
  // React's development build reads through a component's props. A window among them leads it
  // into the page's frames, and one it may not read stops it with an error.
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "");
    frame.srcdoc = "<p>opaque</p>";
    document.body.prepend(frame);
  });
  await page.getByRole("button", { name: "Responsive (B)" }).click();
  const inspector = page.getByRole("dialog", { name: "Responsive preview" });
  await expect(inspector).toBeVisible();
  await addSize(inspector, "iPad · 820 × 1180");
  await expect(frames(page)).toHaveCount(2);
  await expect.poll(() => frameSize(page, 1)).toEqual({ width: 820, height: 1180 });
  expect(errors).toEqual([]);
});

test("shows X-ray in every preview", async ({ page }) => {
  const inspector = await open(page);
  await addSize(inspector, "iPad · 820 × 1180");
  await page.getByRole("button", { name: "X-ray (X)" }).click();
  await expect(page.getByRole("button", { name: "X-ray (X)" })).toHaveAttribute("aria-pressed", "true");
  for (const index of [0, 1]) {
    await expect(page.frameLocator("iframe[data-mesurer-responsive-frame]").nth(index).locator("body")).toHaveClass(/xray-mode/);
  }
  await expect(inspector).toBeVisible();
});

test("draws the layout guides in each preview, at its own size", async ({ page }) => {
  const inspector = await open(page);
  await addSize(inspector, "iPad · 820 × 1180");
  await page.keyboard.press("l");
  await expect(page.getByRole("dialog", { name: "Layout guides" })).toBeVisible();

  // Not across the window, but once in each preview, as wide as that preview.
  const guides = page.locator("[data-mesurer-layout-guides]");
  await expect(guides).toHaveCount(2);
  for (const index of [0, 1]) {
    const frame = (await frames(page).nth(index).boundingBox())!;
    const drawn = (await guides.nth(index).boundingBox())!;
    expect(drawn.x).toBeCloseTo(frame.x, 0);
    expect(drawn.width).toBeCloseTo(frame.width, 0);
    expect(drawn.height).toBeCloseTo(frame.height, 0);
  }

  // Closed, they are the page's again.
  await page.keyboard.press("Escape");
  await page.keyboard.press("b");
  await expect(inspector).toHaveCount(0);
  await expect(guides).toHaveCount(1);
  expect((await guides.boundingBox())!.width).toBe(page.viewportSize()!.width);
});

test("reorders the previews by dragging one, or from the keyboard, without reloading them", async ({ page }) => {
  const inspector = await open(page);
  await addSize(inspector, "iPad · 820 × 1180");
  await addSize(inspector, "iPhone SE · 375 × 667");
  await expect.poll(() => frameSize(page, 2)).toEqual({ width: 375, height: 667 });
  // Something a reload would lose.
  for (const index of [0, 1, 2]) {
    await page.frameLocator("iframe[data-mesurer-responsive-frame]").nth(index).locator("html").evaluate((root, mark) => {
      (window as Window & { mark?: number }).mark = mark;
    }, index);
  }
  // The previews from left to right, by name.
  const order = () =>
    inspector.getByRole("region").evaluateAll((sections) =>
      sections
        .map((section) => ({ left: section.getBoundingClientRect().left, name: section.getAttribute("aria-label")!.split(",")[0] }))
        .sort((a, b) => a.left - b.left)
        .map((section) => section.name),
    );
  expect(await order()).toEqual(["iPhone 15", "iPad", "iPhone SE"]);

  // The last one, dragged by its grip to the front.
  const grip = inspector.getByRole("region", { name: /^iPhone SE,/ }).getByRole("button", { name: "Move preview", exact: true });
  const from = (await grip.boundingBox())!;
  const first = (await inspector.getByRole("region", { name: /^iPhone 15,/ }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + 10, from.y + from.height / 2, { steps: 12 });
  await page.mouse.up();
  expect(await order()).toEqual(["iPhone SE", "iPhone 15", "iPad"]);

  // And one place along from the keyboard.
  await grip.focus();
  await page.keyboard.press("ArrowRight");
  expect(await order()).toEqual(["iPhone 15", "iPhone SE", "iPad"]);
  // It stops at the end of the row.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect(await order()).toEqual(["iPhone 15", "iPad", "iPhone SE"]);

  // None of them loaded again.
  const marks = [];
  for (const index of [0, 1, 2]) {
    marks.push(await page.frameLocator("iframe[data-mesurer-responsive-frame]").nth(index).locator("html").evaluate(() => (window as Window & { mark?: number }).mark));
  }
  expect(marks).toEqual([0, 1, 2]);
});

// Answers a preview's own load of the page, and leaves the page itself alone.
const answerPreview = (page: Page, response: { headers?: Record<string, string>; body: string }) =>
  page.route("**/e2e/fixtures/guide-overlay.html", (route) =>
    route.request().frame() === page.mainFrame()
      ? route.continue()
      : route.fulfill({ contentType: "text/html", ...response }),
  );

test("says so when the page refuses to be shown in a frame", async ({ page }) => {
  await answerPreview(page, { headers: { "x-frame-options": "DENY" }, body: "<p>never shown</p>" });
  const inspector = await open(page);
  await expect(inspector.getByText("This page does not allow itself to be shown in a preview.")).toBeVisible();
});

test("keeps a page in a preview from taking over the tab", async ({ page }) => {
  await answerPreview(page, {
    body: `<p id="framed">framed</p><script>try { top.location = "/e2e/fixtures/guide-overlay.html?busted" } catch (error) { document.title = "blocked" }</script>`,
  });
  await open(page);
  const frame = page.frameLocator("iframe[data-mesurer-responsive-frame]").first();
  await expect(frame.locator("#framed")).toBeVisible();
  await expect.poll(() => frame.locator("html").evaluate(() => document.title)).toBe("blocked");
  expect(page.url()).not.toContain("busted");
});

test("closes when Mesurer is minimized", async ({ page }) => {
  const inspector = await open(page);
  await page.getByRole("button", { name: /Settings/ }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();
  await expect(inspector).toHaveCount(0);
});

test("switches Inspect off and on again inside the previews", async ({ page }) => {
  const inspector = await open(page);
  const inspect = page.getByRole("button", { name: "Inspect (I)" });
  if ((await inspect.getAttribute("aria-pressed")) !== "true") await inspect.click();
  await expect(inspect).toHaveAttribute("aria-pressed", "true");

  await inspect.click();
  await expect(inspect).toHaveAttribute("aria-pressed", "false");
  await expect(inspector).toBeVisible();
  await inspect.click();
  await expect(inspect).toHaveAttribute("aria-pressed", "true");
});

test("with a tool in hand, goes down a preview without sliding the row, and slides the row from over a preview", async ({ page }) => {
  const inspector = await open(page);
  await addSize(inspector, "Laptop · 1280 × 800");
  await addSize(inspector, "Full HD · 1920 × 1080");
  await expect(frames(page)).toHaveCount(3);
  await expect.poll(() => frameSize(page, 2)).toEqual({ width: 1920, height: 1080 });
  const inspect = page.getByRole("button", { name: "Inspect (I)" });
  if ((await inspect.getAttribute("aria-pressed")) !== "true") await inspect.click();

  const rowLeft = () =>
    inspector.locator("section").first().evaluate((section) => section.parentElement!.parentElement!.scrollLeft);
  // The row stands at its end, on the preview that was added last.
  const start = await rowLeft();
  expect(start).toBeGreaterThan(0);
  const frame = page.frameLocator("iframe[data-mesurer-responsive-frame]").nth(2);
  await frame.locator("body").evaluate((body) => { body.style.minHeight = "4000px"; });
  const box = (await frames(page).nth(2).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await page.mouse.wheel(0, 300);
  await expect.poll(() => frame.locator("html").evaluate(() => window.scrollY)).toBeGreaterThan(100);
  expect(await rowLeft()).toBe(start);

  await page.mouse.wheel(-300, 0);
  await expect.poll(rowLeft).toBeLessThan(start);
  expect(await frame.locator("html").evaluate(() => window.scrollX)).toBe(0);
});

test("comments on a preview, and copies it under that preview's page and size", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const inspector = await open(page);
  await inspector.getByRole("combobox", { name: "Size", exact: true }).selectOption({ label: "Laptop" });
  await expect.poll(() => frameSize(page)).toEqual({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Comments (M)" }).click();
  // Commenting leaves the previews open.
  await expect(inspector).toBeVisible();

  const target = page.frameLocator("iframe[data-mesurer-responsive-frame]").first().getByRole("button", { name: "Nested inner button" });
  const box = (await target.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole("textbox", { name: "Comment" }).fill("Too small here.");
  await page.getByRole("textbox", { name: "Comment" }).press("Enter");
  const pins = page.locator("[data-mesurer-comment-pin]");
  await expect(pins).toHaveCount(1);

  await page.keyboard.press("ControlOrMeta+k");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Too small here.");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  // Under the preview's own size, not the window's, and by the element's place in the page.
  expect(copied).toContain(
    `URL: ${page.url()}\nViewport: 1280 × 800 CSS px\n\n1. Too small here.\n[<button>Nested inner button</button> selector:`,
  );
  expect(copied.match(/Viewport:/g)).toHaveLength(1);

  // Escape closes what is open over the previews before the previews.
  await pins.click();
  const thread = page.locator("[data-mesurer-comment-popover]");
  await expect(thread).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(thread).toHaveCount(0);
  await expect(inspector).toBeVisible();

  // The comment belongs to the preview: it goes with the previews, and is back with them.
  const toggle = page.getByRole("button", { name: "Responsive (B)" });
  await toggle.click();
  await expect(inspector).toHaveCount(0);
  await expect(pins).toHaveCount(0);
  await toggle.click();
  await expect(inspector).toBeVisible();
  await expect(pins).toHaveCount(1);
});

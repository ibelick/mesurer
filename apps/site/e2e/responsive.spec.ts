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
  await expect(inspector.getByRole("combobox", { name: "Device" })).toHaveValue("iphone-15");
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

test("changes a preview's size from its device menu, its fields and rotate", async ({ page }) => {
  const inspector = await open(page);
  const device = inspector.getByRole("combobox", { name: "Device" });
  await device.selectOption({ label: "iPhone X" });
  await expect.poll(() => frameSize(page)).toEqual({ width: 375, height: 812 });
  await expect(inspector.getByRole("region", { name: "iPhone X, 375 × 812" })).toBeVisible();

  await inspector.getByRole("button", { name: "Rotate" }).click();
  await expect.poll(() => frameSize(page)).toEqual({ width: 812, height: 375 });
  // Still the same phone, turned.
  await expect(device).toHaveValue("iphone-x");

  const width = inspector.getByRole("textbox", { name: "Width" });
  await width.fill("500");
  await width.blur();
  await expect.poll(() => frameSize(page)).toEqual({ width: 500, height: 375 });
  // A size no device has.
  await expect(device).toHaveValue("");
  await expect(inspector.getByRole("region", { name: "Custom, 500 × 375" })).toBeVisible();

  // Out of bounds comes back within them.
  await width.fill("50");
  await width.blur();
  await expect.poll(async () => (await frameSize(page)).width).toBe(240);
});

test("shows several sizes side by side, added and removed one at a time", async ({ page }) => {
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

test("gives one preview a zoom of its own, and the rest keep the shared one", async ({ page }) => {
  const inspector = await open(page);
  await addSize(inspector, "iPad · 820 × 1180");
  const shared = await frameScale(page, 1);
  const own = inspector.getByRole("region", { name: /^iPhone 15,/ }).getByRole("combobox", { name: "Preview zoom" });
  // It follows the shared zoom until it is given one.
  await expect(own).toHaveValue("");
  await expect(own.locator("option:checked")).toHaveText("Auto");

  await own.selectOption({ label: "100%" });
  await expect.poll(() => frameScale(page, 0)).toBeCloseTo(1, 3);
  expect(await frameScale(page, 1)).toBeCloseTo(shared, 3);
  await expect.poll(() => frameSize(page, 0)).toEqual({ width: 393, height: 852 });

  // The shared zoom moves the others and leaves this one alone.
  await inspector.getByRole("combobox", { name: "Zoom", exact: true }).selectOption({ label: "25%" });
  await expect.poll(() => frameScale(page, 1)).toBeCloseTo(0.25, 3);
  expect(await frameScale(page, 0)).toBeCloseTo(1, 3);

  // Back to following it, and it keeps its zoom through a change of size.
  await own.selectOption({ label: "50%" });
  await inspector.getByRole("region", { name: /^iPhone 15,/ }).getByRole("button", { name: "Rotate" }).click();
  await expect.poll(() => frameScale(page, 0)).toBeCloseTo(0.5, 3);
  await own.selectOption({ label: "Auto" });
  await expect.poll(() => frameScale(page, 0)).toBeCloseTo(0.25, 3);
});

test("stops adding at six previews", async ({ page }) => {
  const inspector = await open(page);
  for (let count = 1; count < 6; count++) await addSize(inspector, "iPhone SE · 375 × 667");
  await expect(frames(page)).toHaveCount(6);
  await expect(inspector.getByRole("combobox", { name: "Add a size" })).toBeDisabled();
  await expect(inspector.getByRole("group", { name: "Breakpoints" }).getByRole("button").first()).toBeDisabled();
});

test("lists the page's own breakpoints, and adds a preview at one", async ({ page }) => {
  const inspector = await open(page);
  const breakpoints = inspector.getByRole("group", { name: "Breakpoints" });
  // min-width 640, the first width past max-width 1023.98, and 80rem.
  for (const width of ["640", "1024", "1280"]) {
    await expect(breakpoints.getByRole("button", { name: width, exact: true })).toBeVisible();
  }
  // A phone is below every one of them.
  await expect(breakpoints.locator("[aria-pressed='true']")).toHaveCount(0);

  await breakpoints.getByRole("button", { name: "1024", exact: true }).click();
  await expect(frames(page)).toHaveCount(2);
  await expect.poll(() => frameSize(page, 1)).toEqual({ width: 1024, height: 852 });
  await expect(breakpoints.getByRole("button", { name: "1024", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(breakpoints.locator("[aria-pressed='true']")).toHaveCount(1);
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

test("closes with Escape, its button, B, a press beside the previews, or by picking a tool", async ({ page }) => {
  const inspector = await open(page);
  const toggle = page.getByRole("button", { name: "Responsive (B)" });

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

  // Another tool takes over from the previews.
  await toggle.click();
  await expect(inspector).toBeVisible();
  await page.getByRole("button", { name: "Inspect (I)" }).click();
  await expect(inspector).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute("aria-pressed", "true");
});

test("gives back the tool that was in use, and the previews as they were left", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const inspect = page.getByRole("button", { name: "Inspect (I)" });
  if ((await inspect.getAttribute("aria-pressed")) !== "true") await inspect.click();
  await page.getByRole("button", { name: "Responsive (B)" }).click();
  const inspector = page.getByRole("dialog", { name: "Responsive preview" });
  await expect(inspect).toHaveAttribute("aria-pressed", "false");
  await inspector.getByRole("combobox", { name: "Device" }).selectOption({ label: "Pixel 8" });
  await addSize(inspector, "iPad mini · 744 × 1133");

  await page.keyboard.press("Escape");
  await expect(inspect).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("b");
  await expect(frames(page)).toHaveCount(2);
  await expect.poll(() => frameSize(page, 0)).toEqual({ width: 412, height: 915 });
  await expect.poll(() => frameSize(page, 1)).toEqual({ width: 744, height: 1133 });
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

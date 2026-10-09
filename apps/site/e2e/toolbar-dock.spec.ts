import { expect, test, type Locator, type Page } from "@playwright/test";

const setDock = async (page: Page, dock: "free" | "snap") => {
  const settings = page.getByRole("dialog", { name: "Settings" });
  if (!(await settings.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Settings" }).click();
  }
  await page.getByLabel("Toolbar dock").selectOption(dock);
  await page.keyboard.press("Escape");
};

const dragBy = async (page: Page, toolbar: Locator, dx: number, dy: number) => {
  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  const startX = box.x + box.width / 2;
  const startY = box.y + 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
  await page.mouse.up();
  // Long enough for a release glide or a turn to finish.
  await page.waitForTimeout(450);
};

// Carries the toolbar by its middle until the pointer is at the given spot: edges glue from the pointer.
const dragTo = async (page: Page, toolbar: Locator, x: number, y: number) => {
  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(450);
};

// The color picker samples through the browser's eyedropper, which a test cannot drive.
const mockEyeDropper = (page: Page) =>
  page.addInitScript(() => {
    class MockEyeDropper {
      open() {
        return Promise.resolve({ sRGBHex: "#336699" });
      }
    }
    (window as Window & { EyeDropper?: typeof MockEyeDropper }).EyeDropper = MockEyeDropper;
  });

type Edge = "top" | "left" | "right" | "bottom";
type Box = { x: number; y: number; width: number; height: number };

// A pointer spot close enough to each edge of the test viewport to glue the toolbar there.
const EDGE_SPOTS: [edge: Edge, x: number, y: number][] = [
  ["top", 550, 30],
  ["left", 30, 350],
  ["right", 1070, 350],
  ["bottom", 550, 670],
];

// Drags the toolbar by its middle onto an edge and waits for it to settle there.
const glueTo = async (page: Page, toolbar: Locator, [edge, x, y]: (typeof EDGE_SPOTS)[number]) => {
  const start = await toolbar.boundingBox();
  if (!start) throw new Error("toolbar not visible");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(550, 350, { steps: 5 });
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
  await expect(toolbar).toHaveAttribute("data-edge", edge);
  await page.waitForTimeout(450);
  const bar = await toolbar.boundingBox();
  if (!bar) throw new Error("toolbar not visible");
  return bar;
};

// A surface belongs 4px off the bar on the side facing the page, between the bar's two ends
// unless it is longer than the bar.
const expectAgainstBar = (edge: Edge, bar: Box, box: Box | null, label: string) => {
  if (!box) throw new Error(`${label} is not on screen`);
  const gap = {
    top: box.y - (bar.y + bar.height),
    bottom: bar.y - (box.y + box.height),
    left: box.x - (bar.x + bar.width),
    right: bar.x - (box.x + box.width),
  }[edge];
  expect(Math.round(gap), label).toBe(4);
  const vertical = edge === "left" || edge === "right";
  const [barStart, barEnd] = vertical ? [bar.y, bar.y + bar.height] : [bar.x, bar.x + bar.width];
  const [start, end] = vertical ? [box.y, box.y + box.height] : [box.x, box.x + box.width];
  if (end - start > barEnd - barStart) return;
  expect(start, label).toBeGreaterThanOrEqual(barStart - 1);
  expect(end, label).toBeLessThanOrEqual(barEnd + 1);
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
});

test("free mode keeps the toolbar wherever it is dropped", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();

  await dragBy(page, toolbar, 300, 200);
  const box = await toolbar.boundingBox();
  expect(box?.x).toBeGreaterThan(200);
  expect(box?.y).toBeGreaterThan(150);
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
});

test("snap mode glues to the left edge and slides vertically along it", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");

  // Pull the toolbar away from the top edge and close to the left edge.
  const box = await toolbar.boundingBox();
  await dragTo(page, toolbar, 30, 350);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  const glued = await toolbar.boundingBox();
  expect(glued?.x).toBe(16);
  // Turned on its side, the bar keeps the size it had lying down.
  expect(glued?.width).toBe(box?.height);
  expect(glued?.height).toBe(box?.width);
  // Released glued toolbars settle in the middle of the edge.
  expect(Math.abs((glued?.y ?? 0) + (glued?.height ?? 0) / 2 - 350)).toBeLessThan(2);

  // Moving along the glued edge changes only the vertical position, while the pointer is down.
  const grab = await toolbar.boundingBox();
  const startX = (grab?.x ?? 0) + (grab?.width ?? 0) / 2;
  const startY = (grab?.y ?? 0) + (grab?.height ?? 0) / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + 80, { steps: 10 });
  const slid = await toolbar.boundingBox();
  expect(slid?.x).toBe(16);
  expect(slid?.y).toBeGreaterThan(glued?.y ?? 0);
  await page.mouse.up();
  await page.waitForTimeout(320);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");

  // The glue survives a reload.
  await page.reload();
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await expect.poll(async () => (await toolbar.boundingBox())?.x).toBe(16);
});

test("a toolbar pulled off its edge is free while dragged, and glues to the nearest zone when let go", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");

  const box = await toolbar.boundingBox();
  await dragTo(page, toolbar, 30, 350);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");

  // Off the edge it is free, and still the column it was: the middle of the screen turns nothing.
  const column = await toolbar.boundingBox();
  if (!column) throw new Error("toolbar not visible");
  await page.mouse.move(column.x + column.width / 2, column.y + column.height / 2);
  await page.mouse.down();
  await page.mouse.move(300, 350, { steps: 10 });
  await expect(toolbar).not.toHaveAttribute("data-edge");
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  expect((await toolbar.boundingBox())?.x).toBeGreaterThan(200);
  // Let go there, it does not stay free: it goes back to the nearest zone, the one it left.
  await page.mouse.up();
  await expect(toolbar).toHaveAttribute("data-edge", "left");
  await expect.poll(async () => (await toolbar.boundingBox())?.x).toBe(16);

  // Only the top and bottom zones lay it flat again.
  await dragTo(page, toolbar, 600, 30);
  await expect(toolbar).toHaveAttribute("data-edge", "top");
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
});

test("a vertical toolbar animates the mode switch and minimize along its own axis", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");

  const box = await toolbar.boundingBox();
  await dragTo(page, toolbar, 30, 350);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  const chrome = toolbar.locator(".mesurer-toolbar-chrome");
  const chromeHeight = async () => (await chrome.boundingBox())?.height ?? 0;
  const inspect = await toolbar.boundingBox();

  // Mode switch: the tool track slides on y and the bar resizes in height only.
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await expect(toolbar).toHaveAttribute("data-resizing", "true");
  const trackAnimations = await toolbar.locator(".mesurer-toolbar-tool-track").evaluate((node) =>
    node.getAnimations().map((animation) =>
      (animation.effect as KeyframeEffect).getKeyframes().map((frame) => String(frame.transform)),
    ),
  );
  expect(trackAnimations.flat().every((transform) => transform.startsWith("translateY("))).toBe(true);
  expect(trackAnimations.flat().length).toBeGreaterThan(0);
  await expect(toolbar).not.toHaveAttribute("data-resizing");
  const annotate = await toolbar.boundingBox();
  expect(annotate?.width).toBe(inspect?.width);
  expect(annotate?.height).not.toBe(inspect?.height);
  expect(await chromeHeight()).toBeCloseTo(annotate?.height ?? 0, 0);

  // Minimize: the chrome shrinks in height through intermediate sizes, then restores.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();
  await expect(toolbar).toHaveAttribute("data-resizing", "collapse");
  const midway = await chromeHeight();
  await expect(toolbar).not.toHaveAttribute("data-resizing");
  const minimized = await toolbar.boundingBox();
  expect(minimized?.width).toBe(annotate?.width);
  expect(minimized?.height).toBe(minimized?.width);
  expect(midway).toBeGreaterThan(minimized?.height ?? 0);
  expect(await chromeHeight()).toBeCloseTo(minimized?.height ?? 0, 0);

  await page.getByRole("button", { name: "Show Mesurer toolbar" }).click();
  await expect(toolbar).not.toHaveAttribute("data-resizing");
  expect((await toolbar.boundingBox())?.height).toBe(annotate?.height);
});

test("a snapped toolbar resizes around its middle", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");

  const box = await toolbar.boundingBox();
  await dragTo(page, toolbar, 30, 350);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  const chrome = toolbar.locator(".mesurer-toolbar-chrome");
  const middle = async () => {
    const rect = await chrome.boundingBox();
    return (rect?.y ?? 0) + (rect?.height ?? 0) / 2;
  };
  const settled = async () => {
    await expect(toolbar).not.toHaveAttribute("data-resizing");
    expect(Math.abs((await middle()) - 350)).toBeLessThanOrEqual(1);
  };
  await settled();

  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await expect(toolbar).toHaveAttribute("data-resizing", "true");
  await settled();

  // Closing and opening stay centered at every frame, not only once settled.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();
  await expect(toolbar).toHaveAttribute("data-resizing", "collapse");
  expect(Math.abs((await middle()) - 350)).toBeLessThanOrEqual(1);
  await settled();

  await page.getByRole("button", { name: "Show Mesurer toolbar" }).click();
  await expect(toolbar).toHaveAttribute("data-resizing", "collapse");
  expect(Math.abs((await middle()) - 350)).toBeLessThanOrEqual(1);
  await settled();
});

test("the toolbar swings a quarter turn between horizontal and vertical", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await expect(toolbar).toHaveAttribute("data-ready", "true");

  // Hold every turn at its first frame, where the turned bar must still look like the old one.
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options);
      if (typeof options === "object" && options.id === "mesurer-toolbar-turn") animation.pause();
      return animation;
    };
  });
  const turnStart = () =>
    toolbar.evaluate((node) => {
      const turns = (target: Element) => target.getAnimations().filter((animation) => animation.id === "mesurer-toolbar-turn");
      const rotations = (target: Element) =>
        turns(target).flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes().map((frame) => String(frame.rotate)));
      const rect = (target: Element) => {
        const box = target.getBoundingClientRect();
        return [box.x, box.y, box.width, box.height].map(Math.round);
      };
      const icon = node.querySelector("[data-tool-id='selection'] button")!;
      const pill = node.querySelector(".mesurer-toolbar-tool-switch-pill")!;
      const active = node.querySelector(".mesurer-toolbar-tool-switch button[aria-pressed='true']")!;
      const finish = () => {
        for (const target of [node, ...node.querySelectorAll("*")]) for (const animation of turns(target)) animation.finish();
      };
      // The swing is short and already under way: rewound, so its first frame is what gets measured.
      for (const target of [node, ...node.querySelectorAll("*")]) {
        for (const animation of turns(target)) {
          animation.pause();
          animation.currentTime = 0;
        }
      }
      const held = {
        bar: rotations(node),
        barBox: rect(node),
        icon: rotations(icon),
        iconBox: rect(icon),
        // The mode switch's pill stays squarely behind the active mode.
        pillOnActive: String(rect(pill)) === String(rect(active)),
      };
      finish();
      return { ...held, settledBox: rect(node) };
    });
  const boxOf = async (name: string) => {
    const box = await page.getByRole("button", { name }).boundingBox();
    if (!box) throw new Error(`${name} not visible`);
    return [box.x, box.y, box.width, box.height].map(Math.round);
  };

  // Annotate mode, so the pill sits on the second mode and has to travel with the bar.
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await expect(toolbar).not.toHaveAttribute("data-resizing");
  await page.waitForTimeout(250);
  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(80, 300, { steps: 10 });
  const row = await toolbar.boundingBox();
  const rowIcon = await boxOf("Select (S)");
  await page.mouse.move(30, 300);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");

  // Turned back a quarter, the column lies exactly where the row was, icons upright in place.
  const toVertical = await turnStart();
  expect(toVertical.bar).toEqual(["-90deg", "0deg"]);
  expect(toVertical.icon).toEqual(["90deg", "0deg"]);
  expect(toVertical.barBox).toEqual([row?.x, row?.y, row?.width, row?.height].map((value) => Math.round(value ?? 0)));
  expect(toVertical.pillOnActive).toBe(true);
  expect(toVertical.iconBox).toEqual(rowIcon);
  expect(toVertical.settledBox.slice(2)).toEqual([box.height, box.width]);

  // Pulled off the edge it stays a column; the same swing the other way waits for the top zone.
  await page.mouse.move(300, 300, { steps: 5 });
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await page.mouse.move(300, 84, { steps: 5 });
  const column = await toolbar.boundingBox();
  const columnIcon = await boxOf("Select (S)");
  await page.mouse.move(300, 60);
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  const toHorizontal = await turnStart();
  expect(toHorizontal.bar).toEqual(["90deg", "0deg"]);
  expect(toHorizontal.icon).toEqual(["-90deg", "0deg"]);
  expect(toHorizontal.barBox).toEqual([column?.x, column?.y, column?.width, column?.height].map((value) => Math.round(value ?? 0)));
  expect(toHorizontal.pillOnActive).toBe(true);
  expect(toHorizontal.iconBox).toEqual(columnIcon);
  expect(toHorizontal.settledBox.slice(2)).toEqual([box.width, box.height]);
  await page.mouse.up();
});

test("a dragged toolbar stays under the pointer through a glue and a release", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await expect(toolbar).toHaveAttribute("data-ready", "true");

  const holdsPointer = async (x: number, y: number) => {
    const box = await toolbar.boundingBox();
    if (!box) return false;
    return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  };
  const moveTo = async (x: number, y: number) => {
    await page.mouse.move(x, y, { steps: 8 });
    expect(await holdsPointer(x, y)).toBe(true);
  };

  // Grab the bar a quarter of the way along, well away from its middle.
  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 2);
  await page.mouse.down();

  await moveTo(400, 300);
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  // Glue to the left edge: the bar turns under the pointer instead of jumping to the middle.
  await moveTo(30, 300);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await moveTo(30, 300);
  await moveTo(30, 420);
  // Off the left zone it is free and stays upright under the pointer, however far it goes.
  await moveTo(52, 420);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await moveTo(300, 420);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  // The top zone lays it flat, and from there the middle keeps it flat.
  await moveTo(300, 40);
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  await moveTo(300, 420);
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  await moveTo(1075, 350);
  await expect(toolbar).toHaveAttribute("data-edge", "right");
  await moveTo(1075, 350);
  await page.mouse.up();
});

test("tooltips stay hidden while the toolbar is dragged", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  const tooltips = page.locator(".mesurer-toolbar-tooltips [role='tooltip']");

  const button = await page.getByRole("button", { name: "X-ray (X)" }).boundingBox();
  if (!button) throw new Error("button not visible");
  const x = button.x + button.width / 2;
  const y = button.y + button.height / 2;
  await page.mouse.move(x, y);
  await expect(tooltips).toHaveCount(1);

  await page.mouse.down();
  await page.mouse.move(x + 200, y + 200, { steps: 5 });
  await expect(tooltips).toHaveCount(0);
  // Long enough for a hover that started mid-drag to have shown its tooltip.
  await page.waitForTimeout(900);
  await expect(tooltips).toHaveCount(0);
  await page.mouse.up();
  await expect(tooltips).toHaveCount(0);
});

test("a toolbar pulled straight off its corner stays flat while dragged, then glues to the nearest zone", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await expect(toolbar).toHaveAttribute("data-edge", "top");
  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  // Grabbed near its left end, in the top-left corner, and pulled straight down.
  const x = box.x + 16;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, 400, { steps: 12 });
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  await expect(toolbar).not.toHaveAttribute("data-edge");
  // Let go beside the left edge's middle zone, that is where it goes.
  await page.mouse.up();
  await expect(toolbar).toHaveAttribute("data-edge", "left");
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
});

test("a toolbar approaching a corner picks no edge until it is released in the corner", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await expect(toolbar).toHaveAttribute("data-edge", "top");
  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(600, 400, { steps: 12 });
  await expect(toolbar).not.toHaveAttribute("data-edge");
  // Off every edge, the zone it would go to is still lit: it never lands nowhere.
  await expect(page.locator(".mesurer-toolbar-zone[data-active=\"true\"]")).toHaveCount(1);
  // Inside the corner's radius, but not yet over either edge's zone: still free.
  await page.mouse.move(60, 60, { steps: 12 });
  await expect(toolbar).not.toHaveAttribute("data-edge");
  await expect(page.locator(".mesurer-toolbar-zone[data-active=\"true\"]")).toHaveCount(1);
  await page.mouse.up();
  await expect(toolbar).toHaveAttribute("data-edge", "top");
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
});

test("a minimized toolbar turns without a swing", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await expect(toolbar).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();
  await expect(toolbar).not.toHaveAttribute("data-resizing");
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (typeof options === "object" && options.id === "mesurer-toolbar-turn") {
        document.documentElement.dataset.turned = "true";
      }
      return animate.call(this, keyframes, options);
    };
  });

  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Pulled off its corner it stays free, and only turns once it is back in the middle.
  await page.mouse.move(300, 300, { steps: 10 });
  await page.mouse.move(30, 300, { steps: 10 });
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await page.mouse.move(300, 300, { steps: 10 });
  await page.mouse.move(300, 30, { steps: 10 });
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  await page.mouse.up();
  await expect(page.locator("html")).not.toHaveAttribute("data-turned");
});

test("a glued toolbar stays in the middle of its edge when closed, opened and resized", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  const middle = async () => {
    await expect(toolbar).not.toHaveAttribute("data-resizing");
    const box = await toolbar.boundingBox();
    return { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 };
  };
  const close = async () => {
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Minimize toolbar" }).click();
  };
  const open = () => page.getByRole("button", { name: "Show Mesurer toolbar" }).click();

  // Top edge: out of its starting corner, centered across the viewport's width, open or closed.
  await expect(toolbar).toHaveAttribute("data-edge", "top");
  const start = await toolbar.boundingBox();
  await dragBy(page, toolbar, 550 - ((start?.x ?? 0) + (start?.width ?? 0) / 2), 0);
  expect((await middle()).x).toBe(550);
  await close();
  expect((await middle()).x).toBe(550);
  // Dragged along the edge while closed, it settles back in the middle, the nearest spot.
  await dragBy(page, toolbar, 200, 0);
  expect((await middle()).x).toBe(550);
  await open();
  expect((await middle()).x).toBe(550);

  // Left edge: centered down the viewport's height, through a viewport resize too.
  const box = await toolbar.boundingBox();
  await dragTo(page, toolbar, 30, 350);
  await expect(toolbar).toHaveAttribute("data-edge", "left");
  expect((await middle()).y).toBe(350);
  await close();
  expect((await middle()).y).toBe(350);
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect.poll(async () => (await middle()).y).toBe(450);
  await open();
  expect((await middle()).y).toBe(450);
  await page.setViewportSize({ width: 1100, height: 700 });
  await expect.poll(async () => (await middle()).y).toBe(350);
});

test("menus open clear of the toolbar and within its span on every edge", async ({ page }) => {
  await mockEyeDropper(page);
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");

  const surfaces: [trigger: string, surface: Locator][] = [
    ["Guide orientation menu", page.getByRole("menu")],
    ["Layout guides (L)", page.locator("[data-mesurer-layout-guides-panel]")],
    ["Sample color (P)", page.locator(".mesurer-color-picker")],
    ["Capture menu", page.getByRole("menu")],
    ["Comment menu", page.getByRole("menu")],
  ];
  for (const spot of EDGE_SPOTS) {
    const bar = await glueTo(page, toolbar, spot);
    for (const [trigger, surface] of surfaces) {
      const button = page.getByRole("button", { name: trigger });
      await button.click();
      await expect(surface).toBeVisible();
      // Placement settles a frame after the surface mounts.
      await page.waitForTimeout(100);
      expectAgainstBar(spot[0], bar, await surface.boundingBox(), `${trigger} on ${spot[0]}`);

      if (trigger === "Sample color (P)") await page.mouse.click(700, 420);
      else await button.click();
      await expect(surface).toHaveCount(0);
    }
  }
});

test("the motion card follows the toolbar to every edge", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  // Inspecting an animated element opens the motion card, which stays open through a drag.
  await page.evaluate(() => {
    const element = document.createElement("div");
    element.style.cssText = "position:fixed;left:480px;top:300px;width:120px;height:80px;background:teal;z-index:1";
    document.body.append(element);
    element.animate([{ transform: "translateX(-10px)" }, { transform: "translateX(10px)" }], {
      duration: 2000,
      iterations: Infinity,
      direction: "alternate",
    });
  });
  await page.mouse.click(540, 340);
  const card = page.locator("[data-mesurer-capture-ui]");
  await expect(card).toBeVisible();

  // Twice round, so every edge is reached from more than one other edge.
  for (const spot of [...EDGE_SPOTS, ...EDGE_SPOTS.slice().reverse()]) {
    const bar = await glueTo(page, toolbar, spot);
    expectAgainstBar(spot[0], bar, await card.boundingBox(), `motion card on ${spot[0]}`);
  }
});

test("the screenshot card sticks to the toolbar on every edge", async ({ page }) => {
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 100;
    canvas.getContext("2d")?.fillRect(0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "test-extension",
          lastError: undefined,
          sendMessage: (_message: unknown, callback: (response: unknown) => void) => callback({ ok: true, dataUrl }),
        },
      },
    });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write: async () => {} } });
  });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  const card = page.locator(".mesurer-screenshot-preview");

  for (const spot of EDGE_SPOTS) {
    const bar = await glueTo(page, toolbar, spot);
    await page.keyboard.press("c");
    await page.mouse.move(620, 140);
    await page.mouse.down();
    await page.mouse.move(780, 240);
    await page.mouse.up();
    await expect(card).toBeVisible();
    await page.waitForTimeout(100);
    expectAgainstBar(spot[0], bar, await card.boundingBox(), `screenshot card on ${spot[0]}`);
    // Moving the toolbar dismisses the card, ready for the next edge.
    await dragBy(page, toolbar, spot[0] === "left" ? 400 : -30, spot[0] === "top" ? 200 : -30);
    await expect(card).toHaveCount(0);
  }
});

test("moving the toolbar closes its menus and cards", async ({ page }) => {
  await mockEyeDropper(page);
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();

  const surfaces: [trigger: string, surface: Locator][] = [
    ["Guide orientation menu", page.getByRole("menu")],
    ["Layout guides (L)", page.locator("[data-mesurer-layout-guides-panel]")],
    ["Sample color (P)", page.locator(".mesurer-color-picker")],
    ["Capture menu", page.getByRole("menu")],
    ["Comment menu", page.getByRole("menu")],
    ["Settings", page.getByRole("dialog", { name: "Settings" })],
  ];
  for (const [trigger, surface] of surfaces) {
    await page.getByRole("button", { name: trigger }).click();
    await expect(surface, trigger).toBeVisible();
    await dragBy(page, toolbar, 30, 40);
    await expect(surface, trigger).toHaveCount(0);
  }
});

test("the extension's recording card never covers the toolbar, on any edge", async ({ page }) => {
  await page.goto("/e2e/fixtures/extension-recording.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  const frame = page.locator("iframe[title='Recording preview']");

  for (const spot of EDGE_SPOTS) {
    const bar = await glueTo(page, toolbar, spot);
    await page.getByRole("button", { name: "Capture menu" }).click();
    await page.getByRole("menuitem", { name: /Screen record/ }).click();
    await page.mouse.move(420, 260);
    await page.mouse.down();
    await page.mouse.move(640, 420, { steps: 4 });
    await page.mouse.up();
    await page.getByRole("button", { name: "Start recording" }).click();
    await page.getByRole("button", { name: /^Stop recording/ }).click();
    await expect(frame).toBeVisible();
    await page.waitForTimeout(150);

    // The card's own box sits against the bar like every other surface.
    expectAgainstBar(spot[0], bar, await frame.locator("xpath=../..").boundingBox(), `recording card on ${spot[0]}`);
    // The iframe overhangs the card so its shadow can paint; that overhang must not swallow
    // clicks meant for the toolbar.
    for (const name of ["Settings", "Comments (M)", "Inspect (I)", "Select and inspect tools (1)"]) {
      await page.getByRole("button", { name }).click({ trial: true, timeout: 1000 });
    }
    // The card stays open, so the next drag crosses its iframe: the drag must not stall there.
  }
});

test("snap mode settles a toolbar dropped near a corner into that corner", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");

  const box = await toolbar.boundingBox();
  const grabX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const grabY = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX - 300, grabY + 380, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  const settled = await toolbar.boundingBox();
  expect(Math.round(settled?.x ?? -1)).toBe(16);
  expect(Math.round((settled?.y ?? 0) + (settled?.height ?? 0))).toBe(700 - 16);
});

test("a toolbar in a corner opens and closes from that corner", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  const chrome = toolbar.locator(".mesurer-toolbar-chrome");
  const close = async () => {
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Minimize toolbar" }).click();
  };
  const open = () => page.getByRole("button", { name: "Show Mesurer toolbar" }).click();

  // Each corner keeps one end of the bar fixed: at every frame of the motion, and once settled.
  const corners: [label: string, x: number, y: number, pinned: (box: Box) => number, at: number][] = [
    ["top left", 60, 30, (box) => box.x, 16],
    ["top right", 1040, 30, (box) => box.x + box.width, 1100 - 16],
    ["bottom right", 1040, 670, (box) => box.x + box.width, 1100 - 16],
    ["left bottom", 20, 640, (box) => box.y + box.height, 700 - 16],
    ["left top", 20, 60, (box) => box.y, 16],
  ];
  for (const [label, x, y, pinned, at] of corners) {
    await dragTo(page, toolbar, x, y);
    const end = async () => {
      const box = await chrome.boundingBox();
      return box ? pinned(box) : Number.NaN;
    };
    const holds = async (when: string) =>
      expect(Math.abs((await end()) - at), `${label}, ${when}`).toBeLessThanOrEqual(1);
    await holds("open");

    await close();
    await expect(toolbar).toHaveAttribute("data-resizing", "collapse");
    await holds("closing");
    await expect(toolbar).not.toHaveAttribute("data-resizing");
    await holds("closed");
    const closed = await chrome.boundingBox();
    expect(closed?.width, label).toBe(closed?.height);

    await open();
    await expect(toolbar).toHaveAttribute("data-resizing", "collapse");
    // The bar is put back on its corner before the frame paints: measure after one has.
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await holds("opening");
    await expect(toolbar).not.toHaveAttribute("data-resizing");
    await holds("opened");
  }
});

test("auto-hide tucks a glued toolbar to a tab and reveals it on hover", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await page.getByRole("button", { name: /Settings/ }).first().click();
  await page.getByRole("switch", { name: "Auto-hide" }).click();
  await page.keyboard.press("Escape");

  await page.mouse.move(600, 500);
  await expect.poll(async () => Math.round(((await toolbar.boundingBox())?.y ?? 0) + ((await toolbar.boundingBox())?.height ?? 0))).toBe(6);

  const box = await toolbar.boundingBox();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, 3);
  await expect.poll(async () => Math.round((await toolbar.boundingBox())?.y ?? -1)).toBe(16);
});

test("auto-hide reveals a tucked toolbar as the pointer nears its edge", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await page.getByRole("button", { name: /Settings/ }).first().click();
  await page.getByRole("switch", { name: "Auto-hide" }).click();
  await page.keyboard.press("Escape");

  await page.mouse.move(600, 500);
  const y = async () => Math.round((await toolbar.boundingBox())?.y ?? -1);
  await expect.poll(y).toBe(-34);

  await page.mouse.move(300, 30, { steps: 5 });
  await expect.poll(y).toBe(16);

  await page.mouse.move(300, 300, { steps: 5 });
  await expect.poll(y).toBe(-34);
});

test("the toolbar comes back on the edge and spot it was left on", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  const reloaded = async () => {
    const before = await toolbar.boundingBox();
    await page.reload();
    await expect(toolbar).toHaveAttribute("data-ready", "true");
    await expect.poll(() => toolbar.boundingBox()).toEqual(before);
  };

  // A column in the top-left corner shares its position with a row there: only the saved edge tells them apart.
  await dragTo(page, toolbar, 30, 350);
  await dragTo(page, toolbar, 30, 60);
  await expect(toolbar).toHaveAttribute("data-edge", "left");
  expect((await toolbar.boundingBox())?.y).toBe(16);
  await reloaded();
  await expect(toolbar).toHaveAttribute("data-edge", "left");
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");

  // Let go in the open, it glues to the nearest zone, and comes back there too.
  await dragTo(page, toolbar, 300, 350);
  await expect(toolbar).toHaveAttribute("data-edge", "left");
  expect(Math.round(((await toolbar.boundingBox())?.y ?? 0) + ((await toolbar.boundingBox())?.height ?? 0) / 2)).toBe(350);
  await reloaded();
  await expect(toolbar).toHaveAttribute("data-edge", "left");

  await dragTo(page, toolbar, 700, 500);
  await expect(toolbar).toHaveAttribute("data-edge", "bottom");
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  await reloaded();
  await expect(toolbar).toHaveAttribute("data-edge", "bottom");
});

test("a pointer resting on a zone's line does not turn the toolbar back and forth", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await dragTo(page, toolbar, 550, 30);
  await dragTo(page, toolbar, 550, 350);
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    let turns = 0;
    Element.prototype.animate = function (keyframes, options) {
      if (typeof options === "object" && options.id === "mesurer-toolbar-turn" && this.classList.contains("mesurer-toolbar-motion")) {
        document.documentElement.dataset.turns = String(++turns);
      }
      return animate.call(this, keyframes, options);
    };
  });

  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(72, 350, { steps: 10 });
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  // Wobbling across the line it came in on.
  for (const x of [74, 71, 76, 72, 78, 73]) await page.mouse.move(x, 350);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await page.mouse.up();
  await expect(page.locator("html")).toHaveAttribute("data-turns", "1");
});

test("auto-hide shows the toolbar when the page loads, and hides it once it has been visited", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await page.getByRole("button", { name: /Settings/ }).first().click();
  await page.getByRole("switch", { name: "Auto-hide" }).click();
  await page.keyboard.press("Escape");
  await page.mouse.move(600, 500);
  const y = async () => Math.round((await toolbar.boundingBox())?.y ?? -1);
  await expect.poll(y).toBe(-34);

  // On a fresh page it is there to be seen, and stays while the pointer is elsewhere.
  await page.reload();
  await expect(toolbar).toHaveAttribute("data-ready", "true");
  expect(await y()).toBe(16);
  await page.mouse.move(620, 520, { steps: 3 });
  await page.waitForTimeout(1000);
  expect(await y()).toBe(16);

  // Once the pointer has been to it, leaving hides it, and from then on it hides as usual.
  await page.mouse.move(300, 30, { steps: 4 });
  await page.mouse.move(620, 520, { steps: 4 });
  await expect.poll(y).toBe(-34);
  await page.mouse.move(300, 30, { steps: 4 });
  await expect.poll(y).toBe(16);
  await page.mouse.move(620, 520, { steps: 4 });
  await expect.poll(y).toBe(-34);
});

test("drop zones are the closed bar's little square on every spot, open or not", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  const zones = page.locator(".mesurer-toolbar-zone");
  const spots = [16, 530, 1044].flatMap((x) => [16, 330, 644].map((y) => `${x}:${y}`)).filter((spot) => spot !== "530:330").sort();
  const shown = async () => {
    await expect(zones).toHaveCount(8);
    const boxes = await zones.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
    for (const box of boxes) expect([box.width, box.height]).toEqual([40, 40]);
    return boxes.map((box) => `${box.x}:${box.y}`).sort();
  };
  const hold = async (x: number, y: number) => {
    const box = await toolbar.boundingBox();
    if (!box) throw new Error("toolbar not visible");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 8 });
  };

  // Open and lying flat, open and standing, then closed: the same eight squares.
  await hold(550, 350);
  expect(await shown()).toEqual(spots);
  await page.mouse.move(30, 350, { steps: 8 });
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  expect(await shown()).toEqual(spots);
  await page.mouse.up();
  await expect(zones).toHaveCount(0);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();
  await expect(toolbar).not.toHaveAttribute("data-resizing");
  await hold(550, 350);
  expect(await shown()).toEqual(spots);
  await page.mouse.up();
});

test("auto-hide lets a dropped toolbar land, then hides it a moment after the pointer leaves", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await page.getByRole("button", { name: /Settings/ }).first().click();
  await page.getByRole("switch", { name: "Auto-hide" }).click();
  await page.keyboard.press("Escape");
  const x = async () => Math.round((await toolbar.boundingBox())?.x ?? -1);

  // Hovering it to grab it brings it out; dropped on the left edge it settles there in full view.
  await page.mouse.move(300, 30, { steps: 5 });
  await expect.poll(async () => Math.round((await toolbar.boundingBox())?.y ?? -1)).toBe(16);
  await page.mouse.down();
  await page.mouse.move(550, 350, { steps: 5 });
  await page.mouse.move(30, 350, { steps: 8 });
  await page.mouse.up();
  await expect(toolbar).toHaveAttribute("data-edge", "left");
  await expect.poll(x).toBe(16);

  // The pointer leaves at once: the bar is still there a moment later, then goes.
  await page.mouse.move(600, 350, { steps: 3 });
  await page.waitForTimeout(300);
  expect(await x()).toBe(16);
  await expect.poll(x).toBe(-34);

  // Coming back within the moment cancels the hide.
  await page.mouse.move(30, 350, { steps: 3 });
  await expect.poll(x).toBe(16);
  await page.mouse.move(600, 350, { steps: 3 });
  await page.waitForTimeout(200);
  await page.mouse.move(30, 350, { steps: 3 });
  await page.waitForTimeout(700);
  expect(await x()).toBe(16);
});

test("a row dragged into a side wall by its far end stands up without the pointer reaching the wall", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await dragTo(page, toolbar, 550, 350);

  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  const grabX = box.x + box.width * 0.9;
  await page.mouse.move(grabX, box.y + box.height / 2);
  await page.mouse.down();
  // The bar's left end meets the wall with the pointer still most of the bar's length away.
  await page.mouse.move(grabX - box.x + 8, 350, { steps: 8 });
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  await page.mouse.move(grabX - box.x - 40, 350, { steps: 8 });
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await expect(toolbar).not.toHaveAttribute("data-edge");
  const pointerX = grabX - box.x - 40;
  expect(pointerX).toBeGreaterThan(250);
  const column = await toolbar.boundingBox();
  expect(pointerX).toBeGreaterThanOrEqual(column?.x ?? 0);
  expect(pointerX).toBeLessThanOrEqual((column?.x ?? 0) + (column?.width ?? 0));
  // Carried on to the wall it glues there.
  await page.mouse.move(30, 350, { steps: 8 });
  await expect(toolbar).toHaveAttribute("data-edge", "left");
  await page.mouse.up();
});

test("auto-hide keeps the toolbar out while something hangs off it or the keyboard is on it", async ({ page }) => {
  await mockEyeDropper(page);
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await page.getByRole("button", { name: /Settings/ }).first().click();
  await page.getByRole("switch", { name: "Auto-hide" }).click();
  await page.keyboard.press("Escape");
  const y = async () => Math.round((await toolbar.boundingBox())?.y ?? -1);
  await page.mouse.move(600, 500);
  await expect.poll(y).toBe(-34);

  // The color picker hangs off the bar: the bar stays with it after the pointer has gone.
  await page.mouse.move(300, 30, { steps: 5 });
  await expect.poll(y).toBe(16);
  await page.getByRole("button", { name: "Sample color (P)" }).click();
  await expect(page.locator(".mesurer-color-picker")).toBeVisible();
  await page.mouse.move(600, 500, { steps: 3 });
  await page.waitForTimeout(900);
  expect(await y()).toBe(16);
  await page.mouse.click(700, 420);
  await expect(page.locator(".mesurer-color-picker")).toHaveCount(0);
  await expect.poll(y).toBe(-34);

  // Reached with the keyboard while hidden, it comes out.
  await toolbar.getByRole("button").first().focus();
  await page.keyboard.press("Tab");
  await expect.poll(y).toBe(16);
});

test("a row turned by a wall lies flat again when let off it, and a reversed swing picks up where it was", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await dragTo(page, toolbar, 550, 350);
  // A slow swing, so the reversal lands in the middle of it.
  await toolbar.evaluate((node) => {
    (node as HTMLElement).style.setProperty("--msr-toolbar-motion", "2000ms linear");
    const animate = Element.prototype.animate;
    const swings: { from: string; duration: number }[] = [];
    (window as Window & { __swings?: typeof swings }).__swings = swings;
    Element.prototype.animate = function (keyframes, options) {
      if (this === node && typeof options === "object" && options.id === "mesurer-toolbar-turn") {
        swings.push({ from: String((keyframes as Keyframe[])[0].rotate), duration: Number(options.duration) });
      }
      return animate.call(this, keyframes, options);
    };
  });

  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  const grabX = box.x + box.width * 0.9;
  const wall = grabX - box.x;
  await page.mouse.move(grabX, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(wall - 48, 350, { steps: 6 });
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await page.waitForTimeout(300);
  await page.mouse.move(wall + 24, 350, { steps: 3 });
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  await page.mouse.up();

  const swings = await page.evaluate(() => (window as Window & { __swings?: { from: string; duration: number }[] }).__swings ?? []);
  expect(swings).toHaveLength(2);
  expect(swings[0]).toEqual({ from: "-90deg", duration: 1100 });
  // The row comes back from where the column had got to, in the time that much takes.
  const back = parseFloat(swings[1].from);
  expect(back).toBeGreaterThan(5);
  expect(back).toBeLessThan(85);
  expect(swings[1].duration).toBeCloseTo((1100 * back) / 90, 0);
});

test("the saved placement follows the dock mode and the window size", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  const saved = () =>
    page.evaluate(() => {
      const found = (localStorage.getItem("mesurer-settings") ?? "").match(/"toolbarPosition":(\{[^}]*\})/);
      return found ? JSON.parse(found[1]) : {};
    });

  await dragTo(page, toolbar, 1070, 350);
  await expect(toolbar).toHaveAttribute("data-edge", "right");
  await expect.poll(saved).toMatchObject({ x: 1044, edge: "right", align: "center", vertical: true });

  // The window narrows: the bar follows its edge, and so does what is saved.
  await page.setViewportSize({ width: 900, height: 700 });
  await expect.poll(saved).toMatchObject({ x: 844, edge: "right", vertical: true });

  // Free mode lets go of the edge, in the save too. The auto-hide option goes with snap mode.
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("switch", { name: "Auto-hide" })).toBeVisible();
  await page.getByLabel("Toolbar dock").selectOption("free");
  await expect(page.getByRole("switch", { name: "Auto-hide" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect.poll(saved).toMatchObject({ edge: null, vertical: false });
});

test("the glide into place is skipped under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(550, 350, { steps: 5 });
  await page.mouse.move(30, 300, { steps: 8 });
  await page.mouse.up();
  // Settled in the middle of the edge at once, with no transition on the way.
  await expect(toolbar).toHaveAttribute("data-edge", "left");
  const container = page.locator(".mesurer-toolbar-container");
  expect(await container.evaluate((node) => (node as HTMLElement).style.transition)).toBe("");
  expect(Math.round(((await toolbar.boundingBox())?.y ?? 0) + ((await toolbar.boundingBox())?.height ?? 0) / 2)).toBe(350);
});

test("auto-hide keeps the toolbar hidden while something is being drawn toward its edge", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await page.getByRole("button", { name: /Settings/ }).first().click();
  await page.getByRole("switch", { name: "Auto-hide" }).click();
  await page.keyboard.press("Escape");
  const y = async () => Math.round((await toolbar.boundingBox())?.y ?? -1);
  await page.mouse.move(600, 500);
  await expect.poll(y).toBe(-34);

  // A press on the page, carried into the bar's reach and over its tab: it stays hidden.
  await page.mouse.down();
  await page.mouse.move(300, 20, { steps: 6 });
  await page.mouse.move(300, 3, { steps: 3 });
  await page.waitForTimeout(400);
  expect(await y()).toBe(-34);

  // Released, the next move within reach brings it out as usual.
  await page.mouse.up();
  await page.mouse.move(300, 30, { steps: 3 });
  await expect.poll(y).toBe(16);

  // Out when a press begins on the page, it still goes away during it.
  await page.mouse.move(600, 300, { steps: 2 });
  await page.mouse.down();
  await page.mouse.move(700, 400, { steps: 4 });
  await expect.poll(y).toBe(-34);
  await page.mouse.up();
});

test("a drag lights the drop zone the toolbar would land in, on an edge too", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await expect(toolbar).toHaveAttribute("data-edge", "top");
  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  const lit = page.locator('.mesurer-toolbar-zone[data-active="true"]');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Along the top edge, away from the corners: the middle zone lights up.
  await page.mouse.move(600, 40, { steps: 12 });
  await expect(toolbar).toHaveAttribute("data-edge", "top");
  await expect(lit).toHaveCount(1);
  await page.mouse.up();
  await expect(lit).toHaveCount(0);
});

test("auto-hide leaves a toolbar that was just opened in view", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await page.getByRole("button", { name: /Settings/ }).first().click();
  await page.getByRole("switch", { name: "Auto-hide" }).click();
  await page.getByRole("button", { name: "Minimize toolbar" }).click();
  await expect(toolbar).not.toHaveAttribute("data-resizing");
  const y = async () => Math.round((await toolbar.boundingBox())?.y ?? -1);
  await page.mouse.move(600, 500);
  await expect.poll(y).toBe(-34);

  // Opened from the keyboard, with the pointer far away: it comes out and stays, even as the
  // pointer wanders and the keyboard moves on.
  await page.getByRole("button", { name: "Show Mesurer toolbar" }).focus();
  await page.keyboard.press("Enter");
  await expect(toolbar).not.toHaveAttribute("data-resizing");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(620, 520, { steps: 2 });
  await page.waitForTimeout(1000);
  expect(await y()).toBe(16);

  // Once the pointer has reached it, leaving hides it as usual.
  await page.mouse.move(300, 30, { steps: 4 });
  await page.mouse.move(620, 520, { steps: 4 });
  await expect.poll(y).toBe(-34);
});

test("a surface opened while the toolbar is auto-hidden sits against it once it is out, not on top of it", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");
  await page.getByRole("button", { name: /Settings/ }).first().click();
  await page.getByRole("switch", { name: "Auto-hide" }).click();
  await page.keyboard.press("Escape");

  for (const spot of EDGE_SPOTS) {
    // Out to be grabbed, glued to the edge, then left alone until it hides.
    const shown = await toolbar.boundingBox();
    if (shown && (shown.y < 0 || shown.x < 0 || shown.x + shown.width > 1100 || shown.y + shown.height > 700)) {
      await page.mouse.move(Math.max(4, Math.min(1096, shown.x + shown.width / 2)), Math.max(4, Math.min(696, shown.y + shown.height / 2)), { steps: 4 });
    }
    await expect.poll(async () => {
      const box = await toolbar.boundingBox();
      return box !== null && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1100 && box.y + box.height <= 700;
    }).toBe(true);
    const bar = await glueTo(page, toolbar, spot);
    await page.mouse.move(550, 350, { steps: 4 });
    await expect.poll(async () => JSON.stringify(await toolbar.boundingBox())).not.toBe(JSON.stringify(bar));
    await page.waitForTimeout(400);

    // Opened from the keyboard, with the bar still out of view.
    await page.keyboard.press("Control+,");
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await expect.poll(() => toolbar.boundingBox()).toEqual(bar);
    await page.waitForTimeout(400);
    expectAgainstBar(spot[0], bar, await settings.boundingBox(), `settings on ${spot[0]}`);
    await page.keyboard.press("Escape");
    await expect(settings).toHaveCount(0);
  }
});

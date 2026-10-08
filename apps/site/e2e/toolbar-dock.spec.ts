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
  await dragBy(page, toolbar, 40 - (box?.x ?? 0), 300 - (box?.y ?? 0));
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
  await page.mouse.move(startX, startY - 80, { steps: 10 });
  const slid = await toolbar.boundingBox();
  expect(slid?.x).toBe(16);
  expect(slid?.y).toBeLessThan(glued?.y ?? 0);
  await page.mouse.up();
  await page.waitForTimeout(320);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");

  // The glue survives a reload.
  await page.reload();
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await expect.poll(async () => (await toolbar.boundingBox())?.x).toBe(16);
});

test("pulling a glued toolbar away from the edge releases it", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");

  const box = await toolbar.boundingBox();
  await dragBy(page, toolbar, 40 - (box?.x ?? 0), 300 - (box?.y ?? 0));
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");

  await dragBy(page, toolbar, 400, 0);
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  const free = await toolbar.boundingBox();
  expect(free?.x).toBeGreaterThan(300);
});

test("a vertical toolbar animates the mode switch and minimize along its own axis", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const toolbar = page.locator(".mesurer-toolbar-motion");
  await expect(toolbar).toBeVisible();
  await setDock(page, "snap");

  const box = await toolbar.boundingBox();
  await dragBy(page, toolbar, 40 - (box?.x ?? 0), 300 - (box?.y ?? 0));
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
  await dragBy(page, toolbar, 40 - (box?.x ?? 0), 300 - (box?.y ?? 0));
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
  await page.mouse.move(60, 300, { steps: 10 });
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

  // And the same swing the other way when it is pulled off the edge.
  await page.mouse.move(120, 300, { steps: 5 });
  const column = await toolbar.boundingBox();
  const columnIcon = await boxOf("Select (S)");
  await page.mouse.move(140, 300);
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
  // Pulled off the edge it follows the pointer, still glued, until it releases.
  await moveTo(100, 420);
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await moveTo(300, 420);
  await expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  await moveTo(300, 420);
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
  await page.mouse.move(30, 300, { steps: 10 });
  await expect(toolbar).toHaveAttribute("data-orientation", "vertical");
  await page.mouse.move(300, 300, { steps: 10 });
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

  // Top edge: centered across the viewport's width, open or closed.
  await expect(toolbar).toHaveAttribute("data-edge", "top");
  expect((await middle()).x).toBe(550);
  await close();
  expect((await middle()).x).toBe(550);
  // Dragged along the edge while closed, it settles back in the middle.
  await dragBy(page, toolbar, 300, 0);
  expect((await middle()).x).toBe(550);
  await open();
  expect((await middle()).x).toBe(550);

  // Left edge: centered down the viewport's height, through a viewport resize too.
  const box = await toolbar.boundingBox();
  await dragBy(page, toolbar, 40 - (box?.x ?? 0), 300 - (box?.y ?? 0));
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

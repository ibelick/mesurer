import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const extensionGate = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../extension/dist/keyboard-gate.js",
);

test("bridges shifted tool group shortcuts after an overlay interaction", async ({
  page,
}) => {
  await page.addInitScript({ path: extensionGate });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  await page.getByRole("button", { name: "Arrows (D)" }).click();
  await page.mouse.move(120, 160);
  await page.mouse.down();
  await page.mouse.move(320, 260, { steps: 5 });
  await page.mouse.up();

  await page.keyboard.press("Shift+1");
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "inspect",
  );
  await page.keyboard.press("Shift+2");
  await expect(page.locator(".mesurer-toolbar-tool-switch")).toHaveAttribute(
    "data-value",
    "annotate",
  );

  await page.keyboard.press("t");
  const text = page.getByRole("button", { name: "Text (T)" });
  await expect(text).toBeVisible();
  await expect(text).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("g");
  const guides = page.getByRole("button", { name: "Guides (G)" });
  await expect(guides).toBeVisible();
  await expect(guides).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("d");
  const arrows = page.getByRole("button", { name: "Arrows (D)" });
  await expect(arrows).toBeVisible();
  await expect(arrows).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("selects cross-group tools after using Settings", async ({ page }) => {
  await page.addInitScript({ path: extensionGate });
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.keyboard.press("Escape");

  await page.keyboard.press("t");
  await expect(page.getByRole("button", { name: "Text (T)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Text (T)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.keyboard.press("i");
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect (I)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("extension keyboard gate isolates Mesurer and bridges page-editor shortcuts", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "mesurer-extension-host";
    const shadow = host.attachShadow({ mode: "open" });
    const root = document.createElement("div");
    root.className = "mesurer-root";
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    root.append(editor);
    shadow.append(root);
    document.body.append(host);
    const prompt = document.createElement("textarea");
    document.body.append(prompt);

    const state = {
      pageListenerEvents: 0,
      pageInputEvents: 0,
      editorEvents: 0,
      bridgedEvents: 0,
    };
    document.addEventListener("keydown", () => {
      state.pageListenerEvents += 1;
    });
    document.addEventListener("input", () => {
      state.pageInputEvents += 1;
    });
    editor.addEventListener("keydown", () => {
      state.editorEvents += 1;
    });
    (window as Window & { __gateState?: Record<string, number> }).__gateState = state;
    (window as Window & { __gateEditor?: HTMLElement }).__gateEditor = editor;
    (window as Window & { __gatePrompt?: HTMLTextAreaElement }).__gatePrompt = prompt;
  });
  await page.addScriptTag({ path: extensionGate });

  const result = await page.evaluate(async () => {
    const state = (window as Window & { __gateState: Record<string, number> }).__gateState;
    const editor = (window as Window & { __gateEditor: HTMLElement }).__gateEditor;
    const prompt = (window as Window & { __gatePrompt: HTMLTextAreaElement }).__gatePrompt;
    window.addEventListener("message", (event) => {
      if (event.data?.type === "__MESURER_KEYBOARD_BRIDGE__") state.bridgedEvents += 1;
    });

    document.documentElement.setAttribute("data-mesurer-keyboard-owned", "1");
    const toolbar = document.createElement("button");
    toolbar.type = "button";
    toolbar.className = "mesurer-root";
    editor.parentElement?.append(toolbar);
    toolbar.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "t",
        code: "KeyT",
      }),
    );
    const afterToolbar = { ...state };
    editor.focus();
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "t",
        code: "KeyT",
      }),
    );
    const afterEditor = { ...state };

    document.documentElement.removeAttribute("data-mesurer-keyboard-owned");
    prompt.focus();
    document.documentElement.setAttribute("data-mesurer-keyboard-owned", "1");
    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "t",
        code: "KeyT",
      }),
    );
    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "1",
        code: "Digit1",
        shiftKey: true,
      }),
    );
    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "z",
        code: "KeyZ",
        ctrlKey: true,
      }),
    );
    prompt.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: "x",
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    const owned = { ...afterEditor };

    document.documentElement.removeAttribute("data-mesurer-keyboard-owned");
    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "t",
        code: "KeyT",
      }),
    );

    return {
      owned,
      afterToolbar,
      bridgedEvents: state.bridgedEvents,
      pageInputEvents: state.pageInputEvents,
      releasedPageListenerEvents: state.pageListenerEvents,
    };
  });

  expect(result.owned.editorEvents).toBe(1);
  expect(result.afterToolbar.pageListenerEvents).toBe(0);
  expect(result.owned.pageListenerEvents).toBe(1);
  expect(result.pageInputEvents).toBe(0);
  expect(result.bridgedEvents).toBe(4);
  expect(result.releasedPageListenerEvents).toBe(2);
});

test("extension keyboard gate does not let page menus dismiss from toolbar clicks", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "mesurer-extension-host";
    const shadow = host.attachShadow({ mode: "open" });
    const root = document.createElement("div");
    root.className = "mesurer-root";
    const toolbar = document.createElement("button");
    toolbar.type = "button";
    toolbar.textContent = "Inspect";
    root.append(toolbar);
    shadow.append(root);
    document.body.append(host);
    const overlay = document.createElement("div");
    overlay.setAttribute("data-mesurer-overlay", "");
    overlay.textContent = "overlay";
    root.append(overlay);

    (window as Window & { __gateToolbar?: HTMLButtonElement }).__gateToolbar = toolbar;
    (window as Window & { __gateOverlay?: HTMLDivElement }).__gateOverlay = overlay;
  });
  await page.addScriptTag({ path: extensionGate });

  const result = await page.evaluate(() => {
    const state = { dismissals: 0 };
    window.addEventListener(
      "pointerdown",
      (event) => {
        if (!event.composedPath().some((node) => node instanceof Element && node.classList.contains("mesurer-root"))) {
          return;
        }
        state.dismissals += 1;
      },
      true,
    );
    const toolbar = (window as Window & { __gateToolbar: HTMLButtonElement }).__gateToolbar;
    const overlay = (window as Window & { __gateOverlay: HTMLDivElement }).__gateOverlay;
    toolbar.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    const afterToolbar = state.dismissals;
    overlay.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    return { afterToolbar, afterOverlay: state.dismissals };
  });

  expect(result.afterToolbar).toBe(0);
  expect(result.afterOverlay).toBe(0);
});

test("extension keyboard gate leaves embedded Mesurer inputs interactive", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.addScriptTag({ path: extensionGate });

  const result = await page.evaluate(() => {
    const appRoot = document.createElement("div");
    const mesurer = document.createElement("div");
    mesurer.className = "mesurer-root";
    const input = document.createElement("input");
    mesurer.append(input);
    appRoot.append(mesurer);
    document.body.append(appRoot);
    document.documentElement.setAttribute("data-mesurer-keyboard-owned", "1");

    const received: string[] = [];
    for (const type of ["input", "copy", "paste", "keydown"]) {
      appRoot.addEventListener(type, () => received.push(type));
    }

    input.focus();
    input.value = "#00aaff";
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
    }));
    input.dispatchEvent(new ClipboardEvent("copy", { bubbles: true }));
    input.dispatchEvent(new ClipboardEvent("paste", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "c",
      code: "KeyC",
      metaKey: true,
    }));

    return received;
  });

  expect(result).toEqual(["input", "copy", "paste", "keydown"]);
});

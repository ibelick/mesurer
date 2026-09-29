import { expect, test } from "@playwright/test";
import type { ActiveTabTestApi } from "./fixtures/guide-overlay";

type ActiveTabTestWindow = Window & { __mesurerActiveTabTest: ActiveTabTestApi };

test("keeps a tab closed when navigation races the close request", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const result = await page.evaluate(async () => {
    const api = (window as ActiveTabTestWindow).__mesurerActiveTabTest;
    const writes: number[][] = [];
    let releaseRead!: () => void;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const registry = api.createActiveTabRegistry(
      async () => {
        await readGate;
        return [7];
      },
      async (ids) => {
        writes.push(ids);
      },
    );

    const closing = registry.setActive(7, false);
    const restoreCheck = registry.ready.then(() => registry.isActive(7));
    releaseRead();
    await closing;

    return {
      restoreCheck: await restoreCheck,
      activeAfterClose: registry.isActive(7),
      writes,
    };
  });

  expect(result.restoreCheck).toBe(false);
  expect(result.activeAfterClose).toBe(false);
  expect(result.writes).toEqual([[]]);
});

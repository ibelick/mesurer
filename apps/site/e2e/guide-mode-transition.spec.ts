import { expect, test } from "@playwright/test";

test("leaving guides does not reveal a stale element hover", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const host = page.locator("#mesurer-extension-host");
  const overlay = host.locator(".mesurer-root > div").first();
  const guidesButton = page.getByRole("button", { name: "Guides (G)" });

  await guidesButton.click();
  await page.mouse.move(300, 280);
  await page.waitForTimeout(50);
  await page.keyboard.press("g");

  await expect(overlay).toHaveCSS("pointer-events", "none");
  await expect(
    overlay.locator('div[style*="width: 200px"][style*="height: 100px"]'),
  ).toHaveCount(0);
});

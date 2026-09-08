import { expect, test } from "@playwright/test";

test("loads the stress bench at both slash variants", async ({ page }) => {
  for (const path of ["/bench", "/bench/"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Stress the interface." })).toBeVisible();
    await expect(page.getByText("package source / live")).toBeVisible();
    await expect(page.getByRole("button", { name: "Comments (M)" })).toBeVisible();
  }
});

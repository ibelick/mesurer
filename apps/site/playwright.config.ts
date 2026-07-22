import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 10_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: {
    command:
      "pnpm --dir ../../packages/mesurer build && pnpm exec vite --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/e2e/fixtures/guide-overlay.html",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
  ],
});

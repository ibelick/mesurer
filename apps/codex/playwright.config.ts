import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests", timeout: 20000, workers: 1,
  use: { browserName: "chromium", headless: true, viewport: { width: 1280, height: 800 } },
});

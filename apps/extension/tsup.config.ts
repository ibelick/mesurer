import { defineConfig, type Options } from "tsup";

const production = { "process.env.NODE_ENV": JSON.stringify("production") };

// dist is emptied by scripts/clean-dist.mjs before this runs: the two builds below share it.
const shared: Options = {
  outDir: "dist",
  format: ["iife"],
  target: "es2020",
  platform: "browser",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: false,
  minify: true,
  esbuildOptions: (options) => {
    options.legalComments = "none";
  },
  outExtension: () => ({
    js: ".js",
  }),
};

export default defineConfig([
  {
    ...shared,
    entry: { content: "src/content.tsx" },
    // Leaves out of the content script what only runs outside the extension, or in its other
    // pages: see packages/mesurer/core/build.ts.
    define: { ...production, "globalThis.__MESURER_EXTENSION__": "true" },
  },
  {
    ...shared,
    entry: {
      background: "src/background.ts",
      "keyboard-gate": "src/keyboard-gate.ts",
      "offscreen-recording": "src/offscreen-recording.ts",
      "recording-player": "src/recording-player.tsx",
    },
    define: production,
  },
]);

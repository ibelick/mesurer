import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    background: "src/background.ts",
    content: "src/content.tsx",
    "keyboard-gate": "src/keyboard-gate.ts",
  },
  outDir: "dist",
  format: ["iife"],
  target: "es2020",
  platform: "browser",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  esbuildOptions: (options) => {
    options.legalComments = "none";
  },
  outExtension: () => ({
    js: ".js",
  }),
});

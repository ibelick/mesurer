import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  target: "es2020",
  bundle: true,
  clean: true,
  external: ["@zumer/snapdom"],
  define: {
    __MESURER_SNAPDOM_CAPTURE__: "true",
    "globalThis.__MESURER_NO_REVIEW__": "false",
  },
});

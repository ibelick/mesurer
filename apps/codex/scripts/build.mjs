import { build } from "tsup";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const app = fileURLToPath(new URL("../", import.meta.url));
const out = resolve(app, "dist/mesurer");
await rm(resolve(app, "dist"), { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({ entry: [resolve(app, "src/launcher.tsx")], outDir: resolve(out, "skills/mesurer/assets"),
  format: ["iife"], platform: "browser", target: "es2020", bundle: true,
  splitting: false, minify: true, sourcemap: false, dts: false,
  noExternal: [/.*/], define: { "process.env.NODE_ENV": '"production"' },
  esbuildOptions(options) { options.alias = { mesurer: resolve(app, "../../packages/mesurer/index.ts") }; },
});
for (const file of ["plugin.json", "README.md", "skills"]) await cp(resolve(app, file), resolve(out, file), { recursive: true });
await mkdir(resolve(out, "assets"), { recursive: true });
await cp(resolve(app, "../site/public/favicon.png"), resolve(out, "assets/icon.png"));
await cp(resolve(app, "../site/public/logo.png"), resolve(out, "assets/logo.png"));
await cp(resolve(app, "../../packages/mesurer/LICENSE"), resolve(out, "LICENSE"));
const bundle = await readFile(resolve(out, "skills/mesurer/assets/launcher.global.js"));
await writeFile(resolve(out, "skills/mesurer/assets/launcher.sha256"), createHash("sha256").update(bundle).digest("hex") + "\n");
const marketplace = { name: "mesurer-dev", interface: { displayName: "Mesurer development" }, plugins: [{
  name: "mesurer", source: { source: "local", path: "./mesurer" },
  policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" }, category: "Developer Tools",
}] };
await mkdir(resolve(app, "dist/.agents/plugins"), { recursive: true });
await writeFile(resolve(app, "dist/.agents/plugins/marketplace.json"), JSON.stringify(marketplace, null, 2) + "\n");
console.log(`Plugin built: ${out}`);

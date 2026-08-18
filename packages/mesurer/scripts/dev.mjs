import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { watch } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = path.join(packageDir, "styles.generated.css");
const tsPath = path.join(packageDir, "styles.generated.ts");

const syncStyles = () => {
  if (!existsSync(cssPath)) return;
  const css = readFileSync(cssPath, "utf8");
  const source = `export const MESURER_STYLES = ${JSON.stringify(css)};\n`;
  if (existsSync(tsPath) && readFileSync(tsPath, "utf8") === source) return;
  writeFileSync(tsPath, source, "utf8");
};

const children = [
  spawn("pnpm", ["exec", "tsup", "--watch"], {
    cwd: packageDir,
    stdio: "inherit",
  }),
  spawn(
    "pnpm",
    ["exec", "tailwindcss", "-i", "styles.css", "-o", "styles.generated.css", "--watch"],
    { cwd: packageDir, stdio: "inherit" },
  ),
];

const close = () => {
  for (const child of children) child.kill("SIGINT");
  process.exit(0);
};

syncStyles();
watch(packageDir, (_event, filename) => {
  if (filename === "styles.generated.css") syncStyles();
});
process.on("SIGINT", close);
process.on("SIGTERM", close);

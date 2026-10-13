import { execFileSync } from "node:child_process";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const app = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(`${app}/dist/mesurer/plugin.json`, "utf8"));
await access(`${app}/dist/mesurer/skills/mesurer/assets/launcher.global.js`);
const name = `mesurer-codex-${manifest.version}.zip`;
execFileSync("zip", ["-q", "-r", `../${name}`, "."], { cwd: `${app}/dist/mesurer` });
console.log(`${app}/dist/${name}`);

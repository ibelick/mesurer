import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(extensionRoot, "dist");
const manifest = JSON.parse(await readFile(path.join(distRoot, "manifest.json"), "utf8"));
const requiredFiles = [
  manifest.background?.service_worker,
  ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
].filter(Boolean);

if ((manifest.content_scripts ?? []).some((script) => (script.js ?? []).includes("capture-bridge.js"))) {
  throw new Error("Extension build must not expose the screenshot capture bridge");
}

try {
  await access(path.join(distRoot, "capture-bridge.js"));
  throw new Error("Extension build must not contain capture-bridge.js");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

await Promise.all(
  requiredFiles.map(async (file) => {
    try {
      await access(path.join(distRoot, file));
    } catch {
      throw new Error(`Extension build is missing ${file}`);
    }
  }),
);

if (manifest.manifest_version !== 3) {
  throw new Error("Extension manifest must use Manifest V3");
}

const generatedFiles = await readdir(distRoot);
for (const file of generatedFiles.filter((name) => name.endsWith(".js"))) {
  const source = await readFile(path.join(distRoot, file), "utf8");
  if (source.includes("mesurer:capture-bridge-")) {
    throw new Error(`Extension build contains capture bridge code in ${file}`);
  }
}

console.log(`Validated extension build ${manifest.name} ${manifest.version}`);

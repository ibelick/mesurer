import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await rm(path.join(extensionRoot, "dist"), { recursive: true, force: true });

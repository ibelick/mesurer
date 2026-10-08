import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(extensionRoot, "dist");
// Measured baseline and rationale: ../BUNDLE_SIZE.md. Keep increases reviewable.
const maxContentGzipBytes = 214 * 1024;

const getFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getFiles(filePath)));
    } else {
      files.push(filePath);
    }
  }

  return files;
};

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const files = await getFiles(distRoot);
const sizes = await Promise.all(
  files.map(async (filePath) => ({
    filePath,
    bytes: (await stat(filePath)).size,
  })),
);
const totalBytes = sizes.reduce((total, file) => total + file.bytes, 0);
const contentPath = path.join(distRoot, "content.js");
const content = await readFile(contentPath);
const contentGzipBytes = gzipSync(content, { level: 9 }).length;

console.log(`Extension package files: ${formatKiB(totalBytes)}`);
console.log(`content.js: ${formatKiB(content.length)}`);
console.log(`content.js gzip: ${formatKiB(contentGzipBytes)}`);
console.log(`content.js gzip headroom: ${formatKiB(maxContentGzipBytes - contentGzipBytes)}`);

if (contentGzipBytes > maxContentGzipBytes) {
  throw new Error(
    `content.js gzip budget exceeded: ${formatKiB(contentGzipBytes)} > ${formatKiB(maxContentGzipBytes)}`,
  );
}

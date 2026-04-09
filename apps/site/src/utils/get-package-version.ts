import packageManifest from "../../../../packages/mesurer/package.json";

type PackageManifest = {
  version?: string;
};

const manifest = packageManifest as PackageManifest;

export function getPackageVersion() {
  return manifest.version ?? "0.0.0";
}

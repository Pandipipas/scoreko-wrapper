import path from "node:path";
import fs from "node:fs";

export const electronRoot = process.cwd();

const envPath = path.join(electronRoot, ".env");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export const bundleRoot = path.resolve(electronRoot, "..");
export const nodecgRuntimeRoot = path.join(electronRoot, "lib", "nodecg");
export const nodecgRuntimeNodeModules = path.join(
  nodecgRuntimeRoot,
  "node_modules",
);
export const bundleName = process.env.NODECG_BUNDLE_NAME?.trim() || "scoreko";
export const runtimeBundleRoot = path.join(
  nodecgRuntimeRoot,
  "bundles",
  bundleName,
);
export const runtimeNpmCache =
  process.env.npm_config_cache ?? path.join(electronRoot, ".npm-runtime-cache");
export const electronCache =
  process.env.ELECTRON_CACHE ?? path.join(electronRoot, ".electron-cache");

export const bundleRootMarkers = ["package.json", "package-lock.json"];
export const generatedBundleEntries = [
  "extension",
  "node_modules/.vite",
  "shared/dist",
  "dashboard",
  "graphics",
];
export const preparedBundleEntries = [
  "assets",
  "dashboard",
  "extension",
  "graphics",
  "schemas",
  "shared",
  "configschema.json",
  "LICENSE",
  "package.json",
  "README.md",
];
export const requiredPreparedBundleEntries = [
  "dashboard",
  "extension",
  "graphics",
  "schemas",
  "shared",
  "package.json",
];

export function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function getLocalBinPath(commandName) {
  const extension = process.platform === "win32" ? ".CMD" : "";
  return path.join(
    bundleRoot,
    "node_modules",
    ".bin",
    `${commandName}${extension}`,
  );
}

export function getPathInside(rootPath, relativePath) {
  const resolvedRoot = path.resolve(rootPath);
  const targetPath = path.resolve(resolvedRoot, relativePath);
  const pathFromRoot = path.relative(resolvedRoot, targetPath);

  if (
    !pathFromRoot ||
    pathFromRoot.startsWith("..") ||
    path.isAbsolute(pathFromRoot)
  ) {
    throw new Error(
      `Refusing to access path outside ${resolvedRoot}: ${targetPath}`,
    );
  }

  return targetPath;
}

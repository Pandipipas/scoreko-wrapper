import fs from "node:fs/promises";
import path from "node:path";
import { getManagedNodecgRuntimePath } from "../app/paths";
import electronLog from "electron-log";

type RuntimeProvisionerConfig = {
  sourceRuntimePath: string;
  userDataPath: string;
  appVersion: string;
  bundleName: string;
  onProgress?: (percent: number, text: string) => void;
};

export type PreparedNodecgRuntime = {
  runtimePath: string;
  installed: boolean;
};

const MANAGED_RUNTIME_MARKER = ".scoreko-installed-runtime.json";
const WRITABLE_NODECG_DIRS = ["cfg", "db", "logs"] as const;
const MANAGED_RUNTIME_ENTRIES = [
  "index.js",
  "package.json",
  "package-lock.json",
  "node_modules",
  "bundles",
] as const;

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function checkIfNeedsInstall(
  config: RuntimeProvisionerConfig,
): Promise<boolean> {
  const targetRuntimePath = getManagedNodecgRuntimePath(config.userDataPath);
  return shouldInstallRuntime(
    config.sourceRuntimePath,
    targetRuntimePath,
    config.appVersion,
    config.bundleName,
  );
}

export async function prepareUserNodecgRuntime({
  sourceRuntimePath,
  userDataPath,
  appVersion,
  bundleName,
  onProgress,
}: RuntimeProvisionerConfig): Promise<PreparedNodecgRuntime> {
  const targetRuntimePath = getManagedNodecgRuntimePath(userDataPath);

  await validateSourceRuntime(sourceRuntimePath, bundleName);
  await fs.mkdir(targetRuntimePath, { recursive: true });

  const installed = await shouldInstallRuntime(
    sourceRuntimePath,
    targetRuntimePath,
    appVersion,
    bundleName,
  );

  if (installed) {
    electronLog.info(
      `Installing managed NodeCG runtime into ${targetRuntimePath}`,
    );
    await installManagedRuntime(
      sourceRuntimePath,
      targetRuntimePath,
      appVersion,
      bundleName,
      onProgress,
    );
  }

  await Promise.all(
    WRITABLE_NODECG_DIRS.map((dir) =>
      fs.mkdir(path.join(targetRuntimePath, dir), { recursive: true }),
    ),
  );

  const nodecgCfgPath = path.join(targetRuntimePath, "cfg", "nodecg.json");
  const existingCfg = (await readJson(nodecgCfgPath)) || {};
  await fs.writeFile(
    nodecgCfgPath,
    JSON.stringify({ ...existingCfg, host: "127.0.0.1" }, null, 2) + "\n",
  );

  return { runtimePath: targetRuntimePath, installed };
}

async function validateSourceRuntime(
  sourceRuntimePath: string,
  bundleName: string,
): Promise<void> {
  const requiredPaths = [
    sourceRuntimePath,
    path.join(sourceRuntimePath, "index.js"),
    path.join(sourceRuntimePath, "package.json"),
    path.join(
      sourceRuntimePath,
      "node_modules",
      "nodecg",
      "dist",
      "server",
      "bootstrap.js",
    ),
    path.join(sourceRuntimePath, "bundles", bundleName, "package.json"),
  ];

  const existence = await Promise.all(requiredPaths.map((p) => exists(p)));
  const missingPaths = requiredPaths.filter((_, i) => !existence[i]);

  if (missingPaths.length > 0) {
    throw new Error(
      `The packaged NodeCG runtime is incomplete. Missing: ${missingPaths.join(", ")}`,
    );
  }
}

async function shouldInstallRuntime(
  sourceRuntimePath: string,
  targetRuntimePath: string,
  appVersion: string,
  bundleName: string,
): Promise<boolean> {
  const targetBootstrap = path.join(
    targetRuntimePath,
    "node_modules",
    "nodecg",
    "dist",
    "server",
    "bootstrap.js",
  );
  const targetBundlePackage = path.join(
    targetRuntimePath,
    "bundles",
    bundleName,
    "package.json",
  );

  const [hasBootstrap, hasBundlePackage] = await Promise.all([
    exists(targetBootstrap),
    exists(targetBundlePackage),
  ]);

  if (!hasBootstrap || !hasBundlePackage) {
    return true;
  }

  const [targetMarker, sourceMarker] = await Promise.all([
    readJson(path.join(targetRuntimePath, MANAGED_RUNTIME_MARKER)),
    readJson(path.join(sourceRuntimePath, ".scoreko-runtime.json")),
  ]);

  return (
    targetMarker?.appVersion !== appVersion ||
    targetMarker?.bundleName !== bundleName ||
    targetMarker?.sourceRuntime?.bundleVersion !==
      sourceMarker?.bundleVersion ||
    targetMarker?.sourceRuntime?.generatedAt !== sourceMarker?.generatedAt ||
    targetMarker?.sourceRuntime?.nodecgVersion !== sourceMarker?.nodecgVersion
  );
}

async function installManagedRuntime(
  sourceRuntimePath: string,
  targetRuntimePath: string,
  appVersion: string,
  bundleName: string,
  onProgress?: (percent: number, text: string) => void,
): Promise<void> {
  await Promise.all(
    MANAGED_RUNTIME_ENTRIES.map(async (entry) => {
      try {
        await fs.rm(path.join(targetRuntimePath, entry), {
          recursive: true,
          force: true,
        });
      } catch {}
    }),
  );

  const total = MANAGED_RUNTIME_ENTRIES.length;
  let index = 0;

  for (const entry of MANAGED_RUNTIME_ENTRIES) {
    const sourcePath = path.join(sourceRuntimePath, entry);
    const targetPath = path.join(targetRuntimePath, entry);

    if (!(await exists(sourcePath))) continue;

    onProgress?.(Math.round((index / total) * 30), `Linking ${entry}...`);

    const stats = await fs.stat(sourcePath);
    if (stats.isDirectory()) {
      await fs.symlink(sourcePath, targetPath, "junction");
    } else {
      await fs.cp(sourcePath, targetPath, {
        recursive: true,
        force: true,
        dereference: true,
      });
    }
    index++;
  }

  onProgress?.(30, "Files linked. Preparing environment...");
}

export async function finalizeUserNodecgRuntime({
  sourceRuntimePath,
  userDataPath,
  appVersion,
  bundleName,
}: RuntimeProvisionerConfig): Promise<void> {
  const targetRuntimePath = getManagedNodecgRuntimePath(userDataPath);
  const sourceRuntime = await readJson(
    path.join(sourceRuntimePath, ".scoreko-runtime.json"),
  );
  await fs.writeFile(
    path.join(targetRuntimePath, MANAGED_RUNTIME_MARKER),
    JSON.stringify(
      {
        appVersion,
        bundleName,
        sourceRuntime,
        installedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
}

async function readJson(filePath: string): Promise<any> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

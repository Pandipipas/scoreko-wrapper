#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  bundleName,
  bundleRoot,
  getNpmCommand,
  nodecgRuntimeNodeModules,
  nodecgRuntimeRoot,
  preparedBundleEntries,
  requiredPreparedBundleEntries,
  runtimeBundleRoot,
  runtimeNpmCache,
} from "./build-config.mjs";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function copyIfExists(source, destination) {
  if (!existsSync(source)) {
    return false;
  }

  cpSync(source, destination, {
    recursive: true,
    force: true,
    dereference: true,
    filter: (sourcePath) =>
      !sourcePath.split(path.sep).includes("node_modules"),
  });
  return true;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      npm_config_cache: runtimeNpmCache,
    },
  });

  if (result.error) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with code ${result.status}`,
    );
  }
}

function getInstalledNodecgVersion() {
  const nodecgPackagePath = path.join(
    bundleRoot,
    "node_modules",
    "nodecg",
    "package.json",
  );

  if (!existsSync(nodecgPackagePath)) {
    throw new Error(
      [
        "NodeCG is not installed in the parent project.",
        `Expected: ${nodecgPackagePath}`,
        `Run 'npm install' from ${bundleRoot} before packaging.`,
      ].join("\n"),
    );
  }

  return readJson(nodecgPackagePath).version;
}

function assertBundleBuildExists() {
  for (const entry of requiredPreparedBundleEntries) {
    const source = path.join(bundleRoot, entry);
    if (!existsSync(source)) {
      throw new Error(
        [
          `The built Scoreko bundle is missing '${entry}'.`,
          `Expected: ${source}`,
          `Run 'npm run build' from ${bundleRoot} before packaging.`,
        ].join("\n"),
      );
    }
  }
}

function createRuntimePackageJson() {
  const bundlePackageJson = readJson(path.join(bundleRoot, "package.json"));
  const dependencies = {
    nodecg: getInstalledNodecgVersion(),
    ...(bundlePackageJson.dependencies ?? {}),
  };

  writeFileSync(
    path.join(nodecgRuntimeRoot, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        name: "scoreko-nodecg-runtime",
        version: bundlePackageJson.version ?? "0.0.0",
        description: "Packaged NodeCG runtime for Scoreko Desktop.",
        type: "commonjs",
        scripts: {
          start: "node index.js",
        },
        dependencies,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    path.join(nodecgRuntimeRoot, "index.js"),
    'require("nodecg");\n',
  );
}

function cleanupRuntimeDependencies() {
  const dirsToRemove = ["prettier", "@types"];

  for (const dir of dirsToRemove) {
    const dirPath = path.join(nodecgRuntimeNodeModules, dir);
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }

  const extsToRemove = [".md", ".map", ".d.ts"];
  const prefixesToRemove = ["license", "changelog", "readme"];

  function cleanDirectory(dir) {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        cleanDirectory(fullPath);
      } else if (entry.isSymbolicLink() && !existsSync(fullPath)) {
        rmSync(fullPath, { force: true });
      } else {
        const name = entry.name.toLowerCase();
        const shouldRemove =
          extsToRemove.some((ext) => name.endsWith(ext)) ||
          prefixesToRemove.some((prefix) => name.startsWith(prefix));

        if (shouldRemove) {
          rmSync(fullPath, { force: true });
        }
      }
    }
  }

  cleanDirectory(nodecgRuntimeNodeModules);
}

function copyBundle() {
  mkdirSync(runtimeBundleRoot, { recursive: true });

  for (const entry of preparedBundleEntries) {
    copyIfExists(
      path.join(bundleRoot, entry),
      path.join(runtimeBundleRoot, entry),
    );
  }
}

function writeManifest() {
  const bundlePackageJson = readJson(path.join(bundleRoot, "package.json"));
  const runtimePackageJson = readJson(
    path.join(nodecgRuntimeRoot, "package.json"),
  );

  writeFileSync(
    path.join(nodecgRuntimeRoot, ".scoreko-runtime.json"),
    `${JSON.stringify(
      {
        bundleName,
        bundleVersion: bundlePackageJson.version ?? "0.0.0",
        nodecgVersion: runtimePackageJson.dependencies.nodecg,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

function installRuntimeDependencies() {
  if (process.env.SCOREKO_SKIP_RUNTIME_NPM_INSTALL === "1") {
    console.log(
      "[prepare-runtime] Skipping runtime npm install by environment request.",
    );
    return;
  }

  run(
    getNpmCommand(),
    ["install", "--omit=dev", "--no-audit", "--no-fund"],
    nodecgRuntimeRoot,
  );
}

function main() {
  assertBundleBuildExists();

  rmSync(nodecgRuntimeRoot, { recursive: true, force: true });
  mkdirSync(nodecgRuntimeNodeModules, { recursive: true });
  mkdirSync(path.join(nodecgRuntimeRoot, "bundles"), { recursive: true });

  createRuntimePackageJson();
  copyBundle();
  installRuntimeDependencies();
  cleanupRuntimeDependencies();
  writeManifest();

  console.log(`[prepare-runtime] NodeCG runtime ready at ${nodecgRuntimeRoot}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

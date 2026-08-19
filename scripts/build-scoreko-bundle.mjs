#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  bundleRoot,
  bundleRootMarkers,
  electronRoot,
  generatedBundleEntries,
  getLocalBinPath,
  getPathInside,
} from "./build-config.mjs";

const nodeModulesPath = path.join(bundleRoot, "node_modules");

const missingMarkers = bundleRootMarkers
  .map((entry) => path.join(bundleRoot, entry))
  .filter((candidatePath) => !existsSync(candidatePath));

if (missingMarkers.length > 0) {
  console.error(
    [
      `Scoreko bundle root was not found at: ${bundleRoot}`,
      "This Electron package expects to live inside the Scoreko repository with the bundle project as its parent.",
      ...missingMarkers.map((candidatePath) => `Missing: ${candidatePath}`),
    ].join("\n"),
  );
  process.exit(1);
}

if (!existsSync(nodeModulesPath)) {
  console.error(
    [
      "The Scoreko bundle dependencies are not installed.",
      `Run this once from ${bundleRoot}:`,
      "  npm install",
    ].join("\n"),
  );
  process.exit(1);
}

const childEnv = {
  ...process.env,
  COREPACK_HOME:
    process.env.COREPACK_HOME ?? path.join(electronRoot, ".corepack"),
  PATH: `${path.join(bundleRoot, "node_modules", ".bin")}${path.delimiter}${process.env.PATH ?? ""}`,
};

/**
 * Removes generated bundle output from the parent Scoreko workspace.
 *
 * @param {string} relativePath Generated path relative to the bundle root.
 * @throws {Error} When the path would escape the bundle root.
 */
function removeGeneratedOutput(relativePath) {
  const targetPath = getPathInside(bundleRoot, relativePath);
  rmSync(targetPath, { recursive: true, force: true });
}

/**
 * Runs a build command in the parent bundle workspace.
 *
 * @param {string} command Executable path.
 * @param {string[]} args Command arguments.
 */
function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: bundleRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: childEnv,
  });

  if (result.error) {
    console.error(
      `Could not run '${command} ${args.join(" ")}': ${result.error.message}`,
    );
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const entry of generatedBundleEntries) {
  removeGeneratedOutput(entry);
}

for (const entry of ["shared/dist", "dashboard", "graphics", "extension"]) {
  mkdirSync(path.join(bundleRoot, entry), { recursive: true });
}

runCommand(getLocalBinPath("vite"), ["build", "--configLoader", "runner"]);
runCommand(getLocalBinPath("tsc"), ["-b", "tsconfig.extension.json"]);

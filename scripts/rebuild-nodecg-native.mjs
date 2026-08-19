import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

import {
  electronCache,
  electronRoot,
  nodecgRuntimeRoot,
  runtimeNpmCache,
} from "./build-config.mjs";

const { values: parsedArgs } = parseArgs({
  args: process.argv.slice(2),
  options: {
    arch: { type: "string" },
    platform: { type: "string" },
  },
  strict: false,
});

function getElectronVersion() {
  try {
    const electronPackageJson = JSON.parse(
      readFileSync(
        path.join(electronRoot, "node_modules", "electron", "package.json"),
        "utf8",
      ),
    );
    return electronPackageJson.version;
  } catch {
    const packageJson = JSON.parse(
      readFileSync(path.join(electronRoot, "package.json"), "utf8"),
    );
    const electronVersionRaw =
      packageJson.devDependencies?.electron ??
      packageJson.dependencies?.electron;
    return electronVersionRaw
      ? electronVersionRaw.replace(/^[\^~]/, "")
      : undefined;
  }
}

const electronVersion = getElectronVersion();

if (!electronVersion) {
  console.error("Could not determine Electron version from package.json.");
  process.exit(1);
}

if (!existsSync(path.join(nodecgRuntimeRoot, "package.json"))) {
  console.error(
    "No packaged NodeCG runtime found. Run npm run prepare:runtime first.",
  );
  process.exit(1);
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        npm_config_runtime: "electron",
        npm_config_target: electronVersion,
        npm_config_disturl: "https://electronjs.org/headers",
        ...(parsedArgs.arch ? { npm_config_arch: parsedArgs.arch } : {}),
        ...(parsedArgs.platform
          ? { npm_config_platform: parsedArgs.platform }
          : {}),
        npm_config_cache: runtimeNpmCache,
        ELECTRON_CACHE: electronCache,
      },
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`${command} ${args.join(" ")} failed with code ${code}`),
        );
      }
    });
  });
}

const targetPlatform = parsedArgs.platform || process.env.npm_config_platform;
const targetArch = parsedArgs.arch || process.env.npm_config_arch;

const buildArgs = [
  "electron-rebuild",
  "-v",
  electronVersion,
  "-m",
  nodecgRuntimeRoot,
  "-o",
  "better-sqlite3",
  "-f",
];

if (targetArch) {
  buildArgs.push("-a", targetArch);
}

if (targetPlatform) {
  buildArgs.push("--platform", targetPlatform);
}

console.log(
  `\n[rebuild-native] Rebuilding better-sqlite3 for Electron ${electronVersion} in: ${nodecgRuntimeRoot}`,
);
await run(
  process.platform === "win32" ? "npx.cmd" : "npx",
  buildArgs,
  nodecgRuntimeRoot,
);

console.log("\n[rebuild-native] Done.");

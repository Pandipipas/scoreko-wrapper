import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const FORBIDDEN_MAIN_SURFACE_PATTERNS: Array<{
  label: string;
  pattern: RegExp;
}> = [
  { label: "ipcMain", pattern: /\bipcMain\b/ },
  { label: "ipcRenderer", pattern: /\bipcRenderer\b/ },
  { label: "contextBridge", pattern: /\bcontextBridge\b/ },
  { label: "preload", pattern: /\bpreload\b/ },
];

const ALLOWLIST = [
  "src/main/windows/changelog-preload.ts",
  "src/main/windows/changelog-window.ts",
];

test("main source does not expose IPC or preload surface", () => {
  const sourceRoot = path.join(process.cwd(), "src", "main");
  const failures: string[] = [];

  for (const filePath of readTypeScriptFiles(sourceRoot)) {
    const relativePath = path
      .relative(process.cwd(), filePath)
      .replace(/\\/g, "/");
    if (ALLOWLIST.includes(relativePath)) {
      continue;
    }

    const contents = fs.readFileSync(filePath, "utf8");

    for (const { label, pattern } of FORBIDDEN_MAIN_SURFACE_PATTERNS) {
      if (pattern.test(contents)) {
        failures.push(
          `${path.relative(process.cwd(), filePath)} contains ${label}`,
        );
      }
    }
  }

  assert.deepEqual(failures, []);
});

function readTypeScriptFiles(directoryPath: string): string[] {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...readTypeScriptFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

import fs from "node:fs";
import path from "node:path";

import { AppRuntimeConfig } from "../config/runtime-config";

export function resolveAppIconPath(
  appConfig: AppRuntimeConfig,
  rootPath: string,
  pathExists: (candidatePath: string) => boolean = fs.existsSync,
): string | undefined {
  const iconCandidates = [
    appConfig.iconPathOverride,
    path.join(rootPath, "static", "icons", "icon.ico"),
    path.join(rootPath, "static", "icons", "icon.png"),
    path.join(rootPath, "static", "icon.ico"),
    path.join(rootPath, "static", "icon.png"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return iconCandidates.find((candidate) => pathExists(candidate));
}

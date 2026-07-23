import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { AppRuntimeConfig } from "../main/config/runtime-config";
import { resolveAppIconPath } from "../main/windows/icon-path";

function getBaseConfig(): AppRuntimeConfig {
  return {
    title: "Scoreko",
    userModelId: "com.scoreko.desktop",
    userDataDirectoryName: "scoreko",
    nodecgPort: "9090",
    bundleName: "scoreko",
    mainDashboardRoute: "dashboard/scoreko/main.html?standalone=true",
    loadDelayMs: 10000,
    startupTimeoutMs: 30000,
    nodecgKillTimeoutMs: 2500,
    updatesEnabled: true,
    updateCheckDelayMs: 5000,
  };
}

test("resolveAppIconPath prioritizes iconPathOverride when present", () => {
  const appConfig: AppRuntimeConfig = {
    ...getBaseConfig(),
    iconPathOverride: "/custom/icon.ico",
  };

  const iconPath = resolveAppIconPath(
    appConfig,
    "/app",
    (candidate) => candidate === "/custom/icon.ico",
  );

  assert.equal(iconPath, "/custom/icon.ico");
});

test("resolveAppIconPath falls back to the first existing default icon", () => {
  const appConfig = getBaseConfig();
  const expectedIconPath = path.join("/app", "static", "icons", "icon.png");

  const iconPath = resolveAppIconPath(
    appConfig,
    "/app",
    (candidate) => candidate === expectedIconPath,
  );

  assert.equal(iconPath, expectedIconPath);
});

test("resolveAppIconPath returns undefined when no icons exist", () => {
  const appConfig = getBaseConfig();

  const iconPath = resolveAppIconPath(appConfig, "/app", () => false);

  assert.equal(iconPath, undefined);
});

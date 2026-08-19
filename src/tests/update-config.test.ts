import assert from "node:assert/strict";
import test from "node:test";

import { AppRuntimeConfig } from "../main/config/runtime-config";
import { loadUpdateSettings } from "../main/updates/update-config";

const baseConfig: AppRuntimeConfig = {
  title: "Scoreko",
  userModelId: "com.scoreko.desktop",
  userDataDirectoryName: "scoreko",
  nodecgPort: "9090",
  bundleName: "scoreko",
  mainDashboardRoute: "dashboard/scoreko/main.html?standalone=true",
  loadDelayMs: 0,
  startupTimeoutMs: 30000,
  nodecgKillTimeoutMs: 2500,
  updatesEnabled: true,
  updateCheckDelayMs: 5000,
};

test("loadUpdateSettings keeps updates disabled when the runtime config disables them", () => {
  const settings = loadUpdateSettings({
    ...baseConfig,
    updatesEnabled: false,
  });

  assert.equal(settings.enabled, false);
});

test("loadUpdateSettings lets runtime config specify settings", () => {
  const settings = loadUpdateSettings({
    ...baseConfig,
    updatesEnabled: true,
  });

  assert.deepEqual(settings, {
    enabled: true,
  });
});

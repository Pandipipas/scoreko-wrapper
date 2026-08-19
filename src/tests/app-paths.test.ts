import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  getApplicationPaths,
  getDashboardUrl,
  getManagedNodecgRuntimePath,
  getNodecgBaseUrl,
  getRootPath,
  getSafeChildPath,
  getSourceNodecgRuntimePath,
  getUpdateDownloadDirectory,
  getUserDataPath,
} from "../main/app/paths";

test("app path helpers build deterministic development paths and URLs", () => {
  const compiledMainDir = path.join("repo", "dist", "main");
  const rootPath = getRootPath(true, compiledMainDir, "/resources");

  assert.equal(rootPath, path.resolve(compiledMainDir, "../.."));
  assert.equal(
    getSourceNodecgRuntimePath(rootPath),
    path.resolve(rootPath, "lib", "nodecg"),
  );
  assert.equal(
    getUserDataPath("/app-data", "scoreko"),
    path.join("/app-data", "scoreko"),
  );
  assert.equal(
    getManagedNodecgRuntimePath("/app-data/scoreko"),
    path.join("/app-data/scoreko", "nodecg"),
  );
  assert.equal(
    getUpdateDownloadDirectory("/tmp"),
    path.join("/tmp", "scoreko-updates"),
  );
  assert.equal(getNodecgBaseUrl("9090"), "http://127.0.0.1:9090");
  assert.equal(
    getDashboardUrl("9090", "scoreko", "dashboard/main.html?standalone=true"),
    "http://localhost:9090/bundles/scoreko/dashboard/main.html?standalone=true",
  );
});

test("getApplicationPaths keeps packaged root under Electron resources", () => {
  const paths = getApplicationPaths({
    appConfig: {
      userDataDirectoryName: "scoreko",
      nodecgPort: "9090",
      bundleName: "scoreko",
      mainDashboardRoute: "dashboard/scoreko/main.html?standalone=true",
    },
    appDataPath: "/users/test/AppData/Roaming",
    compiledMainDir: "/app/dist/main",
    isDev: false,
    resourcesPath: "/opt/Scoreko/resources",
  });

  assert.equal(paths.rootPath, "/opt/Scoreko/resources");
  assert.equal(
    paths.sourceNodecgRuntimePath,
    path.resolve("/opt/Scoreko/resources", "lib", "nodecg"),
  );
  assert.equal(
    paths.userDataPath,
    path.join("/users/test/AppData/Roaming", "scoreko"),
  );
  assert.equal(paths.nodecgBaseUrl, "http://127.0.0.1:9090");
});

test("getSafeChildPath rejects path traversal", () => {
  assert.equal(
    getSafeChildPath("/tmp/scoreko-updates", "setup.exe"),
    path.resolve("/tmp/scoreko-updates/setup.exe"),
  );
  assert.throws(
    () => getSafeChildPath("/tmp/scoreko-updates", "../setup.exe"),
    /outside/,
  );
});

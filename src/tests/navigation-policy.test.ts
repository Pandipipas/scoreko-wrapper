import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldAllowInternalNavigation,
  shouldOpenExternalNavigation,
} from "../main/windows/navigation";

const dashboardUrl =
  "http://localhost:9090/bundles/scoreko/dashboard/main.html";

test("shouldAllowInternalNavigation allows expected internal navigation", () => {
  assert.equal(
    shouldAllowInternalNavigation(
      "http://127.0.0.1:9090/bundles/scoreko/dashboard/page.html",
      dashboardUrl,
    ),
    true,
  );
});

test("shouldAllowInternalNavigation rejects disallowed host", () => {
  assert.equal(
    shouldAllowInternalNavigation(
      "http://evil.local:9090/bundles/scoreko/dashboard/page.html",
      dashboardUrl,
    ),
    false,
  );
});

test("shouldAllowInternalNavigation rejects different port", () => {
  assert.equal(
    shouldAllowInternalNavigation(
      "http://localhost:8080/bundles/scoreko/dashboard/page.html",
      dashboardUrl,
    ),
    false,
  );
});

test("shouldAllowInternalNavigation rejects unsafe schemes", () => {
  assert.equal(
    shouldAllowInternalNavigation("javascript:alert(1)", dashboardUrl),
    false,
  );
});

test("shouldOpenExternalNavigation allows safe external protocols", () => {
  assert.equal(shouldOpenExternalNavigation("https://scoreko.com/docs"), true);
  assert.equal(shouldOpenExternalNavigation("mailto:test@scoreko.com"), true);
});

test("shouldOpenExternalNavigation rejects unsafe protocols", () => {
  assert.equal(shouldOpenExternalNavigation("file:///etc/passwd"), false);
  assert.equal(shouldOpenExternalNavigation("javascript:alert(1)"), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  getEnv,
  getOptionalEnv,
  parseEnvBool,
  parseEnvIntInRange,
  parseEnvPort,
  loadEnvFile,
  getRuntimeConfig,
  getRequiredEnv,
  parseRequiredEnvIntInRange,
  parseRequiredEnvBool,
  parseRequiredEnvPort,
} from "../main/config/runtime-config";

function withEnv(
  name: string,
  value: string | undefined,
  run: () => void,
): void {
  const previousValue = process.env[name];

  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }

  try {
    run();
  } finally {
    if (previousValue === undefined) {
      delete process.env[name];
      return;
    }

    process.env[name] = previousValue;
  }
}

function withEnvs(
  envs: Record<string, string | undefined>,
  run: () => void,
): void {
  const previousValues: Record<string, string | undefined> = {};
  for (const name of Object.keys(envs)) {
    previousValues[name] = process.env[name];
    if (envs[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = envs[name];
    }
  }

  try {
    run();
  } finally {
    for (const name of Object.keys(envs)) {
      if (previousValues[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previousValues[name];
      }
    }
  }
}

test("getOptionalEnv returns undefined for missing variable", () => {
  withEnv("TEST_OPTIONAL_ENV", undefined, () => {
    assert.equal(getOptionalEnv("TEST_OPTIONAL_ENV"), undefined);
  });
});

test("getOptionalEnv trims spaces and returns value", () => {
  withEnv("TEST_OPTIONAL_ENV", "  scoreko  ", () => {
    assert.equal(getOptionalEnv("TEST_OPTIONAL_ENV"), "scoreko");
  });
});

test("getEnv returns fallback for empty value", () => {
  withEnv("TEST_ENV", "   ", () => {
    assert.equal(getEnv("TEST_ENV", "fallback"), "fallback");
  });
});

test("getEnv returns the value when present", () => {
  withEnv("TEST_ENV", "value", () => {
    assert.equal(getEnv("TEST_ENV", "fallback"), "value");
  });
});

test("parseEnvIntInRange hard-fails for out-of-range values", () => {
  withEnv("TEST_ENV_INT_RANGE", "999", () => {
    assert.throws(
      () => parseEnvIntInRange("TEST_ENV_INT_RANGE", 100, 0, 100),
      /must be an integer/,
    );
  });
});

test("parseEnvIntInRange accepts valid value", () => {
  withEnv("TEST_ENV_INT_RANGE", "42", () => {
    assert.equal(parseEnvIntInRange("TEST_ENV_INT_RANGE", 100, 0, 100), 42);
  });
});

test("parseEnvPort validates TCP range", () => {
  withEnv("TEST_ENV_PORT", "70000", () => {
    assert.throws(
      () => parseEnvPort("TEST_ENV_PORT", "9090"),
      /valid TCP port/,
    );
  });
});

test("parseEnvPort normalizes valid port", () => {
  withEnv("TEST_ENV_PORT", "009090", () => {
    assert.equal(parseEnvPort("TEST_ENV_PORT", "9090"), "9090");
  });
});

test("parseEnvBool accepts common true and false values", () => {
  withEnv("TEST_ENV_BOOL", "yes", () => {
    assert.equal(parseEnvBool("TEST_ENV_BOOL", false), true);
  });

  withEnv("TEST_ENV_BOOL", "off", () => {
    assert.equal(parseEnvBool("TEST_ENV_BOOL", true), false);
  });
});

test("parseEnvBool rejects invalid values", () => {
  withEnv("TEST_ENV_BOOL", "maybe", () => {
    assert.throws(
      () => parseEnvBool("TEST_ENV_BOOL", true),
      /must be a boolean/,
    );
  });
});

test("loadEnvFile throws on non-existent file", async () => {
  const missingPath = path.join(__dirname, "does-not-exist-.env");
  await assert.rejects(
    () => loadEnvFile(missingPath),
    /Required configuration file not found/,
  );
});

test("getRequiredEnv throws on missing or empty variable", () => {
  withEnv("TEST_REQUIRED_ENV", undefined, () => {
    assert.throws(() => getRequiredEnv("TEST_REQUIRED_ENV"), /not defined/);
  });

  withEnv("TEST_REQUIRED_ENV", "   ", () => {
    assert.throws(() => getRequiredEnv("TEST_REQUIRED_ENV"), /not defined/);
  });
});

test("getRequiredEnv returns trimmed value when present", () => {
  withEnv("TEST_REQUIRED_ENV", "   scoreko-app   ", () => {
    assert.equal(getRequiredEnv("TEST_REQUIRED_ENV"), "scoreko-app");
  });
});

test("parseRequiredEnvIntInRange validates required integer and throws if missing", () => {
  withEnv("TEST_REQ_INT", undefined, () => {
    assert.throws(
      () => parseRequiredEnvIntInRange("TEST_REQ_INT", 0, 100),
      /not defined/,
    );
  });

  withEnv("TEST_REQ_INT", "150", () => {
    assert.throws(
      () => parseRequiredEnvIntInRange("TEST_REQ_INT", 0, 100),
      /must be an integer/,
    );
  });

  withEnv("TEST_REQ_INT", "42", () => {
    assert.equal(parseRequiredEnvIntInRange("TEST_REQ_INT", 0, 100), 42);
  });
});

test("parseRequiredEnvBool validates required boolean and throws if missing", () => {
  withEnv("TEST_REQ_BOOL", undefined, () => {
    assert.throws(() => parseRequiredEnvBool("TEST_REQ_BOOL"), /not defined/);
  });

  withEnv("TEST_REQ_BOOL", "maybe", () => {
    assert.throws(
      () => parseRequiredEnvBool("TEST_REQ_BOOL"),
      /must be a boolean/,
    );
  });

  withEnv("TEST_REQ_BOOL", "true", () => {
    assert.equal(parseRequiredEnvBool("TEST_REQ_BOOL"), true);
  });

  withEnv("TEST_REQ_BOOL", "off", () => {
    assert.equal(parseRequiredEnvBool("TEST_REQ_BOOL"), false);
  });
});

test("parseRequiredEnvPort validates required port and throws if missing", () => {
  withEnv("TEST_REQ_PORT", undefined, () => {
    assert.throws(() => parseRequiredEnvPort("TEST_REQ_PORT"), /not defined/);
  });

  withEnv("TEST_REQ_PORT", "70000", () => {
    assert.throws(
      () => parseRequiredEnvPort("TEST_REQ_PORT"),
      /valid TCP port/,
    );
  });

  withEnv("TEST_REQ_PORT", "9090", () => {
    assert.equal(parseRequiredEnvPort("TEST_REQ_PORT"), "9090");
  });
});

test("getRuntimeConfig throws if required variables are missing", () => {
  withEnvs(
    {
      SCOREKO_APP_TITLE: undefined,
      SCOREKO_APP_USER_MODEL_ID: "com.scoreko.desktop",
      SCOREKO_APP_USER_DATA_DIRECTORY: "scoreko",
      NODECG_PORT: "9090",
      NODECG_BUNDLE_NAME: "scoreko",
      SCOREKO_DASHBOARD_ROUTE: "dashboard/scoreko/main.html?standalone=true",
      ELECTRON_LOAD_DELAY_MS: "10000",
      NODECG_STARTUP_TIMEOUT_MS: "120000",
      NODECG_KILL_TIMEOUT_MS: "2500",
      SCOREKO_UPDATES_ENABLED: "true",
      SCOREKO_UPDATE_CHECK_DELAY_MS: "5000",
    },
    () => {
      assert.throws(() => getRuntimeConfig(), /SCOREKO_APP_TITLE/);
    },
  );
});

test("getRuntimeConfig parses successfully when all required variables are set", () => {
  withEnvs(
    {
      SCOREKO_APP_TITLE: "Scoreko Test App",
      SCOREKO_APP_USER_MODEL_ID: "com.scoreko.test",
      SCOREKO_APP_USER_DATA_DIRECTORY: "scoreko-test",
      NODECG_PORT: "9191",
      NODECG_BUNDLE_NAME: "scoreko-test",
      SCOREKO_DASHBOARD_ROUTE: "dashboard/scoreko/test.html",
      ELECTRON_LOAD_DELAY_MS: "5000",
      NODECG_STARTUP_TIMEOUT_MS: "60000",
      NODECG_KILL_TIMEOUT_MS: "1500",
      SCOREKO_UPDATES_ENABLED: "false",
      SCOREKO_UPDATE_CHECK_DELAY_MS: "3000",
    },
    () => {
      const config = getRuntimeConfig();
      assert.equal(config.title, "Scoreko Test App");
      assert.equal(config.userModelId, "com.scoreko.test");
      assert.equal(config.userDataDirectoryName, "scoreko-test");
      assert.equal(config.nodecgPort, "9191");
      assert.equal(config.bundleName, "scoreko-test");
      assert.equal(config.mainDashboardRoute, "dashboard/scoreko/test.html");
      assert.equal(config.loadDelayMs, 5000);
      assert.equal(config.startupTimeoutMs, 60000);
      assert.equal(config.nodecgKillTimeoutMs, 1500);
      assert.equal(config.updatesEnabled, false);
      assert.equal(config.updateCheckDelayMs, 3000);
    },
  );
});

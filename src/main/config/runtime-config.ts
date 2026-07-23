import { promises as fs } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

export type AppRuntimeConfig = {
  title: string;
  userModelId: string;
  userDataDirectoryName: string;
  iconPathOverride?: string;
  nodecgPort: string;
  bundleName: string;
  mainDashboardRoute: string;
  loadDelayMs: number;
  startupTimeoutMs: number;
  nodecgKillTimeoutMs: number;
  updatesEnabled: boolean;
  updateCheckDelayMs: number;
};

const MIN_TCP_PORT = 1;
const MAX_TCP_PORT = 65535;

export async function loadEnvFile(envFilePath: string): Promise<void> {
  const resolvedPath = await resolveEnvFilePath(envFilePath);
  try {
    const content = await fs.readFile(resolvedPath, "utf-8");
    const parsed = parseEnv(content);
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    throw new Error(
      `Error reading the .env configuration file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function resolveEnvFilePath(envFilePath: string): Promise<string> {
  try {
    await fs.access(envFilePath);
    return envFilePath;
  } catch {}

  const dir = path.dirname(envFilePath);
  const fallbackPath = path.join(dir, ".env.example");
  try {
    await fs.access(fallbackPath);
    return fallbackPath;
  } catch {}

  throw new Error(
    `Required configuration file not found: ${envFilePath}\n\nPlease create a .env file based on .env.example in the application root.`,
  );
}

export function getRuntimeConfig(): AppRuntimeConfig {
  return {
    title: getRequiredEnv("SCOREKO_APP_TITLE"),
    userModelId: getRequiredEnv("SCOREKO_APP_USER_MODEL_ID"),
    userDataDirectoryName: getRequiredEnv("SCOREKO_APP_USER_DATA_DIRECTORY"),
    iconPathOverride: getOptionalEnv("SCOREKO_APP_ICON_PATH"),
    nodecgPort: parseRequiredEnvPort("NODECG_PORT"),
    bundleName: getRequiredEnv("NODECG_BUNDLE_NAME"),
    mainDashboardRoute: getRequiredEnv("SCOREKO_DASHBOARD_ROUTE"),
    loadDelayMs: parseRequiredEnvIntInRange(
      "ELECTRON_LOAD_DELAY_MS",
      0,
      600000,
    ),
    startupTimeoutMs: parseRequiredEnvIntInRange(
      "NODECG_STARTUP_TIMEOUT_MS",
      1000,
      600000,
    ),
    nodecgKillTimeoutMs: parseRequiredEnvIntInRange(
      "NODECG_KILL_TIMEOUT_MS",
      0,
      120000,
    ),
    updatesEnabled: parseRequiredEnvBool("SCOREKO_UPDATES_ENABLED"),
    updateCheckDelayMs: parseRequiredEnvIntInRange(
      "SCOREKO_UPDATE_CHECK_DELAY_MS",
      0,
      600000,
    ),
  };
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.length === 0) {
    throw new Error(
      `The required environment variable '${name}' is not defined in the .env file.`,
    );
  }
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function getEnv(name: string, fallback: string): string {
  return getOptionalEnv(name) ?? fallback;
}

export function parseRequiredEnvIntInRange(
  name: string,
  min: number,
  max: number,
): number {
  const rawValue = getRequiredEnv(name);
  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < min || parsedValue > max) {
    throw new Error(
      `The ${name} variable must be an integer between ${min} and ${max}. Received value: '${rawValue}'.`,
    );
  }
  return parsedValue;
}

export function parseEnvIntInRange(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < min || parsedValue > max) {
    throw new Error(
      `The ${name} variable must be an integer between ${min} and ${max}. Received value: '${rawValue}'.`,
    );
  }

  return parsedValue;
}

export function parseRequiredEnvBool(name: string): boolean {
  const rawValue = getRequiredEnv(name).toLowerCase();
  if (["1", "true", "yes", "on"].includes(rawValue)) return true;
  if (["0", "false", "no", "off"].includes(rawValue)) return false;

  throw new Error(
    `The ${name} variable must be a boolean. Received value: '${rawValue}'.`,
  );
}

export function parseEnvBool(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name]?.trim().toLowerCase();
  if (!rawValue) return fallback;

  if (["1", "true", "yes", "on"].includes(rawValue)) return true;
  if (["0", "false", "no", "off"].includes(rawValue)) return false;

  throw new Error(
    `The ${name} variable must be a boolean. Received value: '${process.env[name]}'.`,
  );
}

export function parseRequiredEnvPort(name: string): string {
  const rawValue = getRequiredEnv(name);
  const parsedValue = Number.parseInt(rawValue, 10);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < MIN_TCP_PORT ||
    parsedValue > MAX_TCP_PORT
  ) {
    throw new Error(
      `The ${name} variable must be a valid TCP port (${MIN_TCP_PORT}-${MAX_TCP_PORT}). Received value: '${rawValue}'.`,
    );
  }

  return String(parsedValue);
}

export function parseEnvPort(name: string, fallback: string): string {
  const rawValue = getEnv(name, fallback);
  const parsedValue = Number.parseInt(rawValue, 10);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < MIN_TCP_PORT ||
    parsedValue > MAX_TCP_PORT
  ) {
    throw new Error(
      `The ${name} variable must be a valid TCP port (${MIN_TCP_PORT}-${MAX_TCP_PORT}). Received value: '${rawValue}'.`,
    );
  }

  return String(parsedValue);
}

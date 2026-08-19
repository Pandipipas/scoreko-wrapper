#!/usr/bin/env node
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import { bundleName, nodecgRuntimeRoot } from "./build-config.mjs";

const checks = [];

function loadEnv() {
  if (!fs.existsSync(".env")) {
    console.error(
      "FAIL Configuración: Archivo .env obligatorio no encontrado.",
    );
    console.error(
      "Por favor, crea un archivo .env basado en .env.example en la raíz del proyecto.",
    );
    process.exit(1);
  }
  try {
    process.loadEnvFile(".env");
    console.log("OK Configuración: Archivo .env cargado correctamente.\n");
  } catch (error) {
    console.error(
      `FAIL Configuración: Error al leer el archivo .env: ${error.message}`,
    );
    process.exit(1);
  }
}

function addCheck(ok, title, details) {
  checks.push({ ok, title, details });
}

function parsePort(name) {
  const raw = process.env[name];
  if (!raw) {
    addCheck(
      false,
      `${name} missing`,
      `The required environment variable ${name} is not defined in the .env file.`,
    );
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    addCheck(
      false,
      `${name} invalid`,
      `It must be an integer between 1 and 65535. Received value: '${raw}'.`,
    );
    return null;
  }

  addCheck(true, `${name} valid`, `${parsed}`);
  return parsed;
}

function parseIntInRange(name, min, max) {
  const raw = process.env[name];
  if (!raw) {
    addCheck(
      false,
      `${name} missing`,
      `The required environment variable ${name} is not defined in the .env file.`,
    );
    return;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    addCheck(
      false,
      `${name} invalid`,
      `It must be an integer between ${min} and ${max}. Received value: '${raw}'.`,
    );
    return;
  }

  addCheck(true, `${name} valid`, `${parsed}`);
}

function checkNodecgInstall() {
  const indexPath = path.join(nodecgRuntimeRoot, "index.js");
  const bootstrapPath = path.join(
    nodecgRuntimeRoot,
    "node_modules",
    "nodecg",
    "dist",
    "server",
    "bootstrap.js",
  );
  const manifestPath = path.join(nodecgRuntimeRoot, ".scoreko-runtime.json");
  const bundlePath = path.join(nodecgRuntimeRoot, "bundles", bundleName);

  addCheck(
    fs.existsSync(nodecgRuntimeRoot),
    "Packaged NodeCG runtime",
    nodecgRuntimeRoot,
  );
  addCheck(fs.existsSync(indexPath), "Runtime index.js", indexPath);
  addCheck(fs.existsSync(bootstrapPath), "NodeCG bootstrap", bootstrapPath);
  addCheck(fs.existsSync(manifestPath), "Runtime manifest", manifestPath);
  addCheck(
    fs.existsSync(bundlePath),
    `Packaged bundle '${bundleName}'`,
    bundlePath,
  );

  try {
    fs.accessSync(nodecgRuntimeRoot, fs.constants.R_OK | fs.constants.W_OK);
    addCheck(
      true,
      "lib/nodecg permissions",
      "Read/write OK for local development",
    );
  } catch {
    addCheck(
      false,
      "lib/nodecg permissions",
      "No read/write permissions in lib/nodecg",
    );
  }
}

function checkPortAvailability(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      addCheck(
        false,
        `Port ${port}`,
        "It is in use. Free it or change NODECG_PORT.",
      );
      resolve();
    });

    server.listen(port, "127.0.0.1", () => {
      server.close(() => {
        addCheck(true, `Port ${port}`, "Available");
        resolve();
      });
    });
  });
}

async function main() {
  loadEnv();

  const port = parsePort("NODECG_PORT");
  parseIntInRange("ELECTRON_LOAD_DELAY_MS", 0, 600000);
  parseIntInRange("NODECG_STARTUP_TIMEOUT_MS", 1000, 600000);
  parseIntInRange("NODECG_KILL_TIMEOUT_MS", 0, 120000);
  checkNodecgInstall();

  if (port) {
    await checkPortAvailability(port);
  }

  for (const check of checks) {
    const icon = check.ok ? "OK" : "FAIL";
    console.log(`${icon} ${check.title}: ${check.details}`);
  }

  const hasFailures = checks.some((check) => !check.ok);
  if (hasFailures) {
    process.exitCode = 1;
    return;
  }

  console.log("\nDoctor finished: valid configuration.");
}

main();

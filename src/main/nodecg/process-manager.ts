import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import electronLog from "electron-log";
import { AppRuntimeConfig } from "../config/runtime-config";
import { killProcessTree } from "./process-killer";

type NodecgProcessManagerConfig = {
  isDev: boolean;
  nodecgRootPath: string;
  nodecgBaseUrl: string;
  appConfig: AppRuntimeConfig;
  onProgress?: (percent: number, text: string) => void;
};

export function createNodecgProcessManager({
  isDev,
  nodecgRootPath,
  nodecgBaseUrl,
  appConfig,
  onProgress,
}: NodecgProcessManagerConfig) {
  let nodecgProcess: ReturnType<typeof spawn> | null = null;
  let isRunning = false;
  let currentProgress = 30;
  let currentProgressText = "Starting internal engine...";

  const start = async (): Promise<void> => {
    if (isRunning) return;

    const indexPath = path.join(nodecgRootPath, "index.js");
    const bundlePath = path.join(
      nodecgRootPath,
      "bundles",
      appConfig.bundleName,
    );

    await Promise.all([
      fs.promises.access(nodecgRootPath, fs.constants.F_OK).catch(() => {
        throw new Error(`NodeCG folder missing: ${nodecgRootPath}`);
      }),
      fs.promises.access(indexPath, fs.constants.F_OK).catch(() => {
        throw new Error(`NodeCG index.js missing. Rebuild runtime.`);
      }),
      fs.promises.access(bundlePath, fs.constants.F_OK).catch(() => {
        throw new Error(`Bundle '${appConfig.bundleName}' missing in runtime.`);
      }),
    ]);

    const port = Number.parseInt(appConfig.nodecgPort, 10);
    const portAvailable = await probePortAvailable(port);
    if (!portAvailable) {
      throw new Error(`Port ${port} is already in use.`);
    }

    nodecgProcess = spawn(process.execPath, [indexPath], {
      cwd: nodecgRootPath,
      env: {
        ...process.env,
        NODE_ENV: isDev ? "development" : "production",
        NODECG_PORT: appConfig.nodecgPort,
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      shell: false,
      windowsHide: true,
    });

    nodecgProcess.stdout?.on("data", (chunk) => {
      const line = String(chunk).trim();
      if (line) {
        electronLog.info("[nodecg]", line);
        if (onProgress && currentProgress < 90) {
          currentProgress += 5;
          if (currentProgress > 90) currentProgress = 90;

          if (line.includes("Mounting bundle"))
            currentProgressText = "Mounting bundles...";
          else if (line.includes("NodeCG running"))
            currentProgressText = "Connecting to internal server...";
          else if (line.includes("NodeCG"))
            currentProgressText = "Starting NodeCG server...";
          else if (line.includes("extension"))
            currentProgressText = "Loading extensions and plugins...";

          onProgress(Math.floor(currentProgress), currentProgressText);
        }
      }
    });

    nodecgProcess.stderr?.on("data", (chunk) => {
      const line = String(chunk).trim();
      if (line) electronLog.error("[nodecg]", line);
    });

    electronLog.info(`NodeCG started with pid=${nodecgProcess.pid}`);

    nodecgProcess.on("exit", (code, signal) => {
      electronLog.info(`NodeCG exited code=${code} signal=${signal}`);
      isRunning = false;
      nodecgProcess = null;
    });

    isRunning = true;
  };

  const waitForReady = async (): Promise<void> => {
    let waitProgress = currentProgress;
    const startTime = Date.now();

    while (Date.now() - startTime < appConfig.startupTimeoutMs) {
      if (!isRunning) {
        throw new Error(
          `NodeCG exited before becoming ready at ${nodecgRootPath}`,
        );
      }

      try {
        const response = await fetch(nodecgBaseUrl, { method: "GET" });
        if (response.ok || response.status === 404) {
          onProgress?.(100, "Ready!");
          return;
        }
      } catch {}

      await new Promise((r) => setTimeout(r, 100));

      if (waitProgress < 99) {
        waitProgress += 0.5;
        onProgress?.(Math.floor(waitProgress), currentProgressText);
      }
    }
    throw new Error(`Timeout waiting for NodeCG at ${nodecgBaseUrl}`);
  };

  const stop = async (): Promise<void> => {
    if (!nodecgProcess || !isRunning) return;

    const pid = nodecgProcess.pid;
    if (typeof pid !== "number") return;

    electronLog.info(`Stopping NodeCG pid=${pid}`);

    return new Promise((resolve) => {
      const killTimeout = setTimeout(() => {
        if (isRunning) {
          electronLog.warn(`NodeCG did not exit, forcing SIGKILL pid=${pid}`);
          killProcessTree(pid, "SIGKILL");
        }
      }, appConfig.nodecgKillTimeoutMs);

      nodecgProcess!.once("exit", () => {
        clearTimeout(killTimeout);
        resolve();
      });

      killProcessTree(pid, "SIGTERM");
    });
  };

  return { start, waitForReady, stop, isRunning: () => isRunning };
}

function probePortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let resolved = false;

    const complete = (avail: boolean) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(avail);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => complete(false));
    socket.once("timeout", () => complete(true));
    socket.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED" || err.code === "EHOSTUNREACH")
        complete(true);
      else complete(false);
    });
  });
}

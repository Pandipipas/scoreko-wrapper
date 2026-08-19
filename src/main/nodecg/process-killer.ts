import { spawn } from "node:child_process";
import electronLog from "electron-log";

export function killProcessTree(pid: number, signal: NodeJS.Signals): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    electronLog.error(`Invalid pid for process tree termination: ${pid}`);
    return false;
  }

  if (process.platform === "win32") {
    const args = [
      "/pid",
      String(pid),
      "/T",
      ...(signal === "SIGKILL" ? ["/F"] : []),
    ];
    const killer = spawn("taskkill", args, {
      stdio: "ignore",
      shell: false,
      windowsHide: true,
    });

    killer.on("error", (error) => {
      electronLog.error(`taskkill error for pid=${pid}`, error);
    });

    return true;
  }

  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

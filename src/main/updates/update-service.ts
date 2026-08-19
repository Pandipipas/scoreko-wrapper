import { app } from "electron";
import electronLog from "electron-log";
import type { BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import fs from "node:fs/promises";

import { AppRuntimeConfig } from "../config/runtime-config";
import {
  askToDownloadUpdate,
  askToInstallUpdate,
  showDownloadFailedDialog,
} from "./update-dialogs";
import { loadUpdateSettings } from "./update-config";
import { getUpdateWindow } from "../windows/update-window";

type UpdateServiceConfig = {
  appConfig: AppRuntimeConfig;
  getParentWindow: () => BrowserWindow | null;
  beforeInstall: () => Promise<void>;
};

export function scheduleUpdateCheck({
  appConfig,
  getParentWindow,
  beforeInstall,
}: UpdateServiceConfig): void {
  const settings = loadUpdateSettings(appConfig);

  if (!settings.enabled) {
    electronLog.info("Update checks disabled or not configured.");
    return;
  }

  setTimeout(() => {
    void checkForUpdates({ getParentWindow, beforeInstall });
  }, appConfig.updateCheckDelayMs);
}

async function checkForUpdates({
  getParentWindow,
  beforeInstall,
}: {
  getParentWindow: () => BrowserWindow | null;
  beforeInstall: () => Promise<void>;
}): Promise<void> {
  try {
    autoUpdater.logger = electronLog;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.removeAllListeners("update-available");
    autoUpdater.removeAllListeners("download-progress");
    autoUpdater.removeAllListeners("update-downloaded");

    autoUpdater.on("update-available", async (updateInfo) => {
      electronLog.info(`Scoreko update available: ${updateInfo.version}`);

      const downloadChoice = await askToDownloadUpdate(
        updateInfo,
        getParentWindow(),
      );

      if (downloadChoice !== "download") return;

      autoUpdater.downloadUpdate().catch(async (err) => {
        electronLog.error("Update installer download failed.", err);
        await showDownloadFailedDialog(updateInfo, err, getParentWindow());
      });
    });

    autoUpdater.on("download-progress", (progressObj: any) => {
      const updateWin = getUpdateWindow();
      if (updateWin && !updateWin.isDestroyed()) {
        updateWin.webContents.send("update-progress", progressObj.percent);
      }
    });

    autoUpdater.on("update-downloaded", async (updateInfo) => {
      electronLog.info(`Update downloaded: ${updateInfo.version}`);

      if (updateInfo.releaseNotes) {
        const notes = Array.isArray(updateInfo.releaseNotes)
          ? updateInfo.releaseNotes.map((n) => n.note).join("\\n")
          : updateInfo.releaseNotes;

        const changelogPath = path.join(
          app.getPath("userData"),
          "pending-changelog.json",
        );
        await fs
          .writeFile(
            changelogPath,
            JSON.stringify({
              version: updateInfo.version,
              notes: notes,
            }),
          )
          .catch((err) =>
            electronLog.error("Failed to save pending changelog:", err),
          );
      }

      const shouldInstall = await askToInstallUpdate(
        updateInfo,
        getParentWindow(),
      );
      if (shouldInstall) {
        await beforeInstall();
        autoUpdater.quitAndInstall();
      }
    });

    await autoUpdater.checkForUpdates();
  } catch (error) {
    electronLog.error("Update check failed.", error);
  }
}

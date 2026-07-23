import { app, ipcMain } from "electron";
import type { BrowserWindow, IpcMainEvent } from "electron";
import type { UpdateInfo } from "electron-updater";
import {
  getOrCreateUpdateWindow,
  closeUpdateWindow,
} from "../windows/update-window";

export type DownloadUpdateChoice = "download" | "dismiss";

export async function askToDownloadUpdate(
  update: UpdateInfo,
  parentWindow: BrowserWindow | null,
): Promise<DownloadUpdateChoice> {
  return new Promise((resolve) => {
    const win = getOrCreateUpdateWindow(app.getAppPath());

    if (parentWindow && !parentWindow.isDestroyed()) {
      win.setParentWindow(parentWindow);
    }

    const sendState = () => {
      win.webContents.send("update-state", "available", {
        title: "Actualización disponible",
        message: `Scoreko ${update.version} está disponible.`,
      });
      if (!win.isVisible()) win.show();
    };

    if (win.webContents.isLoading()) {
      win.once("ready-to-show", sendState);
    } else {
      sendState();
    }

    const onChoice = (_event: IpcMainEvent, choice: string) => {
      if (choice === "download" || choice === "dismiss") {
        cleanup();
        if (choice === "download") {
          win.webContents.send("update-state", "downloading", {});
          resolve("download");
        } else {
          closeUpdateWindow();
          resolve("dismiss");
        }
      }
    };

    const onClosed = () => {
      cleanup();
      resolve("dismiss");
    };

    const cleanup = () => {
      ipcMain.removeListener("update-choice", onChoice);
      win.removeListener("closed", onClosed);
    };

    ipcMain.on("update-choice", onChoice);
    win.once("closed", onClosed);
  });
}

export async function askToInstallUpdate(
  update: UpdateInfo,
  parentWindow: BrowserWindow | null,
): Promise<boolean> {
  return new Promise((resolve) => {
    const win = getOrCreateUpdateWindow(app.getAppPath());

    if (parentWindow && !parentWindow.isDestroyed()) {
      win.setParentWindow(parentWindow);
    }

    const sendState = () => {
      win.webContents.send("update-state", "ready", {
        title: "Actualización descargada",
        message: `Scoreko ${update.version} se ha descargado.`,
      });
      if (!win.isVisible()) win.show();
    };

    if (win.webContents.isLoading()) {
      win.once("ready-to-show", sendState);
    } else {
      sendState();
    }

    const onChoice = (_event: IpcMainEvent, choice: string) => {
      if (choice === "install" || choice === "later") {
        cleanup();
        if (choice === "later") {
          closeUpdateWindow();
        }
        resolve(choice === "install");
      }
    };

    const onClosed = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      ipcMain.removeListener("update-choice", onChoice);
      win.removeListener("closed", onClosed);
    };

    ipcMain.on("update-choice", onChoice);
    win.once("closed", onClosed);
  });
}

export async function showDownloadFailedDialog(
  update: UpdateInfo,
  error: unknown,
  parentWindow: BrowserWindow | null,
): Promise<void> {
  return new Promise((resolve) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const win = getOrCreateUpdateWindow(app.getAppPath());

    if (parentWindow && !parentWindow.isDestroyed()) {
      win.setParentWindow(parentWindow);
    }

    const sendState = () => {
      win.webContents.send("update-state", "error", {
        message: `Detalles: ${errorMessage}`,
      });
      if (!win.isVisible()) win.show();
    };

    if (win.webContents.isLoading()) {
      win.once("ready-to-show", sendState);
    } else {
      sendState();
    }

    const onChoice = (_event: IpcMainEvent, choice: string) => {
      if (choice === "close-error") {
        cleanup();
        closeUpdateWindow();
        resolve();
      }
    };

    const onClosed = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      ipcMain.removeListener("update-choice", onChoice);
      win.removeListener("closed", onClosed);
    };

    ipcMain.on("update-choice", onChoice);
    win.once("closed", onClosed);
  });
}

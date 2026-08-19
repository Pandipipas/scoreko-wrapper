import { BrowserWindow } from "electron";
import path from "node:path";
import electronLog from "electron-log";

let updateWindow: BrowserWindow | null = null;

export function getOrCreateUpdateWindow(rootPath: string): BrowserWindow {
  if (updateWindow && !updateWindow.isDestroyed()) {
    return updateWindow;
  }

  updateWindow = new BrowserWindow({
    width: 450,
    height: 300,
    show: false,
    autoHideMenuBar: true,
    title: "Scoreko - Actualización",
    icon: path.join(rootPath, "static/icons/icon.png"),
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "update-preload.js"),
    },
  });

  updateWindow
    .loadFile(path.join(rootPath, "static/update.html"))
    .catch((err) => {
      electronLog.error("Failed to load update.html", err);
    });

  updateWindow.on("closed", () => {
    updateWindow = null;
  });

  return updateWindow;
}

export function getUpdateWindow(): BrowserWindow | null {
  return updateWindow && !updateWindow.isDestroyed() ? updateWindow : null;
}

export function closeUpdateWindow(): void {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.close();
  }
}

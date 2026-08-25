import { ipcMain } from "electron";
import type { BrowserWindow, IpcMainEvent } from "electron";
import type { UpdateInfo } from "electron-updater";
import {
  getOrCreateUpdateWindow,
  closeUpdateWindow,
} from "../windows/update-window";

export type DownloadUpdateChoice = "download" | "dismiss";

type ActiveUpdateState = {
  state: string;
  payload: Record<string, any>;
};

let currentUpdateState: ActiveUpdateState | null = null;

function setupStateRequestHandler(win: BrowserWindow) {
  const onStateRequest = (event: IpcMainEvent) => {
    if (currentUpdateState && !win.isDestroyed()) {
      event.reply(
        "update-state",
        currentUpdateState.state,
        currentUpdateState.payload,
      );
    }
  };
  ipcMain.on("update-request-state", onStateRequest);
  return () => {
    ipcMain.removeListener("update-request-state", onStateRequest);
  };
}

export async function askToDownloadUpdate(
  rootPath: string,
  update: UpdateInfo,
  parentWindow: BrowserWindow | null,
): Promise<DownloadUpdateChoice> {
  return new Promise((resolve) => {
    const win = getOrCreateUpdateWindow(rootPath);

    if (parentWindow && !parentWindow.isDestroyed()) {
      win.setParentWindow(parentWindow);
    }

    currentUpdateState = {
      state: "available",
      payload: {
        title: "Actualización disponible",
        message: `Scoreko ${update.version} está disponible.`,
      },
    };

    const cleanupStateRequest = setupStateRequestHandler(win);

    const sendState = () => {
      if (currentUpdateState && !win.isDestroyed()) {
        win.webContents.send(
          "update-state",
          currentUpdateState.state,
          currentUpdateState.payload,
        );
      }
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
          currentUpdateState = {
            state: "downloading",
            payload: {},
          };
          win.webContents.send("update-state", "downloading", {});
          resolve("download");
        } else {
          currentUpdateState = null;
          closeUpdateWindow();
          resolve("dismiss");
        }
      }
    };

    const onClosed = () => {
      cleanup();
      currentUpdateState = null;
      resolve("dismiss");
    };

    const cleanup = () => {
      cleanupStateRequest();
      ipcMain.removeListener("update-choice", onChoice);
      win.removeListener("closed", onClosed);
    };

    ipcMain.on("update-choice", onChoice);
    win.once("closed", onClosed);
  });
}

export async function askToInstallUpdate(
  rootPath: string,
  update: UpdateInfo,
  parentWindow: BrowserWindow | null,
): Promise<boolean> {
  return new Promise((resolve) => {
    const win = getOrCreateUpdateWindow(rootPath);

    if (parentWindow && !parentWindow.isDestroyed()) {
      win.setParentWindow(parentWindow);
    }

    currentUpdateState = {
      state: "ready",
      payload: {
        title: "Actualización descargada",
        message: `Scoreko ${update.version} se ha descargado.`,
      },
    };

    const cleanupStateRequest = setupStateRequestHandler(win);

    const sendState = () => {
      if (currentUpdateState && !win.isDestroyed()) {
        win.webContents.send(
          "update-state",
          currentUpdateState.state,
          currentUpdateState.payload,
        );
      }
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
          currentUpdateState = null;
          closeUpdateWindow();
        }
        resolve(choice === "install");
      }
    };

    const onClosed = () => {
      cleanup();
      currentUpdateState = null;
      resolve(false);
    };

    const cleanup = () => {
      cleanupStateRequest();
      ipcMain.removeListener("update-choice", onChoice);
      win.removeListener("closed", onClosed);
    };

    ipcMain.on("update-choice", onChoice);
    win.once("closed", onClosed);
  });
}

export async function showDownloadFailedDialog(
  rootPath: string,
  update: UpdateInfo,
  error: unknown,
  parentWindow: BrowserWindow | null,
): Promise<void> {
  return new Promise((resolve) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const win = getOrCreateUpdateWindow(rootPath);

    if (parentWindow && !parentWindow.isDestroyed()) {
      win.setParentWindow(parentWindow);
    }

    currentUpdateState = {
      state: "error",
      payload: {
        message: `Detalles: ${errorMessage}`,
      },
    };

    const cleanupStateRequest = setupStateRequestHandler(win);

    const sendState = () => {
      if (currentUpdateState && !win.isDestroyed()) {
        win.webContents.send(
          "update-state",
          currentUpdateState.state,
          currentUpdateState.payload,
        );
      }
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
        currentUpdateState = null;
        closeUpdateWindow();
        resolve();
      }
    };

    const onClosed = () => {
      cleanup();
      currentUpdateState = null;
      resolve();
    };

    const cleanup = () => {
      cleanupStateRequest();
      ipcMain.removeListener("update-choice", onChoice);
      win.removeListener("closed", onClosed);
    };

    ipcMain.on("update-choice", onChoice);
    win.once("closed", onClosed);
  });
}

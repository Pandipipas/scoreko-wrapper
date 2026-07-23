import {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  shell,
} from "electron";
import electronLog from "electron-log";

import { AppRuntimeConfig } from "../config/runtime-config";
import {
  DEFAULT_WINDOW_BACKGROUND,
  DEFAULT_WINDOW_SIZE,
  LOADING_WINDOW_SIZE,
} from "../constants";
import { resolveAppIconPath } from "./icon-path";
import {
  shouldAllowInternalNavigation,
  shouldOpenExternalNavigation,
} from "./navigation";

type WindowServiceDependencies = {
  appConfig: AppRuntimeConfig;
  allowDevTools: boolean;
  rootPath: string;
  mainDashboardUrl: string;
};

export function createMainWindow({
  allowDevTools,
  appConfig,
  rootPath,
  mainDashboardUrl,
}: WindowServiceDependencies): BrowserWindow {
  const windowOptions = createWindowOptions({
    allowDevTools,
    appConfig,
    rootPath,
    isLoadingWindow: false,
  });
  const window = new BrowserWindow(windowOptions);

  applySecurityPolicies(window, allowDevTools);
  window.setMenuBarVisibility(false);

  window.on("resize", () => {
    const [width, height] = window.getSize();
    const ratioX = width / 1920;
    const ratioY = height / 1080;
    const zoomFactor = Math.min(ratioX, ratioY);
    window.webContents.setZoomFactor(zoomFactor);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternalNavigation(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("app://open-logs")) {
      event.preventDefault();
      void shell.showItemInFolder(electronLog.transports.file.getFile().path);
      return;
    }

    if (shouldAllowInternalNavigation(url, mainDashboardUrl)) {
      return;
    }

    event.preventDefault();

    if (shouldOpenExternalNavigation(url)) {
      void shell.openExternal(url);
    }
  });

  window.on("page-title-updated", (event) => {
    event.preventDefault();
  });

  window.webContents.on("did-finish-load", () => {
    window.webContents
      .insertCSS("::-webkit-scrollbar { display: none !important; }")
      .catch(() => {});
  });

  return window;
}

export function createLoadingWindow({
  allowDevTools,
  appConfig,
  rootPath,
}: Omit<WindowServiceDependencies, "mainDashboardUrl">): BrowserWindow {
  const window = new BrowserWindow(
    createWindowOptions({
      allowDevTools,
      appConfig,
      rootPath,
      isLoadingWindow: true,
    }),
  );

  applySecurityPolicies(window, allowDevTools);

  window.on("page-title-updated", (event) => {
    event.preventDefault();
  });

  return window;
}

function createWindowOptions({
  allowDevTools,
  appConfig,
  rootPath,
  isLoadingWindow,
}: {
  allowDevTools: boolean;
  appConfig: AppRuntimeConfig;
  rootPath: string;
  isLoadingWindow: boolean;
}): BrowserWindowConstructorOptions {
  const iconPath = resolveAppIconPath(appConfig, rootPath);

  const baseOptions: BrowserWindowConstructorOptions = {
    show: false,
    title: appConfig.title,
    ...(iconPath ? { icon: iconPath } : {}),
    backgroundColor: DEFAULT_WINDOW_BACKGROUND,
    webPreferences: {
      contextIsolation: true,
      devTools: allowDevTools,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  };

  if (isLoadingWindow) {
    return {
      ...baseOptions,
      frame: false,
      width: LOADING_WINDOW_SIZE.width,
      height: LOADING_WINDOW_SIZE.height,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
    };
  }

  return {
    ...baseOptions,
    width: DEFAULT_WINDOW_SIZE.width,
    height: DEFAULT_WINDOW_SIZE.height,
    minWidth: DEFAULT_WINDOW_SIZE.minWidth,
    minHeight: DEFAULT_WINDOW_SIZE.minHeight,
  };
}

function applySecurityPolicies(
  window: BrowserWindow,
  allowDevTools: boolean,
): void {
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );

  window.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' data: http://localhost:* http://127.0.0.1:*; script-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:*; style-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:*; connect-src 'self' ws://127.0.0.1:* wss://127.0.0.1:* http://localhost:* http://127.0.0.1:* https://api.start.gg https://api.challonge.com https://api.github.com https://scoreko-oauth-proxy.panver.workers.dev https://raw.githubusercontent.com https://gitea.panver.cloud; img-src * data: blob:; media-src * data: blob:; font-src * data:;",
          ],
        },
      });
    },
  );

  if (!allowDevTools) {
    window.webContents.on("devtools-opened", () => {
      window.webContents.closeDevTools();
    });
  }
}

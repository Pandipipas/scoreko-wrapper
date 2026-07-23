import { app, dialog, BrowserWindow } from "electron";
import path from "node:path";
import electronLog from "electron-log";

import { loadEnvFile, getRuntimeConfig } from "./config/runtime-config";
import { getApplicationPaths } from "./app/paths";
import {
  createMainWindow,
  createLoadingWindow,
} from "./windows/window-service";
import { createNodecgProcessManager } from "./nodecg/process-manager";
import {
  prepareUserNodecgRuntime,
  checkIfNeedsInstall,
} from "./nodecg/runtime-setup";

electronLog.initialize();
electronLog.transports.file.level = "debug";
electronLog.transports.console.level = !app.isPackaged ? "debug" : false;

let mainWindow: BrowserWindow | null = null;
let loadingWindow: BrowserWindow | null = null;
let nodecgManager: ReturnType<typeof createNodecgProcessManager> | null = null;

function showFatalError(title: string, error: unknown) {
  const msg =
    error instanceof Error ? error.stack || error.message : String(error);
  electronLog.error(`[FATAL] ${title}:`, msg);
  if (app.isReady()) {
    dialog.showErrorBox(`Scoreko - ${title}`, msg);
  }
}

async function startApp() {
  const isDev = !app.isPackaged;
  const compiledMainDir = __dirname;
  const resourcesPath = process.resourcesPath;

  const rootPath = isDev
    ? path.resolve(compiledMainDir, "..", "..")
    : resourcesPath;
  const envFilePath = path.join(rootPath, ".env");

  await loadEnvFile(envFilePath);
  const appConfig = getRuntimeConfig();

  const paths = getApplicationPaths({
    appConfig,
    appDataPath: app.getPath("appData"),
    compiledMainDir,
    isDev,
    resourcesPath,
  });

  app.setName(appConfig.title);
  app.setPath("userData", paths.userDataPath);

  if (process.platform === "win32") {
    app.setAppUserModelId(appConfig.userModelId);
  }

  const isFirstBoot = await checkIfNeedsInstall({
    sourceRuntimePath: paths.sourceNodecgRuntimePath,
    userDataPath: paths.userDataPath,
    appVersion: app.getVersion(),
    bundleName: appConfig.bundleName,
  });

  loadingWindow = createLoadingWindow({
    allowDevTools: isDev,
    appConfig,
    rootPath,
  });
  await loadingWindow.loadFile(paths.staticLoadingHtmlPath, {
    search: isFirstBoot ? "?firstBoot=true" : "",
  });
  loadingWindow.show();

  const handleProgress = (percent: number, text: string) => {
    if (isFirstBoot && loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.webContents
        .executeJavaScript(
          `
        if (typeof window.updateProgress === "function") {
          window.updateProgress(${percent}, ${JSON.stringify(text)});
        }
      `,
        )
        .catch(() => {});
    }
  };

  const loadingShownAt = Date.now();

  const preparedRuntime = await prepareUserNodecgRuntime({
    sourceRuntimePath: paths.sourceNodecgRuntimePath,
    userDataPath: paths.userDataPath,
    appVersion: app.getVersion(),
    bundleName: appConfig.bundleName,
    onProgress: handleProgress,
  });

  nodecgManager = createNodecgProcessManager({
    isDev,
    nodecgRootPath: preparedRuntime.runtimePath,
    nodecgBaseUrl: paths.nodecgBaseUrl,
    appConfig,
    onProgress: handleProgress,
  });

  await nodecgManager.start();

  mainWindow = createMainWindow({
    allowDevTools: isDev,
    appConfig,
    rootPath,
    mainDashboardUrl: paths.mainDashboardUrl,
  });

  await nodecgManager.waitForReady();

  if (isFirstBoot) {
    const { finalizeUserNodecgRuntime } =
      await import("./nodecg/runtime-setup");
    await finalizeUserNodecgRuntime({
      sourceRuntimePath: paths.sourceNodecgRuntimePath,
      userDataPath: paths.userDataPath,
      appVersion: app.getVersion(),
      bundleName: appConfig.bundleName,
    });
  }

  await mainWindow.loadURL(paths.mainDashboardUrl);

  const elapsed = Date.now() - loadingShownAt;
  const remainingDelay = appConfig.loadDelayMs - elapsed;
  if (remainingDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingDelay));
  }

  if (!loadingWindow.isDestroyed()) {
    loadingWindow.close();
  }

  const changelogPath = path.join(
    app.getPath("userData"),
    "pending-changelog.json",
  );
  try {
    const fs = await import("node:fs/promises");
    const data = await fs.readFile(changelogPath, "utf-8");
    const changelogData = JSON.parse(data);
    if (
      changelogData &&
      changelogData.version === app.getVersion() &&
      changelogData.notes
    ) {
      const { createChangelogWindow } =
        await import("./windows/changelog-window");
      createChangelogWindow({
        rootPath: paths.rootPath,
        markdownContent: changelogData.notes,
      });
    }
    await fs.unlink(changelogPath).catch(() => {});
  } catch {}

  mainWindow.show();

  const { scheduleUpdateCheck } = await import("./updates/update-service");
  scheduleUpdateCheck({
    appConfig,
    getParentWindow: () => mainWindow,
    beforeInstall: async () => {
      await nodecgManager?.stop();
    },
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("ready", () => {
    startApp().catch((err) => {
      showFatalError("Startup Error", err);
      app.exit(1);
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", async (event) => {
    if (nodecgManager && nodecgManager.isRunning()) {
      event.preventDefault();
      await nodecgManager.stop();
      app.quit();
    }
  });
}

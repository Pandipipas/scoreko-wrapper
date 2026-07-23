import { BrowserWindow } from "electron";
import path from "node:path";
import electronLog from "electron-log";
import { marked } from "marked";

type ChangelogWindowOptions = {
  rootPath: string;
  markdownContent: string;
};

export function createChangelogWindow(
  options: ChangelogWindowOptions,
): BrowserWindow {
  const win = new BrowserWindow({
    width: 600,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    title: "Scoreko - Novedades",
    icon: path.join(options.rootPath, "static/icons/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "changelog-preload.js"),
    },
  });

  win
    .loadFile(path.join(options.rootPath, "static/changelog.html"))
    .then(async () => {
      try {
        const htmlContent = await marked.parse(options.markdownContent);
        win.webContents.send("changelog-data", htmlContent);
        win.show();
      } catch (err) {
        electronLog.error("Failed to parse or inject changelog content", err);
        win.show();
      }
    });

  return win;
}

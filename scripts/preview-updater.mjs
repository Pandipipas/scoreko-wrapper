#!/usr/bin/env node
import { app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, "..");

const shouldSimulateError = process.argv.includes("--error");

app.whenReady().then(async () => {
  const { askToDownloadUpdate, askToInstallUpdate, showDownloadFailedDialog } =
    await import("../dist/main/updates/update-dialogs.js");
  const { getUpdateWindow } =
    await import("../dist/main/windows/update-window.js");

  console.log("[Updater Preview] Opening update window in preview mode...");

  if (shouldSimulateError) {
    console.log("[Updater Preview] Simulating download failure dialog...");
    await showDownloadFailedDialog(
      rootPath,
      { version: "0.8.0-preview" },
      new Error("Simulated network timeout connecting to GitHub releases."),
      null,
    );
    console.log("[Updater Preview] Error dialog closed.");
    app.quit();
    return;
  }

  const choice = await askToDownloadUpdate(
    rootPath,
    { version: "0.8.0-preview" },
    null,
  );

  console.log(`User choice: ${choice}`);

  if (choice === "download") {
    console.log("[Updater Preview] Simulating download progress...");
    const win = getUpdateWindow();
    for (let percent = 0; percent <= 100; percent += 4) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (win && !win.isDestroyed()) {
        win.webContents.send("update-progress", percent);
      }
    }

    console.log("[Updater Preview] Download complete. Prompting install...");
    const installChoice = await askToInstallUpdate(
      rootPath,
      { version: "0.8.0-preview" },
      null,
    );
    console.log(
      `Install choice: ${installChoice ? "Install and restart" : "Later"}`,
    );
  }

  setTimeout(() => {
    app.quit();
  }, 500);
});

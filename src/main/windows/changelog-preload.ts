import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  onChangelog: (callback: (html: string) => void) => {
    ipcRenderer.on(
      "changelog-data",
      (_event: IpcRendererEvent, html: string) => {
        callback(html);
      },
    );
  },
});

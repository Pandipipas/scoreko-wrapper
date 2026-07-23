import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  replyChoice: (choice: string) => {
    ipcRenderer.send("update-choice", choice);
  },
  onUpdateState: (callback: (state: string, payload: any) => void) => {
    ipcRenderer.on(
      "update-state",
      (_event: IpcRendererEvent, state: string, payload: any) => {
        callback(state, payload);
      },
    );
  },
  onUpdateProgress: (callback: (percent: number) => void) => {
    ipcRenderer.on(
      "update-progress",
      (_event: IpcRendererEvent, percent: number) => {
        callback(percent);
      },
    );
  },
});

const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electron", {
  // 窗口控制
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-hide"),

  // 窗口最大化状态
  onWindowMaximized: (cb) => ipcRenderer.on("window-maximized", (_e, state) => cb(state)),

  // 开机自启
  getAutoLaunch: () => ipcRenderer.invoke("get-auto-launch"),
  setAutoLaunch: (enabled) => ipcRenderer.invoke("set-auto-launch", enabled),

  // 数据持久化
  loadRecords: () => ipcRenderer.invoke("load-records"),
  saveRecords: (records) => ipcRenderer.invoke("save-records", records),
  loadBlueprints: () => ipcRenderer.invoke("load-blueprints"),
  saveBlueprints: (records) => ipcRenderer.invoke("save-blueprints", records),
  loadWorkDiary: () => ipcRenderer.invoke("load-workdiary"),
  saveWorkDiary: (records) => ipcRenderer.invoke("save-workdiary", records),
  loadPrices: () => ipcRenderer.invoke("load-prices"),
  savePrices: (data) => ipcRenderer.invoke("save-prices", data),

  // 退出
  appQuit: () => ipcRenderer.send("app-quit"),
})

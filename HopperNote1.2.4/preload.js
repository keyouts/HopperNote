const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("api", {
  loadData() {
    return ipcRenderer.invoke("load-data")
  },
  saveData(data) {
    return ipcRenderer.invoke("save-data", data)
  },
  exportEntryHtml(payload) {
    return ipcRenderer.invoke("export-entry-html", payload)
  }
})
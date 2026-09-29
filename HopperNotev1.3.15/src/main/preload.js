const { contextBridge, ipcRenderer } = require("electron")

const api = Object.freeze({
  loadData: () => ipcRenderer.invoke("load-data"),
  saveData: data => ipcRenderer.invoke("save-data", data),
  copyText: value => ipcRenderer.invoke("copy-text", value),
  openExternal: url => ipcRenderer.invoke("open-external", url),
  exportEntryHtml: payload => ipcRenderer.invoke("export-entry-html", payload),
  exportEntryPdf: payload => ipcRenderer.invoke("export-entry-pdf", payload)
})

contextBridge.exposeInMainWorld("api", api)

const { app, BrowserWindow, clipboard, dialog, ipcMain, session, shell } = require("electron")
const fs = require("fs")
const path = require("path")
const { pathToFileURL } = require("url")
const { DataStore } = require("./data-store")
const { configureSession, hardenWindow } = require("./security")
const { LIMITS, safeString, safeUrl, validateExportPayload } = require("../shared/validation")

let mainWindow = null
let dataStore = null
let mainPageUrl = ""
let appSession = null

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]))
}

function safeFileName(value, fallback) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120) || fallback
}

function buildExportHtml(payload, printable) {
  const title = escapeHtml(payload.title)
  const tags = escapeHtml(payload.tags.join(","))
  const exportedAt = escapeHtml(new Date(payload.exportedAt).toLocaleString())
  const printStyle = printable ? "@page { margin: 0.55in; }" : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>${title}</title>
<style>
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #111111;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.6;
}
body {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 28px;
}
.entry-title {
  font-size: 32px;
  font-weight: 800;
  margin: 0 0 10px 0;
}
.entry-meta {
  color: #555555;
  font-size: 12px;
  margin-bottom: 26px;
}
p { margin: 0 0 14px 0; }
h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 12px; }
blockquote {
  border-left: 4px solid #111111;
  padding-left: 12px;
  margin-left: 0;
  color: #333333;
}
ul, ol { padding-left: 24px; }
img, iframe { max-width: 100%; height: auto; }
.video-embed-wrap iframe { width: 100%; max-width: 800px; aspect-ratio: 16 / 9; border: 0; }
.hopper-highlight-card {
  border: 2px solid #111111;
  padding: 14px;
  margin: 18px 0;
  background: #ffffff;
}
.hopper-highlight-remove { display: none; }
.inline-tag {
  display: inline-block;
  border: 2px solid #111111;
  background: #d8ff8f;
  padding: 0 6px;
  font-weight: 800;
}
${printStyle}
</style>
</head>
<body>
  <main data-hopper-export="entry" data-entry-tags="${tags}">
    <h1 class="entry-title">${title}</h1>
    <div class="entry-meta">Exported ${exportedAt}</div>
    <div class="entry-content">${payload.content}</div>
  </main>
</body>
</html>`
}

function isTrustedIpc(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  if (event.sender !== mainWindow.webContents) return false
  if (!event.senderFrame || event.senderFrame !== mainWindow.webContents.mainFrame) return false
  return event.senderFrame.url === mainPageUrl
}

function requireTrustedIpc(event) {
  if (!isTrustedIpc(event)) throw new Error("Untrusted IPC sender")
}

async function writeExport(filePath, contents) {
  await fs.promises.writeFile(filePath, contents, { mode: 0o600 })
  return { ok: true, filePath }
}

function registerIpcHandlers() {
  ipcMain.handle("load-data", async event => {
    requireTrustedIpc(event)
    return dataStore.read()
  })

  ipcMain.handle("save-data", async (event, payload) => {
    requireTrustedIpc(event)
    try {
      return await dataStore.write(payload)
    } catch (error) {
      return { ok: false, error: error.message || "Failed to save" }
    }
  })

  ipcMain.handle("copy-text", (event, rawValue) => {
    requireTrustedIpc(event)
    const value = safeString(rawValue, LIMITS.clipboard)
    clipboard.writeText(value)
    return { ok: true }
  })

  ipcMain.handle("open-external", async (event, rawUrl) => {
    requireTrustedIpc(event)
    const url = safeUrl(rawUrl)
    if (!url) return { ok: false, error: "Blocked URL" }
    await shell.openExternal(url)
    return { ok: true }
  })

  ipcMain.handle("export-entry-html", async (event, rawPayload) => {
    requireTrustedIpc(event)

    try {
      const payload = validateExportPayload(rawPayload)
      const safeName = safeFileName(payload.title, "journal-entry")
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "Export Entry as HTML",
        defaultPath: `${safeName}.html`,
        filters: [{ name: "HTML", extensions: ["html", "htm"] }]
      })

      if (canceled || !filePath) return { ok: false, canceled: true }
      return await writeExport(filePath, buildExportHtml(payload, false))
    } catch (error) {
      return { ok: false, error: error.message || "Failed to export HTML" }
    }
  })

  ipcMain.handle("export-entry-pdf", async (event, rawPayload) => {
    requireTrustedIpc(event)
    let pdfWindow = null

    try {
      const payload = validateExportPayload(rawPayload)
      const safeName = safeFileName(payload.title, "journal-entry")
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "Export Entry as PDF",
        defaultPath: `${safeName}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      })

      if (canceled || !filePath) return { ok: false, canceled: true }

      pdfWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          nodeIntegrationInWorker: false,
          nodeIntegrationInSubFrames: false,
          webSecurity: true,
          allowRunningInsecureContent: false,
          webviewTag: false,
          devTools: false,
          navigateOnDragDrop: false,
          session: appSession
        }
      })

      pdfWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
      const html = buildExportHtml(payload, true)
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      const pdfBuffer = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        marginsType: 0,
        pageSize: "A4"
      })

      return await writeExport(filePath, pdfBuffer)
    } catch (error) {
      return { ok: false, error: error.message || "Failed to export PDF" }
    } finally {
      if (pdfWindow && !pdfWindow.isDestroyed()) pdfWindow.destroy()
    }
  })
}

function createWindow() {
  const indexPath = path.join(__dirname, "../../index.html")
  mainPageUrl = pathToFileURL(indexPath).toString()

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f5f2ea",
    icon: path.join(__dirname, "../../assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: !app.isPackaged,
      navigateOnDragDrop: false,
      safeDialogs: true,
      spellcheck: true,
      session: appSession
    }
  })

  hardenWindow(mainWindow, mainPageUrl)
  mainWindow.once("ready-to-show", () => mainWindow.show())
  mainWindow.on("closed", () => {
    mainWindow = null
  })
  mainWindow.loadFile(indexPath)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId("com.hopper.note")
    appSession = session.fromPartition("hopper-note")
    configureSession(appSession)
    dataStore = new DataStore(path.join(app.getPath("userData"), "journal-data.json"))
    registerIpcHandlers()
    createWindow()

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

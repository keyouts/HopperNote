const { app, BrowserWindow, ipcMain, dialog, nativeImage, session } = require("electron")
const path = require("path")
const fs = require("fs")

let mainWindow
let dataFilePath

const YOUTUBE_EMBED_REQUEST_FILTER = {
  urls: [
    "https://www.youtube.com/*",
    "https://www.youtube-nocookie.com/*",
    "https://*.youtube.com/*"
  ]
}

const YOUTUBE_EMBED_REFERER = "https://hopper.note.app/"

function installYouTubeEmbedHeaderFix() {
  session.defaultSession.webRequest.onBeforeSendHeaders(YOUTUBE_EMBED_REQUEST_FILTER, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders }

    if (!requestHeaders.Referer && !requestHeaders.referer) {
      requestHeaders.Referer = YOUTUBE_EMBED_REFERER
    }

    if (!requestHeaders.Origin && !requestHeaders.origin) {
      requestHeaders.Origin = YOUTUBE_EMBED_REFERER
    }

    callback({ requestHeaders })
  })
}

function getDefaultData() {
  return {
    entries: [],
    highlights: []
  }
}

function ensureDataFile() {
  if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(dataFilePath, JSON.stringify(getDefaultData(), null, 2), "utf8")
  }
}

function readData() {
  try {
    ensureDataFile()
    const raw = fs.readFileSync(dataFilePath, "utf8")
    const parsed = JSON.parse(raw)
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : []
    }
  } catch (e) {
    return getDefaultData()
  }
}

function writeData(payload) {
  const safePayload = {
    entries: Array.isArray(payload && payload.entries) ? payload.entries : [],
    highlights: Array.isArray(payload && payload.highlights) ? payload.highlights : []
  }
  fs.writeFileSync(dataFilePath, JSON.stringify(safePayload, null, 2), "utf8")
  return { ok: true }
}

function createWindow() {
  dataFilePath = path.join(app.getPath("userData"), "journal-data.json")

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, "index.html"))
}

ipcMain.handle("load-data", () => {
  return readData()
})

ipcMain.handle("save-data", (event, payload) => {
  try {
    return writeData(payload)
  } catch (e) {
    return { ok: false, error: e.message || "Failed to save" }
  }
})

ipcMain.handle("export-entry-html", async (event, payload) => {
  try {
    const title = String(payload && payload.title ? payload.title : "journal-entry")
    const content = String(payload && payload.content ? payload.content : "")
    const safeName = title.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim() || "journal-entry"

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export Entry as HTML",
      defaultPath: `${safeName}.html`,
      filters: [{ name: "HTML", extensions: ["html", "htm"] }]
    })

    if (canceled || !filePath) {
      return { ok: false, canceled: true }
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
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
  margin: 0 0 24px 0;
}
p {
  margin: 0 0 14px 0;
}
h1, h2, h3, h4, h5, h6 {
  margin-top: 24px;
  margin-bottom: 12px;
}
blockquote {
  border-left: 4px solid #111111;
  padding-left: 12px;
  margin-left: 0;
  color: #333333;
}
ul, ol {
  padding-left: 24px;
}
img, video, iframe {
  max-width: 100%;
  height: auto;
}
.video-embed-wrap {
  margin: 18px 0;
}
.video-embed-wrap iframe {
  width: 100%;
  max-width: 800px;
  aspect-ratio: 16 / 9;
  border: 0;
}
.hopper-highlight-card {
  border: 2px solid #111111;
  padding: 14px;
  margin: 18px 0;
  background: #ffffff;
}
.hopper-highlight-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.hopper-highlight-dot {
  width: 18px;
  height: 18px;
  border: 2px solid #111111;
  display: inline-block;
  flex-shrink: 0;
  background: yellow;
}
.hopper-highlight-card[data-color="yellow"] .hopper-highlight-dot {
  background: yellow;
}
.hopper-highlight-card[data-color="lightgreen"] .hopper-highlight-dot {
  background: lightgreen;
}
.hopper-highlight-card[data-color="lightskyblue"] .hopper-highlight-dot {
  background: lightskyblue;
}
.hopper-highlight-card[data-color="pink"] .hopper-highlight-dot {
  background: pink;
}
.hopper-highlight-card[data-color="orange"] .hopper-highlight-dot {
  background: orange;
}
.hopper-highlight-text {
  font-weight: 700;
  white-space: pre-wrap;
}
.hopper-highlight-note {
  margin-top: 10px;
  white-space: pre-wrap;
}
.hopper-highlight-url {
  margin-top: 10px;
  font-size: 12px;
  word-break: break-word;
}
.hopper-highlight-remove {
  display: none;
}
</style>
</head>
<body>
  <div class="entry-title">${title}</div>
  <div class="entry-content">${content}</div>
</body>
</html>`

    fs.writeFileSync(filePath, html, "utf8")
    return { ok: true, filePath }
  } catch (e) {
    return { ok: false, error: e.message || "Failed to export HTML" }
  }
})

app.whenReady().then(() => {
  app.setAppUserModelId("com.hopper.note")
  installYouTubeEmbedHeaderFix()
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

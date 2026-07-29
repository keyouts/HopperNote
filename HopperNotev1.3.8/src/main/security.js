const VIDEO_HOSTS = new Set(["www.youtube-nocookie.com", "player.vimeo.com"])
const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "www.youtube-nocookie.com"])
const YOUTUBE_EMBED_REFERER = "https://hopper.note.app/"

function isAllowedVideoFrame(value) {
  try {
    const parsed = new URL(String(value || ""))
    return parsed.protocol === "https:" && VIDEO_HOSTS.has(parsed.hostname.toLowerCase())
  } catch (error) {
    return false
  }
}

function configureSession(targetSession) {
  targetSession.setPermissionCheckHandler(() => false)
  targetSession.setPermissionRequestHandler((webContents, permission, callback) => callback(false))

  targetSession.webRequest.onBeforeSendHeaders({
    urls: [
      "https://www.youtube.com/*",
      "https://youtube.com/*",
      "https://m.youtube.com/*",
      "https://www.youtube-nocookie.com/*"
    ]
  }, (details, callback) => {
    let host = ""
    try {
      host = new URL(details.url).hostname.toLowerCase()
    } catch (error) {}

    if (details.resourceType !== "subFrame" || !YOUTUBE_HOSTS.has(host)) {
      callback({ requestHeaders: details.requestHeaders })
      return
    }

    const requestHeaders = { ...details.requestHeaders }
    if (!requestHeaders.Referer && !requestHeaders.referer) requestHeaders.Referer = YOUTUBE_EMBED_REFERER
    if (!requestHeaders.Origin && !requestHeaders.origin) requestHeaders.Origin = YOUTUBE_EMBED_REFERER
    callback({ requestHeaders })
  })
}

function hardenWindow(window, allowedMainUrl) {
  const contents = window.webContents

  contents.setWindowOpenHandler(() => ({ action: "deny" }))

  contents.on("will-navigate", (event, url) => {
    if (url !== allowedMainUrl) event.preventDefault()
  })

  contents.on("will-frame-navigate", (event, detailsOrUrl, isInPlace, isMainFrame) => {
    const details = typeof detailsOrUrl === "string"
      ? { url: detailsOrUrl, isMainFrame: Boolean(isMainFrame) }
      : detailsOrUrl

    if (details.isMainFrame) {
      if (details.url !== allowedMainUrl) event.preventDefault()
      return
    }

    if (!isAllowedVideoFrame(details.url)) event.preventDefault()
  })

  contents.on("will-attach-webview", event => event.preventDefault())
}

module.exports = { configureSession, hardenWindow, isAllowedVideoFrame }

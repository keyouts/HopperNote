const path = require("path")

const APP_SCHEME = "hopper"
const APP_HOST = "app"
const APP_URL = `${APP_SCHEME}://${APP_HOST}/index.html`

function resolveAppRequestPath(appRoot, requestUrl) {
  try {
    const parsed = new URL(String(requestUrl || ""))
    if (parsed.protocol !== `${APP_SCHEME}:` || parsed.hostname !== APP_HOST) return ""

    const requestedPath = decodeURIComponent(parsed.pathname || "/").replace(/\\/g, "/")
    const relativePath = requestedPath === "/" ? "index.html" : requestedPath.replace(/^\/+/, "")
    const root = path.resolve(appRoot)
    const resolved = path.resolve(root, relativePath)
    const relative = path.relative(root, resolved)

    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return ""
    return resolved
  } catch (error) {
    return ""
  }
}

module.exports = { APP_HOST, APP_SCHEME, APP_URL, resolveAppRequestPath }

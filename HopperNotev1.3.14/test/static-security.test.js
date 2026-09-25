const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const root = path.join(__dirname, "..")
const main = fs.readFileSync(path.join(root, "src/main/main.js"), "utf8")
const index = fs.readFileSync(path.join(root, "index.html"), "utf8")
const packageData = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))

test("enforces window isolation", () => {
  assert.match(main, /sandbox: true/)
  assert.match(main, /contextIsolation: true/)
  assert.match(main, /nodeIntegration: false/)
  assert.match(main, /webSecurity: true/)
})

test("uses restrictive policy", () => {
  assert.match(index, /connect-src 'none'/)
  assert.match(index, /object-src 'none'/)
  assert.match(index, /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/player\.vimeo\.com/)
  assert.doesNotMatch(index, /default-src[^;]*https:/)
})

test("enables package fuses", () => {
  assert.equal(packageData.build.asar, true)
  assert.equal(packageData.build.electronFuses.runAsNode, false)
  assert.equal(packageData.build.electronFuses.onlyLoadAppFromAsar, true)
  assert.equal(packageData.build.electronFuses.enableEmbeddedAsarIntegrityValidation, true)
})


test("avoids dynamic code sinks", () => {
  const renderer = fs.readFileSync(path.join(root, "src/renderer/app.js"), "utf8")
  assert.doesNotMatch(renderer, /document\.write\s*\(/)
  assert.doesNotMatch(renderer, /\beval\s*\(/)
  assert.doesNotMatch(renderer, /new Function\s*\(/)
})


test("uses narrow external links", () => {
  const security = fs.readFileSync(path.join(root, "src/main/security.js"), "utf8")
  const preload = fs.readFileSync(path.join(root, "src/main/preload.js"), "utf8")
  assert.match(security, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/)
  assert.match(preload, /openExternal: url => ipcRenderer\.invoke\("open-external", url\)/)
})

test("keeps header comments", () => {
  const files = [
    path.join(root, "src/renderer/app.js"),
    path.join(root, "src/renderer/styles.css")
  ]
  const comments = files.flatMap(file => {
    const text = fs.readFileSync(file, "utf8")
    return [
      ...(text.match(/^\s*\/\/[^\n]+/gm) || []).map(value => value.replace(/^\s*\/\/\s*/, "").trim()),
      ...(text.match(/\/\*[^*]+\*\//g) || []).map(value => value.replace(/^\/\*\s*|\s*\*\/$/g, "").trim())
    ]
  })
  comments.forEach(comment => assert.equal(comment.split(/\s+/).length, 2, `Comment is not a two-word header: ${comment}`))
})



test("serves the packaged interface through the app protocol", () => {
  const appProtocol = fs.readFileSync(path.join(root, "src/main/app-protocol.js"), "utf8")
  assert.match(main, /protocol\.registerSchemesAsPrivileged/)
  assert.match(main, /appSession\.protocol\.handle\(APP_SCHEME/)
  assert.match(main, /await mainWindow\.loadURL\(mainPageUrl\)/)
  assert.doesNotMatch(main, /mainWindow\.loadFile\(/)
  assert.match(appProtocol, /hopper/)
  assert.equal(packageData.build.electronFuses.grantFileProtocolExtraPrivileges, false)
})

test("keeps the Windows installer contract", () => {
  assert.equal(packageData.version, "1.3.14")
  assert.equal(packageData.scripts.build, "electron-builder --win nsis")
  assert.equal(packageData.devDependencies["electron-builder"], "26.15.7")
  assert.equal(packageData.devDependencies.electron, "42.10.1")
  assert.equal(fs.readFileSync(path.join(root, ".npmrc"), "utf8").trim(), "include=dev")
  assert.equal(packageData.build.win.target, "nsis")
  assert.equal(packageData.build.win.icon, "assets/icon.ico")
  assert.equal(packageData.build.artifactName, "Hopper-Note-Setup-${version}.${ext}")
  assert.equal(packageData.build.nsis.createDesktopShortcut, "always")
  assert.equal(packageData.build.nsis.createStartMenuShortcut, true)
  assert.equal(packageData.build.nsis.shortcutName, "Hopper Note")
  assert.equal(packageData.build.nsis.runAfterFinish, true)
  assert.equal(packageData.build.nsis.installerIcon, "assets/icon.ico")
  assert.equal(packageData.build.nsis.uninstallerIcon, "assets/icon.ico")
})

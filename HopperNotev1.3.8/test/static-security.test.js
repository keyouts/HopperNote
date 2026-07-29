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

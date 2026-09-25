const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { APP_URL, resolveAppRequestPath } = require("../src/main/app-protocol")

test("uses a stable application URL", () => {
  assert.equal(APP_URL, "hopper://app/index.html")
})

test("maps application URLs inside the packaged root", () => {
  const root = path.resolve("C:/example/HopperNote/resources/app.asar")
  assert.equal(resolveAppRequestPath(root, "hopper://app/index.html"), path.resolve(root, "index.html"))
  assert.equal(resolveAppRequestPath(root, "hopper://app/src/renderer/app.js"), path.resolve(root, "src/renderer/app.js"))
})

test("rejects other hosts and escaped paths", () => {
  const root = path.resolve("/tmp/hopper/app.asar")
  assert.equal(resolveAppRequestPath(root, "hopper://other/index.html"), "")
  assert.equal(resolveAppRequestPath(root, "https://app/index.html"), "")
  assert.equal(resolveAppRequestPath(root, "hopper://app/src/%5C..%5C..%5Csecret.txt"), "")
  assert.equal(resolveAppRequestPath(root, "hopper://app/src/renderer/app.js"), path.resolve(root, "src/renderer/app.js"))
})

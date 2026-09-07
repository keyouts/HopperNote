const test = require("node:test")
const assert = require("node:assert/strict")
const settings = require("../src/shared/ui-settings")

test("uses safe defaults", () => {
  assert.deepEqual(settings.normalizeSettings({}), settings.DEFAULT_SETTINGS)
})

test("keeps allowed choices", () => {
  const normalized = settings.normalizeSettings({
    leftPanel: "blue",
    rightPanel: "green",
    editorCanvas: "paper",
    uiFont: "georgia",
    editorFont: "mono",
    editorSize: "20",
    lineHeight: "2",
    leftWidth: "340",
    rightWidth: "380",
    density: "compact",
    corners: "round",
    shadows: "none",
    motion: "reduced"
  })
  assert.equal(normalized.leftPanel, "blue")
  assert.equal(normalized.rightPanel, "green")
  assert.equal(normalized.editorFont, "mono")
  assert.equal(normalized.editorSize, "20")
  assert.equal(normalized.rightWidth, "380")
  assert.equal(normalized.motion, "reduced")
})

test("rejects arbitrary values", () => {
  const normalized = settings.normalizeSettings({
    leftPanel: "url(bad)",
    editorFont: "Comic Sans MS",
    editorSize: "99",
    leftWidth: "9999",
    corners: "circle",
    shadows: "extreme"
  })
  assert.equal(normalized.leftPanel, settings.DEFAULT_SETTINGS.leftPanel)
  assert.equal(normalized.editorFont, settings.DEFAULT_SETTINGS.editorFont)
  assert.equal(normalized.editorSize, settings.DEFAULT_SETTINGS.editorSize)
  assert.equal(normalized.leftWidth, settings.DEFAULT_SETTINGS.leftWidth)
  assert.equal(normalized.corners, settings.DEFAULT_SETTINGS.corners)
  assert.equal(normalized.shadows, settings.DEFAULT_SETTINGS.shadows)
})

test("detects defaults", () => {
  assert.equal(settings.isDefaultSettings(settings.DEFAULT_SETTINGS), true)
  assert.equal(settings.isDefaultSettings({ leftPanel: "blue" }), false)
})

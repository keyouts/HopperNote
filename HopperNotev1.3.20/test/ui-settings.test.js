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
    motion: "reduced",
    buttonMotion: "off",
    contrast: "high",
    focusIndicator: "strong",
    controlSize: "large",
    customPalette: "on",
    paletteEntries: "#202124",
    paletteHighlights: "#252129",
    paletteEditorShell: "#16171a",
    paletteEditorCanvas: "#222327",
    paletteToolbar: "#332f22",
    paletteAccent: "#a7d95d",
    paletteSurface: "#2c2d32",
    paletteText: "#f1f1ed"
  })
  assert.equal(normalized.leftPanel, "blue")
  assert.equal(normalized.rightPanel, "green")
  assert.equal(normalized.editorFont, "mono")
  assert.equal(normalized.editorSize, "20")
  assert.equal(normalized.rightWidth, "380")
  assert.equal(normalized.motion, "reduced")
  assert.equal(normalized.buttonMotion, "off")
  assert.equal(normalized.contrast, "high")
  assert.equal(normalized.focusIndicator, "strong")
  assert.equal(normalized.controlSize, "large")
  assert.equal(normalized.customPalette, "on")
  assert.equal(normalized.paletteEditorCanvas, "#222327")
  assert.equal(normalized.paletteText, "#f1f1ed")
})

test("rejects arbitrary values", () => {
  const normalized = settings.normalizeSettings({
    leftPanel: "url(bad)",
    editorFont: "Comic Sans MS",
    editorSize: "99",
    leftWidth: "9999",
    corners: "circle",
    shadows: "extreme",
    contrast: "maximum",
    focusIndicator: "glow",
    controlSize: "huge",
    customPalette: "maybe",
    paletteEntries: "url(bad)",
    paletteAccent: "#12345g",
    paletteText: "black"
  })
  assert.equal(normalized.leftPanel, settings.DEFAULT_SETTINGS.leftPanel)
  assert.equal(normalized.editorFont, settings.DEFAULT_SETTINGS.editorFont)
  assert.equal(normalized.editorSize, settings.DEFAULT_SETTINGS.editorSize)
  assert.equal(normalized.leftWidth, settings.DEFAULT_SETTINGS.leftWidth)
  assert.equal(normalized.corners, settings.DEFAULT_SETTINGS.corners)
  assert.equal(normalized.shadows, settings.DEFAULT_SETTINGS.shadows)
  assert.equal(normalized.contrast, settings.DEFAULT_SETTINGS.contrast)
  assert.equal(normalized.focusIndicator, settings.DEFAULT_SETTINGS.focusIndicator)
  assert.equal(normalized.controlSize, settings.DEFAULT_SETTINGS.controlSize)
  assert.equal(normalized.customPalette, settings.DEFAULT_SETTINGS.customPalette)
  assert.equal(normalized.paletteEntries, settings.DEFAULT_SETTINGS.paletteEntries)
  assert.equal(normalized.paletteAccent, settings.DEFAULT_SETTINGS.paletteAccent)
  assert.equal(normalized.paletteText, settings.DEFAULT_SETTINGS.paletteText)
})

test("detects defaults", () => {
  assert.equal(settings.isDefaultSettings(settings.DEFAULT_SETTINGS), true)
  assert.equal(settings.isDefaultSettings({ leftPanel: "blue" }), false)
})


test("keeps custom colors stable", () => {
  const normalized = settings.normalizeSettings({
    customPalette: "on",
    paletteEntries: "#ABCDEF",
    paletteText: "#010203"
  })
  assert.equal(normalized.customPalette, "on")
  assert.equal(normalized.paletteEntries, "#abcdef")
  assert.equal(normalized.paletteText, "#010203")
})

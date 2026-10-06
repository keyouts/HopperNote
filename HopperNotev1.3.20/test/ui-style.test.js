const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const root = path.join(__dirname, "..")
const css = fs.readFileSync(path.join(root, "src/renderer/styles.css"), "utf8")
const tray = css.slice(css.lastIndexOf("/* Tool Tray */"))

test("keeps tool tray bounded", () => {
  assert.match(tray, /#toolbar-panel\s*\{[\s\S]*?min-height:\s*132px/)
  assert.match(tray, /#toolbar\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(tray, /\.toolbar-group,[\s\S]*?grid-template-columns:\s*repeat\(auto-fit, minmax\(74px, 1fr\)\)/)
  assert.match(tray, /\.tool-btn,[\s\S]*?max-width:\s*100%/)
  assert.doesNotMatch(tray, /#toolbar\s*\{[\s\S]*?overflow-x:\s*auto/)
})

test("themes select controls", () => {
  assert.match(tray, /select\s*\{[\s\S]*?appearance:\s*none/)
  assert.match(tray, /select\s*\{[\s\S]*?background-image:/)
  assert.match(tray, /select:focus-visible\s*\{[\s\S]*?var\(--accent-color\)/)
})

test("themes all scroll regions", () => {
  assert.match(tray, /\*::-webkit-scrollbar\s*\{/)
  assert.match(tray, /\*::-webkit-scrollbar-thumb\s*\{[\s\S]*?var\(--accent-color\)/)
  assert.match(tray, /\*::-webkit-scrollbar-track\s*\{[\s\S]*?border:\s*2px solid #111/)
})

test("keeps block controls reachable", () => {
  const app = fs.readFileSync(path.join(root, "src/renderer/app.js"), "utf8")
  assert.match(app, /editor\.addEventListener\("mousemove", ev => \{[\s\S]*?const block = getTopLevelEditorBlock\(ev\.target\)[\s\S]*?if \(block\) setActiveEditorBlock\(block\)/)
  assert.match(app, /document\.addEventListener\("pointerdown", ev => \{[\s\S]*?editorWrap\.contains\(ev\.target\)[\s\S]*?setActiveEditorBlock\(null\)/)
  assert.doesNotMatch(app, /editorWrap\.addEventListener\("mouseleave"[\s\S]{0,180}setActiveEditorBlock\(null\)/)
  assert.doesNotMatch(app, /mousemove[\s\S]{0,180}setActiveEditorBlock\(getTopLevelEditorBlock\(ev\.target\)\)/)
})


test("supports accessibility settings", () => {
  assert.match(css, /html\[data-contrast="high"\]/)
  assert.match(css, /html\[data-focus-indicator="strong"\] :focus-visible/)
  assert.match(css, /html\[data-control-size="large"\] input:not\(\[type="file"\]\)/)
})

test("keeps accessibility layout stable", () => {
  const accessibilityStart = css.indexOf('html[data-contrast="high"]')
  const accessibilityEnd = css.indexOf('@media (max-width: 1200px)', accessibilityStart)
  const accessibility = css.slice(accessibilityStart, accessibilityEnd)
  assert.doesNotMatch(accessibility, /--entries-panel-bg:\s*#ffffff/)
  assert.doesNotMatch(accessibility, /--highlights-panel-bg:\s*#ffffff/)
  assert.doesNotMatch(accessibility, /data-focus-indicator="strong"[\s\S]*?box-shadow:/)
  assert.doesNotMatch(accessibility, /data-control-size="large"\] button\s*,/)
  assert.match(accessibility, /data-control-size="large"\] \.tool-btn,[\s\S]*?height:\s*38px/)
  assert.match(accessibility, /data-control-size="large"\] #block-controls button[\s\S]*?width:\s*30px/)
})

test("supports focus workspace", () => {
  const app = fs.readFileSync(path.join(root, "src/renderer/app.js"), "utf8")
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8")
  assert.match(html, /id="focus-mode-btn"[^>]*aria-pressed="false"/)
  assert.match(app, /function setFocusMode\(enabled\)/)
  assert.match(css, /html\[data-focus-mode="on"\] #entries-sidebar,[\s\S]*?#highlights-sidebar[\s\S]*?display:\s*none/)
})

test("supports image wrapping", () => {
  const app = fs.readFileSync(path.join(root, "src/renderer/app.js"), "utf8")
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8")
  assert.match(html, /id="image-wrap-controls"/)
  assert.match(app, /"image-wrap-left", "image-wrap-right"/)
  assert.match(app, /function setImageWrap\(mode\)/)
  assert.match(css, /#editor img\.image-wrap-left[\s\S]*?float:\s*left/)
  assert.match(css, /#editor img\.image-wrap-right[\s\S]*?float:\s*right/)
})


test("supports custom palette", () => {
  const app = fs.readFileSync(path.join(root, "src/renderer/app.js"), "utf8")
  assert.match(app, /root\.dataset\.customPalette = normalized\.customPalette/)
  assert.match(app, /--custom-editor-canvas-bg/)
  assert.match(app, /createSettingColor\("paletteSurface", "Cards and controls"/)
  assert.match(css, /html\[data-custom-palette="on"\][\s\S]*?--editor-canvas-bg: var\(--custom-editor-canvas-bg\)/)
  assert.match(css, /settings-preview\[data-custom-palette="on"\]/)
  assert.match(app, /localStorage\.setItem\(UI_SETTINGS_KEY, JSON\.stringify\(normalized\)\)/)
  assert.match(app, /applyUiSettings\(loadUiSettings\(\)\)/)
})

(function initializeUiSettings(scope) {
  const DEFAULT_SETTINGS = Object.freeze({
    leftPanel: "cream",
    rightPanel: "pink",
    editorShell: "paper",
    editorCanvas: "white",
    toolbar: "gold",
    accent: "lime",
    uiFont: "system",
    editorFont: "system",
    editorSize: "17",
    lineHeight: "1.65",
    leftWidth: "300",
    rightWidth: "340",
    density: "comfortable",
    corners: "square",
    shadows: "full",
    motion: "standard",
    buttonMotion: "tactile",
    contrast: "standard",
    focusIndicator: "standard",
    controlSize: "standard",
    customPalette: "off",
    paletteEntries: "#25222b",
    paletteHighlights: "#302433",
    paletteEditorShell: "#1b1b20",
    paletteEditorCanvas: "#25252b",
    paletteToolbar: "#3a3224",
    paletteAccent: "#b9e769",
    paletteSurface: "#303038",
    paletteText: "#f4f1e8"
  })

  const OPTIONS = Object.freeze({
    leftPanel: Object.freeze(["cream", "paper", "blue", "green", "lavender", "gray"]),
    rightPanel: Object.freeze(["pink", "cream", "blue", "green", "lavender", "gray"]),
    editorShell: Object.freeze(["paper", "white", "cream", "blue", "green", "gray"]),
    editorCanvas: Object.freeze(["white", "paper", "cream", "blue", "green", "pink"]),
    toolbar: Object.freeze(["gold", "cream", "blue", "green", "pink", "gray"]),
    accent: Object.freeze(["lime", "gold", "blue", "pink", "lavender"]),
    uiFont: Object.freeze(["system", "arial", "verdana", "georgia", "mono"]),
    editorFont: Object.freeze(["system", "arial", "verdana", "georgia", "mono"]),
    editorSize: Object.freeze(["14", "15", "16", "17", "18", "19", "20"]),
    lineHeight: Object.freeze(["1.4", "1.55", "1.65", "1.8", "2"]),
    leftWidth: Object.freeze(["260", "280", "300", "320", "340"]),
    rightWidth: Object.freeze(["300", "320", "340", "360", "380"]),
    density: Object.freeze(["compact", "comfortable"]),
    corners: Object.freeze(["square", "soft", "round"]),
    shadows: Object.freeze(["none", "soft", "full"]),
    motion: Object.freeze(["standard", "reduced"]),
    buttonMotion: Object.freeze(["tactile", "off"]),
    contrast: Object.freeze(["standard", "high"]),
    focusIndicator: Object.freeze(["standard", "strong"]),
    controlSize: Object.freeze(["standard", "large"]),
    customPalette: Object.freeze(["off", "on"])
  })

  const COLOR_KEYS = Object.freeze([
    "paletteEntries", "paletteHighlights", "paletteEditorShell", "paletteEditorCanvas",
    "paletteToolbar", "paletteAccent", "paletteSurface", "paletteText"
  ])

  function normalizeColor(value, fallback) {
    const candidate = String(value == null ? "" : value).trim()
    return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toLowerCase() : fallback
  }

  function normalizeSettings(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {}
    const normalized = {}
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      if (COLOR_KEYS.includes(key)) {
        normalized[key] = normalizeColor(source[key], DEFAULT_SETTINGS[key])
        return
      }
      const candidate = String(source[key] == null ? "" : source[key])
      normalized[key] = OPTIONS[key].includes(candidate) ? candidate : DEFAULT_SETTINGS[key]
    })
    return normalized
  }

  function isDefaultSettings(value) {
    const normalized = normalizeSettings(value)
    return Object.keys(DEFAULT_SETTINGS).every(key => normalized[key] === DEFAULT_SETTINGS[key])
  }

  const api = Object.freeze({ DEFAULT_SETTINGS, OPTIONS, COLOR_KEYS, normalizeSettings, isDefaultSettings })

  if (typeof module !== "undefined" && module.exports) module.exports = api
  if (scope) Object.defineProperty(scope, "HopperUiSettings", { value: api, configurable: false, enumerable: false, writable: false })
})(typeof globalThis !== "undefined" ? globalThis : this)

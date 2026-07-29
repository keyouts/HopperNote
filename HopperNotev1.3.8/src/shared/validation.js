(function initializeValidation(scope) {
  const LIMITS = Object.freeze({
    stateBytes: 50 * 1024 * 1024,
    localStateBytes: 4 * 1024 * 1024,
    importBytes: 5 * 1024 * 1024,
    htmlImportBytes: 20 * 1024 * 1024,
    imageBytes: 5 * 1024 * 1024,
    imageCount: 3,
    entries: 2000,
    highlights: 20000,
    notebooks: 500,
    history: 20,
    title: 500,
    content: 24 * 1024 * 1024,
    historyContent: 1024 * 1024,
    highlightText: 100000,
    note: 100000,
    url: 2048,
    id: 128,
    tags: 100,
    tag: 64,
    notebookTitle: 200,
    clipboard: 250000
  })

  const SAFE_COLORS = Object.freeze(["yellow", "lightgreen", "lightskyblue", "pink", "orange"])
  const SAFE_COLOR_SET = new Set(SAFE_COLORS)
  const UNSAFE_TAG_PATTERN = /<\s*(script|style|object|embed|applet|meta|link|base|form|textarea|select|option|svg|math|audio|video|source|track)\b/i
  const UNSAFE_ATTRIBUTE_PATTERN = /\s(?:on[a-z0-9_-]+|srcdoc|formaction|action|xlink:href)\s*=/i
  const UNSAFE_PROTOCOL_PATTERN = /\b(?:href|src)\s*=\s*(["'])?\s*(?:javascript|vbscript|file|filesystem|data:text\/html)\s*:/i
  const UNSAFE_STYLE_PATTERN = /\sstyle\s*=\s*(["'])[^"']*(?:url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding)[^"']*\1/i

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const proto = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null
  }

  function byteLength(value) {
    const text = String(value || "")
    if (typeof Buffer !== "undefined" && typeof Buffer.byteLength === "function") {
      return Buffer.byteLength(text, "utf8")
    }
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(text).length
    }
    return unescape(encodeURIComponent(text)).length
  }

  function safeString(value, maxLength, fallback = "") {
    if (typeof value !== "string" && typeof value !== "number") return fallback
    return String(value).slice(0, maxLength)
  }

  function safeId(value) {
    const id = safeString(value, LIMITS.id).trim()
    return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : ""
  }

  function safeTimestamp(value) {
    const number = Number(value)
    const minimum = 946684800000
    const maximum = Date.now() + 365 * 24 * 60 * 60 * 1000
    return Number.isFinite(number) && number >= minimum && number <= maximum ? Math.floor(number) : Date.now()
  }

  function safeUrl(value) {
    try {
      const parsed = new URL(safeString(value, LIMITS.url).trim())
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return ""
      parsed.username = ""
      parsed.password = ""
      parsed.hash = ""
      return parsed.toString().slice(0, LIMITS.url)
    } catch (error) {
      return ""
    }
  }

  function safeColor(value) {
    const color = safeString(value, 32, "yellow").trim().toLowerCase()
    return SAFE_COLOR_SET.has(color) ? color : "yellow"
  }

  function safeTag(value) {
    return safeString(value, LIMITS.tag)
      .trim()
      .toLowerCase()
      .replace(/^#+/, "")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, LIMITS.tag)
  }

  function safeTags(value) {
    if (!Array.isArray(value)) return []
    return Array.from(new Set(value.slice(0, LIMITS.tags).map(safeTag).filter(Boolean))).sort()
  }

  function assertSafeHtml(value) {
    const html = typeof value === "string" ? value : ""
    if (byteLength(html) > LIMITS.content) throw new Error("Entry content exceeds the allowed size")
    if (UNSAFE_TAG_PATTERN.test(html)) throw new Error("Entry content contains a blocked element")
    if (UNSAFE_ATTRIBUTE_PATTERN.test(html)) throw new Error("Entry content contains a blocked attribute")
    if (UNSAFE_PROTOCOL_PATTERN.test(html)) throw new Error("Entry content contains a blocked URL")
    if (UNSAFE_STYLE_PATTERN.test(html)) throw new Error("Entry content contains blocked styling")
    return html || "<p><br></p>"
  }

  function normalizeHistory(value) {
    if (!Array.isArray(value)) return []
    return value.slice(0, LIMITS.history).flatMap(item => {
      if (!isPlainObject(item)) return []
      const content = typeof item.content === "string" ? item.content : ""
      if (byteLength(content) > LIMITS.historyContent) return []
      return [{
        ts: safeTimestamp(item.ts),
        title: safeString(item.title, LIMITS.title, "Untitled entry") || "Untitled entry",
        content: assertSafeHtml(content)
      }]
    })
  }

  function normalizeState(payload) {
    if (!isPlainObject(payload)) throw new Error("Invalid state payload")
    const serialized = JSON.stringify(payload)
    if (byteLength(serialized) > LIMITS.stateBytes) throw new Error("State exceeds the allowed size")

    const rawEntries = Array.isArray(payload.entries) ? payload.entries : []
    const rawHighlights = Array.isArray(payload.highlights) ? payload.highlights : []
    const rawNotebooks = Array.isArray(payload.notebooks) ? payload.notebooks : []

    if (rawEntries.length > LIMITS.entries) throw new Error("Too many entries")
    if (rawHighlights.length > LIMITS.highlights) throw new Error("Too many highlights")
    if (rawNotebooks.length > LIMITS.notebooks) throw new Error("Too many notebooks")

    const notebooks = rawNotebooks.map(item => {
      if (!isPlainObject(item)) throw new Error("Invalid notebook")
      return {
        id: safeId(item.id),
        title: safeString(item.title, LIMITS.notebookTitle, "Notebook") || "Notebook",
        collapsed: Boolean(item.collapsed),
        createdAt: safeTimestamp(item.createdAt),
        updatedAt: safeTimestamp(item.updatedAt)
      }
    }).filter(item => item.id)

    const notebookIds = new Set(notebooks.map(item => item.id))
    const entries = rawEntries.map(item => {
      if (!isPlainObject(item)) throw new Error("Invalid entry")
      const id = safeId(item.id)
      if (!id) throw new Error("Invalid entry identifier")
      const notebookId = safeId(item.notebookId)
      return {
        id,
        title: safeString(item.title, LIMITS.title, "Untitled entry") || "Untitled entry",
        content: assertSafeHtml(item.content),
        tags: safeTags(item.tags),
        createdAt: safeTimestamp(item.createdAt),
        updatedAt: safeTimestamp(item.updatedAt),
        notebookId: notebookId && notebookIds.has(notebookId) ? notebookId : "",
        history: normalizeHistory(item.history)
      }
    })

    const highlights = rawHighlights.map(item => {
      if (!isPlainObject(item)) throw new Error("Invalid highlight")
      const id = safeId(item.id)
      if (!id) throw new Error("Invalid highlight identifier")
      return {
        id,
        text: safeString(item.text, LIMITS.highlightText),
        color: safeColor(item.color),
        note: safeString(item.note, LIMITS.note),
        tags: safeTags(item.tags),
        timestamp: safeTimestamp(item.timestamp),
        url: safeUrl(item.url)
      }
    })

    return { entries, highlights, notebooks }
  }

  function validateExportPayload(payload) {
    if (!isPlainObject(payload)) throw new Error("Invalid export payload")
    return {
      title: safeString(payload.title, LIMITS.title, "Untitled entry") || "Untitled entry",
      content: assertSafeHtml(payload.content),
      tags: safeTags(payload.tags),
      exportedAt: new Date(safeTimestamp(Date.parse(payload.exportedAt))).toISOString()
    }
  }

  function validateDataImage(value) {
    const text = String(value || "")
    if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\r\n]+$/i.test(text)) return ""
    return byteLength(text) <= Math.ceil(LIMITS.imageBytes * 1.38) ? text : ""
  }

  const api = Object.freeze({
    LIMITS,
    SAFE_COLORS,
    assertSafeHtml,
    byteLength,
    isPlainObject,
    normalizeState,
    safeColor,
    safeId,
    safeString,
    safeTag,
    safeTags,
    safeTimestamp,
    safeUrl,
    validateDataImage,
    validateExportPayload
  })

  if (typeof module !== "undefined" && module.exports) module.exports = api
  if (scope) Object.defineProperty(scope, "HopperValidation", { value: api, configurable: false, enumerable: false, writable: false })
})(typeof globalThis !== "undefined" ? globalThis : this)

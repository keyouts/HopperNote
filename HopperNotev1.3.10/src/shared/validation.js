(function initializeValidation(scope) {
  const SCHEMA_VERSION = 2
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
    pageTitle: 300,
    colorName: 80,
    color: 80,
    content: 24 * 1024 * 1024,
    historyContent: 1024 * 1024,
    highlightText: 100000,
    note: 100000,
    url: 2048,
    id: 128,
    tags: 100,
    tag: 64,
    notebookTitle: 200,
    clipboard: 250000,
    ranges: 4,
    xpath: 2000,
    blockId: 300,
    contextText: 2000
  })

  const SAFE_COLORS = Object.freeze(["yellow", "lightgreen", "lightskyblue", "pink", "orange"])
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

  function safeSourceUrl(value) {
    try {
      const parsed = new URL(safeString(value, LIMITS.url).trim())
      if (!["https:", "http:", "file:"].includes(parsed.protocol)) return ""
      if (parsed.protocol !== "file:") {
        parsed.username = ""
        parsed.password = ""
      }
      parsed.hash = ""
      return parsed.toString().slice(0, LIMITS.url)
    } catch (error) {
      return ""
    }
  }

  function isSafeColor(value) {
    const color = safeString(value, LIMITS.color).trim()
    if (!color || /url|image|var|expression|[;{}<>]/i.test(color)) return false
    if (/^#[0-9a-f]{3,8}$/i.test(color)) return true
    if (/^[a-z]{3,30}$/i.test(color)) return true
    if (/^rgba?\(\s*[\d.%\s,]+\)$/i.test(color)) return true
    if (/^hsla?\(\s*[\d.%\s,degturnrad]+\)$/i.test(color)) return true
    return false
  }

  function safeColor(value) {
    const color = safeString(value, LIMITS.color, "yellow").trim()
    return isSafeColor(color) ? color : "yellow"
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

  function normalizeRange(value) {
    if (!isPlainObject(value)) return null
    const exact = safeString(value.exact, LIMITS.contextText)
    const startXPath = safeString(value.startXPath, LIMITS.xpath)
    const blockXPath = safeString(value.blockXPath, LIMITS.xpath)
    const blockId = safeString(value.blockId, LIMITS.blockId)
    if (!exact && !startXPath && !blockXPath && !blockId) return null
    const startOffset = Math.max(0, Math.floor(Number(value.startOffset) || 0))
    const endOffset = Math.max(startOffset, Math.floor(Number(value.endOffset) || startOffset))
    const blockStart = Math.max(0, Math.floor(Number(value.blockStart) || 0))
    const blockEnd = Math.max(blockStart, Math.floor(Number(value.blockEnd) || blockStart))
    return {
      startXPath,
      endXPath: safeString(value.endXPath, LIMITS.xpath),
      startOffset,
      endOffset,
      blockXPath,
      blockId,
      blockStart,
      blockEnd,
      exact,
      prefix: safeString(value.prefix, 120),
      suffix: safeString(value.suffix, 120)
    }
  }

  function normalizeRanges(value) {
    if (!Array.isArray(value)) return []
    return value.slice(0, LIMITS.ranges).map(normalizeRange).filter(Boolean)
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
        suppressedTags: safeTags(item.suppressedTags),
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
      const createdAt = safeTimestamp(item.createdAt || item.timestamp)
      const updatedAt = safeTimestamp(item.updatedAt || createdAt)
      return {
        id,
        text: safeString(item.text, LIMITS.highlightText),
        color: safeColor(item.color),
        colorName: safeString(item.colorName, LIMITS.colorName),
        note: safeString(item.note, LIMITS.note),
        tags: safeTags(item.tags),
        suppressedTags: safeTags(item.suppressedTags),
        createdAt,
        updatedAt: Math.max(createdAt, updatedAt),
        timestamp: createdAt,
        url: safeSourceUrl(item.url || item.sourcePage || item.keyUrl),
        pageTitle: safeString(item.pageTitle, LIMITS.pageTitle),
        ranges: normalizeRanges(item.ranges),
        pinned: Boolean(item.pinned)
      }
    })

    return { schemaVersion: SCHEMA_VERSION, entries, highlights, notebooks }
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
    SCHEMA_VERSION,
    LIMITS,
    SAFE_COLORS,
    assertSafeHtml,
    byteLength,
    isPlainObject,
    isSafeColor,
    normalizeRanges,
    normalizeState,
    safeColor,
    safeId,
    safeSourceUrl,
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

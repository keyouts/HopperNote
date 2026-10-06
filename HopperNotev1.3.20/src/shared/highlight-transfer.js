(function initializeHighlightTransfer(scope) {
  const validation = typeof module !== "undefined" && module.exports
    ? require("./validation")
    : scope.HopperValidation

  function parseTimestamp(value, fallback = Date.now()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) return validation.safeTimestamp(numeric)
    const parsed = Date.parse(String(value || ""))
    return Number.isFinite(parsed) ? validation.safeTimestamp(parsed) : validation.safeTimestamp(fallback)
  }

  function parseCsv(text) {
    const input = String(text || "").replace(/^\ufeff/, "")
    if (validation.byteLength(input) > validation.LIMITS.importBytes) throw new Error("Highlight file exceeds the allowed size")
    const records = []
    let record = []
    let cell = ""
    let quoted = false

    for (let index = 0; index < input.length; index += 1) {
      const character = input[index]
      const next = input[index + 1]
      if (character === '"') {
        if (quoted && next === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = !quoted
        }
        continue
      }
      if (character === "," && !quoted) {
        record.push(cell)
        cell = ""
        continue
      }
      if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && next === "\n") index += 1
        record.push(cell)
        if (record.some(value => value !== "")) records.push(record)
        if (records.length > validation.LIMITS.highlights + 1) break
        record = []
        cell = ""
        continue
      }
      cell += character
    }

    record.push(cell)
    if (record.some(value => value !== "") && records.length <= validation.LIMITS.highlights) records.push(record)
    return records
  }

  function rowObject(headers, values) {
    const row = {}
    headers.forEach((key, index) => {
      if (key) row[key] = values[index] || ""
    })
    return row
  }

  function normalizeImportedHighlight(raw, options = {}) {
    const text = validation.safeString(raw && (raw.text || raw.highlight || raw.quote), validation.LIMITS.highlightText)
    const url = validation.safeSourceUrl(raw && (raw.url || raw.sourcePage || raw.keyUrl || raw.source || raw.link || options.url))
    if (!text.trim() || !url) return null
    const createdAt = parseTimestamp(raw && (raw.createdAt || raw["created at"] || raw.timestamp), options.now || Date.now())
    const updatedAt = parseTimestamp(raw && (raw.updatedAt || raw["updated at"]), createdAt)
    return {
      id: validation.safeId(raw && raw.id),
      text,
      color: validation.safeColor(raw && raw.color),
      colorName: validation.safeString(raw && (raw.colorName || raw["color name"] || options.colorName), validation.LIMITS.colorName),
      note: validation.safeString(raw && (raw.note || raw.notes || raw.comment), validation.LIMITS.note),
      tags: validation.safeTags(raw && raw.tags),
      suppressedTags: [],
      createdAt,
      updatedAt: Math.max(createdAt, updatedAt),
      timestamp: createdAt,
      url,
      pageTitle: validation.safeString(raw && (raw.pageTitle || raw["page title"]), validation.LIMITS.pageTitle),
      ranges: validation.normalizeRanges(raw && raw.ranges),
      pinned: Boolean(options.pinned || raw && raw.pinned)
    }
  }

  function parseCsvHighlights(text) {
    const records = parseCsv(text)
    if (records.length < 2) return []
    const headers = records[0].map(header => String(header || "").trim().toLowerCase())
    return records.slice(1, validation.LIMITS.highlights + 1)
      .map(values => normalizeImportedHighlight(rowObject(headers, values)))
      .filter(Boolean)
  }

  function parseJsonHighlights(text) {
    if (validation.byteLength(text) > validation.LIMITS.importBytes) throw new Error("Highlight file exceeds the allowed size")
    let parsed
    try {
      parsed = JSON.parse(String(text || "").replace(/^\ufeff/, ""))
    } catch (error) {
      throw new Error("The JSON file could not be read")
    }
    if (!parsed || typeof parsed !== "object") throw new Error("The JSON backup is invalid")

    const customColors = new Map()
    ;(Array.isArray(parsed.customColors) ? parsed.customColors : []).forEach(item => {
      const color = validation.safeColor(item && item.color)
      const name = validation.safeString(item && item.name, validation.LIMITS.colorName)
      if (color && name) customColors.set(color, name)
    })
    const pinnedIds = new Set((Array.isArray(parsed.pinnedHighlightIds) ? parsed.pinnedHighlightIds : []).map(validation.safeId).filter(Boolean))
    const rawHighlights = parsed.highlights || parsed
    const imported = []

    if (Array.isArray(rawHighlights)) {
      rawHighlights.slice(0, validation.LIMITS.highlights).forEach(raw => {
        const highlight = normalizeImportedHighlight(raw, {
          colorName: customColors.get(validation.safeColor(raw && raw.color)) || "",
          pinned: pinnedIds.has(validation.safeId(raw && raw.id))
        })
        if (highlight) imported.push(highlight)
      })
      return imported
    }

    if (!rawHighlights || typeof rawHighlights !== "object") throw new Error("The JSON backup has an invalid highlight collection")
    Object.entries(rawHighlights).forEach(([pageUrl, entries]) => {
      if (imported.length >= validation.LIMITS.highlights || !Array.isArray(entries)) return
      entries.forEach(raw => {
        if (imported.length >= validation.LIMITS.highlights) return
        const color = validation.safeColor(raw && raw.color)
        const highlight = normalizeImportedHighlight(raw, {
          url: pageUrl,
          colorName: customColors.get(color) || "",
          pinned: pinnedIds.has(validation.safeId(raw && raw.id))
        })
        if (highlight) imported.push(highlight)
      })
    })
    return imported
  }

  function importHighlights(text, fileName = "") {
    const name = String(fileName || "").toLowerCase()
    const trimmed = String(text || "").trimStart()
    if (name.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return { source: "JSON", highlights: parseJsonHighlights(text) }
    }
    return { source: "CSV", highlights: parseCsvHighlights(text) }
  }

  function protectCsvValue(value) {
    const text = String(value == null ? "" : value)
    return /^[=+\-@]/.test(text) ? `'${text}` : text
  }

  function csvCell(value) {
    return `"${protectCsvValue(value).replace(/"/g, '""')}"`
  }

  function serializeCsv(highlights) {
    const headers = ["ID", "URL", "Page Title", "Color", "Color Name", "Created At", "Updated At", "Text", "Note"]
    const rows = [headers]
    ;(highlights || []).slice(0, validation.LIMITS.highlights).forEach(item => {
      rows.push([
        item.id || "",
        item.url || "",
        item.pageTitle || "",
        item.color || "yellow",
        item.colorName || "",
        item.createdAt || item.timestamp || "",
        item.updatedAt || item.createdAt || item.timestamp || "",
        item.text || "",
        item.note || ""
      ])
    })
    return "\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\r\n")
  }

  const api = Object.freeze({ importHighlights, normalizeImportedHighlight, parseCsvHighlights, parseJsonHighlights, serializeCsv })
  if (typeof module !== "undefined" && module.exports) module.exports = api
  if (scope) Object.defineProperty(scope, "HopperHighlightTransfer", { value: api, configurable: false, enumerable: false, writable: false })
})(typeof globalThis !== "undefined" ? globalThis : this)

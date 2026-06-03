// Element Handles
const newEntryBtn = document.getElementById("new-entry-btn")
const newNotebookBtn = document.getElementById("new-notebook-btn")
const duplicateEntryBtn = document.getElementById("duplicate-entry-btn")
const deleteEntryBtn = document.getElementById("delete-entry-btn")
const entrySearchInput = document.getElementById("entry-search-input")
const notebookList = document.getElementById("notebook-list")
const entryList = document.getElementById("entry-list")
const tagList = document.getElementById("tag-list")
const tagOverlayOpen = document.getElementById("tag-overlay-open")
const tagOverlayBackdrop = document.getElementById("tag-overlay-backdrop")
const tagOverlayClose = document.getElementById("tag-overlay-close")
const tagDeleteModeBtn = document.getElementById("tag-delete-mode-btn")
const tagFilterCount = document.getElementById("tag-filter-count")
const entryTitleInput = document.getElementById("entry-title-input")
const notebookSelect = document.getElementById("notebook-select")
const entryDateLabel = document.getElementById("entry-date-label")
const saveStatus = document.getElementById("save-status")
const toolbar = document.getElementById("toolbar")
const toolbarPanel = document.getElementById("toolbar-panel")
const toolbarToggleBtn = document.getElementById("toolbar-toggle-btn")
const editor = document.getElementById("editor")
const editorWrap = document.getElementById("editor-wrap")
const markdownPreview = document.getElementById("markdown-preview")
const exportEntryBtn = document.getElementById("export-entry-btn")
const exportPdfBtn = document.getElementById("export-pdf-btn")
const importEntryBtn = document.getElementById("import-entry-btn")
const importCsvBtn = document.getElementById("import-csv-btn")
const exportCsvBtn = document.getElementById("export-csv-btn")
const highlightSearchInput = document.getElementById("highlight-search-input")
const highlightList = document.getElementById("highlight-list")
const collectionList = document.getElementById("collection-list")
const imageInput = document.getElementById("image-input")
const entryHtmlInput = document.getElementById("entry-html-input")
const insertImageBtn = document.getElementById("insert-image-btn")
const insertVideoBtn = document.getElementById("insert-video-btn")
const insertHighlightBtn = document.getElementById("insert-highlight-btn")
const templateBtn = document.getElementById("template-btn")
const clearFormatBtn = document.getElementById("clear-format-btn")
const modalRoot = document.getElementById("modal-root")
const ariaLive = document.getElementById("aria-live")
const markdownToggleBtn = document.getElementById("markdown-toggle-btn")
const historyBtn = document.getElementById("history-btn")

// App State
let state = {
  entries: [],
  highlights: [],
  notebooks: [],
}

let selectedEntryId = null
let activeNotebookId = "all"
let entrySearchQuery = ""
let highlightSearchQuery = ""
let activeHighlightCollection = ""
let activeTagFilter = ""
let saveTimer = null
let selectionRange = null
let tagDeleteMode = false
let tagRenderTimer = null
let sidePanelRenderTimer = null
let isSyncingEditor = false
let isTagStyling = false
var markdownMode = false
var markdownSession = null

const LOCAL_STORAGE_KEY = "hopper-journal-local-state"

// Id Helpers
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// Notebook Data
function createNotebook(title = "New Notebook") {
  const now = Date.now()
  return {
    id: generateId(),
    title: String(title || "New Notebook").trim() || "New Notebook",
    collapsed: false,
    createdAt: now,
    updatedAt: now
  }
}

function normalizeNotebook(raw) {
  const now = Date.now()
  return {
    id: raw && raw.id ? String(raw.id) : generateId(),
    title: raw && raw.title ? String(raw.title) : "Notebook",
    collapsed: !!(raw && raw.collapsed),
    createdAt: normalizeTimestamp(raw && raw.createdAt) || now,
    updatedAt: normalizeTimestamp(raw && raw.updatedAt) || now
  }
}

function getNotebookById(id) {
  return state.notebooks.find(notebook => notebook.id === id) || null
}

function getNotebookTitle(id) {
  const notebook = getNotebookById(id)
  return notebook ? notebook.title : "Loose Entries"
}

function normalizeTimestamp(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : Date.now()
}

function canonicalizeUrl(url) {
  try {
    const u = new URL(url || "")
    u.hash = ""
    return u.toString()
  } catch (e) {
    return (url || "").trim()
  }
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim()
}

function normalizeTag(tag) {
  const value = String(tag || "").trim().toLowerCase().replace(/^#+/, "")
  if (!value) return ""
  return value.replace(/[^a-z0-9_-]/g, "")
}

function extractTagsFromText(text) {
  const tags = []
  const regex = /(^|[^A-Za-z0-9_#-])#([A-Za-z0-9_-]+)/g
  let match

  while ((match = regex.exec(String(text || "")))) {
    const tag = normalizeTag(match[2])
    if (tag) tags.push(tag)
  }

  return Array.from(new Set(tags)).sort()
}

function mergeTags(existing, incoming) {
  return Array.from(new Set([...(existing || []).map(normalizeTag), ...(incoming || []).map(normalizeTag)].filter(Boolean))).sort()
}

function getHighlightUrl(h) {
  return canonicalizeUrl(h.url || h.sourcePage || h.keyUrl || "")
}

function getEntryById(id) {
  return state.entries.find(entry => entry.id === id) || null
}

function htmlToPlainText(html) {
  const div = document.createElement("div")
  div.innerHTML = html || ""
  return (div.textContent || "").replace(/\s+/g, " ").trim()
}

function getVideoEmbedUrl(url) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase()

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/embed/")) {
        const parts = parsed.pathname.split("/").filter(Boolean)
        const id = parts[1]
        if (!id) return null
        return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1`
      }

      const v = parsed.searchParams.get("v")
      if (!v) return null
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}?rel=0&modestbranding=1&playsinline=1`
    }

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/\//g, "")
      if (!id) return null
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1`
    }

    if (host === "youtube-nocookie.com") {
      const parts = parsed.pathname.split("/").filter(Boolean)
      const embedIndex = parts.indexOf("embed")
      const id = embedIndex >= 0 ? parts[embedIndex + 1] : parts[parts.length - 1]
      if (!id) return null
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1`
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const parts = parsed.pathname.split("/").filter(Boolean)
      const id = host === "player.vimeo.com" && parts[0] === "video" ? parts[1] : parts[0]
      if (!id) return null
      return `https://player.vimeo.com/video/${id}`
    }

    return null
  } catch (e) {
    return null
  }
}

function sanitizeEditorHtml(html) {
  const div = document.createElement("div")
  div.innerHTML = html || ""

  div.querySelectorAll("script, style").forEach(node => node.remove())
  applyInsertedHighlightColors(div)

  div.querySelectorAll(".video-embed-wrap iframe").forEach(iframe => {
    const src = iframe.getAttribute("src") || ""
    const embed = getVideoEmbedUrl(src)

    if (!embed) {
      const wrap = iframe.closest(".video-embed-wrap")
      if (wrap) {
        wrap.remove()
      } else {
        iframe.remove()
      }
      return
    }

    iframe.setAttribute("src", embed)
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share")
    iframe.setAttribute("allowfullscreen", "")
    iframe.setAttribute("loading", "lazy")
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin")
  })

  if (!div.innerHTML.trim()) {
    return "<p><br></p>"
  }

  return div.innerHTML
}

function updateEditorPlaceholder() {
  const text = editor.textContent.replace(/\u200B/g, "").trim()
  const hasMedia = !!editor.querySelector("img, iframe, .video-embed-wrap, .hopper-highlight-card")
  editor.classList.toggle("is-empty", !text && !hasMedia)
}

function createEmptyEntry() {
  const now = Date.now()
  return {
    id: generateId(),
    title: "Untitled entry",
    content: "<p><br></p>",
    tags: [],
    createdAt: now,
    updatedAt: now,
    notebookId: activeNotebookId && activeNotebookId !== "all" && activeNotebookId !== "loose" ? activeNotebookId : ""
  }
}

function cloneEntry(entry) {
  const now = Date.now()
  return {
    id: generateId(),
    title: `${entry.title || "Untitled entry"} Copy`,
    content: sanitizeEditorHtml(entry.content || "<p><br></p>"),
    tags: Array.isArray(entry.tags) ? entry.tags.slice() : [],
    createdAt: now,
    updatedAt: now,
    notebookId: entry.notebookId || ""
  }
}

function normalizeEntry(raw) {
  const createdAt = normalizeTimestamp(raw && raw.createdAt)
  const updatedAt = normalizeTimestamp(raw && raw.updatedAt)
  return {
    id: raw && raw.id ? String(raw.id) : generateId(),
    title: raw && raw.title ? String(raw.title) : "Untitled entry",
    content: sanitizeEditorHtml(raw && typeof raw.content === "string" ? raw.content : "<p><br></p>"),
    tags: mergeTags(Array.isArray(raw && raw.tags) ? raw.tags.map(normalizeTag).filter(Boolean) : [], extractTagsFromText(htmlToPlainText(raw && typeof raw.content === "string" ? raw.content : ""))),
    createdAt,
    updatedAt,
    notebookId: raw && raw.notebookId ? String(raw.notebookId) : "",
    history: Array.isArray(raw && raw.history) ? raw.history.slice(0, 20) : []
  }
}

function getHighlightIdentityKey(h) {
  return `${getHighlightUrl(h)}||${normalizeText(h.text)}`
}

function normalizeHighlight(raw) {
  const note = raw && typeof raw.note === "string" ? raw.note : ""
  return {
    id: raw && raw.id ? String(raw.id) : generateId(),
    text: raw && typeof raw.text === "string" ? raw.text : "",
    color: raw && raw.color ? String(raw.color).trim().toLowerCase() : "yellow",
    note,
    tags: getHighlightTags({ text: raw && typeof raw.text === "string" ? raw.text : "", note }),
    timestamp: normalizeTimestamp(raw && raw.timestamp),
    url: getHighlightUrl(raw)
  }
}

function mergeHighlightFields(existing, incoming) {
  const existingTs = normalizeTimestamp(existing.timestamp)
  const incomingTs = normalizeTimestamp(incoming.timestamp)
  const incomingNewer = incomingTs >= existingTs

  return {
    id: incomingNewer ? incoming.id : existing.id,
    text: incomingNewer ? incoming.text : existing.text,
    color: incomingNewer ? incoming.color : existing.color,
    note: normalizeText(incoming.note) ? incoming.note : existing.note,
    tags: mergeTags(existing.tags, incoming.tags),
    timestamp: Math.max(existingTs, incomingTs),
    url: incomingNewer ? incoming.url : existing.url
  }
}

function dedupeHighlights(highlights) {
  const byKey = new Map()

  ;(highlights || []).forEach(raw => {
    const item = normalizeHighlight(raw)
    if (!normalizeText(item.text)) return
    if (!normalizeText(item.url)) return

    const key = getHighlightIdentityKey(item)
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, item)
      return
    }

    byKey.set(key, mergeHighlightFields(existing, item))
  })

  return Array.from(byKey.values()).sort((a, b) => b.timestamp - a.timestamp)
}

// Data Loading
function normalizeLoadedData(data) {
  const notebooks = Array.isArray(data && data.notebooks) ? data.notebooks.map(normalizeNotebook) : []
  const notebookIds = new Set(notebooks.map(notebook => notebook.id))
  const entries = Array.isArray(data && data.entries) ? data.entries.map(normalizeEntry).map(entry => ({
    ...entry,
    notebookId: entry.notebookId && notebookIds.has(entry.notebookId) ? entry.notebookId : ""
  })) : []
  const highlights = Array.isArray(data && data.highlights) ? dedupeHighlights(data.highlights) : []
  return { entries, highlights, notebooks }
}

function announce(text) {
  ariaLive.textContent = ""
  requestAnimationFrame(() => {
    ariaLive.textContent = text
  })
}

function setSaveStatus(text) {
  saveStatus.textContent = text
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return { entries: [], highlights: [], notebooks: [] }
    return normalizeLoadedData(JSON.parse(raw))
  } catch (e) {
    return { entries: [], highlights: [], notebooks: [] }
  }
}

function saveLocalState() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      entries: state.entries,
      highlights: state.highlights,
      notebooks: state.notebooks,
      links: []
    }))
    return true
  } catch (e) {
    return false
  }
}

function canUseNativeApi() {
  return !!(window.api && typeof window.api.loadData === "function" && typeof window.api.saveData === "function")
}

function persistStateNow() {
  state.notebooks = (state.notebooks || []).map(normalizeNotebook)
  state.entries = state.entries.map(normalizeEntry)
  state.highlights = dedupeHighlights(state.highlights)

  if (canUseNativeApi()) {
    return window.api.saveData({
      entries: state.entries,
      highlights: state.highlights,
      notebooks: state.notebooks,
      links: []
    }).then(result => {
      if (result && result.ok) {
        saveLocalState()
        setSaveStatus("Saved")
      } else {
        const localOk = saveLocalState()
        setSaveStatus(localOk ? "Saved locally" : "Save failed")
      }
      return result
    }).catch(() => {
      const localOk = saveLocalState()
      setSaveStatus(localOk ? "Saved locally" : "Save failed")
      return { ok: false }
    })
  }

  const localOk = saveLocalState()
  setSaveStatus(localOk ? "Saved locally" : "Save failed")
  return Promise.resolve({ ok: localOk, localOnly: true })
}

function queueSave() {
  setSaveStatus(canUseNativeApi() ? "Saving..." : "Saving locally...")

  if (saveTimer) clearTimeout(saveTimer)

  saveTimer = setTimeout(() => {
    persistStateNow()
  }, 450)
}

// Render Helpers
function queueSidePanelRender() {
  if (sidePanelRenderTimer) clearTimeout(sidePanelRenderTimer)
  sidePanelRenderTimer = setTimeout(() => {
    sidePanelRenderTimer = null
    renderEntries()
    renderTags()
  }, 180)
}

// Change Helpers
function updateEntryIfChanged(entry, nextTitle, nextContent, inlineTags) {
  const normalizedTags = mergeTags([], inlineTags || [])
  const currentTags = mergeTags([], entry.tags || [])
  const titleChanged = entry.title !== nextTitle
  const contentChanged = entry.content !== nextContent
  const tagsChanged = currentTags.join("\u0001") !== normalizedTags.join("\u0001")

  if (!titleChanged && !contentChanged && !tagsChanged) return false

  entry.title = nextTitle
  entry.content = nextContent
  entry.tags = normalizedTags
  entry.updatedAt = Date.now()
  return true
}

function sortEntries(entries) {
  return entries.slice().sort((a, b) => b.updatedAt - a.updatedAt)
}

function getFilteredEntries() {
  const q = entrySearchQuery.trim().toLowerCase()
  const tag = normalizeTag(activeTagFilter)
  const sorted = sortEntries(state.entries)

  return sorted.filter(entry => {
    const title = (entry.title || "").toLowerCase()
    const content = htmlToPlainText(entry.content || "").toLowerCase()
    const notebookMatch = activeNotebookId === "all" || (activeNotebookId === "loose" ? !entry.notebookId : entry.notebookId === activeNotebookId)
    const tagMatch = !tag || (entry.tags || []).includes(tag)
    const operatorNotebook=(entrySearchQuery.match(/notebook:([^ ]+)/)||[])[1]; const operatorTag=(entrySearchQuery.match(/tag:([^ ]+)/)||[])[1]; const queryNotebookOk=!operatorNotebook||getNotebookTitle(entry.notebookId).toLowerCase().includes(operatorNotebook.toLowerCase()); const queryTagOk=!operatorTag||(entry.tags||[]).join(" ").includes(operatorTag);
    const queryMatch = !q || title.includes(q) || content.includes(q)
    return notebookMatch && tagMatch && queryMatch && queryNotebookOk && queryTagOk
  })
}

function getFilteredHighlights() {
  const q = highlightSearchQuery.trim().toLowerCase()
  const activeCollection = normalizeTag(activeHighlightCollection)
  const items = state.highlights.slice().sort((a, b) => b.timestamp - a.timestamp)

  return items.filter(h => {
    const tags = getHighlightTags(h)
    const collectionMatch = !activeCollection || tags.includes(activeCollection)
    if (!collectionMatch) return false
    if (!q) return true

    const text = (h.text || "").toLowerCase()
    const note = (h.note || "").toLowerCase()
    const url = (h.url || "").toLowerCase()
    const tagText = tags.join(" ").toLowerCase()
    return text.includes(q) || note.includes(q) || url.includes(q) || tagText.includes(q)
  })
}

// Highlight Tags
function getHighlightTags(highlight) {
  const inlineTags = extractTagsFromText(`${highlight && highlight.text ? highlight.text : ""} ${highlight && highlight.note ? highlight.note : ""}`)
  return mergeTags(highlight && highlight.tags ? highlight.tags : [], inlineTags)
}

function getHighlightCollectionsWithCounts() {
  const counts = new Map()

  state.highlights.forEach(highlight => {
    getHighlightTags(highlight).forEach(tag => {
      if (!tag) return
      counts.set(tag, (counts.get(tag) || 0) + 1)
    })
  })

  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }))
}

function renderHighlightCollections() {
  if (!collectionList) return

  collectionList.textContent = ""
  const collections = getHighlightCollectionsWithCounts()

  const allBtn = document.createElement("button")
  allBtn.type = "button"
  allBtn.className = "collection-chip" + (!activeHighlightCollection ? " active" : "")
  allBtn.innerHTML = `<span>All</span><span class="collection-chip-count">${state.highlights.length}</span>`
  allBtn.addEventListener("click", () => {
    activeHighlightCollection = ""
    renderHighlightCollections()
    renderHighlights()
  })
  collectionList.appendChild(allBtn)

  if (!collections.length) {
    const empty = document.createElement("div")
    empty.className = "empty-state collection-empty"
    empty.textContent = "Use #tags inside highlights to make collections."
    collectionList.appendChild(empty)
    return
  }

  collections.forEach(item => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "collection-chip" + (activeHighlightCollection === item.tag ? " active" : "")
    btn.innerHTML = `<span>#${escapeHtml(item.tag)}</span><span class="collection-chip-count">${item.count}</span>`
    btn.addEventListener("click", () => {
      activeHighlightCollection = activeHighlightCollection === item.tag ? "" : item.tag
      renderHighlightCollections()
      renderHighlights()
    })
    collectionList.appendChild(btn)
  })
}

function getAllTagsWithCounts() {
  const counts = new Map()

  state.entries.forEach(entry => {
    const entryTags = mergeTags(entry.tags || [], extractTagsFromText(htmlToPlainText(entry.content || "")))
    ;(entryTags || []).forEach(tag => {
      const normalized = normalizeTag(tag)
      if (!normalized) return
      counts.set(normalized, (counts.get(normalized) || 0) + 1)
    })
  })

  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }))
}

function removeTagEverywhere(tag) {
  const normalized = normalizeTag(tag)
  if (!normalized) return

  state.entries = state.entries.map(entry => {
    const hadTag = (entry.tags || []).map(normalizeTag).includes(normalized)
    return {
      ...entry,
      tags: (entry.tags || []).map(normalizeTag).filter(item => item && item !== normalized),
      updatedAt: hadTag ? Date.now() : entry.updatedAt
    }
  })

  state.highlights = state.highlights.map(highlight => ({
    ...highlight,
    tags: (highlight.tags || []).map(normalizeTag).filter(item => item && item !== normalized)
  }))

  if (activeTagFilter === normalized) activeTagFilter = ""
  if (activeHighlightCollection === normalized) activeHighlightCollection = ""
  renderEntries()
  renderHighlights()
  renderHighlightCollections()
  renderTags()
  queueSave()
  announce(`#${normalized} deleted`)
}

function renderTags() {
  tagList.textContent = ""
  const tags = getAllTagsWithCounts()
  const currentEntry = getEntryById(selectedEntryId)
  const selectedTags = new Set((currentEntry && currentEntry.tags ? currentEntry.tags : []).map(normalizeTag))

  if (tagFilterCount) {
    tagFilterCount.textContent = activeTagFilter ? `#${activeTagFilter}` : `${tags.length} tag${tags.length === 1 ? "" : "s"}`
  }

  const allBtn = document.createElement("button")
  allBtn.type = "button"
  allBtn.className = "tag-chip tag-filter-chip" + (!activeTagFilter ? " active" : "")
  allBtn.textContent = "All entries"
  allBtn.addEventListener("click", () => {
    activeTagFilter = ""
    renderEntries()
    renderTags()
  })
  tagList.appendChild(allBtn)

  if (!tags.length) {
    const empty = document.createElement("div")
    empty.className = "empty-state"
    empty.textContent = "No tags from inserted highlights yet."
    tagList.appendChild(empty)
    return
  }

  tags.forEach(item => {
    const btn = document.createElement("button")
    btn.type = "button"

    const classes = ["tag-chip", "tag-filter-chip"]
    if (activeTagFilter === item.tag) classes.push("active")
    if (selectedTags.has(item.tag)) classes.push("selected-entry-tag")
    if (tagDeleteMode) classes.push("delete-mode")

    btn.className = classes.join(" ")
    btn.innerHTML = `<span>#${escapeHtml(item.tag)}</span><span class="tag-chip-count">${item.count}</span>${tagDeleteMode ? `<span class="tag-chip-x">×</span>` : ""}`

    btn.addEventListener("click", () => {
      if (tagDeleteMode) {
        removeTagEverywhere(item.tag)
        return
      }
      activeTagFilter = activeTagFilter === item.tag ? "" : item.tag
      renderEntries()
      renderTags()
    })

    tagList.appendChild(btn)
  })
}

function openTagOverlay() {
  if (!tagOverlayBackdrop) return
  tagOverlayBackdrop.hidden = false
  tagOverlayBackdrop.classList.add("open")
  renderTags()
}

function closeTagOverlay() {
  if (!tagOverlayBackdrop) return
  tagOverlayBackdrop.classList.remove("open")
  tagOverlayBackdrop.hidden = true
}


function getEntriesForNotebook(notebookId) {
  const previousNotebook = activeNotebookId
  activeNotebookId = notebookId
  const entries = getFilteredEntries()
  activeNotebookId = previousNotebook
  return entries
}

function createNotebookButton(id, label, count, selected) {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "notebook-filter" + (selected ? " active" : "")
  btn.setAttribute("aria-label", `${label}, ${count} entries`)
  btn.innerHTML = `<span aria-hidden="true">${escapeHtml(label)}</span><span class="notebook-count" aria-hidden="true">${count}</span><span class="visually-hidden">${escapeHtml(label)}, ${count} entries</span>`
  btn.addEventListener("click", () => {
    activeNotebookId = id
    renderNotebooks()
    renderEntries()
  })
  return btn
}

function renderNotebooks() {
  if (!notebookList) return
  notebookList.textContent = ""

  notebookList.appendChild(createNotebookButton("all", "All Entries", state.entries.length, activeNotebookId === "all"))
  notebookList.appendChild(createNotebookButton("loose", "Loose Entries", state.entries.filter(entry => !entry.notebookId).length, activeNotebookId === "loose"))

  state.notebooks.slice().sort((a, b) => a.title.localeCompare(b.title)).forEach(notebook => {
    const row = document.createElement("div")
    row.className = "notebook-row" + (activeNotebookId === notebook.id ? " active" : "")

    const toggle = document.createElement("button")
    toggle.type = "button"
    toggle.className = "notebook-toggle"
    const entries = state.entries.filter(entry => entry.notebookId === notebook.id)
    toggle.setAttribute("aria-expanded", String(!notebook.collapsed))
    toggle.setAttribute("aria-label", `${notebook.title}, ${entries.length} entries`)
    toggle.innerHTML = `<span aria-hidden="true">${notebook.collapsed ? "▸" : "▾"}</span><span aria-hidden="true">${escapeHtml(notebook.title)}</span><span class="notebook-count" aria-hidden="true">${entries.length}</span><span class="visually-hidden">${escapeHtml(notebook.title)}, ${entries.length} entries</span>`
    toggle.addEventListener("click", () => {
      activeNotebookId = notebook.id
      notebook.collapsed = !notebook.collapsed
      notebook.updatedAt = Date.now()
      renderNotebooks()
      renderEntries()
      queueSave()
    })

    const rename = document.createElement("button")
    rename.type = "button"
    rename.className = "notebook-mini"
    rename.setAttribute("aria-label", `Rename ${notebook.title}`)
    rename.innerHTML = `<span aria-hidden="true">✎</span><span class="visually-hidden">Rename notebook</span>`
    rename.addEventListener("click", ev => {
      ev.stopPropagation()
      renameNotebook(notebook.id)
    })

    const deleteBtn = document.createElement("button")
    deleteBtn.type = "button"
    deleteBtn.className = "notebook-mini delete"
    deleteBtn.setAttribute("aria-label", `Delete ${notebook.title}`)
    deleteBtn.innerHTML = `<span aria-hidden="true">×</span><span class="visually-hidden">Delete notebook</span>`
    deleteBtn.addEventListener("click", ev => {
      ev.stopPropagation()
      confirmDeleteNotebook(notebook.id)
    })

    row.appendChild(toggle)
    row.appendChild(rename)
    row.appendChild(deleteBtn)
    notebookList.appendChild(row)
  })
}

function renderNotebookSelect() {
  if (!notebookSelect) return
  const current = getEntryById(selectedEntryId)
  notebookSelect.textContent = ""

  const loose = document.createElement("option")
  loose.value = ""
  loose.textContent = "Loose Entries"
  notebookSelect.appendChild(loose)

  state.notebooks.slice().sort((a, b) => a.title.localeCompare(b.title)).forEach(notebook => {
    const option = document.createElement("option")
    option.value = notebook.id
    option.textContent = notebook.title
    notebookSelect.appendChild(option)
  })

  notebookSelect.value = current && current.notebookId ? current.notebookId : ""
}

function openNotebookModal(mode, existingNotebook = null) {
  const isRename = mode === "rename"
  openModal(isRename ? "Rename Notebook" : "New Notebook", (card, close) => {
    const label = document.createElement("label")
    label.className = "modal-label"
    label.textContent = "Notebook name"

    const input = document.createElement("input")
    input.type = "text"
    input.value = existingNotebook ? existingNotebook.title : ""
    input.placeholder = "Notebook name"
    input.setAttribute("aria-label", "Notebook name")

    const actions = document.createElement("div")
    actions.className = "modal-actions"

    const cancelBtn = document.createElement("button")
    cancelBtn.type = "button"
    cancelBtn.textContent = "Cancel"

    const saveBtn = document.createElement("button")
    saveBtn.type = "button"
    saveBtn.textContent = isRename ? "Rename" : "Create"

    const saveNotebook = () => {
      const title = input.value.trim() || "Notebook"
      if (isRename && existingNotebook) {
        existingNotebook.title = title
        existingNotebook.updatedAt = Date.now()
        announce("Notebook renamed")
      } else {
        const notebook = createNotebook(title)
        state.notebooks.push(notebook)
        activeNotebookId = "all"
        announce("Notebook created")
      }
      renderAll()
      queueSave()
      close()
    }

    cancelBtn.addEventListener("click", close)
    saveBtn.addEventListener("click", saveNotebook)
    input.addEventListener("keydown", ev => {
      if (ev.key === "Enter") {
        ev.preventDefault()
        saveNotebook()
      }
    })

    actions.appendChild(cancelBtn)
    actions.appendChild(saveBtn)
    card.appendChild(label)
    card.appendChild(input)
    card.appendChild(actions)
    input.focus()
    input.select()
  })
}

function createNewNotebook() {
  openNotebookModal("create")
}

function renameNotebook(id) {
  const notebook = getNotebookById(id)
  if (!notebook) return
  openNotebookModal("rename", notebook)
}

// Delete Notebook
function confirmDeleteNotebook(id) {
  const notebook = getNotebookById(id)
  if (!notebook) return
  const entryCount = state.entries.filter(entry => entry.notebookId === id).length

  openModal("Delete Notebook", (card, close) => {
    const message = document.createElement("p")
    message.className = "modal-warning"
    message.textContent = `Delete “${notebook.title}”? ${entryCount} entr${entryCount === 1 ? "y" : "ies"} will move to Loose Entries.`

    const actions = document.createElement("div")
    actions.className = "modal-actions"

    const cancelBtn = document.createElement("button")
    cancelBtn.type = "button"
    cancelBtn.textContent = "Cancel"

    const deleteBtn = document.createElement("button")
    deleteBtn.type = "button"
    deleteBtn.className = "danger-action"
    deleteBtn.textContent = "Delete"
    deleteBtn.setAttribute("aria-label", `Delete notebook ${notebook.title}`)

    cancelBtn.addEventListener("click", close)
    deleteBtn.addEventListener("click", () => {
      deleteNotebook(id)
      close()
    })

    actions.appendChild(cancelBtn)
    actions.appendChild(deleteBtn)
    card.appendChild(message)
    card.appendChild(actions)
    deleteBtn.focus()
  })
}

// Notebook Delete
function deleteNotebook(id) {
  const notebook = getNotebookById(id)
  if (!notebook) return
  state.notebooks = state.notebooks.filter(item => item.id !== id)
  state.entries.forEach(entry => {
    if (entry.notebookId === id) {
      entry.notebookId = ""
      entry.updatedAt = Date.now()
    }
  })
  if (activeNotebookId === id) activeNotebookId = "loose"
  renderAll()
  queueSave()
  announce("Notebook deleted")
}

function updateSelectedNotebook(id) {
  const entry = getEntryById(selectedEntryId)
  if (!entry) return
  entry.notebookId = id || ""
  entry.updatedAt = Date.now()
  activeNotebookId = id || "loose"
  renderAll()
  queueSave()
  announce("Notebook updated")
}

function createEntryCard(entry) {
  const card = document.createElement("div")
  card.className = "entry-card" + (entry.id === selectedEntryId ? " selected" : "")
  card.tabIndex = 0
  card.setAttribute("role", "button")
  card.setAttribute("aria-label", `Open entry ${entry.title || "Untitled entry"}`)

  const title = document.createElement("div")
  title.className = "entry-card-title"
  title.textContent = entry.title || "Untitled entry"

  const meta = document.createElement("div")
  meta.className = "entry-card-meta"
  meta.textContent = `${getNotebookTitle(entry.notebookId)} · ${new Date(entry.updatedAt).toLocaleString()}`

  const snippet = document.createElement("div")
  snippet.className = "entry-card-snippet"
  snippet.textContent = htmlToPlainText(entry.content).slice(0, 120) || "Empty entry"

  card.appendChild(title)
  card.appendChild(meta)

  if (entry.tags && entry.tags.length) {
    const tags = document.createElement("div")
    tags.className = "entry-card-tags"
    tags.textContent = entry.tags.map(tag => `#${tag}`).join(" ")
    card.appendChild(tags)
  }

  card.appendChild(snippet)

  card.addEventListener("click", () => {
    selectEntry(entry.id)
  })

  card.addEventListener("keydown", ev => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault()
      selectEntry(entry.id)
    }
  })

  return card
}

function createEntryGroup(id, label, entries, collapsed = false) {
  const section = document.createElement("section")
  section.className = "entry-group"

  const header = document.createElement("button")
  header.type = "button"
  header.className = "entry-group-header"
  header.setAttribute("aria-expanded", String(!collapsed))
  header.setAttribute("aria-label", `${label}, ${entries.length} entries`)
  header.innerHTML = `<span aria-hidden="true">${collapsed ? "▸" : "▾"} ${escapeHtml(label)}</span><span class="notebook-count" aria-hidden="true">${entries.length}</span><span class="visually-hidden">${escapeHtml(label)}, ${entries.length} entries</span>`
  header.addEventListener("click", () => {
    if (id === "loose") {
      activeNotebookId = activeNotebookId === "loose" ? "all" : "loose"
      renderAll()
      return
    }
    const notebook = getNotebookById(id)
    if (!notebook) return
    notebook.collapsed = !notebook.collapsed
    notebook.updatedAt = Date.now()
    activeNotebookId = "all"
    renderAll()
    queueSave()
  })

  section.appendChild(header)

  if (!collapsed) {
    const items = document.createElement("div")
    items.className = "entry-group-items"
    if (entries.length) {
      entries.forEach(entry => items.appendChild(createEntryCard(entry)))
    } else {
      const empty = document.createElement("div")
      empty.className = "empty-state compact-empty"
      empty.textContent = "No entries in this notebook yet."
      items.appendChild(empty)
    }
    section.appendChild(items)
  }

  return section
}

function renderEntries() {
  entryList.textContent = ""
  const entries = getFilteredEntries()

  if (!state.entries.length) {
    const empty = document.createElement("div")
    empty.className = "empty-state"
    empty.textContent = "No entries yet."
    entryList.appendChild(empty)
    return
  }

  if (activeNotebookId === "all") {
    const looseEntries = entries.filter(entry => !entry.notebookId)
    entryList.appendChild(createEntryGroup("loose", "Loose Entries", looseEntries, false))

    state.notebooks.slice().sort((a, b) => a.title.localeCompare(b.title)).forEach(notebook => {
      const grouped = entries.filter(entry => entry.notebookId === notebook.id)
      entryList.appendChild(createEntryGroup(notebook.id, notebook.title, grouped, notebook.collapsed))
    })
    return
  }

  if (!entries.length) {
    const empty = document.createElement("div")
    empty.className = "empty-state"
    empty.textContent = "No entries here yet."
    entryList.appendChild(empty)
    return
  }

  entries.forEach(entry => entryList.appendChild(createEntryCard(entry)))
}

function deleteHighlightById(id) {
  state.highlights = state.highlights.filter(h => h.id !== id)
  renderHighlightCollections()
  renderHighlights()
  queueSave()
  announce("Highlight deleted")
}

function renderHighlights() {
  highlightList.textContent = ""
  const highlights = getFilteredHighlights()

  if (!highlights.length) {
    const empty = document.createElement("div")
    empty.className = "empty-state"
    empty.textContent = "No imported highlights yet."
    highlightList.appendChild(empty)
    return
  }

  highlights.forEach(highlight => {
    const card = document.createElement("div")
    card.className = "highlight-card"

    const deleteBtn = document.createElement("button")
    deleteBtn.type = "button"
    deleteBtn.textContent = "×"
    deleteBtn.setAttribute("aria-label", "Delete highlight")
    deleteBtn.style.position = "absolute"
    deleteBtn.style.top = "10px"
    deleteBtn.style.right = "10px"
    deleteBtn.style.width = "34px"
    deleteBtn.style.height = "34px"
    deleteBtn.style.minWidth = "34px"
    deleteBtn.style.padding = "0"
    deleteBtn.style.display = "inline-flex"
    deleteBtn.style.alignItems = "center"
    deleteBtn.style.justifyContent = "center"
    deleteBtn.style.fontWeight = "800"
    deleteBtn.style.lineHeight = "1"

    deleteBtn.addEventListener("click", ev => {
      ev.stopPropagation()
      deleteHighlightById(highlight.id)
    })

    const swatch = document.createElement("div")
    swatch.className = "highlight-swatch"
    swatch.style.background = highlight.color || "yellow"

    const text = document.createElement("div")
    text.className = "highlight-card-text"
    text.textContent = highlight.text || ""

    const note = document.createElement("div")
    note.className = "highlight-card-note"
    note.textContent = highlight.note || ""

    const meta = document.createElement("div")
    meta.className = "highlight-card-meta"
    meta.textContent = new Date(highlight.timestamp).toLocaleString()

    const url = document.createElement("div")
    url.className = "highlight-card-url"
    url.textContent = highlight.url || ""

    const actions = document.createElement("div")
    actions.className = "highlight-actions"

    const insertBtn = document.createElement("button")
    insertBtn.type = "button"
    insertBtn.textContent = "Insert"

    const copyBtn = document.createElement("button")
    copyBtn.type = "button"
    copyBtn.textContent = "Copy"

    insertBtn.addEventListener("click", ev => {
      ev.stopPropagation()
      if (!selectedEntryId) {
        ensureEntrySelected()
      }
      insertHighlightCard(highlight)
      syncCurrentEntryFromEditor()
    })

    copyBtn.addEventListener("click", async ev => {
      ev.stopPropagation()
      const textToCopy = [highlight.text, highlight.note, highlight.url].filter(Boolean).join("\n\n")
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy)
        announce("Highlight copied")
      }
    })

    actions.appendChild(insertBtn)
    actions.appendChild(copyBtn)

    card.appendChild(deleteBtn)
    card.appendChild(swatch)
    card.appendChild(text)
    if (highlight.note) card.appendChild(note)
    const highlightTags = getHighlightTags(highlight)
    if (highlightTags.length) {
      const tags = document.createElement("div")
      tags.className = "highlight-card-meta"
      tags.textContent = highlightTags.map(tag => `#${tag}`).join(" ")
      card.appendChild(tags)
    }
    card.appendChild(meta)
    if (highlight.url) card.appendChild(url)
    card.appendChild(actions)

    card.addEventListener("dblclick", () => {
      if (!selectedEntryId) {
        ensureEntrySelected()
      }
      insertHighlightCard(highlight)
      syncCurrentEntryFromEditor()
    })

    highlightList.appendChild(card)
  })
}

function renderSelectedEntry() {
  const entry = getEntryById(selectedEntryId)

  if (!entry) {
    entryTitleInput.disabled = false
    editor.setAttribute("contenteditable", "true")
    entryTitleInput.value = ""
    editor.innerHTML = "<p><br></p>"
    setMarkdownPreviewVisible(false)
    entryDateLabel.textContent = "No entry selected"
    if (notebookSelect) notebookSelect.value = ""
    updateEditorPlaceholder()
    return
  }

  entryTitleInput.disabled = false
  editor.setAttribute("contenteditable", "true")
  entryTitleInput.value = entry.title || ""
  if (notebookSelect) notebookSelect.value = entry.notebookId || ""

  if (typeof markdownMode !== "undefined" && markdownMode) {
    editor.textContent = htmlToMarkdown(entry.content || "<p><br></p>")
    editor.classList.add("markdown-mode")
    setMarkdownPreviewVisible(true)
  } else {
    editor.innerHTML = sanitizeEditorHtml(entry.content || "<p><br></p>")
    editor.classList.remove("markdown-mode")
    setMarkdownPreviewVisible(false)
    applyInsertedHighlightColors(editor)
    applyInlineTagBoxes(editor)
  }

  entryDateLabel.textContent = `Created ${new Date(entry.createdAt).toLocaleString()} · Updated ${new Date(entry.updatedAt).toLocaleString()}`
  updateEditorPlaceholder()
}

// Render Logic
function renderAll() {
  renderNotebooks()
  renderNotebookSelect()
  renderEntries()
  renderHighlightCollections()
  renderHighlights()
  renderTags()
  renderSelectedEntry()
}

function ensureEntrySelected() {
  if (selectedEntryId && getEntryById(selectedEntryId)) return

  if (state.entries.length) {
    selectedEntryId = sortEntries(state.entries)[0].id
    renderAll()
    return
  }

  const entry = createEmptyEntry()
  state.entries.unshift(entry)
  selectedEntryId = entry.id
  renderAll()
  queueSave()
}

function selectEntry(id) {
  syncCurrentEntryFromEditor()
  selectedEntryId = id
  renderAll()
  focusEditorAtEnd()
}

// Focus Fields
function focusNewEntryFields() {
  if (!entryTitleInput || !editor) return

  requestAnimationFrame(() => {
    entryTitleInput.disabled = false
    editor.setAttribute("contenteditable", "true")
    editor.removeAttribute("aria-disabled")

    setTimeout(() => {
      try {
        entryTitleInput.focus()
        entryTitleInput.select()

        if (document.activeElement !== entryTitleInput) {
          editor.focus()
        }
      } catch (e) {}
    }, 20)
  })
  requestAnimationFrame(() => {
    entryTitleInput.focus()
    entryTitleInput.select()
    setTimeout(() => {
      if (document.activeElement !== entryTitleInput && document.activeElement !== editor) {
        entryTitleInput.focus()
        entryTitleInput.select()
      }
    }, 0)
  })
}

function createNewEntry() {
  syncCurrentEntryFromEditor()
  const entry = createEmptyEntry()
  state.entries.unshift(entry)
  selectedEntryId = entry.id
  renderAll()
  focusNewEntryFields()
  queueSave()
}

function duplicateSelectedEntry() {
  const entry = getEntryById(selectedEntryId)
  if (!entry) return
  syncCurrentEntryFromEditor()
  const duplicate = cloneEntry(entry)
  state.entries.unshift(duplicate)
  selectedEntryId = duplicate.id
  renderAll()
  queueSave()
}

function deleteSelectedEntry() {
  const entry = getEntryById(selectedEntryId)
  if (!entry) return

  const confirmed = window.confirm(`Delete "${entry.title || "Untitled entry"}"?`)
  if (!confirmed) return

  state.entries = state.entries.filter(item => item.id !== selectedEntryId)
  selectedEntryId = state.entries.length ? sortEntries(state.entries)[0].id : null
  renderAll()
  queueSave()
}

function syncCurrentEntryFromEditor() {
  if (isSyncingEditor) return
  const entry = getEntryById(selectedEntryId)
  if (!entry) return

  isSyncingEditor = true
  try {
    const nextTitle = entryTitleInput.value.trim() || "Untitled entry"
    const rawContent = (typeof markdownMode !== "undefined" && markdownMode) ? markdownToHtml(getMarkdownSource()) : editor.innerHTML
    const nextContent = sanitizeEditorHtml(rawContent)
    const inlineTags = extractTagsFromText(htmlToPlainText(nextContent))
    const changed = updateEntryIfChanged(entry, nextTitle, nextContent, inlineTags)

    if (!changed) {
      updateEditorPlaceholder()
      return
    }

    entryDateLabel.textContent = `Created ${new Date(entry.createdAt).toLocaleString()} · Updated ${new Date(entry.updatedAt).toLocaleString()}`
    updateEditorPlaceholder()
    queueSidePanelRender()
    queueSave()
  } finally {
    isSyncingEditor = false
  }
}

function placeCaretAtEnd(el) {
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  saveSelection()
}

function focusEditorAtEnd() {
  if (!editor.innerHTML.trim()) {
    editor.innerHTML = "<p><br></p>"
  }
  placeCaretAtEnd(editor)
  updateEditorPlaceholder()
}

function ensureEditorHasParagraph() {
  const text = editor.textContent.replace(/\u200B/g, "").trim()
  const blocks = editor.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, .video-embed-wrap, .hopper-highlight-card, img")

  if (!text && blocks.length === 0) {
    editor.innerHTML = "<p><br></p>"
    placeCaretAtEnd(editor)
  }
}

function saveSelection() {
  const selection = window.getSelection()
  if (!selection.rangeCount) return
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return
  selectionRange = range.cloneRange()
}

function restoreSelection() {
  const selection = window.getSelection()
  if (selectionRange && editor.contains(selectionRange.commonAncestorContainer)) {
    selection.removeAllRanges()
    selection.addRange(selectionRange)
    return
  }
  placeCaretAtEnd(editor)
}

function runCommand(command, value = null) {
  editor.focus()
  restoreSelection()
  document.execCommand(command, false, value)
  ensureEditorHasParagraph()
  syncCurrentEntryFromEditor()
}

function insertHtml(html) {
  editor.focus()
  restoreSelection()
  document.execCommand("insertHTML", false, html)
  ensureEditorHasParagraph()
  syncCurrentEntryFromEditor()
}


// Tag Styling
function getCaretOffset(root) {
  const selection = window.getSelection()
  if (!selection.rangeCount) return 0
  const range = selection.getRangeAt(0)
  const preRange = range.cloneRange()
  preRange.selectNodeContents(root)
  preRange.setEnd(range.endContainer, range.endOffset)
  return preRange.toString().length
}

function setCaretOffset(root, offset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = 0
  let node = walker.nextNode()

  while (node) {
    const next = current + node.nodeValue.length
    if (offset <= next) {
      const range = document.createRange()
      const selection = window.getSelection()
      range.setStart(node, Math.max(0, offset - current))
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      saveSelection()
      return
    }
    current = next
    node = walker.nextNode()
  }

  placeCaretAtEnd(root)
}

function shouldSkipTagNode(node) {
  const parent = node.parentElement
  if (!parent) return true
  return !!parent.closest(".inline-tag, .hopper-highlight-card, script, style")
}

function applyInlineTagBoxes(root) {
  if (!root || isTagStyling) return
  isTagStyling = true

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (shouldSkipTagNode(node)) return NodeFilter.FILTER_REJECT
      return /(^|[^A-Za-z0-9_#-])#[A-Za-z0-9_-]+/.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    }
  })

  const nodes = []
  let node = walker.nextNode()
  while (node) {
    nodes.push(node)
    node = walker.nextNode()
  }

  nodes.forEach(textNode => {
    const text = textNode.nodeValue || ""
    const frag = document.createDocumentFragment()
    let last = 0
    const regex = /(^|[^A-Za-z0-9_#-])(#[A-Za-z0-9_-]+)/g
    let match

    while ((match = regex.exec(text))) {
      const start = match.index + match[1].length
      if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)))
      const span = document.createElement("span")
      span.className = "inline-tag"
      span.textContent = match[2]
      span.setAttribute("data-tag", normalizeTag(match[2]))
      span.setAttribute("aria-label", `Tag ${normalizeTag(match[2])}`)
      span.setAttribute("title", `Tag ${normalizeTag(match[2])}`)
      span.setAttribute("spellcheck", "false")
      frag.appendChild(span)
      last = start + match[2].length
    }

    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
    textNode.parentNode.replaceChild(frag, textNode)
  })

  isTagStyling = false
}

function queueInlineTagStyle() {
  if (tagRenderTimer) clearTimeout(tagRenderTimer)
  tagRenderTimer = setTimeout(() => {
    tagRenderTimer = null
    if (!editor || (typeof markdownMode !== "undefined" && markdownMode)) return
    const offset = getCaretOffset(editor)
    applyInlineTagBoxes(editor)
    setCaretOffset(editor, offset)
    syncCurrentEntryFromEditor()
  }, 500)
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function getSafeHighlightColor(value) {
  const color = String(value || "").trim()
  if (!color) return "yellow"
  if (window.CSS && typeof window.CSS.supports === "function" && window.CSS.supports("color", color)) {
    return color
  }
  return "yellow"
}

function applyInsertedHighlightColors(root = editor) {
  if (!root || !root.querySelectorAll) return
  root.querySelectorAll(".hopper-highlight-card").forEach(card => {
    const color = getSafeHighlightColor(card.dataset.color || card.getAttribute("data-color") || "yellow")
    card.dataset.color = color
    card.style.setProperty("--highlight-color", color)
    const dot = card.querySelector(".hopper-highlight-dot")
    if (dot) dot.style.setProperty("background", color, "important")
  })
}

function escapeAttribute(value) {
  return escapeHtml(value)
}

function addTagsToSelectedEntry(tags) {
  const entry = getEntryById(selectedEntryId)
  if (!entry) return
  entry.tags = mergeTags(entry.tags, tags)
}

function openModal(title, bodyBuilder) {
  modalRoot.textContent = ""

  const backdrop = document.createElement("div")
  backdrop.className = "modal-backdrop"

  const card = document.createElement("div")
  card.className = "modal-card"

  const heading = document.createElement("h3")
  heading.textContent = title
  card.appendChild(heading)

  bodyBuilder(card, () => {
    backdrop.remove()
    focusEditorAtEnd()
  })

  backdrop.appendChild(card)
  modalRoot.appendChild(backdrop)

  backdrop.addEventListener("click", ev => {
    if (ev.target === backdrop) {
      backdrop.remove()
      focusEditorAtEnd()
    }
  })
}

function openVideoModal() {
  saveSelection()

  openModal("Embed Video", (card, close) => {
    const input = document.createElement("input")
    input.type = "text"
    input.placeholder = "Paste a YouTube or Vimeo URL"

    const actions = document.createElement("div")
    actions.className = "modal-actions"

    const cancelBtn = document.createElement("button")
    cancelBtn.type = "button"
    cancelBtn.textContent = "Cancel"

    const insertBtn = document.createElement("button")
    insertBtn.type = "button"
    insertBtn.textContent = "Insert"

    cancelBtn.addEventListener("click", close)

    insertBtn.addEventListener("click", () => {
      const embed = getVideoEmbedUrl(input.value.trim())
      if (!embed) {
        input.focus()
        return
      }

      insertHtml(`<div class="video-embed-wrap" contenteditable="false"><iframe src="${embed}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p><br></p>`)
      close()
    })

    actions.appendChild(cancelBtn)
    actions.appendChild(insertBtn)

    card.appendChild(input)
    card.appendChild(actions)

    input.focus()
  })
}

function insertImages(files) {
  if (!files || !files.length) return
  const readers = Array.from(files).map(file => {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.readAsDataURL(file)
    })
  })

  Promise.all(readers).then(images => {
    const html = images.filter(Boolean).map(src => `<img src="${src}" alt="">`).join("<p><br></p>")
    if (html) {
      insertHtml(`${html}<p><br></p>`)
    }
  })
}

function insertHighlightCard(highlight) {
  const color = getSafeHighlightColor(highlight.color || "yellow")
  const colorAttr = escapeHtml(color)
  const text = escapeHtml(highlight.text || "")
  const note = escapeHtml(highlight.note || "")
  const url = escapeHtml(highlight.url || "")
  const insertId = generateId()

  addTagsToSelectedEntry(getHighlightTags(highlight))

  const noteHtml = note ? `<div class="hopper-highlight-note">${note}</div>` : ""
  const urlHtml = url ? `<div class="hopper-highlight-url">${url}</div>` : ""

  insertHtml(
    `<div class="hopper-highlight-card" data-color="${colorAttr}" data-insert-id="${insertId}" style="--highlight-color: ${colorAttr};" contenteditable="false">
      <button class="hopper-highlight-remove" type="button" aria-label="Remove inserted highlight">×</button>
      <div class="hopper-highlight-top">
        <div class="hopper-highlight-dot"></div>
        <div class="hopper-highlight-title" contenteditable="true" spellcheck="true" tabindex="0">Imported Highlight</div>
      </div>
      <div class="hopper-highlight-text">${text}</div>
      ${noteHtml}
      ${urlHtml}
    </div><p><br></p>`
  )

  const insertedCard = editor.querySelector(`[data-insert-id="${insertId}"]`)
  if (insertedCard) {
    applyInsertedHighlightColors(insertedCard.parentElement || editor)
    insertedCard.removeAttribute("data-insert-id")
    syncCurrentEntryFromEditor()
  }
}

// Template Tools
const NOTE_TEMPLATES = [
  {
    name: "Daily Note",
    title: "Daily Note",
    html: () => {
      const today = new Date().toLocaleDateString()
      return `<h2>${escapeHtml(today)}</h2><p><strong>Focus:</strong> </p><ul><li><br></li></ul><p><strong>Notes:</strong></p><p><br></p><p><strong>Tomorrow:</strong></p><p><br></p>`
    }
  },
  {
    name: "Meeting Notes",
    title: "Meeting Notes",
    html: () => `<h2>Meeting Notes</h2><p><strong>Date:</strong> ${escapeHtml(new Date().toLocaleDateString())}</p><p><strong>Attendees:</strong> </p><p><strong>Agenda:</strong></p><ul><li><br></li></ul><p><strong>Notes:</strong></p><p><br></p><p><strong>Action Items:</strong></p><ul><li><input type="checkbox"> </li></ul>`
  },
  {
    name: "Project Note",
    title: "Project Note",
    html: () => `<h2>Project</h2><p><strong>Goal:</strong> </p><p><strong>Status:</strong> </p><p><strong>Links:</strong> [[Related Note]]</p><p><strong>Next Steps:</strong></p><ul><li><br></li></ul>`
  },
  {
    name: "Research Note",
    title: "Research Note",
    html: () => `<h2>Research Note</h2><p><strong>Question:</strong> </p><p><strong>Source:</strong> </p><p><strong>Key Points:</strong></p><ul><li><br></li></ul><p><strong>Connected Notes:</strong> [[Related Note]]</p>`
  },
  {
    name: "To-Do List",
    title: "To-Do List",
    html: () => `<h2>To-Do</h2><ul><li><input type="checkbox"> </li><li><input type="checkbox"> </li><li><input type="checkbox"> </li></ul><p><strong>Notes:</strong></p><p><br></p>`
  }
]

function applyTemplate(template, mode) {
  const entry = getEntryById(selectedEntryId)
  if (!entry || !template) return
  const html = typeof template.html === "function" ? template.html() : String(template.html || "")

  if (mode === "replace") {
    entry.content = sanitizeEditorHtml(html || "<p><br></p>")
    if (!entry.title || entry.title === "Untitled entry") entry.title = template.title || template.name || "Untitled entry"
    entry.updatedAt = Date.now()
    renderSelectedEntry()
  } else {
    insertHtml(html)
  }

  syncCurrentEntryFromEditor()
  queueSave()
  announce(`${template.name} template inserted`)
}

function openTemplateModal() {
  const entry = getEntryById(selectedEntryId)
  if (!entry) return
  saveSelection()

  openModal("Insert Template", (card, close) => {
    const list = document.createElement("div")
    list.className = "template-list"

    NOTE_TEMPLATES.forEach(template => {
      const row = document.createElement("button")
      row.type = "button"
      row.className = "template-choice"
      row.textContent = template.name
      row.addEventListener("click", () => {
        applyTemplate(template, "insert")
        close()
      })
      list.appendChild(row)
    })

    const actions = document.createElement("div")
    actions.className = "modal-actions"

    const replaceBtn = document.createElement("button")
    replaceBtn.type = "button"
    replaceBtn.textContent = "Replace With First"
    replaceBtn.setAttribute("aria-label", "Replace this entry with the first template")
    replaceBtn.addEventListener("click", () => {
      applyTemplate(NOTE_TEMPLATES[0], "replace")
      close()
    })

    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.textContent = "Close"
    closeBtn.addEventListener("click", close)

    actions.appendChild(replaceBtn)
    actions.appendChild(closeBtn)
    card.appendChild(list)
    card.appendChild(actions)
  })
}

function openHighlightPickerModal() {
  saveSelection()

  const items = getFilteredHighlights()

  openModal("Insert Highlight", (card, close) => {
    const list = document.createElement("div")
    list.style.maxHeight = "320px"
    list.style.overflow = "auto"

    if (!items.length) {
      const empty = document.createElement("div")
      empty.className = "empty-state"
      empty.textContent = "No highlights available."
      list.appendChild(empty)
    } else {
      items.slice(0, 60).forEach(item => {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.style.width = "100%"
        btn.style.marginBottom = "10px"
        btn.style.textAlign = "left"
        btn.style.padding = "10px"

        const meta = item.url ? `\n${item.url}` : ""
        btn.textContent = `${item.text || "(Untitled highlight)"}${meta}`

        btn.addEventListener("click", () => {
          insertHighlightCard(item)
          close()
        })

        list.appendChild(btn)
      })
    }

    const actions = document.createElement("div")
    actions.className = "modal-actions"

    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.textContent = "Close"
    closeBtn.addEventListener("click", close)

    actions.appendChild(closeBtn)

    card.appendChild(list)
    card.appendChild(actions)
  })
}

function insertBlock(tagName) {
  const selection = window.getSelection()
  if (!selection.rangeCount) return

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return

  const el = document.createElement(tagName)
  el.innerHTML = selection.toString() || "<br>"

  range.deleteContents()
  range.insertNode(el)
  range.setStartAfter(el)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)

  ensureEditorHasParagraph()
  syncCurrentEntryFromEditor()
}

function insertList() {
  runCommand("insertUnorderedList")
}

function clearFormatting() {
  runCommand("removeFormat")
  runCommand("unlink")
}

function handleToolbarClick(ev) {
  const btn = ev.target.closest("button")
  if (!btn) return

  const command = btn.getAttribute("data-command")
  const action = btn.getAttribute("data-action")

  saveSelection()

  if (command) {
    runCommand(command)
    return
  }

  if (action === "h2") {
    insertBlock("h2")
    return
  }

  if (action === "ul") {
    insertList()
    return
  }

  if (action === "quote") {
    insertBlock("blockquote")
  }
}

function parseCsvLine(line) {
  const result = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
      continue
    }

    current += char
  }

  result.push(current)
  return result
}

function parseCsv(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n").filter(Boolean)
  if (!lines.length) return []

  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase())

  return lines.slice(1).map(line => {
    const values = parseCsvLine(line)
    const row = {}
    headers.forEach((key, idx) => {
      row[key] = values[idx] || ""
    })
    return row
  })
}

function serializeCsv(rows) {
  const headers = ["text", "color", "note", "timestamp", "url"]

  const escapeCell = value => {
    const s = String(value == null ? "" : value)
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  return [
    headers.join(","),
    ...rows.map(row => headers.map(key => escapeCell(row[key] || "")).join(","))
  ].join("\n")
}

function importHighlightsFromCsvText(text) {
  const rows = parseCsv(text)
  const imported = rows.map(row => normalizeHighlight({
    text: row.text || row.highlight || row.quote || "",
    color: row.color || "yellow",
    note: row.note || row.notes || row.comment || "",
    timestamp: row.timestamp || Date.now(),
    url: row.url || row.source || row.link || ""
  }))

  state.highlights = dedupeHighlights(state.highlights.concat(imported))
  renderHighlightCollections()
  renderHighlights()
  renderTags()
  queueSave()
  announce("Highlights imported")
}

function exportHighlightsToCsv() {
  const rows = state.highlights.map(h => ({
    text: h.text || "",
    color: h.color || "",
    note: h.note || "",
    timestamp: h.timestamp || "",
    url: h.url || ""
  }))

  const csv = serializeCsv(rows)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = url
  a.download = "hopper-highlights.csv"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  announce("Highlights exported")
}

function handleImportCsv() {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".csv,text/csv"

  input.addEventListener("change", () => {
    const file = input.files && input.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      importHighlightsFromCsvText(String(reader.result || ""))
    }
    reader.readAsText(file)
  })

  input.click()
}

function parseImportedEntryHtml(htmlText, fileName) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(String(htmlText || ""), "text/html")

  const root = doc.querySelector("[data-hopper-export='entry']")
  const contentNode = root ? root.querySelector(".entry-content") : doc.querySelector(".entry-content")
  const titleNode = root ? root.querySelector(".entry-title") : doc.querySelector(".entry-title")
  const titleTag = doc.querySelector("title")

  let title = ""
  let content = ""
  let tags = []

  if (root && root.getAttribute("data-entry-tags")) {
    tags = root.getAttribute("data-entry-tags").split(",").map(normalizeTag).filter(Boolean)
  }

  if (titleNode) {
    title = (titleNode.textContent || "").trim()
  } else if (titleTag) {
    title = (titleTag.textContent || "").trim()
  } else {
    title = String(fileName || "").replace(/\.[^.]+$/, "").trim()
  }

  if (contentNode) {
    content = contentNode.innerHTML || ""
  } else if (doc.body) {
    const clonedBody = doc.body.cloneNode(true)
    clonedBody.querySelectorAll("script, style").forEach(node => node.remove())
    content = clonedBody.innerHTML || ""
  }

  return {
    title: title || "Imported entry",
    content: sanitizeEditorHtml(content || "<p><br></p>"),
    tags
  }
}

function importEntryFromHtmlText(htmlText, fileName) {
  const parsed = parseImportedEntryHtml(htmlText, fileName)
  const now = Date.now()

  syncCurrentEntryFromEditor()

  const entry = {
    id: generateId(),
    title: parsed.title,
    content: parsed.content,
    tags: parsed.tags || [],
    createdAt: now,
    updatedAt: now,
    notebookId: activeNotebookId && activeNotebookId !== "all" && activeNotebookId !== "loose" ? activeNotebookId : "",
    history: []
  }

  state.entries.unshift(entry)
  selectedEntryId = entry.id
  renderAll()
  queueSave()
  announce("Entry imported")
}

function handleImportEntry() {
  entryHtmlInput.value = ""
  entryHtmlInput.click()
}

function handleImportedEntryFile() {
  const file = entryHtmlInput.files && entryHtmlInput.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    importEntryFromHtmlText(String(reader.result || ""), file.name || "")
  }
  reader.readAsText(file)
}

// Export Helpers
function buildEntryExportPayload() {
  const entry = getEntryById(selectedEntryId)
  if (!entry) return null

  syncCurrentEntryFromEditor()

  const freshEntry = getEntryById(selectedEntryId)
  return {
    title: entryTitleInput.value.trim() || "Untitled entry",
    content: sanitizeEditorHtml(editor.innerHTML),
    tags: freshEntry && Array.isArray(freshEntry.tags) ? freshEntry.tags.slice() : [],
    exportedAt: new Date().toISOString()
  }
}

function buildPrintableEntryHtml(payload) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(payload.title)}</title>
<style>
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #111111;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.6;
}
body {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 28px;
}
.entry-title {
  font-size: 32px;
  font-weight: 800;
  margin: 0 0 10px 0;
}
.entry-meta {
  color: #555555;
  font-size: 12px;
  margin-bottom: 26px;
}
p { margin: 0 0 14px 0; }
h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 12px; }
blockquote {
  border-left: 4px solid #111111;
  padding-left: 12px;
  margin-left: 0;
  color: #333333;
}
ul, ol { padding-left: 24px; }
img, video, iframe { max-width: 100%; height: auto; }
.video-embed-wrap iframe { width: 100%; max-width: 800px; aspect-ratio: 16 / 9; border: 0; }
.hopper-highlight-card {
  border: 2px solid #111111;
  padding: 14px;
  margin: 18px 0;
  background: #ffffff;
}
.hopper-highlight-remove { display: none; }
.inline-tag {
  display: inline-block;
  border: 2px solid #111111;
  background: #d8ff8f;
  padding: 0 6px;
  font-weight: 800;
}
@page { margin: 0.55in; }
</style>
</head>
<body>
  <main data-hopper-export="entry" data-entry-tags="${payload.tags.join(",")}">
    <h1 class="entry-title">${escapeHtml(payload.title)}</h1>
    <div class="entry-meta">Exported ${new Date(payload.exportedAt).toLocaleString()}</div>
    <div class="entry-content">${payload.content}</div>
  </main>
</body>
</html>`
}

function downloadEntryHtml(payload) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(payload.title)}</title>
</head>
<body>
<div data-hopper-export="entry" data-entry-tags="${payload.tags.join(",")}">
<div class="entry-title">${escapeHtml(payload.title)}</div>
<div class="entry-content">${payload.content}</div>
</div>
</body>
</html>`

  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${payload.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim() || "journal-entry"}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function handleExportEntry() {
  const payload = buildEntryExportPayload()
  if (!payload) return

  if (window.api && typeof window.api.exportEntryHtml === "function") {
    window.api.exportEntryHtml(payload).then(result => {
      if (result && result.ok) {
        announce("Entry exported")
      }
    })
    return
  }

  downloadEntryHtml(payload)
  announce("Entry exported")
}

function handleExportPdf() {
  const payload = buildEntryExportPayload()
  if (!payload) return

  if (window.api && typeof window.api.exportEntryPdf === "function") {
    window.api.exportEntryPdf(payload).then(result => {
      if (result && result.ok) {
        announce("PDF exported")
      } else if (result && !result.canceled) {
        announce("PDF export failed")
      }
    })
    return
  }

  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    announce("Popup blocked")
    return
  }

  printWindow.document.write(buildPrintableEntryHtml(payload))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}


function removeInsertedHighlight(target) {
  const card = target.closest(".hopper-highlight-card")
  if (!card) return
  card.remove()
  ensureEditorHasParagraph()
  syncCurrentEntryFromEditor()
}

function handleEditorClick(ev) {
  const removeBtn = ev.target.closest(".hopper-highlight-remove")
  if (removeBtn) {
    ev.preventDefault()
    removeInsertedHighlight(removeBtn)
  }
}

function handleEditorDblClick(ev) {
  const title = ev.target.closest(".hopper-highlight-title")
  if (!title) return
  ev.preventDefault()
  title.focus()

  const range = document.createRange()
  range.selectNodeContents(title)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

function breakInlineTagAtCaret() {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return false

  let node = selection.anchorNode
  if (!node) return false

  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement
  }

  const tag = node && node.closest ? node.closest(".inline-tag") : null
  if (!tag || !editor.contains(tag)) return false

  const range = selection.getRangeAt(0)
  const breakNode = document.createElement("br")
  const after = document.createTextNode("\u200B")
  const parent = tag.parentNode

  if (!parent) return false

  if (range.startContainer === tag.firstChild && range.startOffset < (tag.textContent || "").length) {
    const text = tag.textContent || ""
    const beforeText = text.slice(0, range.startOffset)
    const afterText = text.slice(range.startOffset)

    tag.textContent = beforeText || text
    parent.insertBefore(breakNode, tag.nextSibling)
    parent.insertBefore(after, breakNode.nextSibling)

    if (afterText) {
      parent.insertBefore(document.createTextNode(afterText), after.nextSibling)
    }
  } else {
    parent.insertBefore(breakNode, tag.nextSibling)
    parent.insertBefore(after, breakNode.nextSibling)
  }

  const nextRange = document.createRange()
  nextRange.setStart(after, 1)
  nextRange.collapse(true)
  selection.removeAllRanges()
  selection.addRange(nextRange)

  syncCurrentEntryFromEditor()
  return true
}

function handleEditorKeydown(ev) {
  if (ev.key === "Enter" && breakInlineTagAtCaret()) {
    ev.preventDefault()
    return
  }

  const title = ev.target.closest(".hopper-highlight-title")
  if (!title) return

  if (ev.key === "Enter") {
    ev.preventDefault()
    title.blur()
    syncCurrentEntryFromEditor()
  }

  if (ev.key === "Escape") {
    ev.preventDefault()
    title.blur()
  }
}

function refreshInlineTagsFromEditor() {
  const entry = getEntryById(selectedEntryId)
  if (!entry) return false

  const inlineTags = extractTagsFromText(editor.innerText || htmlToPlainText(editor.innerHTML))
  const before = mergeTags([], entry.tags || []).join("|")
  const after = mergeTags([], inlineTags).join("|")

  if (before !== after) {
    entry.tags = inlineTags
    return true
  }
  return false
}

function handleEditorInput() {
  updateEditorPlaceholder()
  if (typeof markdownMode !== "undefined" && markdownMode) {
    if (markdownSession && markdownSession.entryId === selectedEntryId) {
      markdownSession.dirty = getMarkdownSource() !== markdownSession.markdownSnapshot
    }
    updateMarkdownPreview()
    return
  }
  const tagChanged = refreshInlineTagsFromEditor()
  syncCurrentEntryFromEditor()
  if (tagChanged) queueSidePanelRender()
  queueInlineTagStyle()
}

function loadInitialData() {
  const local = loadLocalState()

  if (canUseNativeApi()) {
    window.api.loadData().then(remote => {
      const normalizedRemote = normalizeLoadedData(remote || {})
      const remoteHasContent = normalizedRemote.entries.length || normalizedRemote.highlights.length || normalizedRemote.notebooks.length
      const localHasContent = local.entries.length || local.highlights.length || local.notebooks.length

      if (remoteHasContent) {
        state = normalizedRemote
        if (localHasContent) {
          const mergedHighlights = dedupeHighlights(normalizedRemote.highlights.concat(local.highlights))
          const mergedEntries = normalizedRemote.entries.length ? normalizedRemote.entries : local.entries
          const notebookMap = new Map()
          ;(local.notebooks || []).concat(normalizedRemote.notebooks || []).forEach(notebook => notebookMap.set(notebook.id, notebook))
          state = {
            entries: mergedEntries.map(normalizeEntry),
            highlights: mergedHighlights,
            notebooks: Array.from(notebookMap.values()).map(normalizeNotebook)
          }
        }
      } else {
        state = local
      }

      if (!state.entries.length) {
        const entry = createEmptyEntry()
        state.entries = [entry]
        selectedEntryId = entry.id
      } else {
        selectedEntryId = sortEntries(state.entries)[0].id
      }

      renderAll()
      persistStateNow()
    }).catch(() => {
      state = local
      if (!state.entries.length) {
        const entry = createEmptyEntry()
        state.entries = [entry]
        selectedEntryId = entry.id
      } else {
        selectedEntryId = sortEntries(state.entries)[0].id
      }
      renderAll()
    })

    return
  }

  state = local
  if (!state.entries.length) {
    const entry = createEmptyEntry()
    state.entries = [entry]
    selectedEntryId = entry.id
  } else {
    selectedEntryId = sortEntries(state.entries)[0].id
  }
  renderAll()
}

// Event Logic
newEntryBtn.addEventListener("click", createNewEntry)
if (newNotebookBtn) newNotebookBtn.addEventListener("click", createNewNotebook)
duplicateEntryBtn.addEventListener("click", duplicateSelectedEntry)
deleteEntryBtn.addEventListener("click", deleteSelectedEntry)

entrySearchInput.addEventListener("input", () => {
  entrySearchQuery = entrySearchInput.value || ""
  renderEntries()
})

highlightSearchInput.addEventListener("input", () => {
  highlightSearchQuery = highlightSearchInput.value || ""
  renderHighlights()
})

entryTitleInput.addEventListener("input", () => {
  syncCurrentEntryFromEditor()
})

if (notebookSelect) {
  notebookSelect.addEventListener("change", () => {
    updateSelectedNotebook(notebookSelect.value)
  })
}


// Toolbar Toggle
function setToolbarCollapsed(collapsed) {
  if (!toolbarPanel || !toolbarToggleBtn) return
  toolbarPanel.classList.toggle("toolbar-collapsed", collapsed)
  toolbarToggleBtn.textContent = collapsed ? "+" : "×"
  toolbarToggleBtn.setAttribute("aria-expanded", String(!collapsed))
  toolbarToggleBtn.setAttribute("aria-label", collapsed ? "Expand editor tools" : "Collapse editor tools")
}

function toggleToolbarPanel() {
  if (!toolbarPanel) return
  setToolbarCollapsed(!toolbarPanel.classList.contains("toolbar-collapsed"))
}

if (toolbar) toolbar.addEventListener("click", handleToolbarClick)
if (toolbarToggleBtn) toolbarToggleBtn.addEventListener("click", toggleToolbarPanel)

editor.addEventListener("mouseup", saveSelection)
editor.addEventListener("keyup", saveSelection)
editor.addEventListener("focus", saveSelection)
editor.addEventListener("click", handleEditorClick)
editor.addEventListener("dblclick", handleEditorDblClick)
editor.addEventListener("keydown", handleEditorKeydown)
editor.addEventListener("input", handleEditorInput)
editor.addEventListener("blur", () => {
  if (typeof markdownMode !== "undefined" && markdownMode) {
    if (markdownSession && markdownSession.entryId === selectedEntryId) {
      markdownSession.dirty = getMarkdownSource() !== markdownSession.markdownSnapshot
    }
    updateMarkdownPreview()
    return
  }
  applyInlineTagBoxes(editor)
  syncCurrentEntryFromEditor()
})

insertImageBtn.addEventListener("click", () => {
  saveSelection()
  imageInput.click()
})

imageInput.addEventListener("change", () => {
  if (imageInput.files && imageInput.files.length) {
    insertImages(imageInput.files)
  }
  imageInput.value = ""
})

insertVideoBtn.addEventListener("click", openVideoModal)
insertHighlightBtn.addEventListener("click", openHighlightPickerModal)
if (templateBtn) templateBtn.addEventListener("click", openTemplateModal)
clearFormatBtn.addEventListener("click", clearFormatting)
importCsvBtn.addEventListener("click", handleImportCsv)
exportCsvBtn.addEventListener("click", exportHighlightsToCsv)
importEntryBtn.addEventListener("click", handleImportEntry)
entryHtmlInput.addEventListener("change", handleImportedEntryFile)
exportEntryBtn.addEventListener("click", handleExportEntry)
if (exportPdfBtn) exportPdfBtn.addEventListener("click", handleExportPdf)

if (tagOverlayOpen) {
  tagOverlayOpen.addEventListener("click", openTagOverlay)
}

if (tagOverlayClose) {
  tagOverlayClose.addEventListener("click", closeTagOverlay)
}

if (tagOverlayBackdrop) {
  tagOverlayBackdrop.addEventListener("click", ev => {
    if (ev.target === tagOverlayBackdrop) {
      closeTagOverlay()
    }
  })
}

if (tagDeleteModeBtn) {
  tagDeleteModeBtn.addEventListener("click", () => {
    tagDeleteMode = !tagDeleteMode
    tagDeleteModeBtn.classList.toggle("active", tagDeleteMode)
    tagDeleteModeBtn.textContent = tagDeleteMode ? "Exit X Mode" : "X Mode"
    renderTags()
  })
}

document.addEventListener("keydown", ev => {
  const mod = ev.ctrlKey || ev.metaKey

  if (ev.key === "Escape" && tagOverlayBackdrop && !tagOverlayBackdrop.hidden) {
    closeTagOverlay()
  }

  if (mod && ev.key.toLowerCase() === "s") {
    ev.preventDefault()
    syncCurrentEntryFromEditor()
    persistStateNow()
  }

  if (mod && ev.key.toLowerCase() === "b") {
    ev.preventDefault()
    runCommand("bold")
  }

  if (mod && ev.key.toLowerCase() === "i") {
    ev.preventDefault()
    runCommand("italic")
  }

  if (mod && ev.shiftKey && ev.key.toLowerCase() === "n") {
    ev.preventDefault()
    createNewNotebook()
    return
  }

  if (mod && ev.key.toLowerCase() === "n") {
    ev.preventDefault()
    createNewEntry()
  }
})

window.addEventListener("beforeunload", () => {
  syncCurrentEntryFromEditor()
})

loadInitialData()

const exportStyle = document.createElement("style")
exportStyle.textContent = `
img, video, iframe {
  max-width: 100%;
  height: auto;
}
.video-embed-wrap {
  margin: 18px 0;
}
.video-embed-wrap iframe {
  width: 100%;
  max-width: 800px;
  aspect-ratio: 16 / 9;
  border: 0;
}
`
document.head.appendChild(exportStyle)



// Markdown Mode

// Text Helpers
function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function escapeAttribute(value) {
  return escapeHtml(String(value || "")).replace(/"/g, "&quot;")
}

function htmlToMarkdown(html) {
  const div = document.createElement("div")
  div.innerHTML = html || ""
  div.querySelectorAll("pre code").forEach(node => {
    const langMatch = String(node.className || "").match(/language-([a-z0-9_-]+)/i)
    const language = langMatch ? langMatch[1] : ""
    node.parentElement.replaceWith(document.createTextNode(`\n\n\`\`\`${language}\n${node.textContent || ""}\n\`\`\`\n\n`))
  })
  div.querySelectorAll("br").forEach(br => br.replaceWith("\n"))
  div.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(node => {
    const level = Math.min(Math.max(Number(node.tagName.slice(1)) || 2, 1), 6)
    node.replaceWith(document.createTextNode(`\n${"#".repeat(level)} ${node.textContent.trim()}\n`))
  })
  div.querySelectorAll("blockquote").forEach(node => {
    const quote = (node.textContent || "").split(/\r?\n/).map(line => `> ${line}`).join("\n")
    node.replaceWith(document.createTextNode(`\n${quote}\n`))
  })
  div.querySelectorAll("li").forEach(node => {
    const checked = node.querySelector('input[type="checkbox"]')
    const marker = checked ? `- [${checked.checked ? "x" : " "}] ` : "- "
    node.replaceWith(document.createTextNode(`\n${marker}${node.textContent.trim()}`))
  })
  div.querySelectorAll("p, div").forEach(node => {
    node.appendChild(document.createTextNode("\n"))
  })
  return (div.textContent || "").replace(/\n{3,}/g, "\n\n").trim()
}

// Markdown Source
function getMarkdownSource() {
  if (!editor) return ""
  const visualText = typeof editor.innerText === "string" ? editor.innerText : ""
  const fallbackText = typeof editor.textContent === "string" ? editor.textContent : ""
  return (visualText || fallbackText || "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trimEnd()
}

function renderInlineMarkdown(value) {
  let text = escapeHtml(value || "")
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>")
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>")
  text = text.replace(/~~([^~]+)~~/g, "<s>$1</s>")
  text = text.replace(/(^|\s)\*([^*]+)\*/g, "$1<em>$2</em>")
  text = text.replace(/(^|\s)_([^_]+)_/g, "$1<em>$2</em>")
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  return text
}

function renderMarkdownTable(rows) {
  const cleanRows = rows.map(row => row.trim()).filter(Boolean)
  if (cleanRows.length < 2) return cleanRows.map(row => `<p>${renderInlineMarkdown(row)}</p>`).join("\n")

  const dividerIndex = cleanRows.findIndex(row => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(row))
  if (dividerIndex < 1) return cleanRows.map(row => `<p>${renderInlineMarkdown(row)}</p>`).join("\n")

  const splitRow = row => row.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim())
  const header = splitRow(cleanRows[dividerIndex - 1])
  const body = cleanRows.slice(dividerIndex + 1).map(splitRow)
  let html = '<table class="md-table"><thead><tr>'
  header.forEach(cell => { html += `<th>${renderInlineMarkdown(cell)}</th>` })
  html += '</tr></thead><tbody>'
  body.forEach(row => {
    html += '<tr>'
    header.forEach((_, index) => { html += `<td>${renderInlineMarkdown(row[index] || "")}</td>` })
    html += '</tr>'
  })
  html += '</tbody></table>'
  return html
}

function flushMarkdownBlocks(buffer, htmlParts) {
  if (!buffer.paragraph.length) return
  htmlParts.push(`<p>${renderInlineMarkdown(buffer.paragraph.join(" "))}</p>`)
  buffer.paragraph = []
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\u00a0/g, " ").split(/\r?\n/)
  const htmlParts = []
  const buffer = { paragraph: [] }
  let listType = null
  let inBlockquote = false
  let quoteLines = []
  let inCode = false
  let codeLanguage = ""
  let codeLines = []
  let tableLines = []

  function closeList() {
    if (!listType) return
    htmlParts.push(listType === "ol" ? "</ol>" : "</ul>")
    listType = null
  }

  function openList(type, className = "") {
    if (listType === type) return
    closeList()
    htmlParts.push(type === "ol" ? "<ol>" : `<ul${className ? ` class="${className}"` : ""}>`)
    listType = type
  }

  function closeQuote() {
    if (!inBlockquote) return
    const raw = quoteLines.join("\n").trim()
    const calloutMatch = raw.match(/^\[!(NOTE|TIP|WARNING|IMPORTANT|QUESTION)\]\s*\n?([\s\S]*)$/i)
    if (calloutMatch) {
      htmlParts.push(`<aside class="md-callout"><strong>${escapeHtml(calloutMatch[1].toUpperCase())}</strong><div>${renderInlineMarkdown(calloutMatch[2].trim())}</div></aside>`)
    } else {
      htmlParts.push(`<blockquote>${renderInlineMarkdown(raw).replace(/\n/g, "<br>")}</blockquote>`)
    }
    inBlockquote = false
    quoteLines = []
  }

  function closeTable() {
    if (!tableLines.length) return
    htmlParts.push(renderMarkdownTable(tableLines))
    tableLines = []
  }

  function closeLooseBlocks() {
    flushMarkdownBlocks(buffer, htmlParts)
    closeQuote()
    closeTable()
    closeList()
  }

  lines.forEach(line => {
    const trimmed = line.trim()

    if (inCode) {
      if (/^```/.test(trimmed)) {
        htmlParts.push(`<pre class="md-code-block"><code class="language-${escapeAttribute(codeLanguage)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`)
        inCode = false
        codeLanguage = ""
        codeLines = []
      } else {
        codeLines.push(line)
      }
      return
    }

    const codeStart = trimmed.match(/^```\s*([a-z0-9_-]*)/i)
    if (codeStart) {
      closeLooseBlocks()
      inCode = true
      codeLanguage = codeStart[1] || ""
      codeLines = []
      return
    }

    if (!trimmed) {
      flushMarkdownBlocks(buffer, htmlParts)
      closeQuote()
      closeList()
      return
    }

    if (/^\|/.test(trimmed) && /\|$/.test(trimmed)) {
      flushMarkdownBlocks(buffer, htmlParts)
      closeQuote()
      closeList()
      tableLines.push(trimmed)
      return
    } else {
      closeTable()
    }

    if (/^---+$/.test(trimmed)) {
      closeLooseBlocks()
      htmlParts.push("<hr>")
      return
    }

    if (/^>\s?/.test(trimmed)) {
      flushMarkdownBlocks(buffer, htmlParts)
      closeList()
      inBlockquote = true
      quoteLines.push(trimmed.replace(/^>\s?/, ""))
      return
    } else {
      closeQuote()
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      closeLooseBlocks()
      const level = heading[1].length
      htmlParts.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      return
    }

    const task = trimmed.match(/^[-*+]\s+\[([ xX])\]\s+(.+)$/)
    if (task) {
      flushMarkdownBlocks(buffer, htmlParts)
      closeQuote()
      closeTable()
      openList("ul", "task-list")
      const checked = task[1].toLowerCase() === "x" ? " checked" : ""
      htmlParts.push(`<li><input type="checkbox" disabled${checked}> ${renderInlineMarkdown(task[2])}</li>`)
      return
    }

    const bullet = trimmed.match(/^[-*+]\s+(.+)$/)
    if (bullet) {
      flushMarkdownBlocks(buffer, htmlParts)
      closeQuote()
      closeTable()
      openList("ul")
      htmlParts.push(`<li>${renderInlineMarkdown(bullet[1])}</li>`)
      return
    }

    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (ordered) {
      flushMarkdownBlocks(buffer, htmlParts)
      closeQuote()
      closeTable()
      openList("ol")
      htmlParts.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`)
      return
    }

    closeList()
    buffer.paragraph.push(trimmed)
  })

  if (inCode) {
    htmlParts.push(`<pre class="md-code-block"><code class="language-${escapeAttribute(codeLanguage)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`)
  }
  closeLooseBlocks()
  return htmlParts.join("\n") || "<p><br></p>"
}

// Preview State
function updateMarkdownPreview() {
  if (!markdownPreview) return
  const source = getMarkdownSource()
  markdownPreview.innerHTML = sanitizeEditorHtml(markdownToHtml(source))
}

function setMarkdownPreviewVisible(visible) {
  if (editorWrap) editorWrap.classList.toggle("markdown-viewer-active", !!visible)
  if (markdownPreview) {
    markdownPreview.hidden = !visible
    markdownPreview.setAttribute("aria-hidden", String(!visible))
  }
  if (visible) updateMarkdownPreview()
}

function setMarkdownMode(nextMode) {
  const entry = getEntryById(selectedEntryId)
  const wantsMarkdown = !!nextMode

  if (wantsMarkdown === markdownMode) return

  if (entry && wantsMarkdown) {
    const htmlSnapshot = sanitizeEditorHtml(editor.innerHTML || entry.content || "<p><br></p>")
    markdownSession = {
      entryId: entry.id,
      htmlSnapshot,
      markdownSnapshot: htmlToMarkdown(htmlSnapshot),
      dirty: false
    }
    syncCurrentEntryFromEditor()
  } else if (entry && !wantsMarkdown) {
    const currentMarkdown = getMarkdownSource()
    if (markdownSession && markdownSession.entryId === entry.id && !markdownSession.dirty && currentMarkdown === markdownSession.markdownSnapshot) {
      entry.content = markdownSession.htmlSnapshot
      entry.updatedAt = Date.now()
      queueSave()
    } else {
      syncCurrentEntryFromEditor()
    }
    markdownSession = null
  } else {
    syncCurrentEntryFromEditor()
    markdownSession = null
  }

  markdownMode = wantsMarkdown
  if (markdownToggleBtn) {
    markdownToggleBtn.textContent = markdownMode ? "Rich Text" : "Markdown"
    markdownToggleBtn.title = markdownMode ? "Switch to rich text view" : "Switch to markdown view"
    markdownToggleBtn.setAttribute("aria-label", markdownMode ? "Switch to rich text view" : "Switch to markdown view")
    markdownToggleBtn.classList.toggle("active", markdownMode)
    markdownToggleBtn.setAttribute("aria-pressed", String(markdownMode))
  }
  renderSelectedEntry()
  focusEditorAtEnd()
}

if (markdownToggleBtn) {
  markdownToggleBtn.addEventListener("click", () => setMarkdownMode(!markdownMode))
}

// Version History
function snapshotEntry() {
  const entry = getEntryById(selectedEntryId)
  if (!entry) return
  entry.history = entry.history || []
  const current = sanitizeEditorHtml((typeof markdownMode !== "undefined" && markdownMode) ? markdownToHtml(getMarkdownSource()) : editor.innerHTML)
  if (entry.history[0] && entry.history[0].content === current && entry.history[0].title === entry.title) return
  entry.history.unshift({ ts: Date.now(), title: entry.title, content: current })
  entry.history = entry.history.slice(0, 20)
}

setInterval(() => {
  try {
    snapshotEntry()
    queueSave()
  } catch (e) {}
}, 60000)

if (historyBtn) {
  historyBtn.addEventListener("click", () => alert("Version snapshots are stored automatically every minute, up to 20 per entry."))
}

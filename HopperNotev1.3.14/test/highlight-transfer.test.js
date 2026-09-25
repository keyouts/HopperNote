const test = require("node:test")
const assert = require("node:assert/strict")
const transfer = require("../src/shared/highlight-transfer")

const now = Date.now()

test("imports Highlight Hopper CSV metadata", () => {
  const csv = [
    '"ID","URL","Page Title","Color","Color Name","Created At","Updated At","Text","Note"',
    `"hh-1","https://example.com/article#part","Example Article","#c8ff00","Lime","${now - 2000}","${now - 1000}","Same sentence","#research Note"`
  ].join("\r\n")
  const items = transfer.parseCsvHighlights(csv)
  assert.equal(items.length, 1)
  assert.equal(items[0].id, "hh-1")
  assert.equal(items[0].pageTitle, "Example Article")
  assert.equal(items[0].color, "#c8ff00")
  assert.equal(items[0].colorName, "Lime")
  assert.equal(items[0].createdAt, now - 2000)
  assert.equal(items[0].updatedAt, now - 1000)
  assert.equal(items[0].url, "https://example.com/article")
})

test("imports Highlight Hopper JSON backup metadata", () => {
  const backup = {
    format: "highlight-hopper-backup",
    version: 1,
    highlights: {
      "https://example.com/page": [{
        id: "hh-2",
        text: "Quoted text",
        color: "rgb(240, 200, 10)",
        createdAt: now - 5000,
        updatedAt: now - 3000,
        sourcePage: "https://example.com/page",
        pageTitle: "Page Title",
        ranges: [{ exact: "Quoted text", prefix: "before", suffix: "after", startOffset: 1, endOffset: 12 }],
        note: "A note"
      }]
    },
    pinnedHighlightIds: ["hh-2"],
    customColors: [{ color: "rgb(240, 200, 10)", name: "Gold" }]
  }
  const items = transfer.parseJsonHighlights(JSON.stringify(backup))
  assert.equal(items.length, 1)
  assert.equal(items[0].id, "hh-2")
  assert.equal(items[0].colorName, "Gold")
  assert.equal(items[0].pinned, true)
  assert.equal(items[0].ranges.length, 1)
  assert.equal(items[0].ranges[0].exact, "Quoted text")
})

test("round trips distinct IDs with identical text", () => {
  const source = [
    { id: "one", url: "https://example.com/", pageTitle: "Example", color: "pink", createdAt: now - 20, updatedAt: now - 10, text: "Duplicate", note: "First" },
    { id: "two", url: "https://example.com/", pageTitle: "Example", color: "pink", createdAt: now - 15, updatedAt: now - 5, text: "Duplicate", note: "Second" }
  ]
  const csv = transfer.serializeCsv(source)
  const parsed = transfer.parseCsvHighlights(csv)
  assert.deepEqual(parsed.map(item => item.id), ["one", "two"])
  assert.deepEqual(parsed.map(item => item.note), ["First", "Second"])
})

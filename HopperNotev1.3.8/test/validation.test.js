const test = require("node:test")
const assert = require("node:assert/strict")
const validation = require("../src/shared/validation")

function validState() {
  return {
    notebooks: [{ id: "notes", title: "Notes", createdAt: Date.now(), updatedAt: Date.now() }],
    entries: [{
      id: "entry-1",
      title: "Entry",
      content: "<p>Safe content</p>",
      tags: ["safe"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notebookId: "notes",
      history: []
    }],
    highlights: [{
      id: "highlight-1",
      text: "Text",
      color: "pink",
      note: "Note",
      tags: [],
      timestamp: Date.now(),
      url: "https://example.com/path#fragment"
    }]
  }
}

test("normalizes valid state", () => {
  const result = validation.normalizeState(validState())
  assert.equal(result.entries.length, 1)
  assert.equal(result.highlights[0].url, "https://example.com/path")
})

test("rejects active html", () => {
  const state = validState()
  state.entries[0].content = '<img src="x" onerror="alert(1)">'
  assert.throws(() => validation.normalizeState(state), /blocked attribute/)
})

test("rejects unsafe protocols", () => {
  assert.equal(validation.safeUrl("javascript:alert(1)"), "")
  assert.equal(validation.safeUrl("file:///etc/passwd"), "")
})

test("restricts colors", () => {
  assert.equal(validation.safeColor("pink"), "pink")
  assert.equal(validation.safeColor("url(https://example.com/a)"), "yellow")
})

test("restricts data images", () => {
  assert.match(validation.validateDataImage("data:image/png;base64,AAAA"), /^data:image\/png/)
  assert.equal(validation.validateDataImage("data:image/svg+xml;base64,AAAA"), "")
})


test("rejects oversized entry content", () => {
  const state = validState()
  state.entries[0].content = "x".repeat(validation.LIMITS.content + 1)
  assert.throws(() => validation.normalizeState(state), /allowed size/)
})

test("drops oversized history snapshots", () => {
  const state = validState()
  state.entries[0].history = [{ ts: Date.now(), title: "Large", content: "x".repeat(validation.LIMITS.historyContent + 1) }]
  assert.equal(validation.normalizeState(state).entries[0].history.length, 0)
})

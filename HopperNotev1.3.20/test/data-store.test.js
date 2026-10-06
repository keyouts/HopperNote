const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { DataStore } = require("../src/main/data-store")

function sampleState(title) {
  const now = Date.now()
  return {
    notebooks: [],
    highlights: [],
    entries: [{
      id: "entry-1",
      title,
      content: "<p>Content</p>",
      tags: [],
      createdAt: now,
      updatedAt: now,
      notebookId: "",
      history: []
    }]
  }
}

test("writes and reads atomically", async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "hopper-note-"))
  const filePath = path.join(directory, "journal-data.json")
  const store = new DataStore(filePath)

  await store.write(sampleState("First"))
  await store.write(sampleState("Second"))
  const result = await store.read()

  assert.equal(result.entries[0].title, "Second")
  assert.equal(JSON.parse(await fs.promises.readFile(`${filePath}.bak`, "utf8")).entries[0].title, "First")
  await fs.promises.rm(directory, { recursive: true, force: true })
})

test("recovers from backup", async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "hopper-note-"))
  const filePath = path.join(directory, "journal-data.json")
  const store = new DataStore(filePath)

  await store.write(sampleState("Backup"))
  await fs.promises.copyFile(filePath, `${filePath}.bak`)
  await fs.promises.writeFile(filePath, "{broken", "utf8")
  const result = await store.read()

  assert.equal(result.entries[0].title, "Backup")
  const names = await fs.promises.readdir(directory)
  assert.ok(names.some(name => name.includes(".corrupt-")))
  await fs.promises.rm(directory, { recursive: true, force: true })
})

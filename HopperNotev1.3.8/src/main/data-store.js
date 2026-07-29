const fs = require("fs")
const path = require("path")
const { normalizeState } = require("../shared/validation")

function defaultData() {
  return { entries: [], highlights: [], notebooks: [] }
}

function corruptPath(filePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  return `${filePath}.corrupt-${stamp}`
}

class DataStore {
  constructor(filePath) {
    this.filePath = filePath
    this.backupPath = `${filePath}.bak`
    this.writeChain = Promise.resolve()
  }

  async ensureDirectory() {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true })
  }

  async readFile(filePath) {
    const raw = await fs.promises.readFile(filePath, "utf8")
    return normalizeState(JSON.parse(raw))
  }

  async read() {
    await this.ensureDirectory()

    try {
      return await this.readFile(this.filePath)
    } catch (error) {
      if (error && error.code === "ENOENT") {
        const data = defaultData()
        await this.write(data)
        return data
      }

      try {
        await fs.promises.rename(this.filePath, corruptPath(this.filePath))
      } catch (renameError) {}

      try {
        const backup = await this.readFile(this.backupPath)
        await this.write(backup)
        return backup
      } catch (backupError) {
        const data = defaultData()
        await this.write(data)
        return data
      }
    }
  }

  async write(payload) {
    const data = normalizeState(payload)
    const serialized = `${JSON.stringify(data, null, 2)}\n`

    this.writeChain = this.writeChain.catch(() => {}).then(async () => {
      await this.ensureDirectory()
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
      const handle = await fs.promises.open(tempPath, "w", 0o600)

      try {
        await handle.writeFile(serialized, "utf8")
        await handle.sync()
      } finally {
        await handle.close()
      }

      try {
        await fs.promises.copyFile(this.filePath, this.backupPath)
      } catch (copyError) {}

      try {
        await fs.promises.rename(tempPath, this.filePath)
      } catch (renameError) {
        try {
          await fs.promises.unlink(tempPath)
        } catch (unlinkError) {}
        throw renameError
      }

      return { ok: true }
    })

    return this.writeChain
  }
}

module.exports = { DataStore, defaultData }

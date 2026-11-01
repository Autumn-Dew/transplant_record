const path = require('path')

function errorMessage(error) {
  return String(error && error.message ? error.message : error)
}

/**
 * JSON 文件持久化：
 * - 同一文件的写入严格串行，避免较早的慢写入覆盖较新的数据。
 * - 先写同目录临时文件，再 rename 到目标文件，避免留下半截 JSON。
 * - 所有操作返回结构化结果，调用方不得把失败伪装成成功。
 */
function createJsonPersistence({ fs, ensureDir, logger = console }) {
  const queues = new Map()
  let tempSequence = 0

  async function load(filePath, fallback) {
    await ensureDir()
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      return { ok: true, data: JSON.parse(raw), source: 'file' }
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return { ok: true, data: fallback, source: 'fallback', missing: true }
      }
      const message = errorMessage(error)
      logger.error?.('[boosting] 读取数据失败:', filePath, message)
      return { ok: false, data: fallback, source: 'fallback', error: message }
    }
  }

  function save(filePath, data) {
    const previous = queues.get(filePath) || Promise.resolve()
    const operation = previous.catch(() => {}).then(async () => {
      await ensureDir()
      const tempPath = path.join(
        path.dirname(filePath),
        `.${path.basename(filePath)}.${process.pid}.${++tempSequence}.tmp`,
      )

      try {
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8')
        await fs.rename(tempPath, filePath)
        return { ok: true }
      } catch (error) {
        try { await fs.unlink(tempPath) } catch { /* 临时文件可能尚未创建 */ }
        const message = errorMessage(error)
        logger.error?.('[boosting] 保存数据失败:', filePath, message)
        return { ok: false, error: message }
      }
    })

    queues.set(filePath, operation)
    operation.finally(() => {
      if (queues.get(filePath) === operation) queues.delete(filePath)
    })
    return operation
  }

  return { load, save }
}

module.exports = { createJsonPersistence }
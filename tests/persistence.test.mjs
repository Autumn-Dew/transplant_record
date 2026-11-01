import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { createJsonPersistence } = require('../electron/persistence.cjs')

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'tr-persistence-'))
  const realFs = await import('node:fs/promises')
  const store = createJsonPersistence({
    fs: realFs,
    ensureDir: () => realFs.mkdir(dir, { recursive: true }),
    logger: { error() {} },
  })
  return { dir, file: path.join(dir, 'records.json'), store }
}

test('JSON 持久化返回真实成功结果，并且不遗留临时文件', async t => {
  const { dir, file, store } = await fixture()
  t.after(() => rm(dir, { recursive: true, force: true }))

  assert.deepEqual(await store.save(file, [{ id: 1 }]), { ok: true })
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), [{ id: 1 }])
  assert.deepEqual((await readdir(dir)).filter(name => name.endsWith('.tmp')), [])
})

test('同一文件的连续写入按调用顺序落盘，最终一定是最新值', async t => {
  const { dir, file } = await fixture()
  t.after(() => rm(dir, { recursive: true, force: true }))

  const realFs = await import('node:fs/promises')
  let writes = 0
  const delayedFs = {
    ...realFs,
    async writeFile(...args) {
      writes += 1
      if (writes === 1) await new Promise(resolve => setTimeout(resolve, 30))
      return realFs.writeFile(...args)
    },
  }
  const store = createJsonPersistence({
    fs: delayedFs,
    ensureDir: () => realFs.mkdir(dir, { recursive: true }),
    logger: { error() {} },
  })

  const first = store.save(file, { version: 1 })
  const second = store.save(file, { version: 2 })
  assert.deepEqual(await Promise.all([first, second]), [{ ok: true }, { ok: true }])
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { version: 2 })
})

test('写入失败会返回 ok=false，不会伪装成保存成功', async () => {
  const store = createJsonPersistence({
    fs: {
      async writeFile() { throw new Error('disk full') },
      async rename() {},
      async unlink() {},
      async readFile() {},
    },
    ensureDir: async () => {},
    logger: { error() {} },
  })

  const result = await store.save('C:\\invalid\\records.json', [])
  assert.equal(result.ok, false)
  assert.match(result.error, /disk full/)
})

test('损坏的 JSON 与文件不存在可被区分', async t => {
  const { dir, file, store } = await fixture()
  t.after(() => rm(dir, { recursive: true, force: true }))

  const missing = await store.load(file, [])
  assert.deepEqual(missing, { ok: true, data: [], source: 'fallback', missing: true })

  const realFs = await import('node:fs/promises')
  await realFs.writeFile(file, '{broken', 'utf8')
  const corrupted = await store.load(file, [])
  assert.equal(corrupted.ok, false)
  assert.deepEqual(corrupted.data, [])
  assert.match(corrupted.error, /JSON/)
})
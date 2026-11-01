// ═══════════════════════════════════════════════════════════════════
// 数据补齐（hydrate）的契约
//
//   · 补齐只发生在 src/main.js → data/repos.js hydrateAll() 这一处；
//     页面不再各自 hydrate（以前谁忘了写谁就没有数据）。
//   · hydrate() 返回同一个 Promise：并发/重复调用共享同一次文件读取，
//     调用方可以 await 它来决定「数据就绪后的初值」。
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url))
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

function filesUnder(dir, ext, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) filesUnder(p, ext, out)
    else if (p.endsWith(ext)) out.push(p)
  }
  return out
}

// ── 浏览器 + Electron 替身：记录每个通道被读了几次 ──
const LS = new Map()
globalThis.localStorage = {
  getItem: k => (LS.has(k) ? LS.get(k) : null),
  setItem: (k, v) => { LS.set(k, String(v)) },
  removeItem: k => { LS.delete(k) },
  clear: () => LS.clear(),
  key: i => [...LS.keys()][i] ?? null,
  get length() { return LS.size },
}
const calls = { records: 0, completions: 0, games: 0, blueprints: 0 }
globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  electron: {
    loadRecords: async () => { calls.records++; return [{ id: 'p-file', account: '1', game: '终末地', service: '普托', status: 1 }] },
    saveRecords: async () => {},
    loadCompletions: async () => { calls.completions++; return [{ id: 'c-file', projectId: 'p-file', result: 'done' }] },
    saveCompletions: async () => {},
    loadGames: async () => { calls.games++; return [{ id: 'g-file', name: '来自文件' }] },
    saveGames: async () => {},
    loadBlueprints: async () => { calls.blueprints++; return [{ id: 'bp-file', code: 'X' }] },
    saveBlueprints: async () => {},
  },
}

const { projectsRepo, completionsRepo, gamesRepo, blueprintsRepo, hydrateAll } =
  await import('../src/data/repos.js')

test('数据补齐只有一个入口：页面 / 组件不再各自 hydrate', () => {
  const offenders = []
  for (const file of [...filesUnder(srcRoot, '.vue'), ...filesUnder(srcRoot, '.js')]) {
    const rel = path.relative(srcRoot, file)
    if (rel === path.join('data', 'repos.js')) continue   // 定义与聚合处
    if (/\.hydrate\(/.test(readFileSync(file, 'utf8'))) offenders.push(rel)
  }
  assert.deepEqual(offenders, [], `这些文件仍在自行 hydrate：${offenders.join(', ')}`)
})

test('main.js 在挂载之后调用 hydrateAll()', () => {
  const main = read('src/main.js')
  assert.match(main, /import \{ hydrateAll \} from "\.\/data\/repos\.js"/, '需要引入 hydrateAll')
  assert.match(main, /mount\("#app"\)[\s\S]{0,200}hydrateAll\(\)/, '应在 mount 之后补齐，避免阻塞首屏')
  assert.match(main, /runStartupMigration\(\)[\s\S]*mount/, '迁移仍要先于挂载执行')
})

test('并发调用共享同一次文件读取', async () => {
  LS.clear()
  // 两个调用同时发起：只应触发一次 loadRecords
  const [a, b] = await Promise.all([projectsRepo.hydrate(), projectsRepo.hydrate()])
  assert.equal(calls.records, 1, '并发 hydrate 只读一次文件')
  assert.equal(a, b, '重复调用返回同一个 Promise 的结果')
  assert.equal(projectsRepo.state.value[0]?.id, 'p-file', '文件数据已补齐到内存')
})

test('hydrateAll 覆盖四个仓库，且对已补齐的仓库不再重复读盘', async () => {
  await hydrateAll()
  assert.equal(calls.records, 1, '项目已在上一用例补齐，不重复读盘')
  assert.equal(calls.completions, 1)
  assert.equal(calls.games, 1)
  assert.equal(calls.blueprints, 1)
  assert.equal(completionsRepo.state.value[0]?.id, 'c-file')
  assert.equal(gamesRepo.state.value[0]?.id, 'g-file')
  assert.equal(blueprintsRepo.state.value[0]?.id, 'bp-file')

  // 再次调用仍然不读盘
  await hydrateAll()
  assert.equal(calls.records, 1)
  assert.equal(calls.completions, 1)
})

test('本地已有数据时不去读文件（不覆盖用户数据）', async () => {
  LS.clear()
  LS.set('tr-accounts', JSON.stringify([{ id: 'p-local' }]))
  // 用独立实例（?query 后缀）避开上一个用例已经缓存的 Promise
  const fresh = await import('../src/data/repos.js?local-first')
  const before = calls.records
  await fresh.projectsRepo.hydrate()
  assert.equal(calls.records, before, '本地有数据时 hydrate 直接返回')
  assert.equal(fresh.projectsRepo.state.value[0]?.id, 'p-local')
})

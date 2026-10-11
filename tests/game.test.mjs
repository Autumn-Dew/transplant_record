// 游戏与服务项目管理测试（真实 repo + service）
import test from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)) },
  removeItem: k => { store.delete(k) },
  clear: () => store.clear(),
  key: i => [...store.keys()][i],
  get length() { return store.size },
}
globalThis.window = { dispatchEvent: () => {}, addEventListener: () => {}, removeEventListener: () => {} }

const { gamesRepo, projectsRepo, completionsRepo } = await import('../src/data/repos.js')
const gsvc = await import('../src/services/gameService.js')
const psvc = await import('../src/services/projectService.js')
const { gameKeyOf, gameNameOf, usableGames, defaultGames } = await import('../src/domain/games.js')

function reset() {
  store.clear()
  projectsRepo.replaceAll([])
  completionsRepo.replaceAll([])
  gamesRepo.reload()
}

test('初始目录包含内置游戏，且可自由新增任意游戏', () => {
  reset()
  assert.equal(gamesRepo.state.value.length, defaultGames().length)
  const g = gsvc.addGame({ name: '鸣潮', short: 'WW' })
  assert.equal(g.id, '鸣潮')
  assert.equal(g.enabled, true)
  assert.equal(gamesRepo.state.value.length, defaultGames().length + 1)
  // 新增后立即可用于创建项目
  const p = psvc.createProject({ account: '1', game: '鸣潮', status: 1 })
  assert.equal(projectsRepo.find(p.id).gameKey, '鸣潮')
})

test('同名游戏 id 自动去重，改名不改变 id（价格表 key 稳定）', () => {
  reset()
  const a = gsvc.addGame({ name: '鸣潮' })
  const b = gsvc.addGame({ name: '鸣潮' })
  assert.notEqual(a.id, b.id)
  gsvc.updateGame(a.id, { name: '鸣潮2' })
  const cur = gamesRepo.state.value.find(x => x.id === a.id)
  assert.equal(cur.id, a.id)
  assert.equal(cur.name, '鸣潮2')
  assert.equal(gameKeyOf(gamesRepo.state.value, '鸣潮2'), a.id)
})

test('停用游戏：不出现在可用列表，但历史数据与项目不受影响', () => {
  reset()
  const p = psvc.createProject({ account: '1', game: 'ak', status: 1 })
  gsvc.toggleGame('ak')
  const ak = gamesRepo.state.value.find(g => g.id === 'ak')
  assert.equal(ak.enabled, false)
  assert.equal(usableGames(gamesRepo.state.value).some(g => g.id === 'ak'), false)
  assert.ok(projectsRepo.find(p.id), '停用游戏不得影响项目数据')
  assert.equal(gameNameOf(gamesRepo.state.value, 'ak'), '明日方舟', '停用后仍能解析名称')
})

test('有项目引用的游戏不允许物理删除，只能归档', () => {
  reset()
  const p = psvc.createProject({ account: '1', game: 'ak', status: 1 })
  const usage = gsvc.gameUsage('ak', '明日方舟')
  assert.equal(usage.count, 1)
  const r = gsvc.removeGame('ak')
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'in-use')
  assert.ok(gamesRepo.state.value.find(g => g.id === 'ak'))
  gsvc.archiveGame('ak')
  assert.equal(gamesRepo.state.value.find(g => g.id === 'ak').archived, true)
  assert.ok(projectsRepo.find(p.id), '归档游戏不得影响项目数据')
})

test('无引用的游戏可以删除', () => {
  reset()
  const g = gsvc.addGame({ name: '临时游戏' })
  assert.equal(gsvc.removeGame(g.id).ok, true)
  assert.equal(gamesRepo.state.value.some(x => x.id === g.id), false)
})

test('游戏排序：上下移动并重排 order', () => {
  reset()
  gsvc.addGame({ name: 'A' })
  gsvc.addGame({ name: 'B' })
  const ids = gamesRepo.state.value.map(g => g.id)
  assert.equal(ids[ids.length - 1], 'B')
  gsvc.moveGame('B', -1)
  const after = gamesRepo.state.value.map(g => g.id)
  assert.equal(after.indexOf('B'), ids.length - 2)
  assert.deepEqual(gamesRepo.state.value.map(g => g.order), gamesRepo.state.value.map((_, i) => i + 1))
})

test('服务项目：新增 / 修改 / 停用 / 排序 / 删除', () => {
  reset()
  const a = gsvc.addService('ak', { name: '服务A', price: 20, unit: '月' })
  const b = gsvc.addService('ak', { name: '服务B', price: 30 })
  let ak = gamesRepo.state.value.find(g => g.id === 'ak')
  assert.equal(ak.services.filter(s => s.id === a.id || s.id === b.id).length, 2)

  gsvc.updateService('ak', b.id, { name: '服务B2', price: 35, enabled: false })
  ak = gamesRepo.state.value.find(g => g.id === 'ak')
  const svcB = ak.services.find(s => s.id === b.id)
  assert.equal(svcB.name, '服务B2')
  assert.equal(svcB.price, 35)
  assert.equal(svcB.enabled, false)

  const idxBefore = ak.services.findIndex(s => s.id === b.id)
  gsvc.moveService('ak', b.id, -1)
  ak = gamesRepo.state.value.find(g => g.id === 'ak')
  assert.equal(ak.services.findIndex(s => s.id === b.id), idxBefore - 1)
  assert.deepEqual(ak.services.map(s => s.order), ak.services.map((_, i) => i + 1))

  gsvc.removeService('ak', a.id)
  ak = gamesRepo.state.value.find(g => g.id === 'ak')
  assert.equal(ak.services.some(s => s.id === a.id), false)
})

test('修改服务项目不改写已生成的执行记录快照', () => {
  reset()
  const p = psvc.createProject({ account: '1', game: 'ak', service: '普托', status: 2, plannedTimes: 3 })
  psvc.confirmExecution(p.id)
  gsvc.addService('ak', { name: '全托' })
  gsvc.updateGame('ak', { name: '明日方舟（新）' })
  assert.equal(completionsRepo.state.value[0].service, '普托')
  assert.equal(completionsRepo.state.value[0].gameName, '明日方舟')
  assert.ok(projectsRepo.find(p.id))
})

test('统计信息', () => {
  reset()
  const base = defaultGames().length
  gsvc.addGame({ name: 'X' })
  gsvc.archiveGame('nte')
  const s = gsvc.gameStats()
  assert.equal(s.total, base + 1)
  assert.equal(s.archived, 1)
  assert.ok(s.services > 0)
})

// 旧版本数据兼容与双通道一致性测试（第二轮）
//   使用「修改前真实数据结构」的样本，覆盖全部 tr-* 键与 Electron 文件通道
import test from 'node:test'
import assert from 'node:assert/strict'

// ── 浏览器 + Electron 双通道模拟 ──
const LS = new Map()
globalThis.localStorage = {
  getItem: k => (LS.has(k) ? LS.get(k) : null),
  setItem: (k, v) => { LS.set(k, String(v)) },
  removeItem: k => { LS.delete(k) },
  clear: () => LS.clear(),
  key: i => [...LS.keys()][i],
  get length() { return LS.size },
}
const FILES = new Map()
const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  electron: {
    loadRecords: async () => clone(FILES.get('records')) ?? [],
    saveRecords: async d => { FILES.set('records', clone(d)) },
    loadCompletions: async () => clone(FILES.get('completions')) ?? [],
    saveCompletions: async d => { FILES.set('completions', clone(d)) },
    loadGames: async () => clone(FILES.get('games')) ?? null,
    saveGames: async d => { FILES.set('games', clone(d)) },
    loadBlueprints: async () => clone(FILES.get('blueprints')) ?? [],
    saveBlueprints: async d => { FILES.set('blueprints', clone(d)) },
    loadPrices: async () => clone(FILES.get('prices')) ?? null,
    savePrices: async d => { FILES.set('prices', clone(d)) },
  },
}

// ── 修改前的真实数据样本（v1：无 schemaVersion / kind / state / host）──
const V1_ACCOUNTS = [
  {
    id: 'abc123', account: '13800138000', password: 'pw123', game: '终末地', service: '普托',
    status: 2, remainingDays: 22, lastConfirmDate: '2026-10-10',
    createdAt: '2026-09-15T04:00:00.000Z', note: '老板很好',
    wechatName: '老板A', qqName: '', bilibiliName: '', xiaohongshuName: '', douyinName: '',
    preferredPlatform: 'wechat', totalFee: 30, actualFee: 30, delayedFee: '',
    myOwnField: '别丢我',                      // ← 未知字段必须保留
  },
  { id: 'one001', account: '13900139000', game: '明日方舟', service: '主线推图', status: 1, remainingDays: 1, createdAt: '2026-10-01T12:00:00.000Z' },
  { id: 'ren001', account: '13800138000', game: '终末地', status: 2, locked: true, prevTaskId: 'abc123', createdAt: '2026-10-15T00:00:00.000Z', remainingDays: 31 },
  { id: 'done001', account: '13700137000', game: '终末地', status: 0, remainingDays: 0, createdAt: '2026-08-01T00:00:00.000Z' },
]
const V1_COMPLETIONS = [
  { id: 'c1', taskId: 'abc123', date: '2026-10-10', time: '21:00:00', game: '终末地', service: '普托', account: '13800138000', displayName: '老板A', fee: 30, totalFee: 30, actualFee: 30, status: 2, wasHosting: true, note: '今天打晚了', password: 'pw123', customTag: 'keep-me' },
]
const V1_OTHER = {
  'tr-report-roll': { abc123: { 龙门币: '1200' } },
  'tr-blueprints': [{ id: 'bp1', code: 'ABC-1', name: '蓝图A', land: '3x3', products: '铁', source: '主线', color: '#FF6D00', group: 'G1' }],
  'tr-blueprint-groups': ['G1', 'G2'],
  'tr-services': ['基建', '打boss', '我的自定义服务'],
  'tr-workdiary': [{ id: 'w1', text: '今天完成 3 单' }],
  'tr-shop-info': [{ id: 'c1', label: '代肝联系方式', value: 'QQ 123456', position: 'head' }],
  'tr-select-limit': 3,
  'tr-theme': 'light',
}

function seedV1() {
  LS.clear(); FILES.clear()
  LS.set('tr-accounts', JSON.stringify(V1_ACCOUNTS))
  LS.set('tr-completions', JSON.stringify(V1_COMPLETIONS))
  Object.entries(V1_OTHER).forEach(([k, v]) => LS.set(k, typeof v === 'string' ? v : JSON.stringify(v)))
}

seedV1()

const { runStartupMigration, rollback, hasBackup } = await import('../src/services/migration.js')
const first = runStartupMigration()

// ══════════ 迁移 ══════════

test('迁移执行成功，且未丢失任何键', () => {
  assert.deepEqual(first.errors, [])
  for (const k of Object.keys(V1_OTHER)) assert.ok(LS.has(k), `键 ${k} 被删除`)
  assert.ok(LS.has('tr-accounts'))
  assert.ok(LS.has('tr-completions'))
})

test('项目：旧字段全部保留（含未知字段），新字段有合理默认值', () => {
  const rows = JSON.parse(LS.get('tr-accounts'))
  const a = rows.find(r => r.id === 'abc123')
  // 原有字段逐一保留
  assert.equal(a.account, '13800138000')
  assert.equal(a.password, 'pw123')
  assert.equal(a.game, '终末地')
  assert.equal(a.service, '普托')
  assert.equal(a.status, 2)
  assert.equal(a.remainingDays, 22)
  assert.equal(a.lastConfirmDate, '2026-10-10')
  assert.equal(a.createdAt, '2026-09-15T04:00:00.000Z')
  assert.equal(a.note, '老板很好')
  assert.equal(a.totalFee, 30)
  assert.equal(a.myOwnField, '别丢我', '未知字段必须保留')
  // 新增字段
  assert.equal(a.schemaVersion, 3)
  assert.equal(a.kind, 'hosting')
  assert.equal(a.state, 'active')
  assert.equal(a.host.startDate, '2026-09-15')
  assert.equal(a.host.endDate, '2026-10-15')
  assert.ok(a.host.plannedTimes >= a.host.completedTimes)
  assert.equal(a.hostingChainId, 'abc123')
  assert.equal(a.paidAt, '2026-09-15')
})

test('项目：单次 / 已完成 / 待激活状态映射正确', () => {
  const rows = JSON.parse(LS.get('tr-accounts'))
  const one = rows.find(r => r.id === 'one001')
  assert.equal(one.kind, 'oneoff')
  assert.equal(one.state, 'pending')
  assert.equal(one.plannedDate, '2026-10-01')
  const done = rows.find(r => r.id === 'done001')
  assert.equal(done.state, 'completed')
  const ren = rows.find(r => r.id === 'ren001')
  assert.equal(ren.state, 'scheduled')
  assert.equal(ren.locked, true)
  assert.equal(ren.prevTaskId, 'abc123')
  assert.equal(ren.hostingChainId, 'abc123', '续费项目被并入原项目所在的连续托管关系')
})

test('执行记录：旧字段保留 + 未知字段保留 + 新字段补齐', () => {
  const rows = JSON.parse(LS.get('tr-completions'))
  const c = rows[0]
  assert.equal(c.id, 'c1')
  assert.equal(c.taskId, 'abc123')
  assert.equal(c.date, '2026-10-10')
  assert.equal(c.time, '21:00:00')
  assert.equal(c.fee, 30)
  assert.equal(c.password, 'pw123')
  assert.equal(c.customTag, 'keep-me', '未知字段必须保留')
  assert.equal(c.projectId, 'abc123')
  assert.equal(c.plannedDate, '2026-10-10')
  assert.equal(c.completedDate, '2026-10-10')
  assert.equal(c.result, 'done')
  assert.deepEqual(c.images, [])
  assert.equal(c.chainStart, undefined, '旧记录没有当时的链快照，不臆造')
})

test('其它数据键不被迁移改动', () => {
  assert.deepEqual(JSON.parse(LS.get('tr-report-roll')), V1_OTHER['tr-report-roll'])
  assert.deepEqual(JSON.parse(LS.get('tr-blueprints')), V1_OTHER['tr-blueprints'])
  assert.deepEqual(JSON.parse(LS.get('tr-blueprint-groups')), V1_OTHER['tr-blueprint-groups'])
  assert.deepEqual(JSON.parse(LS.get('tr-services')), V1_OTHER['tr-services'])
  assert.deepEqual(JSON.parse(LS.get('tr-workdiary')), V1_OTHER['tr-workdiary'])
  assert.deepEqual(JSON.parse(LS.get('tr-shop-info')), V1_OTHER['tr-shop-info'])
  assert.equal(LS.get('tr-select-limit'), '3', '与 useRowSelect 一致：裸字符串')
  assert.equal(LS.get('tr-theme'), 'light', '与 useGlobalTheme 一致：裸字符串')
})

test('迁移前自动备份，且可完整回滚到迁移前状态', () => {
  assert.equal(hasBackup('accounts'), true)
  assert.equal(hasBackup('completions'), true)
  const backup = JSON.parse(LS.get('tr-backup-accounts'))
  assert.equal(backup.___backup, true)
  assert.deepEqual(backup.records, V1_ACCOUNTS)
  assert.equal(rollback('accounts'), true)
  assert.deepEqual(JSON.parse(LS.get('tr-accounts')), V1_ACCOUNTS, '回滚必须与迁移前完全一致')
})

test('迁移失败可恢复：备份始终保留原始数据', () => {
  // 回滚后再次迁移，备份不会被覆盖成"已迁移"的数据
  runStartupMigration()
  assert.deepEqual(JSON.parse(LS.get('tr-backup-accounts')).records, V1_ACCOUNTS)
  assert.equal(JSON.parse(LS.get('tr-accounts'))[0].schemaVersion, 3)
})

// ══════════ 幂等 ══════════

test('多次迁移不重复创建数据、不修改结果（幂等）', () => {
  const before = JSON.parse(LS.get('tr-accounts'))
  const completionsBefore = JSON.parse(LS.get('tr-completions'))
  const r2 = runStartupMigration()
  const r3 = runStartupMigration()
  assert.equal(r2.projects, 0, '第二次不需要再迁移项目')
  assert.equal(r2.completions, 0)
  assert.equal(r3.projects, 0)
  const after = JSON.parse(LS.get('tr-accounts'))
  assert.equal(after.length, before.length)
  assert.deepEqual(after, before)
  assert.deepEqual(JSON.parse(LS.get('tr-completions')), completionsBefore)
})

test('迁移会写入数据版本号，重复启动仍保持同一版本', () => {
  assert.equal(JSON.parse(LS.get('tr-schema-version')), 2)
})

// ══════════ 双通道一致性 ══════════

const { projectsRepo, completionsRepo } = await import('../src/data/repos.js')

test('双通道：本地已有数据时，Electron 文件不会覆盖本地的新数据', async () => {
  // 本地：用户当前数据（3 条，模拟用户删掉了一条）
  const localNow = [{ id: 'local-only', account: '1', game: 'ak', status: 1, createdAt: '2026-11-01T00:00:00.000Z' }]
  LS.set('tr-accounts', JSON.stringify(localNow))
  // 文件：另一份"较旧"的数据
  FILES.set('records', [{ id: 'file-only', account: '2', game: 'ak', status: 1 }])
  projectsRepo.reload()
  await projectsRepo.hydrate()
  const ids = projectsRepo.state.value.map(p => p.id)
  assert.deepEqual(ids, ['local-only'], '本地数据优先，文件不得反向覆盖')
})

test('双通道：本地为空时，从 Electron 文件补齐并写回本地', async () => {
  LS.delete('tr-completions')
  FILES.set('completions', V1_COMPLETIONS)
  completionsRepo.reload()
  assert.equal(completionsRepo.state.value.length, 0, '本地确认为空')
  await completionsRepo.hydrate()
  assert.equal(completionsRepo.state.value.length, 1, '从文件补齐')
  assert.ok(LS.has('tr-completions'), '补齐后写回本地，两通道一致')
  assert.deepEqual(JSON.parse(LS.get('tr-completions'))[0].id, 'c1')
})

test('双通道：写入时两侧同时更新（不会只写一边）', () => {
  const before = completionsRepo.state.value.length
  completionsRepo.add({ id: 'newc1', projectId: 'abc123', taskId: 'abc123', date: '2026-11-02', result: 'done' })
  assert.equal(completionsRepo.state.value.length, before + 1)
  const local = JSON.parse(LS.get('tr-completions'))
  const file = FILES.get('completions')
  assert.ok(local.some(c => c.id === 'newc1'), 'localStorage 已更新')
  assert.ok(file.some(c => c.id === 'newc1'), 'Electron 文件已更新')
})

test('旧版价格表文件 + 本地为空：合并后仍保留未知游戏数据', async () => {
  LS.delete('tr-prices')
  FILES.set('prices', {
    __version: 1,
    endfield: { categories: [{ name: '托管', mode: 'preset', items: [{ key: 3, name: '普托', price: 88 }] }] },
    '鸣潮': { categories: [{ name: '日常', mode: 'preset', items: [{ key: 1, name: '清体力', price: 10 }] }] },
  })
  const { usePrices } = await import('../src/composables/usePrices.js')
  const { getGame } = usePrices()
  await new Promise(r => setTimeout(r, 0))
  assert.equal(getGame('endfield').categories.find(c => c.name === '托管').items.find(i => i.name === '普托').price, 88)
  assert.equal(getGame('鸣潮').categories[0].items[0].price, 10, '通过游戏管理新增的游戏价格数据保留')
})

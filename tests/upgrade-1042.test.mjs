// ═══════════════════════════════════════════════════════════════════
// 1.0.42 → 当前版本 的数据继承验证（不报错 / 不丢失 / 不改写历史）
//
// 数据来源：本仓库 git 提交 `9b27760`（v1.0.42 一站式代肝工具）的**真实写入逻辑**，
// 逐行复刻在下面的 legacy 区，不做任何「理想化」改写：
//   · src/utils/taskComplete.js  → appendCompletion / completeTaskById（执行记录的唯一写入点）
//   · src/views/AccountPage.vue  → addCompletion（精简形态的记录）
//   · src/views/AddPage.vue      → defaultTask / saveTask（项目字段 + 续费链 locked/prevTaskId）
//   · src/composables/useRowSelect.js / ReportSheet.vue / AdminPage.vue / WorkDiary.vue → 其它存储键
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'

// ── localStorage 模拟 ──
const LS = new Map()
globalThis.localStorage = {
  getItem: k => (LS.has(k) ? LS.get(k) : null),
  setItem: (k, v) => { LS.set(k, String(v)) },
  removeItem: k => { LS.delete(k) },
  clear: () => LS.clear(),
  key: i => [...LS.keys()][i],
  get object() { return Object.fromEntries(LS) },
  get length() { return LS.size },
}
// ── Electron 文件通道模拟（1.0.42 的四个文件）──
const FILES = new Map()
const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  electron: {
    saveRecords: d => FILES.set('boosting-records.json', clone(d)),
    saveBlueprints: d => FILES.set('blueprints.json', clone(d)),
    saveWorkDiary: d => FILES.set('workdiary.json', clone(d)),
    savePrices: d => FILES.set('prices.json', clone(d)),
  },
}
globalThis.CustomEvent = class { constructor(t) { this.type = t } }

const { monthSpanDays } = await import('../src/utils/date.js')
const { getDisplayName } = await import('../src/domain/mask.js')

// ═══════════════════════════════════════════════════════════════════
// legacy 1.0.42 写入逻辑（逐行复刻，见文件头的来源说明）
// ═══════════════════════════════════════════════════════════════════
const ACCOUNTS_KEY = 'tr-accounts'
const COMPLETIONS_KEY = 'tr-completions'

function localToday() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// 1.0.42 src/utils/taskComplete.js#appendCompletion
function legacyAppendCompletion(record, wasHosting) {
  const list = JSON.parse(localStorage.getItem(COMPLETIONS_KEY) || '[]')
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    taskId: record.id,
    date: localToday(),
    time: new Date().toTimeString().slice(0, 8),
    game: record.game,
    service: record.service || '',
    account: record.account,
    displayName: getDisplayName(record),
    wechatName: record.wechatName || '', qqName: record.qqName || '',
    bilibiliName: record.bilibiliName || '', xiaohongshuName: record.xiaohongshuName || '', douyinName: record.douyinName || '',
    preferredPlatform: record.preferredPlatform || 'wechat',
    fee: record.actualFee || record.totalFee || '',
    totalFee: record.totalFee || '', actualFee: record.actualFee || '', delayedFee: record.delayedFee || '',
    status: record.status || 1,
    wasHosting: !!wasHosting,
    note: record.note || '',
    password: record.password || '',
  })
  localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(list))
}

// 1.0.42 src/utils/taskComplete.js#completeTaskById
function legacyCompleteTaskById(taskId) {
  let list
  try { list = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') } catch { return { ok: false, reason: 'not-found' } }
  const item = list.find(r => String(r.id) === String(taskId))
  if (!item) return { ok: false, reason: 'not-found' }
  const wasHosting = item.status === 2
  const fallback = wasHosting ? monthSpanDays(item.createdAt) : 1
  const cur = (item.remainingDays != null && item.remainingDays !== '') ? Number(item.remainingDays) : fallback
  item.remainingDays = cur - 1
  item.lastConfirmDate = localToday()
  let completed = false
  if (item.remainingDays <= 0) {
    item.status = 0
    completed = true
    legacyAppendCompletion(item, wasHosting)
    list.forEach(r => { if (r.locked && r.prevTaskId === item.id) r.locked = false })
  }
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
  try { window.electron?.saveRecords?.(list) } catch { /* ignore */ }
  return { ok: true, completed }
}

// 1.0.42 src/views/AccountPage.vue#addCompletion（精简形态）
function legacyAddShortCompletion(record) {
  const list = JSON.parse(localStorage.getItem(COMPLETIONS_KEY) || '[]')
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    taskId: record.id,
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 8),
    game: record.game,
    service: record.service || '',
    account: record.account,
    password: record.password || '',
  })
  localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(list))
}

// 1.0.42 AddPage.saveTask 产物：项目字段 + id/createdAt/remainingDays（+ 续费链）
function legacyProject(form) {
  const id = 'legacy-' + Math.random().toString(36).slice(2, 8)
  const createdAt = form.createdAt || new Date().toISOString()
  const data = { ...form, id, createdAt }
  if (!data.remainingDays && data.remainingDays !== 0) {
    data.remainingDays = data.status === 2 ? monthSpanDays(createdAt) : 1
  }
  return data
}

// ═══════════════════════════════════════════════════════════════════
// 准备一份「1.0.42 用户」的完整数据
// ═══════════════════════════════════════════════════════════════════
const BASE = {
  wechatName: '', qqName: '', bilibiliName: '', xiaohongshuName: '', douyinName: '',
  preferredPlatform: 'wechat', totalFee: '', actualFee: '', delayedFee: '', note: '', password: '',
}

function seedLegacy1042() {
  LS.clear(); FILES.clear()

  // ① 单次未完成
  const oneOff = legacyProject({
    ...BASE, account: '13800138000', game: '明日方舟', service: '精托', status: 1,
    remainingDays: 1, totalFee: 30, actualFee: 25, note: '单次备注', password: 'pw1',
    wechatName: '老板A', customField: '单次自定义字段',
  })
  // ② 托管进行中：创建日 + 1 个月 = 30 天，已确认 10 次 → 剩 20 次
  const hosting = legacyProject({
    ...BASE, account: '13900139000', game: '终末地', service: '普托', status: 2,
    remainingDays: 20, totalFee: 100, actualFee: 100, delayedFee: 10,
    wechatName: '老板B', preferredPlatform: 'qq', qqName: '老板B的QQ',
    createdAt: '2026-09-10T02:00:00.000Z',
    lastConfirmDate: '2026-09-20', myOwnField: '自定义字段必须保留',
  })
  // ③ 托管只剩 1 次 → 确认一次即完成（1.0.42：完成时才写记录，wasHosting=true）
  const done = legacyProject({
    ...BASE, account: '13700137000', game: '明日方舟', service: '全托', status: 2,
    remainingDays: 1, totalFee: 150, actualFee: 150, wechatName: '老板C',
    createdAt: '2026-08-01T02:00:00.000Z',
  })
  // ④ 1.0.42 的续费项目：locked + prevTaskId（指向同账号进行中的托管）
  const renewal = legacyProject({
    ...BASE, account: '13900139000', game: '终末地', service: '普托', status: 2,
    remainingDays: 30, totalFee: 150, actualFee: 150, wechatName: '老板B', preferredPlatform: 'qq',
    createdAt: '2026-09-01T02:00:00.000Z', locked: true, prevTaskId: hosting.id,
  })
  const accounts = [oneOff, hosting, done, renewal]
  LS.set(ACCOUNTS_KEY, JSON.stringify(accounts))
  FILES.set('boosting-records.json', clone(accounts))

  // 执行记录：用 1.0.42 的真实写入函数生成
  legacyCompleteTaskById(oneOff.id)          // 单次确认 → 完成 → 记一条（完整形态，wasHosting=false）
  legacyCompleteTaskById(done.id)            // 托管的剩余次数为 0 → 确认即完成 → 记一条（完整形态，wasHosting=true）
  legacyAddShortCompletion(hosting)          // 精简形态（只减次数、不写记录的那种记录）

  // 其它存储键（1.0.42 真实键名）
  LS.set('tr-blueprints', JSON.stringify([
    { id: 'bp1', group: '谷地', code: 'EF-0021-A', name: '四号谷地滑索', land: '5x5', products: '滑索', source: '主线', color: '#FF6D00' },
    { id: 'bp2', group: '武陵', code: 'EF-0031-B', name: '武陵仓库', land: '4x4', products: '仓库', source: '支线', color: '', myTag: '蓝图自定义字段' },
  ]))
  LS.set('tr-blueprint-groups', JSON.stringify(['谷地', '武陵', '谷地', ' ']))
  LS.set('tr-prices', JSON.stringify({
    __version: 1,
    endfield: { categories: [{ name: '托管', mode: 'preset', items: [{ key: 3, name: '普托', price: 999, unit: '月', note: '用户改价' }] }] },
    ak: { categories: [{ name: '日常', mode: 'preset', items: [{ key: 1, name: '清体力', price: 10 }] }] },
  }))
  LS.set('tr-prices-version', '2')
  LS.set('tr-services', JSON.stringify(['基建', '打boss', '用户自定服务']))
  LS.set('tr-shop-info', JSON.stringify([{ id: 's1', name: '秋の露', contact: 'wx-1' }]))
  LS.set('tr-select-limit', '3')
  LS.set('tr-report-roll', JSON.stringify({ [hosting.id]: { 理智: '120' } }))
  LS.set('tr-theme', 'dark')
  LS.set('user-unrelated-key', 'not-ours')

  // 只返回 id（对象本身会被 1.0.42 的写入函数原地修改）
  return { oneOff: oneOff.id, hosting: hosting.id, done: done.id, renewal: renewal.id }
}

// ═══════════════════════════════════════════════════════════════════
// 升级：跑当前版本的启动迁移 + 各 Repository 读取
// ═══════════════════════════════════════════════════════════════════
const ID = seedLegacy1042()
// 1.0.42 的原始数据快照（在跑任何当前版本代码之前）
const legacyAccountsRaw = JSON.parse(localStorage.getItem('tr-accounts'))
const legacyCompletionsRaw = JSON.parse(localStorage.getItem('tr-completions'))
const before = clone(Object.fromEntries(LS))

const { runStartupMigration, rollback } = await import('../src/services/migration.js')
const report = runStartupMigration()
const { projectsRepo, completionsRepo, blueprintsRepo, blueprintGroupsRepo, gamesRepo } = await import('../src/data/repos.js')
const { isHosting, STATE, paymentsOf } = await import('../src/domain/project.js')

// ══════════ 迁移本身 ══════════
test('1.0.42 数据迁移：执行成功、无错误、不删除任何既有键', () => {
  assert.deepEqual(report.errors, [], '迁移不得报错')
  assert.ok(report.projects > 0, '确实迁移了项目')
  for (const k of ['tr-accounts', 'tr-completions', 'tr-blueprints', 'tr-blueprint-groups',
    'tr-prices', 'tr-prices-version', 'tr-services', 'tr-shop-info', 'tr-select-limit',
    'tr-report-roll', 'tr-theme', 'user-unrelated-key']) {
    assert.notEqual(localStorage.getItem(k), null, `键 ${k} 不得被删除`)
  }
  assert.equal(localStorage.getItem('user-unrelated-key'), 'not-ours', '非本应用的键不动')
})

test('迁移前后：项目 / 记录 / 蓝图的数量一条不少', () => {
  assert.equal(projectsRepo.state.value.length, legacyAccountsRaw.length, '项目一条不少')
  assert.equal(projectsRepo.state.value.length, 4)
  assert.equal(completionsRepo.state.value.length, legacyCompletionsRaw.length, '执行记录一条不少')
  assert.equal(completionsRepo.state.value.length, 3)
  assert.equal(blueprintsRepo.state.value.length, 2, '蓝图一条不少')
})

test('项目：1.0.42 的字段逐个保留（含未知字段），只做新增', () => {
  // 唯一的例外是 game：老数据存的是游戏名，迁移统一成游戏 id（展示名保留在 gameName）
  const NORMALIZED = new Set(['game'])
  for (const old of legacyAccountsRaw) {
    const now = projectsRepo.find(old.id)
    assert.ok(now, `项目 ${old.id} 必须存在`)
    for (const [k, v] of Object.entries(old)) {
      if (NORMALIZED.has(k)) continue
      assert.deepEqual(now[k], v, `字段 ${k} 被改写：${JSON.stringify(now[k])} ≠ ${JSON.stringify(v)}`)
    }
    // 只做新增，不删除任何旧字段
    assert.equal('kind' in now, true, '新增 kind')
    assert.equal('state' in now, true, '新增 state')
    if (isHosting(now)) assert.equal('paidAt' in now, true, '托管项目新增 paidAt（收入归月依据）')
  }

  // game 统一为**游戏名**（与 v1.0.42 老数据一致）；价格表仍按 gameKey / gameKeyOf 匹配
  const gameNames = new Set(gamesRepo.state.value.map(g => g.name))
  for (const old of legacyAccountsRaw) {
    const now = projectsRepo.find(old.id)
    if (gameNames.has(old.game)) assert.equal(now.game, old.game, '本来就是游戏名的保持不变')
    else assert.ok(gameNames.has(now.game), `game=${now.game} 应规范化为游戏名`)
  }
  const hostingNow = projectsRepo.find(ID.hosting)
  assert.equal(hostingNow.game, '终末地', 'id（endfield）→ 游戏名「终末地」')
  assert.equal(hostingNow.gameName, '终末地', '展示名一致')

  assert.equal(projectsRepo.find(ID.hosting).myOwnField, '自定义字段必须保留')
  assert.equal(projectsRepo.find(ID.oneOff).customField, '单次自定义字段')
})

test('托管周期：由 1.0.42 的 remainingDays + createdAt 正确推导（不丢剩余天数）', () => {
  const p = projectsRepo.find(ID.hosting)
  assert.equal(isHosting(p), true, 'status=2 → 托管')
  assert.equal(p.host.startDate, '2026-09-10', '开始日 = 创建日')
  assert.equal(p.host.endDate, '2026-10-09', '结束日 = 开始日 + 30 − 1（老数据 +1 个月多一天，已校正）')
  assert.equal(p.host.cycleDays, 30, '周期天数 = 1.0.42 的 monthSpanDays')
  assert.equal(p.host.plannedTimes, 30, '计划次数 = 周期天数')
  assert.equal(p.host.completedTimes, 10, '已完成 = 计划 − 剩余（20）')
  assert.equal(p.remainingDays, 20, '旧字段原样保留')
  assert.equal(p.lastConfirmDate, '2026-09-20', '上次确认日保留')

  const one = projectsRepo.find(ID.oneOff)
  assert.equal(isHosting(one), false, 'status=1 → 单次')
  assert.equal(one.state, STATE.COMPLETED, '1.0.42 确认后 status=0 → 已完成')
})

test('1.0.42 的续费链（locked + prevTaskId）被保留并补上链条 ID', () => {
  const r = projectsRepo.find(ID.renewal)
  assert.equal(r.locked, true, '待激活标记保留')
  assert.equal(r.prevTaskId, ID.hosting, '上一期关联保留')
  assert.equal(r.hostingChainId, ID.hosting, '迁移按 prevTaskId 追溯到链条根')
  assert.equal(r.state, STATE.SCHEDULED, 'locked → 待开始')
  assert.equal(projectsRepo.find(ID.hosting).hostingChainId, ID.hosting, '前一期自成一链')
})

test('执行记录：旧字段逐个保留，并补上 projectId/completedDate/result', () => {
  for (const old of legacyCompletionsRaw) {
    const now = completionsRepo.state.value.find(c => c.id === old.id)
    assert.ok(now, `记录 ${old.id} 必须存在`)
    for (const [k, v] of Object.entries(old)) {
      assert.deepEqual(now[k], v, `记录字段 ${k} 被改写：${JSON.stringify(now[k])} ≠ ${JSON.stringify(v)}`)
    }
    assert.equal(now.projectId, old.taskId, 'taskId 映射到 projectId')
    assert.ok(now.completedDate, '补上 completedDate')
    assert.equal(now.result, 'done', '默认 result=done')
  }
  // 1.0.42 的两种形态都在
  const full = completionsRepo.state.value.find(c => c.wasHosting === true)
  assert.ok(full, '存在 wasHosting=true 的完整形态')
  assert.equal(full.fee, 150, '收费快照保留')
  assert.equal(full.service, '全托')
  const short = completionsRepo.state.value.find(c => 'wasHosting' in c === false)
  assert.ok(short, '存在 AccountPage 的精简形态')
  assert.equal(short.service, '普托')
})

test('蓝图 / 分组 / 价格 / 其它键：内容原样保留', () => {
  assert.equal(blueprintsRepo.find('bp2').myTag, '蓝图自定义字段', '蓝图自定义字段保留')
  assert.deepEqual(blueprintGroupsRepo.state.value, ['谷地', '武陵', '谷地'], '分组仍按既有规则 trim + 去空')
  const prices = JSON.parse(localStorage.getItem('tr-prices'))
  assert.equal(prices.endfield.categories.find(c => c.name === '托管').items.find(i => i.name === '普托').price, 999, '用户改价保留')
  assert.equal(prices.ak.categories[0].items[0].price, 10)
  assert.equal(localStorage.getItem('tr-services'), before['tr-services'], '服务记忆不动')
  assert.equal(localStorage.getItem('tr-select-limit'), before['tr-select-limit'], '选择上限不动')
  assert.equal(localStorage.getItem('tr-report-roll'), before['tr-report-roll'], '变更回填不动')
  assert.equal(localStorage.getItem('tr-theme'), 'dark', '主题不动')
})

test('迁移幂等：第二次启动 changed = 0，数据逐字节不变', () => {
  const snapshot = JSON.stringify([...LS.entries()].sort())
  const again = runStartupMigration()
  assert.equal(again.projects, 0, '项目不再重复迁移')
  assert.equal(again.completions, 0, '记录不再重复迁移')
  assert.deepEqual(again.errors, [])
  assert.equal(JSON.stringify([...LS.entries()].sort()), snapshot, '数据逐字节不变')
})

test('升级后收费记录可用：老项目自动派生一条订单，金额与收费日不丢', () => {
  const p = projectsRepo.find(ID.hosting)
  const pays = paymentsOf(p)
  assert.equal(pays.length, 1, '老项目派生一条（只读，不写回）')
  assert.equal(pays[0].amount, 100, '金额 = 实际收费')
  assert.equal(pays[0].paidAt, '2026-09-10', '收费归属日 = 创建日')
  assert.equal('payments' in p, false, '读取不得给老记录写入新字段')
})

test('可完整回滚到 1.0.42 的原始数据', () => {
  assert.equal(rollback('accounts'), true)
  assert.equal(rollback('completions'), true)
  const accNow = JSON.parse(localStorage.getItem('tr-accounts'))
  assert.deepEqual(accNow, legacyAccountsRaw, '项目数据完整还原')
  const comNow = JSON.parse(localStorage.getItem('tr-completions'))
  assert.deepEqual(comNow, legacyCompletionsRaw, '执行记录完整还原')
})

// 连续托管模型测试（第二轮）：
//   周期独立 / 连续关系 / 剩余天数（按日历、断层不累计）/ 收入独立 / 记录归属
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

const { normalizeProject, STATE, KIND } = await import('../src/domain/project.js')
const {
  buildChainSummary, assignChainIds, resolveChainId, sumIncome, incomeByMonth, isAdjacent, periodOf,
} = await import('../src/domain/hosting-chain.js')
const { diffDays, addDays, todayLocal, addMonth, fmtDate } = await import('../src/utils/date.js')
const { projectsRepo, completionsRepo, gamesRepo } = await import('../src/data/repos.js')
const svc = await import('../src/services/projectService.js')

function reset() {
  store.clear()
  projectsRepo.replaceAll([])
  completionsRepo.replaceAll([])
  gamesRepo.reload()
}

// 构造一个托管周期（纯函数测试用）
function P(id, start, end, extra = {}) {
  const days = diffDays(start, end) + 1
  return normalizeProject({
    id,
    account: '13800138000',
    game: 'ak',
    gameName: '明日方舟',
    service: '普托',
    status: 2,
    kind: KIND.HOSTING,
    state: STATE.ACTIVE,
    totalFee: 100,
    paidAt: start,
    createdAt: `${start}T00:00:00`,
    host: {
      startDate: start, endDate: end, cycleDays: days,
      plannedTimes: days, completedTimes: 0,
      plan: { mode: 'daily', weekdays: [], timesPerDay: 1 },
    },
    ...extra,
  })
}

// ══════════ 天数计算（纯函数） ══════════

test('连续托管：旧周期剩 5 天 + 新周期一个月 = 按日历累计的连续剩余天数', () => {
  // 1 月 1 日 – 1 月 31 日（31 天），续费 2 月 1 日 – 2 月 28 日（28 天）
  const s = buildChainSummary([P('a1', '2026-01-01', '2026-01-31'), P('a2', '2026-02-01', '2026-02-28')], { today: '2026-01-27' })
  assert.equal(s.continuous, true)
  assert.equal(s.chainStart, '2026-01-01')
  assert.equal(s.chainEnd, '2026-02-28')
  assert.equal(s.totalDays, 31 + 28)
  // 旧周期剩 5 天（1/27–1/31，含今天）+ 新周期 28 天 = 33
  assert.equal(s.remainingDays, 5 + 28)
  assert.equal(s.dayIndex, 27)
  assert.equal(s.currentPeriodId, 'a1')
  assert.equal(s.periodCount, 2)
})

test('跨 31 天月份：3 月 31 天 + 4 月 30 天，剩余天数按实际周期计算', () => {
  const s = buildChainSummary([P('b1', '2026-03-01', '2026-03-31'), P('b2', '2026-04-01', '2026-04-30')], { today: '2026-03-27' })
  // 3/27–3/31 = 5 天，加 4 月 30 天 = 35
  assert.equal(s.remainingDays, 35)
  assert.equal(s.totalDays, 31 + 30)
})

test('闰年 2 月（29 天）与其它月份天数都按日历处理', () => {
  const leap = buildChainSummary([P('c1', '2028-02-01', '2028-02-29')], { today: '2028-02-01' })
  assert.equal(leap.totalDays, 29)
  // 周期天数与 totalDays 同一口径（含首尾）：2/01–2/29 = 29 天
  assert.equal(periodOf(P('c1', '2028-02-01', '2028-02-29')).cycleDays, 29)
  const feb28 = buildChainSummary([P('c2', '2026-02-01', '2026-02-28')], { today: '2026-02-28' })
  assert.equal(feb28.totalDays, 28)
  assert.equal(feb28.remainingDays, 1, '结束日当天还剩 1 天')
  assert.equal(buildChainSummary([P('c2', '2026-02-01', '2026-02-28')], { today: '2026-03-01' }).remainingDays, 0)
})

test('剩余天数与第几天在开始前 / 结束日 / 过期后都不出现 0/1 混乱', () => {
  const list = [P('d1', '2026-05-01', '2026-05-30')]
  assert.equal(buildChainSummary(list, { today: '2026-04-20' }).remainingDays, 30, '尚未开始 → 总天数')
  assert.equal(buildChainSummary(list, { today: '2026-04-20' }).dayIndex, 0)
  assert.equal(buildChainSummary(list, { today: '2026-05-01' }).remainingDays, 30)
  assert.equal(buildChainSummary(list, { today: '2026-05-01' }).dayIndex, 1)
  assert.equal(buildChainSummary(list, { today: '2026-05-30' }).remainingDays, 1, '结束日当天 = 1')
  assert.equal(buildChainSummary(list, { today: '2026-05-31' }).remainingDays, 0, '过期 = 0')
  assert.equal(buildChainSummary(list, { today: '2026-05-31' }).expired, true)
})

test('断层：不连续的周期不会被累计进剩余天数，并标记为非连续', () => {
  const p1 = P('e1', '2026-01-01', '2026-01-31')
  const p2 = P('e2', '2026-03-05', '2026-04-04')  // 中间空档
  const s = buildChainSummary([p1, p2], { today: '2026-01-20' })
  assert.equal(s.continuous, false)
  assert.equal(s.segmentCount, 2)
  assert.equal(s.chainEnd, '2026-01-31', '只累计第一个连续段')
  assert.equal(s.remainingDays, 12)
  assert.equal(isAdjacent('2026-01-31', '2026-02-01'), true)
  assert.equal(isAdjacent('2026-01-31', '2026-03-05'), false)
})

test('续费起点与上一期重叠（同一天）时，剩余天数取段内最大结束日，与项目排序无关', () => {
  // 两期起点同为 1/01：id 字典序靠前的一期反而结束更晚
  // （真实场景：当天创建又当天续费 / 补录旧周期，id 由时间戳+随机后缀生成，字典序不可预测）
  const overlapped = [
    P('zz', '2026-01-01', '2026-01-05'),   // 5 天的小周期
    P('aa', '2026-01-01', '2026-01-31'),   // 同起点、结束更晚
  ]
  for (const list of [overlapped, [...overlapped].reverse()]) {
    const s = buildChainSummary(list, { today: '2026-01-01' })
    assert.equal(s.chainStart, '2026-01-01')
    assert.equal(s.chainEnd, '2026-01-31', '必须取段内最大结束日，而不是排序后最后一条')
    assert.equal(s.continuous, true)
    assert.equal(s.segmentCount, 1)
    assert.equal(s.remainingDays, 31)
  }
})

test('三段连续续费：连续段跨度合并，收入仍按期独立', () => {
  const list = [
    P('f1', '2026-01-01', '2026-01-31', { totalFee: 100, paidAt: '2026-01-01' }),
    P('f2', '2026-02-01', '2026-02-28', { totalFee: 100, paidAt: '2026-02-01' }),
    P('f3', '2026-03-01', '2026-03-31', { totalFee: 120, paidAt: '2026-03-01' }),
  ]
  const s = buildChainSummary(list, { today: '2026-01-15' })
  assert.equal(s.continuous, true)
  assert.equal(s.periodCount, 3)
  assert.equal(s.chainStart, '2026-01-01')
  assert.equal(s.chainEnd, '2026-03-31')
  assert.equal(s.totalDays, 31 + 28 + 31)
  assert.equal(s.totalIncome, 320, '聚合展示仍保留每期独立收费')
  assert.deepEqual(s.incomeByPeriod.map(x => x.fee), [100, 100, 120])
  assert.equal(s.currentPeriodId, 'f1')
})

test('取消的周期不计入连续托管剩余时间', () => {
  const p1 = P('g1', '2026-01-01', '2026-01-31')
  const p2 = P('g2', '2026-02-01', '2026-02-28', { state: STATE.CANCELLED, cancelledAt: '2026-01-20T00:00:00Z' })
  const s = buildChainSummary([p1, p2], { today: '2026-01-20' })
  assert.equal(s.chainEnd, '2026-01-31')
  assert.equal(s.remainingDays, 12)
  assert.equal(s.currentPeriodId, 'g1')
})

test('按月收入：按收费归属日期统计，不按项目结束日期', () => {
  const list = [
    P('h1', '2026-01-01', '2026-01-31', { totalFee: 100, paidAt: '2026-01-05' }),
    P('h2', '2026-02-01', '2026-02-28', { totalFee: 100, paidAt: '2026-02-05' }),
  ]
  assert.equal(sumIncome(list, { month: '2026-01' }).total, 100)
  assert.equal(sumIncome(list, { month: '2026-02' }).total, 100)
  assert.equal(sumIncome(list).total, 200)
  const byMonth = incomeByMonth(list)
  assert.deepEqual(byMonth.map(x => [x.month, x.total]), [['2026-01', 100], ['2026-02', 100]])
})

// ══════════ 链条关系（纯函数） ══════════

test('按 prevTaskId 追溯链条根，补全 hostingChainId 且幂等', () => {
  const raw = [
    { id: 'r1', status: 2, game: 'ak' },
    { id: 'r2', status: 2, prevTaskId: 'r1', game: 'ak' },
    { id: 'r3', status: 2, prevTaskId: 'r2', game: 'ak' },
    { id: 'r4', status: 1, game: 'ak' },
  ]
  const first = assignChainIds(raw)
  assert.equal(first.changed, 3)
  assert.deepEqual(first.records.slice(0, 3).map(r => r.hostingChainId), ['r1', 'r1', 'r1'])
  assert.equal(first.records[3].hostingChainId, undefined, '单次项目不参与托管链条')
  const second = assignChainIds(first.records)
  assert.equal(second.changed, 0, '幂等：已补全不再改动')
  assert.equal(resolveChainId({ id: 'r3', prevTaskId: 'r2' }, raw), 'r1')
})

// ══════════ 业务服务（真实 repo + service） ══════════

const TODAY = todayLocal()

function makeHosting(overrides = {}) {
  return svc.createProject({
    account: '13800138000', game: 'ak', service: '普托', status: 2,
    plannedTimes: 5, hostStart: TODAY, hostEnd: addDays(TODAY, 29),
    totalFee: 100, wechatName: '老板A', preferredPlatform: 'wechat',
    ...overrides,
  })
}

test('续费创建独立项目，且自动加入同一条连续托管关系', () => {
  reset()
  const p1 = makeHosting()
  assert.equal(projectsRepo.find(p1.id).hostingChainId, p1.id)
  const r = svc.renewProject(p1.id, { totalFee: 100 })
  const p2 = r.project
  assert.notEqual(p2.id, p1.id)
  assert.equal(projectsRepo.find(p2.id).prevTaskId, p1.id)
  assert.equal(projectsRepo.find(p2.id).hostingChainId, p1.id, '续费属于同一连续托管关系')
  assert.equal(svc.chainPeriods(p1.id).length, 2)
  assert.equal(projectsRepo.find(p2.id).paidAt, TODAY)
})

test('续费后连续剩余天数 = 原周期剩余 + 新周期（按日历，含今天）', () => {
  reset()
  const p1 = makeHosting({ hostStart: TODAY, hostEnd: addDays(TODAY, 9) })   // 10 天周期
  const r = svc.renewProject(p1.id, {})                                     // 从 p1 结束日次日起一个月
  const summary = svc.chainSummaryOf(p1.id, TODAY)
  assert.equal(summary.continuous, true)
  assert.equal(summary.chainStart, TODAY)
  assert.equal(summary.chainEnd, projectsRepo.find(r.project.id).host.endDate)
  // 10 天（含今天）+ 新周期天数
  const newDays = diffDays(projectsRepo.find(r.project.id).host.startDate, projectsRepo.find(r.project.id).host.endDate) + 1
  assert.equal(summary.remainingDays, 10 + newDays)
  assert.equal(summary.periodCount, 2)
})

test('续费后修改旧项目不影响新项目（资料为独立快照）', () => {
  reset()
  const p1 = makeHosting({ service: '普托' })
  const r = svc.renewProject(p1.id, {})
  const p2 = r.project
  svc.updateProject(p1.id, { service: '全托', totalFee: 999, account: 'changed' })
  const after = projectsRepo.find(p2.id)
  assert.equal(after.service, '普托', '新项目保留创建时的服务快照')
  assert.equal(after.totalFee, 100)
  assert.equal(after.account, '13800138000')
  // 反向：改新项目不影响旧项目
  svc.updateProject(p2.id, { service: '精托' })
  assert.equal(projectsRepo.find(p1.id).service, '全托')
})

test('每个收费周期收入独立，聚合展示不合并', () => {
  reset()
  const p1 = makeHosting({ totalFee: 100, actualFee: 100 })
  const r = svc.renewProject(p1.id, { totalFee: 100 })
  svc.updateProject(r.project.id, { actualFee: 100 })
  const all = svc.revenueStats()
  assert.equal(all.total, 200, '两期累计')
  assert.equal(all.count, 2)
  assert.equal(svc.revenueStats({ month: TODAY.slice(0, 7) }).total, 200)
  const summary = svc.chainSummaryOf(p1.id, TODAY)
  assert.equal(summary.totalIncome, 200)
  assert.equal(summary.incomeByPeriod.length, 2)
})

test('每日执行记录明确归属各自周期，并保存当时的连续托管快照', () => {
  reset()
  const p1 = makeHosting({ plannedTimes: 30, hostStart: TODAY, hostEnd: addDays(TODAY, 29) })
  const rec1 = svc.confirmExecution(p1.id).record
  assert.equal(rec1.projectId, p1.id)
  assert.equal(rec1.hostingChainId, p1.id)
  assert.equal(rec1.periodStart, TODAY)
  assert.equal(rec1.periodEnd, addDays(TODAY, 29))
  assert.equal(rec1.chainStart, TODAY)
  assert.equal(rec1.chainEnd, addDays(TODAY, 29))
  assert.equal(rec1.chainDayIndex, 1)
  assert.equal(rec1.chainRemainingDays, 30)
})

test('历史记录不会被后续续费改写（返图时间快照保持）', () => {
  reset()
  const p1 = makeHosting({ plannedTimes: 30, hostStart: TODAY, hostEnd: addDays(TODAY, 29) })
  const rec1 = svc.confirmExecution(p1.id).record
  const chainEndBefore = rec1.chainEnd
  const remainingBefore = rec1.chainRemainingDays
  // 续费一个月：连续托管结束日被推后
  svc.renewProject(p1.id, {})
  const after = completionsRepo.state.value.find(c => c.id === rec1.id)
  assert.equal(after.chainEnd, chainEndBefore, '历史记录的托管结束日不得被续费改写')
  assert.equal(after.chainRemainingDays, remainingBefore)
  // 而当前的连续托管汇总已反映续费后的期限
  const summary = svc.chainSummaryOf(p1.id, TODAY)
  assert.notEqual(summary.chainEnd, chainEndBefore)
  assert.ok(summary.remainingDays > remainingBefore)
})

test('续费后执行第二期，记录归属于第二期周期', () => {
  reset()
  const p1 = makeHosting({ plannedTimes: 1, hostStart: TODAY, hostEnd: addDays(TODAY, 4) })
  svc.confirmExecution(p1.id)                              // 上一期用尽 → 已结束
  const r = svc.renewProject(p1.id, { startDate: TODAY })
  const p2 = r.project
  assert.equal(projectsRepo.find(p2.id).locked, false, '上一期已结束 → 新周期不再锁定')
  const rec = svc.confirmExecution(p2.id).record
  assert.equal(rec.projectId, p2.id)
  assert.equal(rec.hostingChainId, p1.id)
  assert.equal(rec.periodStart, TODAY)
  assert.equal(rec.periodEnd, projectsRepo.find(p2.id).host.endDate)
  const p2End = projectsRepo.find(p2.id).host.endDate
  assert.equal(rec.chainRemainingDays, diffDays(TODAY, p2End) + 1, '快照 = 当时的连续剩余天数（含今天）')
  assert.equal(rec.chainEnd, p2End)
})

test('列表聚合：同一客户的连续托管只显示一条，但底层周期保持独立', () => {
  reset()
  const p1 = makeHosting()
  svc.renewProject(p1.id, {})
  const chains = svc.hostingChains(TODAY)
  assert.equal(chains.length, 1, '聚合为一条连续托管')
  assert.equal(chains[0].summary.periodCount, 2)
  assert.equal(chains[0].periods.length, 2, '各周期 ID / 收费仍然独立可见')
  assert.equal(chains[0].account, '13800138000')
})

test('不同客户不会被聚合到同一条连续托管关系', () => {
  reset()
  const a = makeHosting({ account: 'A0001' })
  const b = makeHosting({ account: 'B0002' })
  assert.equal(svc.hostingChains(TODAY).length, 2)
  assert.notEqual(projectsRepo.find(a.id).hostingChainId, projectsRepo.find(b.id).hostingChainId)
})

test('链条上的历史执行记录可按周期查询', () => {
  reset()
  const p1 = makeHosting({ plannedTimes: 1 })
  svc.confirmExecution(p1.id)                       // 上一期完成
  const r = svc.renewProject(p1.id, { startDate: TODAY })
  svc.confirmExecution(r.project.id)
  const execs = svc.chainExecutions(p1.id)
  assert.equal(execs.length, 2)
  assert.deepEqual([...new Set(execs.map(e => e.projectId))].sort(), [p1.id, r.project.id].sort())
})

test('ensureChains 为旧数据补全链条并落盘', () => {
  reset()
  projectsRepo.replaceAll([
    { id: 'old1', account: 'a', game: 'ak', status: 2, createdAt: `${TODAY}T00:00:00`, remainingDays: 30 },
    { id: 'old2', account: 'a', game: 'ak', status: 2, prevTaskId: 'old1', createdAt: `${TODAY}T00:00:00`, remainingDays: 30 },
  ])
  const changed = svc.ensureChains()
  assert.ok(changed >= 2)
  const rows = JSON.parse(localStorage.getItem('tr-accounts'))
  assert.equal(rows.find(r => r.id === 'old2').hostingChainId, 'old1')
  assert.equal(svc.chainPeriods('old1').length, 2)
})

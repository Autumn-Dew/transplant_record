// 业务服务集成测试（真实 repo + service，用内存 localStorage 驱动）
//
// 覆盖：项目生命周期、托管每日限制与次数分离、执行记录独立性、
//       续费关联与到期推导、归档优于删除、游戏目录联动。
import test from 'node:test'
import assert from 'node:assert/strict'

// ── 最小浏览器环境（必须在导入业务模块之前装好）──
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

const { projectsRepo, completionsRepo, gamesRepo } = await import('../src/data/repos.js')
const svc = await import('../src/services/projectService.js')
const { RESULT } = await import('../src/domain/completion.js')
const { STATE, KIND, isArchived } = await import('../src/domain/project.js')
const { todayLocal, addDays, addMonth } = await import('../src/utils/date.js')

function reset() {
  store.clear()
  projectsRepo.replaceAll([])
  completionsRepo.replaceAll([])
  gamesRepo.reload()
}

const TODAY = todayLocal()

function makeHosting(overrides = {}) {
  return svc.createProject({
    account: '13800138000', game: 'endfield', service: '普托', status: 2,
    plannedTimes: 2, hostStart: TODAY, hostEnd: addDays(TODAY, 30),
    totalFee: 30, wechatName: '老板A', preferredPlatform: 'wechat',
    ...overrides,
  })
}

test('单次项目：创建 → 待执行 → 确认完成 → 生成独立执行记录', () => {
  reset()
  const p = svc.createProject({ account: '13900139000', game: 'ak', service: '主线推图', status: 1, totalFee: 15 })
  assert.equal(p.kind, KIND.ONE_OFF)
  assert.equal(p.state, STATE.PENDING)
  assert.equal(projectsRepo.find(p.id).gameKey, 'ak')
  assert.equal(svc.todayTasks().some(t => t.id === p.id), true)

  const r = svc.confirmExecution(p.id, { content: '推完 0-2 章' })
  assert.equal(r.ok, true)
  assert.equal(r.completed, true)
  assert.equal(projectsRepo.find(p.id).state, STATE.COMPLETED)
  assert.equal(completionsRepo.state.value.length, 1)

  const rec = completionsRepo.state.value[0]
  assert.equal(rec.projectId, p.id)
  assert.equal(rec.gameName, '明日方舟')
  assert.equal(rec.service, '主线推图')
  assert.equal(rec.totalFee, 15)
  assert.equal(rec.completedDate, TODAY)
  assert.equal(rec.content, '推完 0-2 章')
})

test('单次项目完成后不再出现在今日代办', () => {
  reset()
  const p = svc.createProject({ account: '1', game: 'ak', status: 1 })
  svc.confirmExecution(p.id)
  assert.equal(svc.todayTasks().some(t => t.id === p.id), false)
})

test('托管项目：每次执行都生成记录，且每天只能确认一次', () => {
  reset()
  const p = makeHosting()
  assert.equal(svc.todayTasks().some(t => t.id === p.id), true)

  const first = svc.confirmExecution(p.id)
  assert.equal(first.ok, true)
  assert.equal(first.completed, false)
  assert.equal(completionsRepo.state.value.length, 1)

  const second = svc.confirmExecution(p.id)
  assert.equal(second.ok, false)
  assert.equal(second.reason, 'confirmed-today')
  assert.equal(completionsRepo.state.value.length, 1, '重复确认不应生成第二条记录')
})

test('托管周期与执行次数完全分离：用尽计划次数后自动完成', () => {
  reset()
  const p = makeHosting({ plannedTimes: 2 })
  svc.confirmExecution(p.id, { force: true })
  let cur = projectsRepo.find(p.id)
  assert.equal(cur.host.plannedTimes, 2)
  assert.equal(cur.host.completedTimes, 1)
  assert.equal(cur.remainingDays, 1)
  assert.equal(cur.state, STATE.ACTIVE)

  const last = svc.confirmExecution(p.id, { force: true })
  assert.equal(last.completed, true)
  cur = projectsRepo.find(p.id)
  assert.equal(cur.state, STATE.COMPLETED)
  assert.equal(cur.remainingDays, 0)
  assert.equal(completionsRepo.state.value.length, 2, '每次执行都应留下一条独立记录')
})

test('跳过 / 异常不计入已完成次数，但同样留下记录', () => {
  reset()
  const p = makeHosting({ plannedTimes: 5 })
  const r = svc.confirmExecution(p.id, { result: RESULT.SKIPPED, note: '账号异常' })
  assert.equal(r.ok, true)
  const cur = projectsRepo.find(p.id)
  assert.equal(cur.host.completedTimes, 0)
  assert.equal(cur.host.skippedTimes, 1)
  assert.equal(completionsRepo.state.value[0].result, 'skipped')
})

test('暂停中的托管不生成今日代办，也不允许确认', () => {
  reset()
  const p = makeHosting()
  svc.pauseProject(p.id, '老板要求')
  assert.equal(projectsRepo.find(p.id).state, STATE.PAUSED)
  assert.equal(svc.todayTasks().some(t => t.id === p.id), false)
  assert.equal(svc.confirmExecution(p.id).reason, 'paused')
  svc.resumeProject(p.id)
  assert.equal(projectsRepo.find(p.id).state, STATE.ACTIVE)
  assert.equal(svc.todayTasks().some(t => t.id === p.id), true)
})

test('托管到期后不再生成今日代办（不改写存储状态）', () => {
  reset()
  const p = makeHosting({ hostStart: addDays(TODAY, -40), hostEnd: addDays(TODAY, -5) })
  assert.equal(projectsRepo.find(p.id).state, STATE.ACTIVE)
  assert.equal(svc.shouldRunToday(projectsRepo.find(p.id)), false)
  assert.equal(svc.todayTasks().some(t => t.id === p.id), false)
})

test('每周指定日期的执行计划：只在该星期几生成代办', () => {
  reset()
  const dow = new Date(`${TODAY}T00:00:00`).getDay()
  const hit = dow === 0 ? 7 : dow
  const miss = hit === 7 ? 1 : hit + 1
  const p = makeHosting({ planMode: 'weekly', planWeekdays: [hit], plannedTimes: 4 })
  assert.equal(svc.shouldRunToday(projectsRepo.find(p.id)), true)
  svc.updateProject(p.id, { host: { plan: { mode: 'weekly', weekdays: [miss], timesPerDay: 1 } } })
  assert.equal(svc.shouldRunToday(projectsRepo.find(p.id)), false)
})

test('续费：新项目独立 ID、关联原项目、起点为原项目结束日期、不继承进度', () => {
  reset()
  const prev = makeHosting({ plannedTimes: 1 })
  svc.confirmExecution(prev.id)                       // 用尽 → 完成
  const plan = svc.planRenewal(prev.id)
  // 新周期从原周期结束日的次日起算（不重叠）
  assert.equal(plan.startDate, addDays(projectsRepo.find(prev.id).host.endDate, 1))

  const r = svc.renewProject(prev.id, { totalFee: 35 })
  assert.equal(r.ok, true)
  const next = r.project
  assert.notEqual(next.id, prev.id)
  assert.equal(projectsRepo.find(next.id).prevTaskId, prev.id)
  assert.equal(next.account, prev.account)
  assert.equal(next.game, prev.game)
  assert.equal(next.service, prev.service)
  assert.equal(next.totalFee, 35)
  // 不继承进度
  assert.equal(projectsRepo.find(next.id).host.completedTimes, 0)
  assert.ok(projectsRepo.find(next.id).host.plannedTimes > 0)
  // 旧项目的历史记录仍完整
  assert.equal(completionsRepo.state.value.filter(c => c.projectId === prev.id).length, 1)
})

test('续费项目在上一期未完成时处于「待开始」且不可确认，完成后自动解锁', () => {
  reset()
  const prev = makeHosting({ plannedTimes: 2 })
  const r = svc.renewProject(prev.id, {})
  const next = r.project
  assert.equal(projectsRepo.find(next.id).state, STATE.SCHEDULED)
  assert.equal(projectsRepo.find(next.id).locked, true)
  assert.equal(svc.todayTasks().some(t => t.id === next.id), false)
  assert.equal(svc.confirmExecution(next.id).reason, 'not-started')

  svc.confirmExecution(prev.id, { force: true })
  svc.confirmExecution(prev.id, { force: true })      // 用尽 → 完成并解锁后继
  assert.equal(projectsRepo.find(next.id).locked, false)
  // 上一期结束后新周期即生效（是否「今天该做」由日期判定，不靠状态）
  assert.equal(projectsRepo.find(next.id).state, STATE.ACTIVE)
})

test('续费日期由用户显式给出时不会被静默覆盖', () => {
  reset()
  const prev = makeHosting({ plannedTimes: 2 })
  const custom = addDays(TODAY, 45)
  const r = svc.renewProject(prev.id, { startDate: custom })
  assert.equal(r.startDate, custom)
  assert.equal(projectsRepo.find(r.project.id).host.startDate, custom)
  assert.equal(projectsRepo.find(r.project.id).host.endDate, addMonth(custom))
})

test('有历史记录的项目不允许物理删除，只能归档', () => {
  reset()
  const p = makeHosting({ plannedTimes: 1 })
  assert.equal(svc.canHardDelete(p.id).ok, true)
  svc.confirmExecution(p.id)
  const check = svc.canHardDelete(p.id)
  assert.equal(check.ok, false)
  assert.equal(check.hasHistory, true)
  assert.equal(svc.hardDeleteProject(p.id).ok, false)
  assert.ok(projectsRepo.find(p.id), '项目必须保留')
  svc.archiveProject(p.id)
  assert.equal(isArchived(projectsRepo.find(p.id)), true)
  assert.equal(projectsRepo.find(p.id).state, STATE.COMPLETED, '归档不得覆盖已完成状态')
  assert.equal(completionsRepo.state.value.length, 1, '归档不得影响历史记录')
})

test('被续费引用的项目同样不允许物理删除', () => {
  reset()
  const prev = makeHosting({ plannedTimes: 1 })
  const next = svc.renewProject(prev.id, {}).project
  assert.equal(svc.canHardDelete(prev.id).hasSuccessor, true)
  assert.equal(svc.hardDeleteProject(prev.id).ok, false)
  assert.ok(projectsRepo.find(next.id))
})

test('修改项目不会改写已生成的执行记录（历史快照）', () => {
  reset()
  const p = makeHosting({ plannedTimes: 3, service: '普托', totalFee: 30 })
  svc.confirmExecution(p.id)
  const rec = completionsRepo.state.value[0]
  svc.updateProject(p.id, { service: '全托', totalFee: 150, game: 'ak' })
  const after = completionsRepo.state.value[0]
  assert.equal(after.service, '普托')
  assert.equal(after.totalFee, 30)
  assert.equal(after.gameName, '终末地')
  assert.equal(projectsRepo.find(p.id).service, '全托')
  assert.equal(projectsRepo.find(p.id).gameKey, 'ak', '项目改名不改写历史快照')
})

test('游戏目录：新增游戏后可直接用于创建项目，并解析价格表 key', () => {
  reset()
  const games = [...gamesRepo.state.value, { id: 'wuwa', name: '鸣潮', short: 'WW', order: 9, services: [{ id: 's1', name: '日常', price: 20 }] }]
  gamesRepo.replace(games)
  const p = svc.createProject({ account: '1', game: '鸣潮', status: 1 })
  assert.equal(projectsRepo.find(p.id).gameKey, 'wuwa')
  assert.equal(projectsRepo.find(p.id).gameName, '鸣潮')
})

test('统计信息区分待执行 / 托管中 / 已完成 / 已归档', () => {
  reset()
  const one = svc.createProject({ account: '1', game: 'ak', status: 1 })
  const host = makeHosting({ account: '2', plannedTimes: 1 })
  svc.confirmExecution(host.id)
  svc.archiveProject(host.id)
  const s = svc.projectStats()
  assert.equal(s.pending, 1)
  assert.equal(s.hosting, 0)
  assert.equal(s.completed, 1)
  assert.equal(s.archived, 1)
  assert.ok(projectsRepo.find(one.id))
})

// ── 今日代办：延期 / 取消 / 到期 ──

test('单次项目默认今天即到期待办', () => {
  reset()
  const p = svc.createProject({ account: '1', game: 'ak', status: 1 })
  assert.equal(projectsRepo.find(p.id).plannedDate, TODAY)
  assert.equal(svc.todayTasks().some(t => t.id === p.id), true)
})

test('延期单次代办：改计划日期后今天不再出现，且不产生执行记录', () => {
  reset()
  const p = svc.createProject({ account: '1', game: 'ak', status: 1 })
  const future = addDays(TODAY, 3)
  const r = svc.postponeTask(p.id, future, TODAY)
  assert.equal(r.ok, true)
  assert.equal(projectsRepo.find(p.id).plannedDate, future)
  assert.equal(svc.todayTasks().some(t => t.id === p.id), false)
  assert.equal(completionsRepo.state.value.length, 0)
  // 到了那一天重新出现
  assert.equal(svc.todayTasks(future).some(t => t.id === p.id), true)
})

test('延期托管代办：仅把该日标记为不执行，进度与记录都不变', () => {
  reset()
  const p = makeHosting({ plannedTimes: 5 })
  const r = svc.postponeTask(p.id, undefined, TODAY)
  assert.equal(r.ok, true)
  const cur = projectsRepo.find(p.id)
  assert.deepEqual(cur.host.skippedDates, [TODAY])
  assert.equal(cur.host.completedTimes, 0)
  assert.equal(cur.host.skippedTimes, 0)
  assert.equal(svc.shouldRunToday(cur, TODAY), false)
  assert.equal(svc.shouldRunToday(cur, addDays(TODAY, 1)), true, '明天应恢复生成代办')
  assert.equal(completionsRepo.state.value.length, 0, '延期不是执行事实')
})

test('取消代办后不再生成，且保留可追溯时间戳', () => {
  reset()
  const p = makeHosting({ plannedTimes: 5 })
  svc.cancelTask(p.id, '老板终止')
  const cur = projectsRepo.find(p.id)
  assert.equal(cur.state, STATE.CANCELLED)
  assert.ok(cur.cancelledAt)
  assert.equal(cur.cancelReason, '老板终止')
  assert.equal(svc.todayTasks().some(t => t.id === p.id), false)
  assert.equal(svc.confirmExecution(p.id).reason, 'closed')
})

test('todayTaskItems 提供今日代办所需的展示信息', () => {
  reset()
  makeHosting({ account: '2', plannedTimes: 4 })
  svc.createProject({ account: '1', game: 'ak', status: 1 })
  const items = svc.todayTaskItems()
  assert.equal(items.length, 2)
  const hostItem = items.find(i => i.hosting)
  assert.equal(hostItem.progress.planned, 4)
  assert.equal(hostItem.progress.completed, 0)
  const oneItem = items.find(i => !i.hosting)
  assert.equal(oneItem.progress, null)
})

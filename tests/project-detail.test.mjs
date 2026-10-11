// 项目详情窗口测试
//   · 数据组装（概览 / 本期托管 / 连续托管链 / 执行记录 / 财务 / 续费建议）
//   · 可用操作矩阵（不隐藏原版任何操作，只按状态给出必要限制）
//   · 历史隔离：查看详情不写存储；编辑当期不影响其它期
//   · 结构约束：分区齐全、操作按钮齐全、原版字段未丢、支持 reduced-motion
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const { projectsRepo, completionsRepo, gamesRepo } = await import('../src/data/repos.js')
const svc = await import('../src/services/projectService.js')
const { buildProjectDetail, availableActions, periodFee } = await import('../src/services/projectDetail.js')
const { addDays, todayLocal, diffDays } = await import('../src/utils/date.js')
const { KIND, STATE } = await import('../src/domain/project.js')

const TODAY = todayLocal()

function reset() {
  store.clear()
  projectsRepo.replaceAll([])
  completionsRepo.replaceAll([])
  gamesRepo.reload()
}

function makeHosting(extra = {}) {
  const p = svc.createProject({
    account: '13800138000',
    wechatName: '老板A',
    gameName: '终末地',
    service: '普托',
    kind: KIND.HOSTING,
    status: 2,
    totalFee: 100,
    actualFee: 100,
    host: {
      startDate: TODAY,
      endDate: addDays(TODAY, 29),
      plan: { mode: 'daily', weekdays: [], timesPerDay: 1 },
      plannedTimes: 30,
    },
    ...extra,
  })
  return p
}

function makeOneOff(extra = {}) {
  return svc.createProject({
    account: '13900139000', gameName: '明日方舟', service: '精托',
    kind: KIND.ONE_OFF, status: 1, totalFee: 30, plannedDate: TODAY, ...extra,
  })
}

// ══════════ 可用操作矩阵 ══════════

test('托管进行中：可暂停 / 延期 / 续费 / 归档 / 提前结束，但不可「恢复」', () => {
  reset()
  const p = makeHosting()
  const a = availableActions(p.id)
  assert.equal(a.edit, true)
  assert.equal(a.pause, true)
  assert.equal(a.resume, false)
  assert.equal(a.extend, true)
  assert.equal(a.renew, true)
  assert.equal(a.cancel, true)
  assert.equal(a.archive, true)
  assert.equal(a.restore, false)
  assert.equal(a.remove, true, '尚无历史记录 → 允许物理删除')
})

test('暂停中：可恢复，不能再暂停', () => {
  reset()
  const p = makeHosting()
  svc.pauseProject(p.id)
  const a = availableActions(p.id)
  assert.equal(a.pause, false)
  assert.equal(a.resume, true)
  assert.equal(a.extend, true, '暂停期间仍可延期')
})

test('已归档：可取消归档，不再显示归档；归档不改变原业务状态', () => {
  reset()
  const p = makeHosting()
  svc.archiveProject(p.id)
  const a = availableActions(p.id)
  assert.equal(a.archive, false)
  assert.equal(a.restore, true)
  assert.equal(a.pause, false, '已归档项目不再提供暂停')
  assert.equal(projectsRepo.find(p.id).state, STATE.ACTIVE, '归档只是标记，业务状态不变')
})

test('已完成 / 已取消：不可再提前结束；已完成仍可续费与归档', () => {
  reset()
  // 已完成：单次项目确认即完成
  const one = makeOneOff()
  svc.confirmExecution(one.id)
  assert.equal(projectsRepo.find(one.id).state, STATE.COMPLETED)
  const ao = availableActions(one.id)
  assert.equal(ao.cancel, false, '已完成的项目不能再「提前结束」')
  assert.equal(ao.archive, true)
  assert.equal(ao.renew, false, '单次项目不提供续费')

  // 托管「已完成」：走真实路径（计划次数改为 1 → 确认一次即用尽 → 自动完成）
  const p = makeHosting()
  svc.updateProject(p.id, { host: { ...projectsRepo.find(p.id).host, plannedTimes: 1 } })
  svc.confirmExecution(p.id)
  assert.equal(projectsRepo.find(p.id).state, STATE.COMPLETED, '次数用尽 → 自动完成')
  const a = availableActions(p.id)
  assert.equal(a.cancel, false, '已完成的项目不能再「提前结束」')
  assert.equal(a.renew, true, '已完成是续费的主要场景')
  assert.equal(a.archive, true)
  assert.equal(a.extend, false, '已结束的周期不再延期')
  assert.equal(a.remove, false, '已产生执行记录 → 只能归档')

  // 已取消
  const q = makeHosting()
  svc.cancelProject(q.id)
  assert.equal(availableActions(q.id).cancel, false)
  assert.equal(availableActions(q.id).extend, false)
})

test('有执行记录或被续费引用的项目不可物理删除', () => {
  reset()
  const p = makeHosting()
  svc.confirmExecution(p.id)
  assert.equal(availableActions(p.id).remove, false, '有执行记录 → 只能归档')

  const q = makeHosting({ account: '13700137000' })
  svc.renewProject(q.id, {})           // 产生后继项目
  assert.equal(availableActions(q.id).remove, false, '被续费引用 → 不可物理删除')
})

test('单次项目：没有托管操作，但仍可编辑 / 提前结束 / 归档', () => {
  reset()
  const one = makeOneOff()
  const a = availableActions(one.id)
  assert.equal(a.pause, false)
  assert.equal(a.resume, false)
  assert.equal(a.extend, false)
  assert.equal(a.renew, false)
  assert.equal(a.cancel, true)
  assert.equal(a.archive, true)
})

// ══════════ 数据组装 ══════════

test('详情数据含全部分区：概览 / 本期托管 / 连续托管链 / 执行记录 / 财务 / 续费建议', () => {
  reset()
  const p = makeHosting()
  const d = buildProjectDetail(p.id)
  assert.equal(d.project.id, p.id)
  assert.ok(d.displayName)
  assert.equal(d.hosting, true)
  assert.equal(d.host.startDate, TODAY)
  assert.ok(d.host.endDate >= d.host.startDate, '结束日不早于开始日')
  assert.equal(d.host.totalDays, diffDays(d.host.startDate, d.host.endDate), '总天数 = 起止之差')
  assert.ok(d.host.planned >= 1)
  assert.ok(d.chain, '托管项目应有连续托管链数据')
  assert.equal(d.chain.periodCount, 1)
  assert.deepEqual(d.executions, [])
  assert.equal(d.finance.periodFee, 100)
  assert.equal(d.finance.paidAt, TODAY)
  assert.equal(d.finance.chainTotal, 100)
  assert.equal(d.renewPlan.startDate, addDays(d.host.endDate, 1), '续费建议起点 = 原周期结束日次日')
  assert.equal(d.renewPlan.prevEndDate, d.host.endDate)
})

test('单次项目：无托管链，仍能组装详情', () => {
  reset()
  const one = makeOneOff()
  const d = buildProjectDetail(one.id)
  assert.equal(d.hosting, false)
  assert.equal(d.host, null)
  assert.equal(d.chain, null)
  assert.equal(d.renewPlan, null)
  assert.equal(d.finance.periodFee, 30)
  assert.equal(buildProjectDetail('不存在的项目'), null)
})

test('连续托管：各期仍独立 —— 期数、逐期收入、每期起止都逐条保留', () => {
  reset()
  const p1 = makeHosting({ totalFee: 100, actualFee: 100 })
  const r = svc.renewProject(p1.id, {})
  const p2 = r.project
  const d2 = buildProjectDetail(p2.id)
  assert.equal(d2.chain.periodCount, 2)
  assert.equal(d2.chain.periods.length, 2)
  const fees = d2.chain.incomeByPeriod.map(x => x.fee)
  assert.deepEqual(fees, [100, 100], '逐期收入独立保留，聚合不合并')
  assert.equal(d2.chain.totalIncome, 200)
  // 第二期是「本期」
  const idx = d2.chain.periods.findIndex(x => x.projectId === String(p2.id))
  assert.equal(idx, 1)
  // 第一期资料与收入未因续费被改写
  const p1After = projectsRepo.find(p1.id)
  assert.equal(p1After.totalFee, 100)
  assert.equal(p1After.service, projectsRepo.find(p2.id).service)
})

test('执行记录：本项目记录归属正确，并按周期分组供「各期展开」', () => {
  reset()
  const p1 = makeHosting({ host: { startDate: addDays(TODAY, -3), endDate: addDays(TODAY, 1), plannedTimes: 2, plan: { mode: 'daily', weekdays: [], timesPerDay: 1 } } })
  svc.confirmExecution(p1.id)
  const d = buildProjectDetail(p1.id)
  assert.equal(d.executions.length, 1, '托管项目每天只能确认一次')
  assert.equal(d.executions[0].projectId, p1.id)
  assert.equal(d.executionsByPeriod[String(p1.id)].length, 1)
  assert.equal(d.chainExecutionCount, 1)
  // 续费后：新期记录与旧期记录各自归属，互不串期
  const p2 = svc.renewProject(p1.id, {}).project
  const d1 = buildProjectDetail(p1.id)
  assert.equal(d1.executionsByPeriod[String(p2.id)], undefined, '本期详情不应带出下一期的记录')
  assert.equal(d1.chainExecutionCount, 1, '整链记录数包含各期，但逐期仍按 projectId 归属')
})

test('查看详情不写任何存储（历史隔离）', () => {
  reset()
  const p1 = makeHosting()
  svc.confirmExecution(p1.id)
  svc.renewProject(p1.id, {})
  const snapshot = JSON.stringify([...store.entries()].sort())
  buildProjectDetail(p1.id)
  buildProjectDetail(projectsRepo.state.value[1].id)
  assert.equal(JSON.stringify([...store.entries()].sort()), snapshot, '详情只读，不应改动存储')
})

test('编辑当期不影响其它期的资料、收入与执行记录', () => {
  reset()
  const p1 = makeHosting()
  svc.confirmExecution(p1.id)
  const p2 = svc.renewProject(p1.id, {}).project
  const p2Before = JSON.stringify(projectsRepo.find(p2.id))
  const execBefore = JSON.stringify(completionsRepo.state.value)

  svc.updateProject(p1.id, { service: '全托', totalFee: 999, actualFee: 999 })

  assert.equal(JSON.stringify(projectsRepo.find(p2.id)), p2Before, '第二期资料不被改写')
  assert.equal(JSON.stringify(completionsRepo.state.value), execBefore, '执行记录不被改写')
  assert.equal(projectsRepo.find(p1.id).totalFee, 999)
  // 逐期收入仍各自独立
  const d = buildProjectDetail(p1.id)
  assert.deepEqual(d.chain.incomeByPeriod.map(x => x.fee), [999, 100])
})

test('财务取值：实际收费优先，其次总收费', () => {
  assert.equal(periodFee({ totalFee: 100, actualFee: 80 }), 80)
  assert.equal(periodFee({ totalFee: 100, actualFee: '' }), 100)
  assert.equal(periodFee({ totalFee: 100 }), 100)
  assert.equal(periodFee({ totalFee: '', actualFee: null }), 0)
})

test('本期剩余天数与周期一致（含今天）', () => {
  reset()
  const p = makeHosting()
  const d = buildProjectDetail(p.id)
  assert.equal(d.chain.remainingDays, diffDays(TODAY, d.host.endDate) + 1, '含今天')
  assert.ok(d.host.totalDays >= 1)
  assert.ok(d.chain.chainEnd >= d.chain.chainStart)
})

// ══════════ 结构约束（源码级） ══════════

test('详情窗口必须是分区结构，不能把所有内容堆在一个长弹窗里', () => {
  const sfc = read('src/components/ProjectDetail.vue')
  for (const key of ['overview', 'host', 'executions', 'finance']) {
    assert.ok(sfc.includes(`key: '${key}'`), `缺少分区 ${key}`)
  }
  assert.match(sfc, /class="pd-tab/, '应有分区切换')
  assert.match(sfc, /\.pd-drawer/, '应采用抽屉式面板')
  assert.match(sfc, /\.pd-body[^}]*overflow-y:\s*auto/, '分区内容区应可滚动')
})

test('原版详情窗口的操作与字段都不得丢失', () => {
  const sfc = read('src/components/ProjectDetail.vue')
  // 原版操作：编辑 / 保存 / 取消 / 关闭
  assert.match(sfc, /@click="startEdit"/)
  assert.match(sfc, /@click="submitEdit"/)
  assert.match(sfc, /@click="cancelEdit"/)
  assert.match(sfc, /@click="requestClose"/)
  // 本轮补齐的业务操作
  for (const ev of ['pause', 'resume', 'extend', 'cancel', 'archive', 'restore', 'renew', 'remove']) {
    assert.ok(sfc.includes(`emit('${ev}'`) || sfc.includes(`'${ev}'`), `缺少操作 ${ev}`)
  }
  // 原版字段：账号 / 密码 / 平台名称 5 项 / 延后收费 / 创建时间 / 上次确认
  for (const f of ['account', 'password', 'preferredPlatform', 'wechatName', 'qqName', 'bilibiliName', 'xiaohongshuName', 'douyinName', 'delayedFee', 'createdAt', 'lastConfirmDate']) {
    assert.ok(sfc.includes(f), `缺少原版字段 ${f}`)
  }
  assert.match(sfc, /@media \(prefers-reduced-motion: reduce\)/, '需支持减少动态效果')
})

test('详情窗口的打开 / 关闭 / 分区切换都带动效', () => {
  const sfc = read('src/components/ProjectDetail.vue')
  assert.match(sfc, /\.pd-drawer[\s\S]{0,200}transform:\s*translateX\(102%\)/, '抽屉应从右侧滑入')
  assert.match(sfc, /\.pd-mask\.open \.pd-drawer\s*\{\s*transform:\s*translateX\(0\)/, '打开态归位')
  assert.match(sfc, /\.pd-mask\.closing \.pd-drawer/, '关闭也要有动效')
  assert.match(sfc, /@keyframes pd-panel-in/, '分区切换应有进入动画')
  assert.match(sfc, /key: tab|:key="tab"/, '分区切换用 key 触发重播，避免离开动画阻塞')
})

test('服务层：详情组装只读，写操作全部落在 projectService', () => {
  const svcSrc = read('src/services/projectDetail.js')
  assert.match(svcSrc, /buildProjectDetail/, '应提供服务层组装函数')
  assert.equal(/projectsRepo\.(update|remove|replaceAll)/.test(svcSrc), false, '详情服务不得写项目存储')
  assert.equal(/completionsRepo\.(update|remove|replaceAll|persist)/.test(svcSrc), false, '详情服务不得写执行记录')

  const page = read('src/views/AccountPage.vue')
  assert.match(page, /<ProjectDetail/, '页面应挂载详情组件')
  assert.match(page, /buildProjectDetail\(/, '数据应来自服务层组装')
  assert.equal(page.includes('class="modal-mask" v-if="showDetail"'), false, '旧弹窗模板应已移除')
})

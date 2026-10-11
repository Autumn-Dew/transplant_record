// 项目详情窗口测试
//   · 数据组装（概览 / 托管周期 / 财务 / 收费记录）
//   · 可用操作：编辑 / 续费（加天数+收费）/ 归档（消耗全部天数并完成）/ 删除
//     —— 暂停 · 恢复 · 延期 · 提前结束已下线
//   · 托管周期可直接修改（不必只能靠续费）
//   · 历史隔离：查看详情不写存储；编辑当期不影响其它期
//   · 结构约束：与「代肝记录」同一套弹窗版式；不得再出现托管链等用不上的内容
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
const { addDays, todayLocal, diffDays, daysBetween } = await import('../src/utils/date.js')
const { KIND, STATE, hostProgress } = await import('../src/domain/project.js')

const TODAY = todayLocal()

function reset() {
  store.clear()
  projectsRepo.replaceAll([])
  completionsRepo.replaceAll([])
  gamesRepo.reload()
}

function makeHosting(extra = {}) {
  return svc.createProject({
    account: '13800138000',
    wechatName: '老板A',
    gameName: '终末地',
    service: '普托',
    kind: KIND.HOSTING,
    status: 2,
    totalFee: 100,
    actualFee: 100,
    hostDays: 30,
    ...extra,
  })
}

function makeOneOff(extra = {}) {
  return svc.createProject({
    account: '13900139000', gameName: '明日方舟', service: '精托',
    kind: KIND.ONE_OFF, status: 1, totalFee: 30, plannedDate: TODAY, ...extra,
  })
}

// ══════════ 可用操作 ══════════

test('可用操作只有 编辑 / 续费 / 归档 / 删除（暂停·恢复·延期·提前结束已下线）', () => {
  reset()
  const p = makeHosting()
  const a = availableActions(p.id)
  assert.equal(a.edit, true)
  assert.equal(a.renew, true, '续费 = 加天数 + 一笔收费')
  assert.equal(a.archive, true, '归档 = 消耗全部天数并完成托管')
  assert.equal(a.restore, false)
  assert.equal(a.remove, true, '尚无历史记录 → 允许物理删除')
  for (const k of ['pause', 'resume', 'extend', 'cancel']) {
    assert.equal(k in a, false, `不应再有操作 ${k}`)
  }
})

test('单次项目：只有 编辑 / 归档 / 删除，没有托管操作', () => {
  reset()
  const one = makeOneOff()
  const a = availableActions(one.id)
  assert.equal(a.edit, true)
  assert.equal(a.renew, false, '单次项目不提供续费')
  assert.equal(a.archive, true)
  assert.equal(a.remove, true)
  for (const k of ['pause', 'resume', 'extend', 'cancel']) assert.equal(k in a, false)
})

test('归档 = 消耗全部剩余天数，直接完成整个托管', () => {
  reset()
  const p = makeHosting()          // 30 天
  svc.confirmExecution(p.id)       // 已完成 1 次
  const before = projectsRepo.find(p.id)
  assert.equal(before.state, STATE.ACTIVE)
  assert.equal(before.host.completedTimes, 1)
  assert.ok(hostProgress(before).remaining > 0)

  svc.archiveProject(p.id)
  const after = projectsRepo.find(p.id)
  assert.equal(after.state, STATE.COMPLETED, '直接完成整个托管')
  assert.equal(after.status, 0)
  assert.equal(after.remainingDays, 0, '剩余天数被消耗光')
  assert.equal(after.host.completedTimes, after.host.plannedTimes, '全部天数计入已完成')
  assert.equal(hostProgress(after).remaining, 0)

  const a = availableActions(p.id)
  assert.equal(a.archive, false)
  assert.equal(a.restore, true)
  assert.equal(a.remove, false, '已归档 → 只能取消归档')

  // 取消归档：精确还原被消耗的天数，托管重新生效
  svc.restoreProject(p.id)
  const back = projectsRepo.find(p.id)
  assert.equal(back.archived, false)
  assert.equal(back.state, STATE.ACTIVE, '重新生效')
  assert.equal(back.host.completedTimes, 1, '还原归档前的完成次数')
  assert.equal(back.remainingDays, hostProgress(back).remaining)
})

test('已归档项目不可再确认执行', () => {
  reset()
  const p = makeHosting()
  svc.archiveProject(p.id)
  const r = svc.confirmExecution(p.id)
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'closed')
  assert.equal(completionsRepo.state.value.length, 0, '不得产生执行记录')
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

// ══════════ 托管周期可直接修改 ══════════

test('托管周期可直接修改：「托管天数」改了立即重算结束日与周期天数', () => {
  reset()
  const p = makeHosting()   // 30 天
  assert.equal(projectsRepo.find(p.id).host.cycleDays, 30)

  svc.updateProject(p.id, { hostDays: 15 })
  const host = projectsRepo.find(p.id).host
  assert.equal(host.cycleDays, 15, '周期天数按新天数重算')
  assert.equal(daysBetween(host.startDate, host.endDate), 15, '含首尾')
  assert.equal(diffDays(host.startDate, host.endDate), 14, '结束日 = 开始日 + 天数 − 1')

  // 详情里也直接反映新周期
  const d = buildProjectDetail(p.id)
  assert.equal(d.host.totalDays, 15)
})

test('托管周期可通过 host（开始日 / 结束日）直接修改', () => {
  reset()
  const p = makeHosting()
  const start = addDays(TODAY, -4)
  svc.updateProject(p.id, { host: { ...projectsRepo.find(p.id).host, startDate: start, endDate: addDays(start, 9), cycleDays: 10 } })
  const d = buildProjectDetail(p.id)
  assert.equal(d.host.startDate, start)
  assert.equal(d.host.endDate, addDays(start, 9))
  assert.equal(d.host.totalDays, 10)
})

// ══════════ 数据组装 ══════════

test('详情数据：概览 / 托管周期 / 财务 / 收费记录 都能组装出来', () => {
  reset()
  const p = makeHosting()
  const d = buildProjectDetail(p.id)
  assert.equal(d.project.id, p.id)
  assert.ok(d.displayName)
  assert.equal(d.hosting, true)
  assert.equal(d.host.startDate, TODAY)
  assert.ok(d.host.endDate >= d.host.startDate, '结束日不早于开始日')
  // 托管天数含首尾（与表单「结束日 = 开始日 + 天数 − 1」一致）
  assert.equal(d.host.totalDays, daysBetween(d.host.startDate, d.host.endDate))
  assert.equal(d.host.totalDays, 30)
  assert.ok(d.host.planned >= 1)
  assert.equal(d.finance.periodFee, 100)
  assert.equal(d.finance.paidAt, TODAY)
  // 收费记录：首次创建即记一条订单
  assert.equal(d.finance.paymentCount, 1)
  assert.equal(d.finance.paidTotal, 100)
  assert.equal(d.finance.payments[0].amount, 100)
  // 用不上的聚合视图不再组装
  assert.equal('chain' in d, false, '不再组装托管链')
  assert.equal('executions' in d, false, '不再组装执行记录')
  assert.equal('renewPlan' in d, false, '不再组装续费建议项目')
})

test('单次项目：没有托管周期，仍能组装详情', () => {
  reset()
  const one = makeOneOff()
  const d = buildProjectDetail(one.id)
  assert.equal(d.hosting, false)
  assert.equal(d.host, null)
  assert.equal(d.finance.periodFee, 30)
  assert.equal(d.finance.paymentCount, 0, '单次项目没有收费记录（订单只属于托管）')
  assert.equal(buildProjectDetail('不存在的项目'), null)
})

test('续费 = 在原项目上加天数 + 追加一条收费记录（不新建项目）', () => {
  reset()
  const p = makeHosting({ totalFee: 100, actualFee: 100 })
  const countBefore = projectsRepo.state.value.length
  const r = svc.addHostingPeriod(p.id, { days: 30, amount: 100, paidAt: TODAY })
  assert.equal(r.ok, true)
  assert.equal(projectsRepo.state.value.length, countBefore, '不新建项目')

  const after = projectsRepo.find(p.id)
  assert.equal(after.host.endDate, addDays(TODAY, 59), '结束日整段顺延 30 天')
  assert.equal(after.host.cycleDays, 60, '周期天数按新周期重算（含首尾）')
  assert.equal(after.payments.length, 2, '首次收费 + 本次收费 = 两条订单')
  assert.equal(after.payments[1].amount, 100)
  assert.equal(after.payments[1].paidAt, TODAY)

  const d = buildProjectDetail(p.id)
  assert.equal(d.finance.paidTotal, 200, '累计收费 = 各笔订单之和')
  assert.equal(d.finance.paymentCount, 2)
  // 收入按每一笔收费归月（两笔都在本月）
  const month = TODAY.slice(0, 7)
  assert.equal(svc.revenueStats({ month }).total, 200)
  assert.equal(svc.revenueStats({ month }).count, 2)
})

test('编辑收费 = 编辑最近一笔订单（详情与收入统计保持一致）', () => {
  reset()
  const p = makeHosting({ totalFee: 100, actualFee: 100 })
  svc.addHostingPeriod(p.id, { days: 30, amount: 100, paidAt: TODAY })
  svc.updateProject(p.id, { totalFee: 999, actualFee: 999 })
  const d = buildProjectDetail(p.id)
  assert.equal(d.finance.payments.length, 2)
  assert.equal(d.finance.payments[1].amount, 999, '最近一笔订单跟着改')
  assert.equal(d.finance.payments[0].amount, 100, '更早的订单不改写')
  assert.equal(d.finance.paidTotal, 1099)
})

test('查看详情不写任何存储（历史隔离）', () => {
  reset()
  const p = makeHosting()
  svc.confirmExecution(p.id)
  svc.addHostingPeriod(p.id, { days: 30, amount: 100 })
  const snapshot = JSON.stringify([...store.entries()].sort())
  buildProjectDetail(p.id)
  assert.equal(JSON.stringify([...store.entries()].sort()), snapshot, '详情只读，不应改动存储')
})

test('编辑当期不影响其它项目的资料、收入与执行记录', () => {
  reset()
  const p1 = makeHosting()
  svc.confirmExecution(p1.id)
  const p2 = makeHosting({ account: '13600136000' })
  const p2Before = JSON.stringify(projectsRepo.find(p2.id))
  const execBefore = JSON.stringify(completionsRepo.state.value)

  svc.updateProject(p1.id, { service: '全托', totalFee: 999, actualFee: 999 })

  assert.equal(JSON.stringify(projectsRepo.find(p2.id)), p2Before, '另一个项目不被改写')
  assert.equal(JSON.stringify(completionsRepo.state.value), execBefore, '执行记录不被改写')
  assert.equal(projectsRepo.find(p1.id).totalFee, 999)
})

test('财务取值：实际收费优先，其次总收费', () => {
  assert.equal(periodFee({ totalFee: 100, actualFee: 80 }), 80)
  assert.equal(periodFee({ totalFee: 100, actualFee: '' }), 100)
  assert.equal(periodFee({ totalFee: 100 }), 100)
  assert.equal(periodFee({ totalFee: '', actualFee: null }), 0)
})

test('托管天数留空 → 1 天周期（开始日 = 结束日）', () => {
  reset()
  const p = svc.createProject({
    account: '13500135000', gameName: '终末地', service: '普托',
    kind: KIND.HOSTING, status: 2, totalFee: 50, hostDays: '',
  })
  const host = projectsRepo.find(p.id).host
  assert.equal(host.endDate, host.startDate, '留空 = 1 天')
  assert.equal(host.cycleDays, 1)
  assert.equal(diffDays(host.startDate, host.endDate), 0)
})

// ══════════ 结构约束（源码级） ══════════

test('详情窗口与「代肝记录」同一套弹窗版式，且不再有托管链等用不上的内容', () => {
  const sfc = read('src/components/ProjectDetail.vue')
  assert.match(sfc, /class="modal-mask"/, '应用同一套弹窗（侧边抽屉）版式')
  assert.match(sfc, /class="edit-popup/, '弹窗容器与代肝记录一致')
  assert.match(sfc, /class="detail-grid"/, '字段用 detail-grid 两列展开')
  assert.match(sfc, /class="detail-section"/, '分区标题用 detail-section')
  assert.equal(/托管链|托管累计|pd-tab|pd-drawer/.test(sfc), false, '托管链 / 分区 tab / 抽屉都应删除')
  // 代肝记录的详细信息弹窗也用同一套类名
  const diary = read('src/views/WorkDiary.vue')
  assert.match(diary, /class="modal-mask"[\s\S]{0,200}class="edit-popup"/)
  assert.match(diary, /class="detail-grid"/)
})

test('操作只剩 编辑 / 续费 / 归档 / 取消归档 / 删除 / 关闭', () => {
  const sfc = read('src/components/ProjectDetail.vue')
  assert.match(sfc, /@click="startEdit"/)
  assert.match(sfc, /@click="onSave"/, '保存走统一确认')
  assert.match(sfc, /@click="cancelEdit"/)
  assert.match(sfc, /@click="requestClose"/)
  for (const ev of ['archive', 'restore', 'add-period', 'remove']) {
    assert.ok(sfc.includes(`emit('${ev}'`) || sfc.includes(`'${ev}'`), `缺少操作 ${ev}`)
  }
  // 暂停 / 恢复 / 延期 / 提前结束必须删掉（用不上）
  assert.equal(/暂停托管|恢复托管|>延期<|提前结束/.test(sfc), false, '无意义的托管生命周期操作应删除')
  assert.equal(/emit\('(pause|resume|extend|cancel)'/.test(sfc), false, '不得再派发这些操作')
})

test('写操作全部走统一的多次点击确认（连点 4 次生效）', () => {
  const sfc = read('src/components/ProjectDetail.vue')
  assert.match(sfc, /useConfirmClick/, '使用统一的多次点击确认机制')
  assert.match(sfc, /cfm\.trigger\('save'\)/, '保存走确认')
  assert.match(sfc, /cfm\.trigger\('archive'\)/, '归档走确认')
  assert.match(sfc, /cfm\.trigger\('remove'\)/, '删除走确认')
  assert.match(sfc, /cfm\.trigger\('add-period'\)/, '确认续费走确认')
  assert.match(sfc, /@click="onSave"/, '保存按钮改为 onSave（内部走确认）')
})

test('原版详情窗口的字段都不得丢失', () => {
  const sfc = read('src/components/ProjectDetail.vue')
  for (const f of ['account', 'password', 'preferredPlatform', 'wechatName', 'qqName', 'bilibiliName', 'xiaohongshuName', 'douyinName', 'delayedFee', 'createdAt', 'lastConfirmDate']) {
    assert.ok(sfc.includes(f), `缺少原版字段 ${f}`)
  }
  assert.match(sfc, /@media \(prefers-reduced-motion: reduce\)/, '需支持减少动态效果')
})

test('详情窗口编辑态可直接修改托管周期（开始日 / 结束日 / 天数）', () => {
  const sfc = read('src/components/ProjectDetail.vue')
  assert.match(sfc, /v-model="hostStart"/, '可直接改开始日')
  assert.match(sfc, /v-model="hostEnd"/, '可直接改结束日')
  assert.match(sfc, /v-model\.number="hostDays"/, '可直接改托管天数')
  assert.match(sfc, /submitEdit[\s\S]{0,600}patch\.host = \{/, '提交时把新周期写回 host')
})

test('详情窗口沿用统一弹窗的打开动效（右侧滑入），并支持减少动态效果', () => {
  const sfc = read('src/components/ProjectDetail.vue')
  assert.match(sfc, /class="modal-mask"/, '与代肝记录共用 .modal-mask / .edit-popup')
  const css = read('src/assets/css/page-common.css')
  assert.match(css, /@keyframes drawer-slide-in/, '侧边抽屉滑入动画')
  assert.match(css, /\.modal-mask \.edit-popup\s*\{[\s\S]{0,400}animation: drawer-slide-in/, '弹窗使用该动画')
  assert.match(sfc, /@media \(prefers-reduced-motion: reduce\)/)
})

test('服务层：详情组装只读，写操作全部落在 projectService', () => {
  const svcSrc = read('src/services/projectDetail.js')
  assert.match(svcSrc, /buildProjectDetail/, '应提供服务层组装函数')
  assert.equal(/projectsRepo\.(update|remove|replaceAll)/.test(svcSrc), false, '详情服务不得写项目存储')
  assert.equal(/completionsRepo/.test(svcSrc), false, '详情服务不得读写执行记录')

  const page = read('src/views/AccountPage.vue')
  assert.match(page, /<ProjectDetail/, '页面应挂载详情组件')
  assert.match(page, /buildProjectDetail\(/, '数据应来自服务层组装')
  assert.match(page, /addHostingPeriod/, '续费应走「加天数 + 一笔收费」')
  assert.equal(page.includes('hostingChains'), false, '列表不再有连续托管聚合')
})

test('收入统计落在「代肝记录」页', () => {
  const diary = read('src/views/WorkDiary.vue')
  assert.match(diary, /revenueStats/, '收入统计使用按每笔收费归月的统计')
  assert.match(diary, /income-strip/, '有收入统计区块')
  const account = read('src/views/AccountPage.vue')
  assert.equal(/monthIncomeSum/.test(account), false, '代肝代办页不再做收入统计')
})

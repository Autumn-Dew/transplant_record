// ═══════════════════════════════════════════════════════════════════
// 项目业务服务 — 唯一承载项目生命周期规则的地方
//
// 页面只调用这里的函数，不直接拼装业务规则。
//
// 生命周期规则：
//   单次项目：创建 → 待执行(pending) → 确认执行 → 已完成(completed) → 可归档
//   托管项目：创建 → 待开始/托管中 → 每日确认 → 次数用尽 → 已完成 → 可归档
//             可暂停 / 恢复 / 取消 / 续费（续费=新项目，不继承进度与历史）
// ═══════════════════════════════════════════════════════════════════

import { projectsRepo, completionsRepo, gamesRepo } from '../data/repos.js'
import { KIND, STATE, PLAN_MODE, isHosting, isClosed, isArchived, isCancelled, isCompleted, normalizeProject, plannedTimesFor, hostProgress, paymentsOf, normalizePayment, normalizePayments } from '../domain/project.js'
import { buildCompletion, RESULT, newId } from '../domain/completion.js'
import { buildChainSummary, incomeByMonth, resolveChainId, assignChainIds } from '../domain/hosting-chain.js'
import { gameKeyOf, gameNameOf } from '../domain/games.js'
import { getDisplayName } from '../domain/mask.js'
import { todayLocal, fmtDate, addMonth, addDays, diffDays, isYmd, daysBetween, endDateFromDays } from '../utils/date.js'

const weekdayOf = (d = todayLocal()) => {
  const dt = new Date(`${d}T00:00:00`)
  const js = dt.getDay()          // 0=周日
  return js === 0 ? 7 : js        // 1=周一 … 7=周日
}

function games() { return gamesRepo.state.value }

// ── 托管计划：由表单推导 host 结构 ──
export function buildHost(form, { startDate, endDate, createdAt, days } = {}) {
  const start = isYmd(startDate) ? startDate : fmtDate(createdAt || new Date())
  // 托管天数含首尾：10/01 + 20 天 = 10/20。
  // 留空（未填 / 非正数）→ 1 天（开始日 = 结束日），与表单提示「留空按 1 天」一致。
  const n = Math.max(1, Math.round(Number(days) || 0))
  const end = isYmd(endDate) ? endDate : endDateFromDays(start, n)
  const cycleDays = Math.max(1, daysBetween(start, end)) || 30
  const plan = {
    mode: form.planMode || PLAN_MODE.DAILY,
    weekdays: Array.isArray(form.planWeekdays) ? form.planWeekdays.map(Number) : [],
    timesPerDay: Math.max(1, Number(form.timesPerDay) || 1),
  }
  const planned = Number.isFinite(Number(form.plannedTimes)) && Number(form.plannedTimes) > 0
    ? Number(form.plannedTimes)
    : (plan.mode === PLAN_MODE.WEEKLY
      ? Math.max(1, Math.round((plan.weekdays.length || 7) / 7 * cycleDays * plan.timesPerDay))
      : cycleDays * plan.timesPerDay)
  return {
    startDate: start,
    endDate: end,
    cycle: 'month',
    cycleDays,
    plan,
    plannedTimes: planned,
    completedTimes: 0,
    skippedTimes: 0,
    abnormalTimes: 0,
    cancelledTimes: 0,
  }
}

// 创建项目（单次 / 托管）
export function createProject(form = {}) {
  const now = new Date()
  const isHost = Number(form.status) === 2 || form.kind === KIND.HOSTING
  const createdAt = form.createdAt || now.toISOString()
  const p = {
    ...form,
    id: form.id || newId('p'),
    createdAt,
    kind: isHost ? KIND.HOSTING : KIND.ONE_OFF,
    // game 统一存**游戏名**（与 v1.0.42 的老数据一致）；gameKey 存 id，供价格表匹配
    game: gameNameOf(games(), form.game),
    gameKey: gameKeyOf(games(), form.game),
    gameName: gameNameOf(games(), form.game),
    status: isHost ? 2 : (form.status == null ? 1 : Number(form.status)),
    schemaVersion: 2,
  }
  if (isHost) {
    p.host = buildHost(form, { startDate: form.hostStart, endDate: form.hostEnd, createdAt, days: form.hostDays })
    p.state = p.locked ? STATE.SCHEDULED : STATE.ACTIVE
    p.remainingDays = p.host.plannedTimes
    // 连续托管关系 ID：新建项目自成一链（历史续费项目会由迁移按 prevTaskId 追溯补全）
    p.hostingChainId = String(form.hostingChainId || p.id)
    if (!isYmd(p.paidAt)) p.paidAt = fmtDate(createdAt)
    // 收费记录（订单）：首次收费也记一条 —— 之后每次「加天数」都会再追加一条
    const firstAmount = p.actualFee !== '' && p.actualFee != null ? p.actualFee : (p.totalFee ?? '')
    p.payments = Array.isArray(form.payments) && form.payments.length
      ? normalizePayments(form.payments)
      : [normalizePayment({ amount: firstAmount, paidAt: p.paidAt, days: p.host.cycleDays, note: '', createdAt })]
  } else {
    p.state = STATE.PENDING
    p.remainingDays = 1
    if (!isYmd(p.plannedDate)) p.plannedDate = fmtDate(createdAt)
  }
  projectsRepo.add(normalizeProject(p))
  return p
}

// 修改项目（只改项目本身，绝不影响已生成的执行记录）
export function updateProject(id, patch = {}) {
  const cur = projectsRepo.find(id)
  if (!cur) return null
  const next = { ...patch }
  if (patch.game != null) {
    // game 统一存游戏名（与老数据一致），gameKey 存 id
    next.game = gameNameOf(games(), patch.game)
    next.gameKey = gameKeyOf(games(), patch.game)
    next.gameName = gameNameOf(games(), patch.game)
  }
  // 类型切换（单次 ⇄ 托管）：同步 kind 与生命周期状态，缺少 host 时补建
  if (patch.status != null && Number(patch.status) !== Number(cur.status)) {
    const isHost = Number(patch.status) === 2
    next.kind = isHost ? KIND.HOSTING : KIND.ONE_OFF
    if (isHost) {
      next.state = cur.locked ? STATE.SCHEDULED : STATE.ACTIVE
      if (!cur.host) next.host = buildHost({ ...cur, ...patch }, { createdAt: cur.createdAt })
    } else {
      next.state = STATE.PENDING
    }
  }
  if (patch.host && cur.host) {
    next.host = { ...cur.host, ...patch.host }
    next.remainingDays = Math.max(0, Number(next.host.plannedTimes) - Number(next.host.completedTimes))
  }
  // 托管周期：只要**起止日期变了**就重算「周期天数」与「计划次数」。
  //   · 表单路径：改的是扁平字段 hostDays（开始日 + 天数 − 1 推结束日）
  //   · 详情窗口路径：直接改 host.startDate / host.endDate（patch.host 已合并进 next.host）
  // 以前只在「有 hostDays」时才重算，详情窗口改完日期后 plannedTimes 仍是旧值，
  // 界面上「执行进度 / 剩余次数」都不动，看起来就像天数没改成功。
  // 计划次数按新周期重算，但**不少于已完成次数**，避免出现「已完成 > 计划」的负数剩余。
  const patchDays = Number(patch && patch.hostDays)
  const baseHost = next.host || cur.host
  if (baseHost) {
    const prevStart = isYmd(cur.host?.startDate) ? cur.host.startDate : ''
    const prevEnd = isYmd(cur.host?.endDate) ? cur.host.endDate : ''
    const start = isYmd(baseHost.startDate) ? baseHost.startDate : fmtDate(cur.createdAt)
    const wantDays = Number.isFinite(patchDays) && patchDays > 0
    const end = wantDays
      ? endDateFromDays(start, Math.max(1, Math.round(patchDays)))
      : (isYmd(baseHost.endDate) ? baseHost.endDate : prevEnd)
    const datesChanged = !!end && (start !== prevStart || end !== prevEnd)
    if (end && (wantDays || datesChanged)) {
      const cycleDays = Math.max(1, daysBetween(start, end))
      const completed = Number(baseHost.completedTimes) || 0
      const planned = Math.max(completed, plannedTimesFor(baseHost.plan, cycleDays))
      next.host = { ...baseHost, startDate: start, endDate: end, cycleDays, plannedTimes: planned }
      next.remainingDays = Math.max(0, planned - completed)
    }
  }
  // 项目上的收费字段与「最近一笔收费记录」保持一致：
  // 编辑收费 = 编辑当前这笔订单，否则详情显示与收入统计会对不上。
  const pays = Array.isArray(cur.payments) ? cur.payments : null
  if (pays && pays.length && (patch.totalFee !== undefined || patch.actualFee !== undefined || patch.paidAt !== undefined)) {
    const nextTotal = patch.totalFee !== undefined ? patch.totalFee : cur.totalFee
    const nextActual = patch.actualFee !== undefined ? patch.actualFee : cur.actualFee
    const amount = nextActual !== '' && nextActual != null ? nextActual : (nextTotal ?? '')
    const paidAt = isYmd(patch.paidAt) ? patch.paidAt : (isYmd(cur.paidAt) ? cur.paidAt : '')
    const last = pays.length - 1
    next.payments = pays.map((pay, k) => (k === last
      ? normalizePayment({ ...pay, amount, paidAt })
      : pay))
  }
  return projectsRepo.update(id, next)
}

// ── 今日代办 ──

// 托管项目今天是否应执行
export function shouldRunToday(p, today = todayLocal()) {
  if (!isHosting(p)) return false
  if (p.locked || isClosed(p)) return false
  if (p.state !== STATE.ACTIVE) return false
  const host = p.host || {}
  // 显式延期的日期不生成代办
  if (Array.isArray(host.skippedDates) && host.skippedDates.includes(today)) return false
  if (isYmd(host.startDate) && diffDays(host.startDate, today) < 0) return false
  if (isYmd(host.endDate) && diffDays(host.endDate, today) > 0) return false
  const plan = host.plan || {}
  if (plan.mode === PLAN_MODE.WEEKLY) {
    const days = Array.isArray(plan.weekdays) ? plan.weekdays.map(Number) : []
    return days.includes(weekdayOf(today))
  }
  if (plan.mode === PLAN_MODE.CUSTOM) return false
  return true
}

// 单次项目今天是否为到期待办（计划日期 <= 今天）
export function isDueToday(p, today = todayLocal()) {
  if (!p || isHosting(p)) return false
  if (isClosed(p)) return false
  if (p.state !== STATE.PENDING) return false
  const plan = isYmd(p.plannedDate) ? p.plannedDate : fmtDate(p.createdAt)
  return diffDays(plan, today) >= 0
}

// 今日代办列表：托管今日应执行 + 单次到期待办
export function todayTasks(today = todayLocal()) {
  return projectsRepo.state.value.filter(p => (isHosting(p) ? shouldRunToday(p, today) : isDueToday(p, today)))
}

// 今日代办（带展示信息，供面板直接渲染）
export function todayTaskItems(today = todayLocal()) {
  return todayTasks(today).map(p => ({
    ...p,
    hosting: isHosting(p),
    progress: isHosting(p) ? hostProgress(p) : null,
  }))
}

/**
 * 延期代办（不产生执行记录，仅调整「何时该做」）
 *  - 托管：把指定日期标记为不执行（默认明天）
 *  - 单次：修改计划执行日期
 * 返回是否成功。
 */
export function postponeTask(id, toDate, today = todayLocal()) {
  const p = projectsRepo.find(id)
  if (!p) return { ok: false, reason: 'not-found' }
  const target = isYmd(toDate) ? toDate : addDays(today, 1)
  if (isHosting(p)) {
    const host = { ...(p.host || {}) }
    const dates = Array.isArray(host.skippedDates) ? [...host.skippedDates] : []
    // 从今天起顺延到目标日期（含目标日期当天之前的每一天）
    let cur = today
    let guard = 0
    while (diffDays(cur, target) > 0 && guard++ < 400) {
      if (!dates.includes(cur)) dates.push(cur)
      cur = addDays(cur, 1)
    }
    host.skippedDates = dates.sort()
    projectsRepo.update(id, { host })
    return { ok: true, to: target }
  }
  projectsRepo.update(id, { plannedDate: target })
  return { ok: true, to: target }
}

// 取消代办（单次项目直接结束；托管项目取消停止生成后续代办）
export function cancelTask(id, reason = '') {
  return cancelProject(id, reason)
}

// ── 确认执行 ──
// opts: { result, content, note, images, plannedDate, completedDate, force }
export function confirmExecution(projectId, opts = {}) {
  const raw = projectsRepo.find(projectId)
  if (!raw) return { ok: false, reason: 'not-found' }
  const p = { ...raw }
  const today = todayLocal()
  const hosting = isHosting(p)

  if (hosting && p.state === STATE.SCHEDULED) return { ok: false, reason: 'not-started' }
  if (hosting && p.state === STATE.PAUSED) return { ok: false, reason: 'paused' }
  if (hosting && p.lastConfirmDate === today && !opts.force) return { ok: false, reason: 'confirmed-today' }
  if (p.state === STATE.CANCELLED || isArchived(p)) return { ok: false, reason: 'closed' }

  const result = opts.result || RESULT.DONE
  const isCountable = result === RESULT.DONE
  const completedDate = isYmd(opts.completedDate) ? opts.completedDate : today

  // 1) 先生成独立执行记录（事实层，先落盘，保证不丢）
  //    托管项目额外记录「执行当时的周期与连续托管状态」快照，
  //    后续续费 / 改期都不会改写这条历史
  let chainSnap = {}
  if (hosting) {
    const all = projectsRepo.state.value
    const chainId = resolveChainId(p, all)
    const summary = buildChainSummary(
      all.filter(x => isHosting(x) && resolveChainId(x, all) === chainId),
      { today },
    )
    chainSnap = {
      hostingChainId: chainId,
      periodStart: p.host?.startDate,
      periodEnd: p.host?.endDate,
      chainStart: summary.chainStart,
      chainEnd: summary.chainEnd,
      chainDayIndex: summary.dayIndex,
      chainRemainingDays: summary.remainingDays,
    }
  }
  const record = buildCompletion(p, {
    result,
    content: opts.content,
    note: opts.note,
    images: opts.images,
    plannedDate: isYmd(opts.plannedDate) ? opts.plannedDate : today,
    completedDate,
    wasHosting: hosting,
    gameKey: p.gameKey || gameKeyOf(games(), p.game),
    gameName: p.gameName || gameNameOf(games(), p.game),
    ...chainSnap,
  })
  completionsRepo.add(record)

  // 2) 再更新项目进度
  const patch = { lastConfirmDate: today }
  if (hosting) {
    const host = { ...(p.host || {}) }
    if (result === RESULT.DONE) host.completedTimes = Number(host.completedTimes || 0) + 1
    else if (result === RESULT.SKIPPED) host.skippedTimes = Number(host.skippedTimes || 0) + 1
    else if (result === RESULT.ABNORMAL) host.abnormalTimes = Number(host.abnormalTimes || 0) + 1
    else if (result === RESULT.CANCELLED) host.cancelledTimes = Number(host.cancelledTimes || 0) + 1
    patch.host = host
    patch.remainingDays = Math.max(0, Number(host.plannedTimes || 0) - Number(host.completedTimes || 0))
    const done = Number(host.completedTimes || 0) >= Number(host.plannedTimes || 0)
    if (done) {
      patch.state = STATE.COMPLETED
      patch.status = 0
      patch.completedAt = new Date().toISOString()
    }
  } else if (isCountable) {
    patch.state = STATE.COMPLETED
    patch.status = 0
    patch.remainingDays = 0
    patch.completedAt = new Date().toISOString()
  }

  projectsRepo.update(projectId, patch)

  // 3) 前一期完成 → 解锁续费项目（待开始 → 托管中）
  if (!hosting || patch.state === STATE.COMPLETED) unlockSuccessors(projectId)

  return { ok: true, record, completed: patch.state === STATE.COMPLETED }
}

// 解锁以 projectId 为前序的续费项目
// 解锁条件只有一个：上一期已结束。新周期是否「今天该执行」由日期判定负责，
// 因此解锁后状态即为「托管中」，避免把未来的周期误标为不可确认。
export function unlockSuccessors(prevId) {
  projectsRepo.state.value
    .filter(p => p.locked && String(p.prevTaskId) === String(prevId))
    .forEach(p => projectsRepo.update(p.id, { locked: false, state: STATE.ACTIVE }))
}

// ── 暂停 / 恢复 / 到期 ──
export function pauseProject(id, reason = '') {
  const p = projectsRepo.find(id)
  if (!p || !isHosting(p)) return null
  return projectsRepo.update(id, { state: STATE.PAUSED, pausedAt: new Date().toISOString(), pauseReason: reason })
}

export function resumeProject(id) {
  const p = projectsRepo.find(id)
  if (!p || !isHosting(p)) return null
  const patch = { state: STATE.ACTIVE, resumedAt: new Date().toISOString() }
  // 暂停期间的天数不消耗：把结束日按实际暂停天数往后顺延，并重算托管天数
  const host = { ...(p.host || {}) }
  const pausedFrom = fmtDate(p.pausedAt)
  const pausedDays = isYmd(pausedFrom) ? Math.max(0, diffDays(pausedFrom, todayLocal())) : 0
  if (pausedDays > 0 && isYmd(host.endDate)) {
    host.endDate = addDays(host.endDate, pausedDays)
    host.cycleDays = Math.max(1, daysBetween(host.startDate, host.endDate))
    patch.host = host
  }
  return projectsRepo.update(id, patch)
}

// ── 加天数 + 追加收费记录（同客户再次新增托管的唯一入口）──
/**
 * 业务模型：同一客户再次「新增托管」= 在原项目上加天数、多记一笔收费，
 * 而**不是**新建一个项目。因此：
 *   · 结束日整段后移 days 天（原结束日之后接 days 天：无缝衔接、不重叠、不断档）
 *   · 周期天数与计划次数按新周期重算（已完成的次数保留）
 *   · 追加一条收费记录（订单），收入按「每笔收费的归属日期」统计
 * 返回 { ok, project, payment, days }
 */
export function addHostingPeriod(projectId, { days, amount, paidAt, note } = {}) {
  const cur = projectsRepo.find(projectId)
  if (!cur || !isHosting(cur)) return { ok: false, reason: 'not-hosting' }

  const host = { ...(cur.host || {}) }
  const start = isYmd(host.startDate) ? host.startDate : fmtDate(cur.createdAt)
  const base = isYmd(host.endDate) ? host.endDate : addMonth(start)
  // 默认「加多少天」必须用原周期的**日历跨度**（结束日 − 开始日），而不是 cycleDays。
  // cycleDays 是「含首尾」的天数（10/12→11/11 = 31），直接拿它去 addDays 会多加 1 天
  // （11/11 + 31 = 12/12，比一个自然月多一天）。
  const spanDays = Math.max(1, diffDays(start, base))
  const n = Math.max(1, Math.round(Number(days) || spanDays || 30))
  host.startDate = start
  host.endDate = addDays(base, n)
  host.cycleDays = Math.max(1, daysBetween(start, host.endDate))
  host.plannedTimes = Math.max(Number(host.completedTimes) || 0, plannedTimesFor(host.plan, host.cycleDays), 1)

  const payment = normalizePayment({
    amount: amount == null || amount === '' ? (cur.totalFee ?? '') : amount,
    paidAt: isYmd(paidAt) ? paidAt : todayLocal(),
    days: n,
    note,
    createdAt: new Date().toISOString(),
  })

  const patch = {
    host,
    // 原有订单（老项目会在这一刻把派生的一条落盘）+ 本次新增的一条
    payments: [...paymentsOf(cur), payment],
    // 项目上的收费字段同步为「最近一次收费」；累计金额一律以 payments 为准
    totalFee: payment.amount,
    actualFee: cur.actualFee === '' || cur.actualFee == null ? '' : payment.amount,
    paidAt: payment.paidAt,
    remainingDays: Math.max(0, host.plannedTimes - Number(host.completedTimes || 0)),
  }
  // 已完成 / 已到期（含被取消）的周期加天数后重新生效
  if (cur.state === STATE.COMPLETED || cur.state === STATE.EXPIRED || cur.state === STATE.CANCELLED) {
    patch.state = STATE.ACTIVE
    patch.status = 2
    patch.completedAt = null
    if (isCancelled(cur)) patch.cancelledAt = null
  }

  const project = projectsRepo.update(projectId, patch)
  return { ok: true, project, payment, days: n }
}

// ── 取消 / 归档（优先于物理删除）──
export function cancelProject(id, reason = '') {
  const p = projectsRepo.find(id)
  if (!p) return null
  return projectsRepo.update(id, {
    state: STATE.CANCELLED,
    status: 0,
    cancelledAt: new Date().toISOString(),
    cancelReason: reason,
  })
}

// 归档 = 消耗全部剩余天数，直接完成整个托管。
//   · 托管：剩余次数全部记入已完成（剩余 = 0），状态置为「已完成」，并打归档标记
//   · 单次：只打归档标记（没有天数可消耗）
// 归档时记下消耗掉的次数，「取消归档」据此精确还原。
export function archiveProject(id) {
  const p = projectsRepo.find(id)
  if (!p) return null
  const patch = { archived: true, archivedAt: new Date().toISOString() }
  if (isHosting(p)) {
    const host = { ...(p.host || {}) }
    const planned = Number(host.plannedTimes || 0)
    patch.archivedConsumed = Math.max(0, planned - Number(host.completedTimes || 0))
    host.completedTimes = planned
    patch.host = host
    patch.remainingDays = 0
    patch.state = STATE.COMPLETED
    patch.status = 0
    patch.completedAt = new Date().toISOString()
  }
  return projectsRepo.update(id, patch)
}

// 取消归档 = 去掉归档标记，并还原归档时消耗掉的天数（托管重新生效）
export function restoreProject(id) {
  const p = projectsRepo.find(id)
  if (!p) return null
  const patch = { archived: false, archivedAt: null, archivedConsumed: null }
  const consumed = Number(p.archivedConsumed || 0)
  if (isHosting(p)) {
    if (consumed > 0) {
      const host = { ...(p.host || {}) }
      host.completedTimes = Math.max(0, Number(host.completedTimes || 0) - consumed)
      patch.host = host
      patch.remainingDays = Math.max(0, Number(host.plannedTimes || 0) - host.completedTimes)
    }
    if (p.state === STATE.COMPLETED) {
      patch.state = STATE.ACTIVE
      patch.status = 2
      patch.completedAt = null
    }
  }
  return projectsRepo.update(id, patch)
}

// 物理删除（危险操作，仅用于「无历史记录」的误建项目）
export function canHardDelete(id) {
  const hasHistory = completionsRepo.state.value.some(c => String(c.projectId || c.taskId) === String(id))
  const hasSuccessor = projectsRepo.state.value.some(p => String(p.prevTaskId) === String(id))
  return { ok: !hasHistory && !hasSuccessor, hasHistory, hasSuccessor }
}

export function hardDeleteProject(id) {
  const check = canHardDelete(id)
  if (!check.ok) return { ok: false, ...check }
  projectsRepo.remove(id)
  return { ok: true }
}

// ── 续费（历史形态：每次续费新建一个独立项目）──
//
// ⚠ 界面已不再使用本组函数：现在「续期」走 addHostingPeriod()（在原项目上加天数 + 一条收费记录）。
//   保留这里的 planRenewal / renewProject 是为了兼容历史数据（多项目续费链 prevTaskId /
//   hostingChainId）与既有测试；除非要恢复「续费=新项目」的形态，否则不要在新代码里调用。

// 建议的续费日期（基于旧项目的结束日期，而非创建日期）
// 新周期从原周期结束日的**次日**开始，避免两期重叠
export function planRenewal(prevId, today = todayLocal()) {
  const prev = projectsRepo.find(prevId)
  if (!prev) return null
  const startDate = isYmd(prev.host?.endDate)
    ? addDays(prev.host.endDate, 1)
    : addMonth(fmtDate(prev.createdAt))
  return {
    prevId: prev.id,
    startDate,
    endDate: endDateFromDays(startDate, daysBetween(prev.host?.startDate, prev.host?.endDate) || 30),
    game: prev.game,
    gameName: prev.gameName || prev.game,
    account: prev.account,
    service: prev.service,
    prevEndDate: prev.host?.endDate || null,
    // 上一期是否仍未结束（决定新周期是否需要「待开始」锁定）
    prevOpen: !isCompleted(prev) && !isArchived(prev) && !isCancelled(prev) &&
      (isYmd(prev.host?.endDate) ? diffDays(today, prev.host.endDate) >= 0 : false),
  }
}

// 同账号下最近的可续费托管项目
// 注意：必须用 isArchived / isCancelled 判断 —— 归档只打 `archived` 标记（`state` 可能仍是 active），
// 只比较 state 会把「已归档 / 已删除」的托管当成可续费项目，导致删掉之后仍然弹出续费窗口。
export function findRenewalCandidate({ account, game } = {}) {
  const list = projectsRepo.state.value.filter(p => {
    if (!isHosting(p)) return false
    if (isArchived(p) || isCancelled(p)) return false
    if (p.state === STATE.CANCELLED || p.state === STATE.ARCHIVED) return false
    if (account && p.account !== account) return false
    if (game && gameKeyOf(games(), p.game) !== gameKeyOf(games(), game)) return false
    return true
  })
  if (!list.length) return null
  return [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]
}

/**
 * 续费：创建一个全新的托管项目。
 *  - 新 ID、prevTaskId 关联原项目
 *  - 继承游戏 / 账号 / 服务内容（可覆盖）
 *  - 不继承执行进度与历史记录
 *  - startDate 必须显式给出（默认取 planRenewal 的建议值，由用户确认）
 */
export function renewProject(prevId, overrides = {}) {
  const prev = projectsRepo.find(prevId)
  if (!prev) return { ok: false, reason: 'not-found' }
  const plan = planRenewal(prevId)
  const startDate = isYmd(overrides.startDate) ? overrides.startDate : plan.startDate
  const endDate = isYmd(overrides.endDate) ? overrides.endDate : addMonth(startDate)
  const form = {
    account: prev.account,
    password: prev.password,
    game: prev.game,
    service: prev.service,
    note: '',
    wechatName: prev.wechatName, qqName: prev.qqName, bilibiliName: prev.bilibiliName,
    xiaohongshuName: prev.xiaohongshuName, douyinName: prev.douyinName,
    preferredPlatform: prev.preferredPlatform,
    // 价格「继承旧项目作为默认值」，可被 overrides 覆盖（每次收费仍独立保存）
    totalFee: overrides.totalFee != null ? overrides.totalFee : (prev.totalFee ?? ''),
    actualFee: overrides.actualFee != null ? overrides.actualFee : '',
    delayedFee: '',
    status: 2,
    kind: KIND.HOSTING,
    createdAt: `${startDate}T00:00:00`,
    // 上一期尚未结束 → 新周期「待开始」；上一期已结束 → 立即生效
    locked: plan.prevOpen,
    prevTaskId: prev.id,
    // 续费属于同一条连续托管关系（第二期、第三期…）
    hostingChainId: String(prev.hostingChainId || resolveChainId(prev, projectsRepo.state.value)),
    paidAt: isYmd(overrides.paidAt) ? overrides.paidAt : todayLocal(),
    hostStart: startDate,
    hostEnd: endDate,
    plannedTimes: overrides.plannedTimes,
    planMode: overrides.planMode || prev.host?.plan?.mode || PLAN_MODE.DAILY,
    planWeekdays: overrides.planWeekdays || prev.host?.plan?.weekdays || [],
    timesPerDay: overrides.timesPerDay || prev.host?.plan?.timesPerDay || 1,
    ...pickOverrides(overrides),
  }
  const created = createProject(form)
  return { ok: true, project: created, startDate, endDate, prev }
}

function pickOverrides(o) {
  const out = {}
  const keys = ['game', 'service', 'account', 'password', 'note', 'totalFee', 'actualFee',
    'wechatName', 'qqName', 'bilibiliName', 'xiaohongshuName', 'douyinName', 'preferredPlatform']
  keys.forEach(k => { if (o[k] !== undefined) out[k] = o[k] })
  return out
}

// ── 统计 ──
export function projectStats() {
  const list = projectsRepo.state.value
  const live = list.filter(p => !isArchived(p) && !isCancelled(p))
  return {
    total: live.length,
    pending: live.filter(p => p.state === STATE.PENDING).length,
    hosting: live.filter(p => p.state === STATE.ACTIVE).length,
    paused: live.filter(p => p.state === STATE.PAUSED).length,
    completed: list.filter(p => p.state === STATE.COMPLETED).length,
    archived: list.filter(p => isArchived(p)).length,
    cancelled: list.filter(p => isCancelled(p)).length,
    totalFee: live.reduce((s, p) => s + (Number(p.totalFee) || 0), 0),
  }
}

// ══════════ 连续托管关系（第二轮）══════════

// 某项目所属的连续托管关系 ID
// ⚠ 界面已不再展示托管链；本组函数保留用于历史数据（多项目续费链）与迁移，勿在新代码里依赖。
export function chainIdOf(projectId) {
  const all = projectsRepo.state.value
  const p = all.find(x => String(x.id) === String(projectId))
  return p ? resolveChainId(p, all) : ''
}

// 一条连续托管关系下的全部周期（按开始日期排序）
export function chainPeriods(chainId) {
  const all = projectsRepo.state.value
  return all
    .filter(p => isHosting(p) && resolveChainId(p, all) === String(chainId))
    .sort((a, b) => String(a.host?.startDate || '').localeCompare(String(b.host?.startDate || '')))
}

// 某项目的连续托管汇总（剩余天数 / 第几天 / 当前周期 / 各期收入）
export function chainSummaryOf(projectId, today = todayLocal()) {
  const chainId = chainIdOf(projectId)
  if (!chainId) return null
  return buildChainSummary(chainPeriods(chainId), { today })
}

// 全部连续托管关系：同一客户的多个收费周期聚合为一条展示记录
// （展示聚合，不合并底层项目；各周期 ID / 收费 / 执行记录保持独立）
export function hostingChains(today = todayLocal()) {
  const all = projectsRepo.state.value
  const map = new Map()
  all.filter(isHosting).forEach(p => {
    const id = resolveChainId(p, all)
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(p)
  })
  const rows = [...map.entries()].map(([chainId, periods]) => {
    const summary = buildChainSummary(periods, { today })
    const latest = [...periods].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0]
    return {
      chainId,
      summary,
      periods: summary.periods,
      latest,
      account: latest?.account || '',
      displayName: getDisplayName(latest),
      gameName: latest?.gameName || latest?.game || '',
      service: latest?.service || '',
    }
  })
  return rows.sort((a, b) => {
    const da = (a.summary.expired || !a.summary.started) ? 1 : 0
    const db = (b.summary.expired || !b.summary.started) ? 1 : 0
    if (da !== db) return da - db
    return String(b.summary.chainStart).localeCompare(String(a.summary.chainStart))
  })
}

// 某条链上的全部执行记录（历史查询，按周期归属）
export function chainExecutions(chainId) {
  const ids = new Set(chainPeriods(chainId).map(p => String(p.id)))
  return completionsRepo.state.value.filter(c => ids.has(String(c.projectId || c.taskId)))
}

// ── 收入统计：每一笔收费（订单）独立，聚合展示绝不合并收入 ──
// 一个项目可能被「加天数」多次 → 每次收费都记一条 payments，按每笔的归属日期归月。
export function revenueStats({ month, from, to } = {}) {
  const all = projectsRepo.state.value.filter(isHosting)
  const list = all.flatMap(p => {
    const chainId = resolveChainId(p, all)
    return paymentsOf(p).map(pay => ({
      projectId: String(p.id),
      chainId,
      paymentId: pay.id,
      paidAt: isYmd(pay.paidAt) ? pay.paidAt : fmtDate(p.createdAt),
      fee: Number(pay.amount) || 0,
      days: pay.days,
      game: p.gameName || p.game || '',
      service: p.service || '',
      account: p.account || '',
      displayName: getDisplayName(p),
    }))
  })
  const inRange = list.filter(r =>
    (!month || r.paidAt.startsWith(month)) &&
    (!from || r.paidAt >= from) &&
    (!to || r.paidAt <= to))
  return {
    month: month || '',
    total: inRange.reduce((s, r) => s + r.fee, 0),
    count: inRange.length,
    items: inRange.sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt))),
    byMonth: incomeByMonth(all),
  }
}

// 补全链条 ID 并落盘（旧数据即时生效、迁移后一致性）
export function ensureChains() {
  const all = projectsRepo.state.value
  const { records, changed } = assignChainIds(all)
  if (changed > 0) projectsRepo.replaceAll(records)
  return changed
}

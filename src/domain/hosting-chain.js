// ═══════════════════════════════════════════════════════════════════
// 连续托管关系（hosting chain）— 纯函数，不依赖 Vue / localStorage
//
// ⚠ 现状：界面已不再展示托管链（详情窗口/列表都已移除），「续期」也改为在原项目上加天数。
//   本模块保留用于**历史数据兼容与迁移**（老数据里「每次续费 = 一个独立项目」，
//   需要按 prevTaskId 追溯链条根并补全 hostingChainId）以及既有的纯函数测试。
//
// 模型视角：
//   A. 托管周期项目：历史数据里每次收费 = 一个独立项目（独立 ID / 日期 / 价格 / 服务快照）
//   B. 连续托管关系：多个周期可属于同一条 hostingChainId（由 prevTaskId 追溯）
//   C. 连续托管汇总：按「关系」聚合出连续起止、剩余天数、逐笔收入
//
// 计算规则（统一、可测试）：
//   · 剩余天数 remainingDays = 今天到「连续段有效结束日」的天数，**含今天**：
//       今天 == 结束日 → 1；今天 > 结束日 → 0；尚未开始 → 总天数
//   · 天数一律按本地日历计算（28/29/30/31 天的月份自然处理）
//   · 只有「无断层」的周期才累计：下一段开始日 > 当前累计结束日 + 1 天 → 断层，
//     断层之后的周期不再计入连续剩余天数
//   · 收入逐笔（订单）独立：每笔收费的金额与归属日期各自保留，聚合展示不合并收入
// ═══════════════════════════════════════════════════════════════════

import { fmtDate, addDays, diffDays, daysBetween, isYmd, todayLocal } from '../utils/date.js'
import { isHosting, isArchived, isCancelled, paymentsOf, paidTotalOf } from './project.js'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(p) {
  const v = p.actualFee !== '' && p.actualFee != null ? p.actualFee
    : (p.totalFee !== '' && p.totalFee != null ? p.totalFee : '')
  return num(v)
}

// 周期视图（单个托管项目）
export function periodOf(p) {
  const host = p.host || {}
  const startDate = isYmd(host.startDate) ? host.startDate : fmtDate(p.createdAt)
  const endDate = isYmd(host.endDate) ? host.endDate : addDays(startDate, 30)
  return {
    projectId: String(p.id),
    chainId: String(p.hostingChainId || p.id),
    account: p.account || '',
    game: p.gameName || p.game || '',
    service: p.service || '',
    startDate,
    endDate,
    cycleDays: Math.max(1, daysBetween(startDate, endDate)),
    plannedTimes: num(host.plannedTimes),
    completedTimes: num(host.completedTimes),
    fee: money(p),
    // 累计收费：一个项目可能被「加天数」多次，金额以收费记录（订单）为准
    paidTotal: paidTotalOf(p),
    payments: paymentsOf(p),
    paidAt: isYmd(p.paidAt) ? p.paidAt : (p.createdAt ? fmtDate(p.createdAt) : startDate),
    // 归月依据：项目创建日（大部分项目创建时即入账）
    createdAt: p.createdAt ? fmtDate(p.createdAt) : startDate,
    state: p.state,
    archived: isArchived(p),
    cancelled: isCancelled(p),
    legacyRemaining: p.remainingDays,
  }
}

// 是否「紧接」上一段（无空档）：下一段起点 <= 当前累计结束日 + 1 天
export function isAdjacent(prevEndDate, nextStartDate) {
  if (!isYmd(prevEndDate) || !isYmd(nextStartDate)) return false
  return diffDays(prevEndDate, nextStartDate) <= 1
}

/**
 * 聚合一条连续托管关系。
 * periods: 该项目所属链条的全部项目（顺序不限）
 * 返回 { chainId, periods, continuous, segments, chainStart, chainEnd, totalDays,
 *        dayIndex, remainingDays, started, expired, currentPeriodId, totalIncome, incomeByPeriod }
 */
export function buildChainSummary(periods, { today = todayLocal() } = {}) {
  const all = (Array.isArray(periods) ? periods : [])
    .filter(p => isHosting(p))
    .map(periodOf)
    .sort((a, b) => (a.startDate === b.startDate
      ? String(a.projectId).localeCompare(String(b.projectId))
      : a.startDate.localeCompare(b.startDate)))

  const active = all.filter(p => !p.archived && !p.cancelled)
  const pool = active.length ? active : all

  const chainId = pool[0]?.chainId || ''
  // 连续段：从第一段起逐段顺延；遇到断层即停止累计
  // 注意：chainEnd 必须取「段内最大结束日」而不是排序后最后一条的结束日 ——
  // 否则当两期起点相同（例如当天续费 / 补录）时，字典序靠前的一期会被排到后面，
  // 取到较小的结束日，导致剩余天数偏小。cursorEnd 即段内最大结束日。
  const segments = []
  let cursorEnd = ''
  let continuous = true
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i]
    if (i === 0) {
      segments.push([p])
      cursorEnd = p.endDate
      continue
    }
    if (isAdjacent(cursorEnd, p.startDate)) {
      segments[segments.length - 1].push(p)
      if (diffDays(cursorEnd, p.endDate) > 0) cursorEnd = p.endDate
    } else {
      continuous = false
      segments.push([p])
      cursorEnd = p.endDate
    }
  }

  const head = segments[0] || []
  const chainStart = head[0]?.startDate || ''
  // 段内最大结束日（与 periods 的排序无关）
  const chainEnd = head.reduce((max, p) => (max && diffDays(max, p.endDate) <= 0 ? max : p.endDate), '')
  const totalDays = chainStart && chainEnd ? diffDays(chainStart, chainEnd) + 1 : 0

  const started = !!chainStart && diffDays(chainStart, today) >= 0
  // 已过期：今天在「连续段有效结束日」之后
  const expired = !!chainEnd && diffDays(chainEnd, today) > 0
  const dayIndex = !started ? 0 : Math.max(1, Math.min(diffDays(chainStart, today) + 1, totalDays))
  // 含今天：today == end → 1
  const remainingDays = !chainStart
    ? 0
    : (!started ? totalDays : Math.max(0, diffDays(today, chainEnd) + 1))

  const current = pool.find(p => diffDays(p.startDate, today) >= 0 && diffDays(today, p.endDate) >= 0) || null

  // 逐笔收费（订单）展开：一个项目可能有多次收费，每笔独立归期、独立归月
  const incomeByPeriod = all.flatMap((p, i) => p.payments.map((pay, k) => ({
    projectId: p.projectId,
    index: i + 1,
    paymentIndex: k + 1,
    fee: num(pay.amount),
    paidAt: pay.paidAt || p.paidAt,
    startDate: p.startDate,
    endDate: p.endDate,
  })))

  return {
    chainId,
    periods: all,
    segments,
    continuous,
    segmentCount: segments.length,
    chainStart,
    chainEnd,
    totalDays,
    dayIndex,
    started,
    expired,
    remainingDays,
    currentPeriodId: current ? current.projectId : '',
    currentPeriod: current,
    periodCount: all.length,
    totalIncome: all.reduce((s, p) => s + num(p.paidTotal), 0),
    incomeByPeriod,
  }
}

// 把「项目对象 / periodOf 视图」统一展开成逐笔收费（订单）
function paymentRows(items) {
  return (Array.isArray(items) ? items : []).flatMap(item => {
    if (!item) return []
    const pays = Array.isArray(item.payments) ? item.payments : paymentsOf(item)
    const fallbackDate = item.paidAt || (item.createdAt ? fmtDate(item.createdAt) : '')
    return pays.map(pay => ({
      projectId: String(item.projectId || item.id || ''),
      fee: num(pay.amount),
      paidAt: pay.paidAt || fallbackDate,
    }))
  })
}

// 按月份统计收入：**逐笔收费（订单）**归月，每笔独立
// month: 'YYYY-MM'，省略则统计全部
export function sumIncome(items, { month } = {}) {
  const rows = paymentRows(items)
  const filtered = month ? rows.filter(r => String(r.paidAt).startsWith(month)) : rows
  return {
    month: month || '',
    total: filtered.reduce((s, r) => s + r.fee, 0),
    count: filtered.length,
    items: filtered.map(r => ({ projectId: r.projectId, fee: r.fee, paidAt: r.paidAt })),
  }
}

// 逐月收入表（用于工作日记/统计）：按每笔收费的归属日期归月
export function incomeByMonth(items) {
  const map = new Map()
  paymentRows(items).forEach(r => {
    const m = String(r.paidAt || '').slice(0, 7)
    if (!m) return
    if (!map.has(m)) map.set(m, { month: m, total: 0, count: 0 })
    const row = map.get(m)
    row.total += r.fee
    row.count += 1
  })
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

// ── 迁移辅助：按 prevTaskId 追溯链条根，为旧记录补齐 hostingChainId ──
// 幂等：已有 hostingChainId 的记录原样返回
export function assignChainIds(records) {
  const list = Array.isArray(records) ? records : []
  const byId = new Map(list.map(r => [String(r.id), r]))
  const memo = new Map()

  function rootId(record) {
    const key = String(record.id)
    if (memo.has(key)) return memo.get(key)
    const seen = new Set([key])
    let cur = record
    while (cur && cur.prevTaskId && byId.has(String(cur.prevTaskId)) && !seen.has(String(cur.prevTaskId))) {
      const next = byId.get(String(cur.prevTaskId))
      seen.add(String(next.id))
      cur = next
    }
    const root = String(cur?.id || key)
    seen.forEach(id => memo.set(id, root))
    return root
  }

  let changed = 0
  const out = list.map(r => {
    if (!isHosting(r)) return r
    if (r.hostingChainId) return r
    const id = rootId(r)
    changed++
    return { ...r, hostingChainId: id }
  })
  return { records: out, changed }
}

// 追溯某条记录所属链条（不依赖已写入的 hostingChainId）
export function resolveChainId(record, allRecords) {
  if (!record) return ''
  if (record.hostingChainId) return String(record.hostingChainId)
  const byId = new Map((Array.isArray(allRecords) ? allRecords : []).map(r => [String(r.id), r]))
  const seen = new Set([String(record.id)])
  let cur = record
  while (cur && cur.prevTaskId && byId.has(String(cur.prevTaskId)) && !seen.has(String(cur.prevTaskId))) {
    const next = byId.get(String(cur.prevTaskId))
    seen.add(String(next.id))
    cur = next
  }
  return String(cur?.id || record.id)
}

// ═══════════════════════════════════════════════════════════════════
// 项目（单次 / 托管）领域模型 — 纯函数，不依赖 Vue / localStorage
//
// 关键职责划分（务必保持独立）：
//   项目生命周期状态  → project.state
//   每日代办状态      → task.status（代办层）
//   执行记录          → completion.result（事实层，独立保存）
//
// v1 → v2 迁移原则：
//   * 旧字段一律原位保留，只做「新增」，不删除、不改名、不改语义。
//   * 迁移幂等：已迁移的记录不会二次改写（schemaVersion 判定）。
//   * 无法确定的含义不猜测、不丢弃。
// ═══════════════════════════════════════════════════════════════════

import { fmtDate, addMonth, monthSpanDays, todayLocal, diffDays, isYmd, daysBetween, endDateFromDays } from '../utils/date.js'

export const PROJECT_SCHEMA_VERSION = 3

export const KIND = {
  ONE_OFF: 'oneoff',   // 单次项目
  HOSTING: 'hosting',  // 托管项目
}

// 项目生命周期状态（与代办状态、执行记录状态互不混用）
export const STATE = {
  SCHEDULED: 'scheduled', // 待开始（已创建、尚未生效，如续费项目）
  PENDING: 'pending',     // 待执行（单次项目待办）
  ACTIVE: 'active',       // 托管中
  PAUSED: 'paused',       // 暂停中
  EXPIRED: 'expired',     // 已到期
  COMPLETED: 'completed', // 已完成
  CANCELLED: 'cancelled', // 已取消
  ARCHIVED: 'archived',   // 已归档
}

export const STATE_LABEL = {
  [STATE.SCHEDULED]: '待开始',
  [STATE.PENDING]: '未完成',
  [STATE.ACTIVE]: '托管中',
  [STATE.PAUSED]: '暂停中',
  [STATE.EXPIRED]: '已到期',
  [STATE.COMPLETED]: '已完成',
  [STATE.CANCELLED]: '已取消',
  [STATE.ARCHIVED]: '已归档',
}

export const PLAN_MODE = {
  DAILY: 'daily',       // 每日执行
  WEEKLY: 'weekly',     // 每周指定日期执行
  CUSTOM: 'custom',     // 自定义执行计划（仅记录说明，不自动生成代办）
}

function num(v, d = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

function str(v, d = '') {
  return v == null ? d : String(v)
}

// ── v1 status ⇄ v2 kind / state ──
export function kindFromLegacy(status) {
  return num(status, 1) === 2 ? KIND.HOSTING : KIND.ONE_OFF
}

export function stateFromLegacy(raw) {
  if (raw.cancelledAt) return STATE.CANCELLED
  if (raw.archivedAt) return STATE.ARCHIVED
  if (raw.locked) return STATE.SCHEDULED
  const s = num(raw.status, 1)
  if (s === 0) return STATE.COMPLETED
  if (s === 2) return STATE.ACTIVE
  return STATE.PENDING
}

// ── 托管计划：由托管起止日期与执行计划推导「计划次数」 ──
// plan: { mode, weekdays: number[1-7], timesPerDay }
export function hostTimesPerWeek(plan) {
  if (!plan || plan.mode !== PLAN_MODE.WEEKLY) return 7
  const days = Array.isArray(plan.weekdays) ? plan.weekdays.map(Number).filter(d => d >= 1 && d <= 7) : []
  return days.length ? new Set(days).size : 0
}

// 按周期推导计划总次数（daily=每天 timesPerDay 次；weekly=每周若干天）
export function plannedTimesFor(plan, cycleDays) {
  const tpd = Math.max(1, num(plan?.timesPerDay, 1))
  const days = Math.max(1, num(cycleDays, 30))
  if (plan?.mode === PLAN_MODE.WEEKLY) {
    return Math.round(hostTimesPerWeek(plan) / 7 * days * tpd)
  }
  return Math.round(days * tpd)
}

// 是否为托管项目（兼容 v1：无 kind 时按 status===2 判定）
export function isHosting(p) {
  if (!p) return false
  return p.kind ? p.kind === KIND.HOSTING : num(p.status, 1) === 2
}

// 是否已完成（兼容 v1：status===0）
export function isCompleted(p) {
  if (!p) return false
  if (p.state) return p.state === STATE.COMPLETED
  return num(p.status, 1) === 0
}

// 是否已归档 / 已取消（这些不进入今日代办）
// 「归档」是独立标记（archivedAt），不覆盖已完成 / 已取消等业务状态
export function isArchived(p) {
  if (!p) return false
  return !!p.archivedAt || p.state === STATE.ARCHIVED
}

export function isCancelled(p) {
  if (!p) return false
  return !!p.cancelledAt || p.state === STATE.CANCELLED
}

export function isClosed(p) {
  return isArchived(p) || isCancelled(p)
}

// 托管是否已到期（派生判定，不改写存储状态）
export function isExpired(p, today = todayLocal()) {
  if (!isHosting(p)) return false
  const end = p.host?.endDate
  if (!isYmd(end)) return false
  if (isCompleted(p) || isClosed(p)) return false
  return diffDays(end, today) > 0
}

// 托管进度：{ planned, completed, remaining, dayIndex, totalDays }
export function hostProgress(p) {
  const host = p?.host || {}
  const cycleDays = num(host.cycleDays, 0)
    || (isYmd(host.startDate) && isYmd(host.endDate) ? daysBetween(host.startDate, host.endDate) : 0)
    || monthSpanDays(p?.createdAt) || 30
  const planned = num(host.plannedTimes, 0) || cycleDays
  const completed = num(host.completedTimes, 0)
  const start = isYmd(host.startDate) ? host.startDate : fmtDate(p?.createdAt)
  const today = todayLocal()
  const dayIndex = Math.max(1, Math.min(diffDays(start, today) + 1, cycleDays))
  return {
    planned,
    completed,
    remaining: Math.max(0, planned - completed),
    // v1 字段：remainingDays 保留为「剩余次数」的兼容视图
    legacyRemaining: p?.remainingDays,
    dayIndex,
    totalDays: cycleDays,
    startDate: start,
    endDate: isYmd(host.endDate) ? host.endDate : addMonth(start),
  }
}

function payId() {
  return 'pay-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function normalizePayment(raw, fallback = {}) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const amount = r.amount === '' || r.amount == null
    ? num(fallback.amount, 0)
    : num(r.amount, 0)
  return {
    id: str(r.id) || payId(),
    amount,
    paidAt: isYmd(r.paidAt) ? r.paidAt : (isYmd(fallback.paidAt) ? fallback.paidAt : ''),
    days: Math.max(0, Math.round(num(r.days, 0))),
    note: str(r.note),
    createdAt: str(r.createdAt) || str(fallback.createdAt),
  }
}

export function normalizePayments(list, fallback = {}) {
  return (Array.isArray(list) ? list : [])
    .filter(x => x && typeof x === 'object')
    .map(x => normalizePayment(x, fallback))
}

/**
 * 订单记录视图（只读）：
 *   · 项目自己的 payments 为准（规范化后返回，不改写原对象）
 *   · 老项目没有该字段 → 由项目自身派生**一条**（金额 / 收费日 / 周期天数），
 *     因此打开老项目不会凭空写入 payments 字段
 */
export function paymentsOf(p) {
  if (!p || !isHosting(p)) return []
  const own = Array.isArray(p.payments) ? p.payments.filter(x => x && typeof x === 'object') : []
  if (own.length) return normalizePayments(own)
  const host = p.host || {}
  const amount = p.actualFee !== '' && p.actualFee != null ? p.actualFee : (p.totalFee ?? '')
  return [normalizePayment({
    // 派生订单的 ID 稳定（同一项目每次读取一致）
    id: `${str(p.id)}-pay1`,
    amount,
    paidAt: isYmd(p.paidAt) ? p.paidAt : fmtDate(createdAtOf(p)),
    days: num(host.cycleDays, 0),
    note: '',
    createdAt: str(p.createdAt),
  })]
}

// 累计收费（各笔订单金额之和）
export function paidTotalOf(p) {
  return paymentsOf(p).reduce((s, x) => s + num(x.amount, 0), 0)
}

// ── 规范化（读时校正，不写回）──
export function normalizeProject(raw, { now = todayLocal() } = {}) {
  const p = { ...raw }
  p.id = str(p.id) || `p-${Math.random().toString(36).slice(2, 10)}`
  p.createdAt = p.createdAt || new Date().toISOString()

  p.kind = p.kind || kindFromLegacy(p.status)
  p.state = p.state || stateFromLegacy(p)
  p.schemaVersion = num(p.schemaVersion, PROJECT_SCHEMA_VERSION)
  // v1 兼容视图：status 与 state 保持同步（旧页面仍读 status）
  p.status = p.status == null ? legacyStatusOf(p) : num(p.status, 1)

  if (p.kind === KIND.HOSTING) {
    p.host = normalizeHost(p, now)
    // 连续托管关系 ID：由 createProject / renewProject / 迁移补全；
    // 为空时读取侧会按 prevTaskId 追溯（domain/hosting-chain.js resolveChainId）
    p.hostingChainId = str(p.hostingChainId)
    // 收费归属日期（收入统计依据，绝不使用项目结束日期）
    if (!isYmd(p.paidAt)) p.paidAt = fmtDate(createdAtOf(p))
    // 收费记录（订单）：只规范化已存在的数组，不凭空创建 —— 老项目保持「没有该字段」，
    // 由 paymentsOf() 读取侧派生，因此打开/查看不会给历史记录写入新字段。
    if (Array.isArray(p.payments)) p.payments = normalizePayments(p.payments)
  } else if (!isYmd(p.plannedDate)) {
    // 单次项目的计划执行日期（默认创建日），用于「今日到期待办」与延期
    p.plannedDate = fmtDate(createdAtOf(p))
  }
  p.gameName = str(p.gameName || p.game)
  return p
}

function createdAtOf(p) {
  try {
    const d = new Date(p.createdAt)
    return isNaN(d.getTime()) ? new Date() : d
  } catch {
    return new Date()
  }
}

function legacyStatusOf(p) {
  if (p.state === STATE.COMPLETED) return 0
  if (p.kind === KIND.HOSTING || p.state === STATE.ACTIVE) return 2
  return 1
}

function normalizeHost(p, now) {
  const prev = p.host && typeof p.host === 'object' ? p.host : {}
  const createdAt = p.createdAt
  const startDate = isYmd(prev.startDate) ? prev.startDate : fmtDate(createdAt)
  // 周期天数以「用户填的天数」为准；结束日是派生值（开始日 + 天数 − 1，含首尾）。
  // v1.0.42 的结束日按「+1 个月」算（9/10 → 10/10），比天数多一天，
  // 一改天数就会「退回」正确值，看起来像少了一天 —— 这里统一按天数校正结束日。
  const prevDays = Math.max(0, num(prev.cycleDays, 0) || 0)
  const rawEnd = isYmd(prev.endDate) ? prev.endDate : addMonth(startDate)
  const spanDays = Math.max(1, daysBetween(startDate, rawEnd))
  const cycleDays = prevDays || monthSpanDays(createdAt) || spanDays || 30
  const endDate = cycleDays !== spanDays ? endDateFromDays(startDate, cycleDays) : rawEnd
  const plan = {
    mode: prev.plan?.mode || PLAN_MODE.DAILY,
    weekdays: Array.isArray(prev.plan?.weekdays) ? prev.plan.weekdays.map(Number) : [],
    timesPerDay: Math.max(1, num(prev.plan?.timesPerDay, 1)),
  }
  // 计划次数：优先用已存值；否则由周期推导；再不行用旧 remainingDays 兜底
  const legacyRemaining = p.remainingDays === '' || p.remainingDays == null ? null : num(p.remainingDays)
  let plannedTimes = num(prev.plannedTimes, 0)
  if (!plannedTimes) {
    plannedTimes = legacyRemaining != null ? Math.max(cycleDays, legacyRemaining) : cycleDays
  }
  let completedTimes = num(prev.completedTimes, -1)
  if (completedTimes < 0) {
    completedTimes = legacyRemaining != null ? Math.max(0, plannedTimes - legacyRemaining) : 0
  }
  return {
    startDate,
    endDate,
    cycle: prev.cycle || 'month',
    cycleDays,
    plan,
    plannedTimes,
    completedTimes,
    skippedTimes: num(prev.skippedTimes, 0),
    abnormalTimes: num(prev.abnormalTimes, 0),
    cancelledTimes: num(prev.cancelledTimes, 0),
    // 显式延期（不执行）的日期清单
    skippedDates: Array.isArray(prev.skippedDates) ? prev.skippedDates.filter(isYmd) : [],
  }
}

// 批量规范化（保持顺序）
export function normalizeProjects(list, opts) {
  return (Array.isArray(list) ? list : []).filter(r => r && typeof r === 'object').map(r => normalizeProject(r, opts))
}

// 是否为「需要迁移」的记录
export function needsMigration(raw) {
  return num(raw?.schemaVersion, 1) < PROJECT_SCHEMA_VERSION
}

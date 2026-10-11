// ═══════════════════════════════════════════════════════════════════
// 执行记录（代肝记录）领域模型 — 纯函数，不依赖 Vue / localStorage
//
// 执行记录是「已经发生的事实」：
//   * 一旦生成即独立保存，不因项目修改、代办删除、续费而改变或消失。
//   * 所有展示字段都是生成时的快照（游戏名、服务内容、价格、账号）。
// ═══════════════════════════════════════════════════════════════════

import { todayLocal } from '../utils/date.js'
import { getDisplayName } from './mask.js'
import { isHosting } from './project.js'

export const COMPLETION_SCHEMA_VERSION = 2

// 执行结果
export const RESULT = {
  DONE: 'done',           // 已完成
  SKIPPED: 'skipped',     // 已跳过
  ABNORMAL: 'abnormal',   // 异常
  CANCELLED: 'cancelled', // 已取消
}

export const RESULT_LABEL = {
  [RESULT.DONE]: '已完成',
  [RESULT.SKIPPED]: '已跳过',
  [RESULT.ABNORMAL]: '异常',
  [RESULT.CANCELLED]: '已取消',
}

function str(v, d = '') {
  return v == null ? d : String(v)
}

// 生成 ID（沿用 v1 风格：时间戳 36 进制 + 随机后缀，保证与旧 ID 无冲突）
export function newId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// v1 记录（无 result / plannedDate）→ v2 视图；不修改原始存储
export function normalizeCompletion(raw) {
  const c = { ...raw }
  c.id = str(c.id) || newId('c')
  c.projectId = str(c.projectId || c.taskId)
  c.taskId = str(c.taskId || c.projectId)
  const d = str(c.date)
  c.plannedDate = str(c.plannedDate || d)
  c.completedDate = str(c.completedDate || d)
  c.result = c.result || (c.skipped ? RESULT.SKIPPED : RESULT.DONE)
  c.gameName = str(c.gameName || c.game)
  c.content = str(c.content)
  c.images = Array.isArray(c.images) ? c.images : []
  c.schemaVersion = Number(c.schemaVersion) || COMPLETION_SCHEMA_VERSION
  return c
}

export function normalizeCompletions(list) {
  return (Array.isArray(list) ? list : []).filter(r => r && typeof r === 'object').map(normalizeCompletion)
}

/**
 * 由项目快照生成一条执行记录（不做任何 I/O）。
 * project: 规范化后的项目对象
 * opts: { result, content, note, images, plannedDate, completedDate, time, gameKey, gameName, service }
 */
export function buildCompletion(project, opts = {}) {
  const p = project || {}
  const now = new Date()
  const completedDate = str(opts.completedDate) || todayLocal()
  const time = str(opts.time) || now.toTimeString().slice(0, 8)
  return {
    // ── 身份与关联 ──
    id: newId('c'),
    projectId: str(p.id),
    taskId: str(p.id),
    schemaVersion: COMPLETION_SCHEMA_VERSION,
    // ── 计划 / 实际 ──
    plannedDate: str(opts.plannedDate) || completedDate,
    completedDate,
    date: completedDate,   // v1 兼容字段
    time,
    // ── 托管归属快照（第二轮）：执行当时的周期与连续托管状态 ──
    // 这些字段是历史快照，后续续费/改期都不得改写它们
    hostingChainId: str(opts.hostingChainId || p.hostingChainId),
    periodStart: str(opts.periodStart || p.host?.startDate),
    periodEnd: str(opts.periodEnd || p.host?.endDate),
    chainStart: str(opts.chainStart),
    chainEnd: str(opts.chainEnd),
    chainDayIndex: opts.chainDayIndex == null ? null : Number(opts.chainDayIndex),
    chainRemainingDays: opts.chainRemainingDays == null ? null : Number(opts.chainRemainingDays),
    // ── 结果 ──
    result: opts.result || RESULT.DONE,
    content: str(opts.content),
    // ── 快照（生成时的真实值，后续改名/改价不影响）──
    gameKey: str(opts.gameKey || p.gameKey),
    gameName: str(opts.gameName || p.gameName || p.game),
    game: str(opts.gameName || p.gameName || p.game),
    service: str(opts.service != null ? opts.service : p.service),
    account: str(p.account),
    password: str(p.password),
    displayName: str(opts.displayName || p.displayName || getDisplayName(p)),
    wechatName: str(p.wechatName), qqName: str(p.qqName),
    bilibiliName: str(p.bilibiliName), xiaohongshuName: str(p.xiaohongshuName),
    douyinName: str(p.douyinName),
    preferredPlatform: str(p.preferredPlatform, 'wechat'),
    totalFee: p.totalFee ?? '', actualFee: p.actualFee ?? '', delayedFee: p.delayedFee ?? '',
    fee: p.actualFee || p.totalFee || '',
    price: p.actualFee || p.totalFee || '',
    // ── 其他 ──
    status: p.status ?? 1,
    wasHosting: opts.wasHosting != null ? !!opts.wasHosting : isHosting(p),
    note: str(opts.note != null ? opts.note : p.note),
    images: Array.isArray(opts.images) ? opts.images.slice() : [],
  }
}

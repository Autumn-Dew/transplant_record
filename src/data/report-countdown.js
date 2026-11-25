/**
 * 日报 · 倒计时的值（`tr-report-countdown`）
 *
 * 为什么单独存、而且按托管项目分：
 *   模板（tr-report-draft）是「有哪些行」的定义，同一个游戏的所有托管共用；
 *   但倒计时的数字是「这次托管的月卡还剩几天」，不同托管完全是两码事。
 *   所以值不进模板，按 taskId 各存一份。
 *
 * 结构：
 *   { [taskId]: { [行名]: { base: 7, date: '2026-11-25' } } }
 *
 *   base  填的那天的数字
 *   date  哪天填的
 *   显示值 = base −（今天 − date），减到 0 就停住
 *   用户改了数字 → base 换成新值、date 换成今天，第二天再从新值往下减
 */

import { readJSON, writeJSON } from './storage.js'

const KEY = 'tr-report-countdown'

export function readCountdownMap() {
  const raw = readJSON(KEY, null)
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

const NO_TASK = '__none'

export function readCountdowns(taskId) {
  const map = readCountdownMap()
  const own = map[taskId || NO_TASK]
  return own && typeof own === 'object' && !Array.isArray(own) ? own : {}
}

/** 写一条：base 为 null 表示清空 */
export function writeCountdown(taskId, label, base, date) {
  const map = readCountdownMap()
  if (!label) return map
  const key = taskId || NO_TASK
  const own = map[key] && typeof map[key] === 'object' ? map[key] : {}
  if (base == null) delete own[label]
  else own[label] = { base, date }
  if (Object.keys(own).length) map[key] = own
  else delete map[key]
  try { writeJSON(KEY, map) } catch { /* 存储失败不影响当前会话 */ }
  return map
}

/** 算今天的显示值；没填过返回 null */
export function countdownToday(rec, today) {
  if (!rec || rec.base == null) return null
  const base = Number(rec.base)
  if (!Number.isFinite(base)) return null
  const a = Date.parse(String(rec.date || '') + 'T00:00:00')
  const b = Date.parse(String(today || '') + 'T00:00:00')
  if (!Number.isFinite(a) || !Number.isFinite(b)) return base
  return Math.max(0, base - Math.floor((b - a) / 86400000))
}

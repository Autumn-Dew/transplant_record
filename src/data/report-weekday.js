// ═══════════════════════════════════════════════════════════════════
// 周几标记：日报工具栏右上角显示的「今天是周几」
//
//   每一周的一天都可以单独配一句提示（tip）和一个颜色，
//   例如「周一」= 例行结算，配蓝色；「周五」= 收尾对账，配橙色。
//   存储：tr-report-weekday   { [0..6]: { tip, color } }   0 = 周日
// ═══════════════════════════════════════════════════════════════════

import { KEYS, readJSON, writeJSON } from './storage.js'

export const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 展示顺序：周一到周日（0 是周日，放最后）
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function normalizeOne(raw) {
  const tip = String((raw && raw.tip) || '').trim().slice(0, 40)
  const color = HEX.test(String((raw && raw.color) || '')) ? String(raw.color) : ''
  return { tip, color }
}

/** 读取整份配置（永远返回 7 项，缺的填空） */
export function readWeekdayMarks() {
  let raw = null
  try { raw = readJSON(KEYS.REPORT_WEEKDAY, null) } catch { /* ignore */ }
  const out = {}
  for (let i = 0; i < 7; i++) out[i] = normalizeOne(raw && typeof raw === 'object' ? raw[i] : null)
  return out
}

/** 写回整份配置，返回规整后的结果 */
export function writeWeekdayMarks(marks) {
  const out = {}
  for (let i = 0; i < 7; i++) out[i] = normalizeOne(marks && marks[i])
  try { writeJSON(KEYS.REPORT_WEEKDAY, out) } catch { /* 存储失败不影响当前会话 */ }
  return out
}

/** 今天的星期下标（0 = 周日） */
export function todayWeekday(date = new Date()) {
  return date.getDay()
}

/** 今天的日期文本：2026-11-03 */
export function todayDateText(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

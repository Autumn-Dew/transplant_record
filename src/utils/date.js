// 日期工具：按「创建日 + 1 个月」的托管周期

function pad(n) { return String(n).padStart(2, '0') }

// 任意输入 → 本地 Date（yyyy-MM-dd 或 ISO 均可）
// 关键：纯日期按本地解析；带时间的 ISO 先解析为时刻再取本地日期，
//       绝不能直接截取 UTC 字符串前 10 位（会跨时区差一天）。
export function toDate(input) {
  if (!input) return null
  if (input instanceof Date) return isNaN(input) ? null : input
  const s = String(input)
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return null
}

// Date → yyyy-MM-dd
export function fmtDate(input) {
  const d = toDate(input)
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 加 1 个月（月末天数不足则回退到上月末，如 1/31 → 2/28）
export function addMonth(input) {
  const d = toDate(input)
  if (!d) return ''
  const day = d.getDate()
  const t = new Date(d.getFullYear(), d.getMonth(), day)
  t.setMonth(t.getMonth() + 1)
  if (t.getDate() !== day) t.setDate(0)
  return fmtDate(t)
}

// 周期天数：创建日 ~ 创建日 + 1 个月
// 例：9/15 → 10/15 = 30 天；10/15 → 11/15 = 31 天
export function monthSpanDays(input) {
  const d = toDate(input)
  if (!d) return 30
  const day = d.getDate()
  const end = new Date(d.getFullYear(), d.getMonth(), day)
  end.setMonth(end.getMonth() + 1)
  if (end.getDate() !== day) end.setDate(0)
  return Math.round((end - d) / 86400000)
}

// ── 以下为重构新增：所有日期一律使用「本地日期」，避免 UTC 偏移 ──

// 是否为合法 yyyy-MM-dd
export function isYmd(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))
}

// 本地今天 yyyy-MM-dd
export function todayLocal(base) {
  return fmtDate(base instanceof Date ? base : new Date())
}

// 加 n 天（n 可为负）
export function addDays(input, n) {
  const d = toDate(input)
  if (!d) return ''
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + Number(n || 0))
  return fmtDate(t)
}

// to - from 的天数差（本地日期，同一天为 0）
export function diffDays(from, to) {
  const a = toDate(from)
  const b = toDate(to)
  if (!a || !b) return 0
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((b0 - a0) / 86400000)
}

// 今天相对创建日的第几天（1 起，clamp 到 [1, span]）
export function dayIndex(input, span) {
  const d = toDate(input)
  if (!d) return 1
  const today = new Date()
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const idx = Math.round((t0 - d) / 86400000) + 1
  const max = span || monthSpanDays(input)
  return Math.max(1, Math.min(idx, max))
}

// ── 托管天数：统一为「含首尾」（开始日与结束日各算一天）──
// 例：10/01 → 10/20 = 20 天（旧代码用 diffDays 得 19 天，少一天）
export function daysBetween(start, end) {
  const n = diffDays(start, end)
  return n >= 0 ? n + 1 : 0
}

// 由「开始日 + 托管天数」推结束日（含首尾）
// 例：10/01 + 20 天 = 10/20
export function endDateFromDays(start, days) {
  const n = Math.max(1, Math.round(Number(days) || 0))
  return addDays(start, n - 1)
}

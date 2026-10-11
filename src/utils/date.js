// 日期工具：按「创建日 + 1 个月」的托管周期

function pad(n) { return String(n).padStart(2, '0') }

// 任意输入 → 本地 Date（yyyy-MM-dd 或 ISO 均可）
export function toDate(input) {
  if (!input) return null
  if (input instanceof Date) return isNaN(input) ? null : input
  const s = String(input)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
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

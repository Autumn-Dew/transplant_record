// ═══════════════════════════════════════════════════════════════════
// 托管进度：百分比 + 八档配色 + 10 格刻度
//   「代肝代办」列表与「每日汇报」画布共用这一份计算，避免两处各写一套后跑偏。
// ═══════════════════════════════════════════════════════════════════

/** 从「刚起步」到「已做完」的色阶（越高越暖，接近收尾就警示） */
export const PROGRESS_SCALE = [
  { min: 100, color: '#b8322d' },      // 已做完
  { min: 90, color: '#d9534f' },       // 快结束，该续费/收尾
  { min: 80, color: '#e3763a' },       // 收尾中
  { min: 70, color: '#e8a33d' },       // 即将结束
  { min: 55, color: '#c9a93a' },       // 后半程
  { min: 40, color: '#8fae3f' },       // 过半
  { min: 20, color: '#3c9d6e' },       // 推进中
  { min: 0, color: 'var(--accent)' },  // 刚起步
]

export const SEGMENT_TOTAL = 10

/** 完成百分比（0–100 整数） */
export function percentOf(completed, planned) {
  const c = Number(completed) || 0
  const p = Number(planned) || 0
  if (p <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((c / p) * 100)))
}

/** 按百分比取颜色 */
export function progressColorByPercent(pct) {
  const hit = PROGRESS_SCALE.find(s => pct >= s.min)
  return hit ? hit.color : PROGRESS_SCALE[PROGRESS_SCALE.length - 1].color
}

/** 点亮几格（有进度至少 1 格，避免小数值看着像没开始） */
export function segmentsByPercent(pct, total = SEGMENT_TOTAL) {
  if (pct <= 0) return 0
  return Math.max(1, Math.ceil((pct / 100) * total))
}

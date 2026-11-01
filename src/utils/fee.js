// ═══════════════════════════════════════════════════════════════════
// 列表竖线配色（代肝代办 / 代肝记录共用）
//
// 每行左侧竖线分上下两段：
//   上段 = 类型色（托管 / 单次 / 灰显）
//   下段 = 金额色（≥100 红 / 50~99 黄 / 1~49 绿 / 无 灰）
//
// 这两套阀值原来在两个页面各写一份，改一处就会两个页面不一致，因此收敛到这里。
// ═══════════════════════════════════════════════════════════════════

export const TYPE_COLOR = {
  hosting: '#FF6D00',   // 托管：亮橙
  oneoff: '#00B0FF',    // 单次：亮蓝
  muted: '#9E9E9E',     // 待激活 / 今日已确认：灰
}

export const FEE_COLOR = {
  high: '#FF1744',      // ≥ 100
  mid: '#FFEA00',       // 50 ~ 99
  low: '#00E676',       // 1 ~ 49
  none: '#BDBDBD',      // 0 / 无金额
}

export const FEE_THRESHOLDS = { high: 100, mid: 50, low: 0 }

/** 金额 → 竖线下段颜色（非法 / 空值按 0 处理） */
export function feeColor(amount) {
  const fee = Number(amount) || 0
  if (fee >= FEE_THRESHOLDS.high) return FEE_COLOR.high
  if (fee >= FEE_THRESHOLDS.mid) return FEE_COLOR.mid
  if (fee > FEE_THRESHOLDS.low) return FEE_COLOR.low
  return FEE_COLOR.none
}

/** 类型 → 竖线上段颜色；muted 用于「待激活 / 今日已确认」这类灰显行 */
export function typeColor(isHosting, { muted = false } = {}) {
  if (muted) return TYPE_COLOR.muted
  return isHosting ? TYPE_COLOR.hosting : TYPE_COLOR.oneoff
}

/** 一行的完整竖线样式（上下段颜色 + 入场延迟） */
export function rowBarStyle({ isHosting, muted = false, amount, delayStyle } = {}) {
  const top = typeColor(isHosting, { muted })
  return {
    ...(delayStyle || {}),
    '--bar-top': top,
    '--bar-bottom': feeColor(amount) || top,
  }
}

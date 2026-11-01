// ═══════════════════════════════════════════════════════════════════
// 价格一览的画布外观（原版 / 终末地风格）
//
// 与「每日汇报主题」「应用主题」三方各自独立：
//   * 只写 `tr-price-theme` 这一个键，绝不碰业务数据 `tr-prices`；
//   * 未知值一律回落到 `classic`（原版），不存在「无外观」状态。
// ═══════════════════════════════════════════════════════════════════

import { KEYS, readJSON, writeJSON } from './storage.js'

export const PRICE_THEMES = ['classic', 'endfield']
export const PRICE_THEME_LABEL = { classic: '原版', endfield: '终末地风格' }

export function normalizePriceTheme(v) {
  const raw = String(v == null ? '' : v).replace(/^"|"$/g, '').trim()
  return PRICE_THEMES.includes(raw) ? raw : 'classic'
}

/** 读取当前外观（缺省 / 非法值 → classic） */
export function readPriceTheme() {
  return normalizePriceTheme(readJSON(KEYS.PRICE_THEME, null))
}

/** 写入外观并返回规范化后的值（存储失败不影响当前会话） */
export function writePriceTheme(id) {
  const next = normalizePriceTheme(id)
  writeJSON(KEYS.PRICE_THEME, next)
  return next
}

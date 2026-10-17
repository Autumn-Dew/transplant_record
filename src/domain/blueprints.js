// ═══════════════════════════════════════════════════════════════════
// 蓝图记录的纯逻辑：字号配置 + 「以已有蓝图为基础」生成独立副本
//
//   * 纯函数，不依赖 Vue / localStorage，可直接单测。
//   * 字号是**记录级**字段（fontSize），不涉及分组数据结构：
//     blueprintGroups 仍为纯字符串数组，本次未改动。
//   * 兼容性：读取时对缺失/非法字号给默认值，**不回写**历史记录；
//     蓝图仓库的 normalize 只补 id、其余字段原样保留，因此新增 fontSize
//     与既有数据天然兼容，未知字段也不会丢失。
// ═══════════════════════════════════════════════════════════════════

export const FONT_SIZE_MIN = 8
export const FONT_SIZE_MAX = 48
/** 与蓝图列表 CSS 的 .bp-col 字号一致 —— 未设置字号的记录外观与改动前完全相同 */
export const DEFAULT_FONT_SIZE = 12
/** 常用字号快捷选项 */
export const FONT_SIZE_PRESETS = [11, 12, 13, 14, 16, 18, 20]

// 蓝图记录的可复制字段（内容 + 配置）
// 蓝图记录的字段清单（复制 / 展示以这里为准；未知字段同样会被保留）
export const BLUEPRINT_FIELDS = ['group', 'code', 'name', 'land', 'products', 'source', 'note', 'color', 'fontSize']

/**
 * 把任意输入规范成合法字号。
 * 空值 / 非数字 → 默认字号；越界 → 夹紧到 [8, 48]；小数 → 取整。
 */
export function normalizeFontSize(v, fallback = DEFAULT_FONT_SIZE) {
  if (v === '' || v === null || v === undefined) return fallback
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return fallback   // 非正数字号无意义 → 用默认值
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(n)))
}

/** 读取记录的字号（未设置 → 默认字号）；纯读取，不修改记录 */
export function fontSizeOf(record) {
  return normalizeFontSize(record?.fontSize)
}

/** 用户输入是否为可用的字号（用于界面提示，不抛错） */
export function isValidFontSize(v) {
  if (v === '' || v === null || v === undefined) return true // 空 = 用默认
  const n = Number(v)
  return Number.isFinite(n) && n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX
}

// #RGB / #RRGGBB（# 可省略，大小写均可）
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** 是否为合法 HEX 颜色（空字符串视为「未设置」，也算合法） */
export function isValidHex(v) {
  const s = String(v ?? '').trim()
  if (!s) return true
  return HEX_RE.test(s)
}

/** 规范化 HEX：去空格、补 #、非法值原样返回（由界面提示，不静默丢弃） */
export function normalizeHex(v) {
  const s = String(v ?? '').trim()
  if (!s) return ''
  if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(s)) return '#' + s
  return s
}

/**
 * 复制一条蓝图记录的内容与配置（深拷贝，去掉 id）。
 * 深拷贝保证副本与原记录**完全独立**：任意一方后续修改都不会影响另一方。
 */
export function blueprintCopy(record) {
  let base
  try { base = JSON.parse(JSON.stringify(record || {})) } catch { base = { ...(record || {}) } }
  const copy = { ...base }
  delete copy.id
  return copy
}

/** 生成新蓝图 ID（与项目内既有风格一致：时间戳 36 进制 + 随机后缀） */
export function newBlueprintId() {
  return 'bp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/**
 * 以已有蓝图为基础生成**完全独立**的新蓝图记录。
 * 复制：分组、字段、内容、颜色配置、字号配置，以及记录上的其它自定义字段。
 * 不复制：id（新生成）。
 */
export function duplicateBlueprint(record, { id } = {}) {
  return { ...blueprintCopy(record), id: id || newBlueprintId() }
}

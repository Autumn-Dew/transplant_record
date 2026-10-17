import { KEYS, readJSON, writeJSON } from './storage.js'

/* ══════════════════════════════════════════════════════════════════
   每日汇报 · 主题（内容皮肤）预设

   ── 与背景彻底解耦 ──
   背景只负责画布底层（底色 + 图案 + 导出兜底色），
   主题只负责「已有内容元素」的视觉表现：
     标题行 / 托管信息栏 / 卡片标题 / 任务行 / 单选 / 输入框 / 图片边框。
   两者可任意组合：任意主题 × 任意背景都成立，互不改写对方。
   持久化也是两个独立键：主题写自己的汇报主题键，背景写自己的背景键
   （两个键都在 storage.js 的 KEYS 里登记，互不读写）。

   ── 唯一的硬约束：不改布局 ──
   所有主题只用「颜色 / 背景 / 边框色 / 内嵌阴影 / 字重 / 小字距 /
   不占布局的伪元素」表达差异，绝不设置 padding / margin / 宽高 /
   font-size / display / flex / grid，因此：
     · 文本不会因为换主题而重新换行
     · 画布尺寸、列数、控件位置与导出尺寸都不变

   ── 三个系列，七种预设 ──
     classic    经典简报        —— 白底细框，克制、正式、通用
     lone-star  科研档案 / 航天制图 / 工业仪器
     p3r        斜切海报 / 月相编辑 / 都市拼贴
   同系列内的差异靠「结构语言」区分（厚重铭牌 / 轻量线稿 / 实体面板），
   不是只换颜色。

   每套主题：
     id      稳定唯一 ID，同时作为画布类名 rp-theme-<id>
     label   显示名称
     family  风格系列（classic | lone-star | p3r），仅用于分组展示
     hint    一句话说明设计侧重（选择器里展示）
   ══════════════════════════════════════════════════════════════════ */

const CLASSIC = {
  id: 'classic',
  label: '经典简报',
  family: 'classic',
  hint: '白底细框 · 正式通用',
}

const LONE_STAR_THEMES = [
  {
    id: 'ls-archive',
    label: '科研档案',
    family: 'lone-star',
    hint: '暖白纸面 · 深蓝铭牌 · 档案装帧',
  },
  {
    id: 'ls-drafting',
    label: '航天制图',
    family: 'lone-star',
    hint: '冷白图纸 · 坐标基准线 · 轻量线稿',
  },
  {
    id: 'ls-gauge',
    label: '工业仪器',
    family: 'lone-star',
    hint: '实体面板 · 状态铭牌 · 粗细分明',
  },
]

const P3R_THEMES = [
  {
    id: 'p3r-poster',
    label: '斜切海报',
    family: 'p3r',
    hint: '整宽斜切色带 · 明黄收口 · 高对比',
  },
  {
    id: 'p3r-lunar',
    label: '月相编辑',
    family: 'p3r',
    hint: '冷白留白 · 月相轨迹 · 克制编辑感',
  },
  {
    id: 'p3r-tiles',
    label: '都市拼贴',
    family: 'p3r',
    hint: '错位矩形 · 模块拼贴 · 局部反色',
  },
]

export const REPORT_THEMES = [CLASSIC, ...LONE_STAR_THEMES, ...P3R_THEMES]

/* 选择器按「经典 / 孤星风格 / P3R 风格」分组展示 */
export const REPORT_THEME_GROUPS = [
  { id: 'classic', label: '经典', items: [CLASSIC] },
  { id: 'lone-star', label: '孤星风格', items: LONE_STAR_THEMES },
  { id: 'p3r', label: 'P3R 风格', items: P3R_THEMES },
]

export const DEFAULT_REPORT_THEME = CLASSIC.id
export const REPORT_THEME_IDS = REPORT_THEMES.map(t => t.id)

/* 老用户没有主题记录时回落到经典简报；未知值也回落，不留「无主题」状态 */
export function normalizeReportThemeId(value) {
  const raw = String(value == null ? '' : value).trim()
  return REPORT_THEME_IDS.includes(raw) ? raw : DEFAULT_REPORT_THEME
}

export function findReportTheme(id) {
  const key = normalizeReportThemeId(id)
  return REPORT_THEMES.find(t => t.id === key) || REPORT_THEMES[0]
}

/* ── 持久化（独立键，不读写背景键，也不读写应用主题键）── */
export function readReportTheme() {
  try { return normalizeReportThemeId(readJSON(KEYS.REPORT_THEME, null)) } catch { return DEFAULT_REPORT_THEME }
}

export function writeReportTheme(id) {
  const key = normalizeReportThemeId(id)
  try { writeJSON(KEYS.REPORT_THEME, key) } catch { /* 存储失败不影响当前会话 */ }
  return key
}

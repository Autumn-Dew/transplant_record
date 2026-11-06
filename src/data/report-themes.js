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

   ── 五个系列，每族 8 套（经典 1 套），共 33 套 ──
     classic    经典简报
     lone-star  孤星：科研档案 / 航天制图 / 工业仪器 / 规格卡 / 值班日志 /
                电路图 / 货运单 / 终端（暗）
     p3r        斜切海报 / 月相编辑 / 都市拼贴 / 斜切分割 / 夜间霓虹（暗）/
                索引页 / 传单 / 档案袋
     endfield   台账 / 夜班（暗）/ 工单 / 舱单 / 终端（暗）/ 检查表 /
                批次卡 / 结算单
     swiss      网格版式 / 索引版式（暗）/ 田字格 / 分栏 / 海报 / 表格 /
                黑白摄影 / 反白（暗）
   同系列内的差异靠「结构语言」区分（铭牌 / 线稿 / 面板 / 编号栏 / 条带），
   不是只换颜色。

   每套主题：
     id      稳定唯一 ID，同时作为画布类名 rp-theme-<id>
     label   显示名称
     family  风格系列（classic | lone-star | p3r | endfield | swiss | stijl），仅用于分组展示
     tone    明暗倾向：light = 深色字配浅底；dark = 浅墨字，画布要用深色背景
             选择器里按它标出「浅色 / 暗色」，避免把暗色主题配到白底上
     hint    一句话说明设计侧重（选择器里展示）
   ══════════════════════════════════════════════════════════════════ */

const CLASSIC = {
  id: 'classic',
  label: '经典简报',
  family: 'classic',
  tone: 'light',
  hint: '白底细框 · 正式通用',
}

const LONE_STAR_THEMES = [
  { id: 'ls-archive', label: '科研档案', family: 'lone-star', tone: 'light', hint: '暖白纸面 · 深蓝铭牌 · 档案装帧' },
  { id: 'ls-drafting', label: '航天制图', family: 'lone-star', tone: 'light', hint: '冷白图纸 · 坐标基准线 · 轻量线稿' },
  { id: 'ls-gauge', label: '工业仪器', family: 'lone-star', tone: 'light', hint: '实体面板 · 状态铭牌 · 粗细分明' },
  { id: 'ls-spec', label: '规格卡', family: 'lone-star', tone: 'light', hint: '器材规格框 · 橙色校验章 · 双层边界' },
  { id: 'ls-log', label: '值班日志', family: 'lone-star', tone: 'light', hint: '深蓝值班栏 · 橙色时间标 · 横线记录' },
  { id: 'ls-schematic', label: '电路图', family: 'lone-star', tone: 'light', hint: '蓝图节点 · 虚线回路 · 坐标标记' },
  { id: 'ls-manifest', label: '货运单', family: 'lone-star', tone: 'light', hint: '单证表头 · 装运条码 · 实线分项' },
  { id: 'ls-terminal', label: '深空终端', family: 'lone-star', tone: 'dark', hint: '自带深蓝承载面 · 琥珀状态灯 · 扫描行' },
]

const P3R_THEMES = [
  { id: 'p3r-poster', label: '斜切海报', family: 'p3r', tone: 'light', hint: '整宽斜切色带 · 明黄收口 · 高对比' },
  { id: 'p3r-lunar', label: '月相编辑', family: 'p3r', tone: 'light', hint: '冷白留白 · 月相轨迹 · 克制编辑感' },
  { id: 'p3r-tiles', label: '都市拼贴', family: 'p3r', tone: 'light', hint: '错位矩形 · 模块拼贴 · 局部反色' },
  { id: 'p3r-cut', label: '夜间数据', family: 'p3r', tone: 'dark', hint: '深海军蓝承载面 · 青色数据刻度 · 琥珀只标关键数字' },
]

/* ── 终末地风格：工业工作台（依据 endfield-ui skill 的六条不变量）── */
const ENDFIELD_THEMES = [
  { id: 'ef-ledger', label: '台账', family: 'endfield', tone: 'light', hint: '纸白承载面 · 墨色信息栏 · lime 只做标记' },
  { id: 'ef-nightshift', label: '夜班', family: 'endfield', tone: 'dark', hint: '石墨黑面板 · 浅墨文字 · lime 收口' },
  { id: 'ef-workorder', label: '工单', family: 'endfield', tone: 'light', hint: '白纸表格 · 墨色实线 · 编号栏' },
  { id: 'ef-manifest', label: '运输舱单', family: 'endfield', tone: 'light', hint: '黑色舱单铭牌 · 三色校验条 · 编号分项' },
  { id: 'ef-coldstore', label: '冷库', family: 'endfield', tone: 'light', hint: '冷灰白面板 · 冰蓝标记 · 细格分区' },
  { id: 'ef-hatch', label: '工地', family: 'endfield', tone: 'light', hint: '暖米纸面 · 琥珀标记 · 斜纹底' },
  { id: 'ef-contour', label: '等高线', family: 'endfield', tone: 'light', hint: '中性纸 · 明黄标记 · 双角度细线' },
  { id: 'ef-console', label: '终端', family: 'endfield', tone: 'dark', hint: '墨黑面板 · lime 扫描线 · 等宽数字' },
]

/* ── 瑞士风格：国际主义平面设计（只有墨 / 米白 / 红，全部平涂）── */
const SWISS_THEMES = [
  { id: 'swiss-rule', label: '网格版式', family: 'swiss', tone: 'light', hint: '米白纸面 · 12 栏细线 · 红色编号' },
  { id: 'swiss-index', label: '索引版式', family: 'swiss', tone: 'dark', hint: '墨底米白 · 大号编号 · 不对称留白' },
  { id: 'swiss-field', label: '田字格', family: 'swiss', tone: 'light', hint: '四象限细线 · 居中留白 · 极简分隔' },
  { id: 'swiss-column', label: '分栏', family: 'swiss', tone: 'light', hint: '两栏文本 · 顶部大编号 · 栏间细线' },
]


/* ── 风格派：新造型主义（粗黑线切格 / 三原色平涂 / 不对称构图）── */
const STIJL_THEMES = [
  { id: 'st-grid', label: '粗格', family: 'stijl', tone: 'light', hint: '四格粗黑线 · 右上红块 · 大面积米白' },
  { id: 'st-block', label: '色块', family: 'stijl', tone: 'light', hint: '大黄块 · 红小方 · 空白承载文字' },
  { id: 'st-rule', label: '粗线', family: 'stijl', tone: 'light', hint: '上下两条粗线 · 左缘蓝条 · 极简分栏' },
  { id: 'st-corner', label: '角块', family: 'stijl', tone: 'light', hint: '左上红角 · 右下黄角 · 黑细框' },
  { id: 'st-band', label: '横带', family: 'stijl', tone: 'light', hint: '整宽黄带 · 红短线收口' },
  { id: 'st-column', label: '竖栏', family: 'stijl', tone: 'light', hint: '右侧蓝栏 · 竖粗线 · 编号左对齐' },
  { id: 'st-letter', label: '方块字母', family: 'stijl', tone: 'light', hint: '标题方块字母 · 三色小方块 · 黑底线' },
  { id: 'st-inverse', label: '反白格', family: 'stijl', tone: 'dark', hint: '黑底米白格 · 红黄蓝三色平涂' },
]

/* 一条平铺列表：不再按风格系列分组，选择器里从头到尾只有一条。
   经典简报不在这条列表里 —— 它是「经典外观」按钮的预设（见下方
   CLASSIC_REPORT_THEME），按钮一按就把主题与背景一起恢复成经典。 */
export const REPORT_THEMES = [...P3R_THEMES, ...ENDFIELD_THEMES, ...SWISS_THEMES]

export const CLASSIC_REPORT_THEME = CLASSIC
export const DEFAULT_REPORT_THEME = CLASSIC.id
/* ids 仍包含经典：老用户存的就是 'classic'，回落逻辑不能把它当非法值 */
export const REPORT_THEME_IDS = [CLASSIC.id, ...REPORT_THEMES.map(t => t.id)]

/* 老用户没有主题记录时回落到经典简报；未知值也回落，不留「无主题」状态 */
export function normalizeReportThemeId(value) {
  const raw = String(value == null ? '' : value).trim()
  return REPORT_THEME_IDS.includes(raw) ? raw : DEFAULT_REPORT_THEME
}

export function findReportTheme(id) {
  const key = normalizeReportThemeId(id)
  return [CLASSIC, ...REPORT_THEMES].find(t => t.id === key) || CLASSIC
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

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
  { id: 'ls-spec', label: '规格卡', family: 'lone-star', tone: 'light', hint: '双层细框 · 右上编号块 · 参数对齐' },
  { id: 'ls-log', label: '值班日志', family: 'lone-star', tone: 'light', hint: '横向条带 · 左缘时间列 · 逐条记录' },
  { id: 'ls-schematic', label: '电路图', family: 'lone-star', tone: 'light', hint: '路径节点 · 虚线连接 · 图纸网格感' },
  { id: 'ls-manifest', label: '货运单', family: 'lone-star', tone: 'light', hint: '表格横线 · 重量列 · 单证压印' },
  { id: 'ls-terminal', label: '终端', family: 'lone-star', tone: 'dark', hint: '深蓝底 · 冷白字 · 扫描线与状态灯' },
]

const P3R_THEMES = [
  { id: 'p3r-poster', label: '斜切海报', family: 'p3r', tone: 'light', hint: '整宽斜切色带 · 明黄收口 · 高对比' },
  { id: 'p3r-lunar', label: '月相编辑', family: 'p3r', tone: 'light', hint: '冷白留白 · 月相轨迹 · 克制编辑感' },
  { id: 'p3r-tiles', label: '都市拼贴', family: 'p3r', tone: 'light', hint: '错位矩形 · 模块拼贴 · 局部反色' },
  { id: 'p3r-cut', label: '斜切分割', family: 'p3r', tone: 'light', hint: '对角分割 · 上下两色 · 硬边收口' },
  { id: 'p3r-night', label: '夜间霓虹', family: 'p3r', tone: 'dark', hint: '深蓝底 · 霓虹边线 · 高饱和强调' },
  { id: 'p3r-index', label: '索引页', family: 'p3r', tone: 'light', hint: '右侧索引条 · 编号列 · 目录感' },
  { id: 'p3r-flyer', label: '传单', family: 'p3r', tone: 'light', hint: '大标题压顶 · 底部信息带 · 快讯排版' },
  { id: 'p3r-archive', label: '档案袋', family: 'p3r', tone: 'light', hint: '标签条 · 装订孔 · 牛皮纸色' },
]

/* ── 终末地风格：工业工作台（依据 endfield-ui skill 的六条不变量）── */
const ENDFIELD_THEMES = [
  { id: 'ef-ledger', label: '台账', family: 'endfield', tone: 'light', hint: '纸白承载面 · 墨色信息栏 · lime 只做标记' },
  { id: 'ef-nightshift', label: '夜班', family: 'endfield', tone: 'dark', hint: '石墨黑面板 · 浅墨文字 · lime 收口' },
  { id: 'ef-workorder', label: '工单', family: 'endfield', tone: 'light', hint: '白纸表格 · 墨色实线 · 编号栏' },
  { id: 'ef-manifest', label: '舱单', family: 'endfield', tone: 'light', hint: '表头铭牌 · 三色条 · 编号前缀' },
  { id: 'ef-terminal', label: '终端', family: 'endfield', tone: 'dark', hint: '墨底 · lime 边框 · 光标式强调' },
  { id: 'ef-checklist', label: '检查表', family: 'endfield', tone: 'light', hint: '方框勾选 · 细分隔线 · 逐项核验' },
  { id: 'ef-batch', label: '批次卡', family: 'endfield', tone: 'light', hint: '大号批次号 · 状态条 · 批次分组' },
  { id: 'ef-invoice', label: '结算单', family: 'endfield', tone: 'light', hint: '金额右对齐 · 双线收口 · 合计行' },
]

/* ── 瑞士风格：国际主义平面设计（只有墨 / 米白 / 红，全部平涂）── */
const SWISS_THEMES = [
  { id: 'swiss-rule', label: '网格版式', family: 'swiss', tone: 'light', hint: '米白纸面 · 12 栏细线 · 红色编号' },
  { id: 'swiss-index', label: '索引版式', family: 'swiss', tone: 'dark', hint: '墨底米白 · 大号编号 · 不对称留白' },
  { id: 'swiss-field', label: '田字格', family: 'swiss', tone: 'light', hint: '四象限细线 · 居中留白 · 极简分隔' },
  { id: 'swiss-column', label: '分栏', family: 'swiss', tone: 'light', hint: '两栏文本 · 顶部大编号 · 栏间细线' },
  { id: 'swiss-poster', label: '海报', family: 'swiss', tone: 'light', hint: '红色块 · 超大留白 · 单点强调' },
  { id: 'swiss-table', label: '表格', family: 'swiss', tone: 'light', hint: '横线分行 · 数字右对齐 · 无竖线' },
  { id: 'swiss-mono', label: '黑白摄影', family: 'swiss', tone: 'light', hint: '灰度块 · 图注小字 · 大幅留白' },
  { id: 'swiss-inverse', label: '反白', family: 'swiss', tone: 'dark', hint: '墨底米白 · 红色细线 · 反白排版' },
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

export const REPORT_THEMES = [CLASSIC, ...LONE_STAR_THEMES, ...P3R_THEMES, ...ENDFIELD_THEMES, ...SWISS_THEMES, ...STIJL_THEMES]

/* 选择器按「经典 / 孤星风格 / P3R 风格 / 终末地风格 / 瑞士风格」分组展示 */
export const REPORT_THEME_GROUPS = [
  { id: 'classic', label: '经典', items: [CLASSIC] },
  { id: 'lone-star', label: '孤星风格', items: LONE_STAR_THEMES },
  { id: 'p3r', label: 'P3R 风格', items: P3R_THEMES },
  { id: 'endfield', label: '终末地风格', items: ENDFIELD_THEMES },
  { id: 'swiss', label: '瑞士风格', items: SWISS_THEMES },
  { id: 'stijl', label: '风格派', items: STIJL_THEMES },
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

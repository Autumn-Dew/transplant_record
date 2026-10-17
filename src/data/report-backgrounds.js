import { KEYS, readJSON, writeJSON } from './storage.js'

/* ══════════════════════════════════════════════════════════════════
   每日汇报 · 背景（画布底层）

   ── 背景只负责「画布底层」──
   底色 + 图案（档头 / 网格 / 轨道 / 刻度 / 斜切块 / 矩形分区）+ 导出兜底色。
   标题、卡片、信息栏、任务行等**内容组件的样式由主题（report-themes.js）
   单独决定**，两者互不改写，可任意组合。

   ── 分类依据：风格系列 ──
     · 孤星风格 —— 与孤星系列主题气质协调的背景
     · P3R 风格 —— 与 P3R 系列主题气质协调的背景
   分组只用于选择器展示与归类，不决定内容皮肤。
   所有主题都能配所有背景（见 report-themes.js 的组合说明）。

   ── 实现方式 ──
   全部由多层 CSS 渐变构成（linear / radial / repeating-linear，配合
   background-size 与 position 做分区），不引用主题变量、不依赖外部图片：
   既保证能被 html2canvas 捕获进导出图，也不会随应用主题或汇报主题变色。
   每套背景都有一个**明确的构图重心**（顶部 / 右下 / 底部 / 左侧斜切），
   装饰集中在边缘与留白区，正文区域保持干净。

   每套背景：
     id / label / hint   标识与说明
     style               风格系列（'default' | 'lone-star' | 'p3r'），仅用于分组
     base                底色（导出时 html2canvas 的兜底）
     bg                  直接作为画布 CSS 的 background 值
   ══════════════════════════════════════════════════════════════════ */

/* ── 默认：与既有汇报视觉一致，尽量不改动老用户体验 ── */
const DEFAULT_BG = {
  id: 'plain',
  label: '纯白',
  hint: '默认 · 与既有汇报版式一致',
  style: 'default',
  base: '#ffffff',
  bg: '#ffffff',
}

/* ── 孤星风格：航天工业 / 科研档案 / 仪器面板 ── */
const LONE_STAR_BGS = [
  {
    id: 'lt-archive',
    label: '科研档案',
    hint: '顶部档头 + 竖向索引网格 + 装订线',
    style: 'lone-star',
    base: '#f8f5ee',
    bg:
      // 顶部档头条带
      'linear-gradient(180deg, rgba(20,27,34,0.10) 0 34px, transparent 34px),'
      // 竖向索引网格
      + 'repeating-linear-gradient(90deg, rgba(20,27,34,0.042) 0 1px, transparent 1px 46px),'
      // 左侧工业橙装订线
      + 'linear-gradient(90deg, rgba(216,121,56,0.85) 0 4px, transparent 4px),'
      // 右下角档案索引框（细边）
      + 'linear-gradient(180deg, transparent 0 86%, rgba(113,129,138,0.18) 86% 86.4%, transparent 86.4%),'
      + 'linear-gradient(160deg, #fdfbf6 0%, #f8f5ee 62%, #f2ece0 100%)',
  },
  {
    id: 'lt-orbital',
    label: '航天工程',
    hint: '右下轨道圆环 + 45° 制图线',
    style: 'lone-star',
    base: '#f4f6f8',
    bg:
      // 右下双轨道圆环
      'radial-gradient(circle at 94% 98%, transparent 0 148px, rgba(16,25,35,0.17) 148px 150px, transparent 150px 206px, rgba(216,121,56,0.32) 206px 208px, transparent 208px),'
      // 45° 工程制图线
      + 'repeating-linear-gradient(45deg, rgba(16,25,35,0.045) 0 1px, transparent 1px 26px),'
      // 左上坐标原点十字（横 + 竖）
      + 'linear-gradient(90deg, rgba(16,25,35,0.22) 0 1px, transparent 1px) 56px 56px / 26px 1px no-repeat,'
      + 'linear-gradient(180deg, rgba(16,25,35,0.22) 0 1px, transparent 1px) 56px 56px / 1px 26px no-repeat,'
      + 'linear-gradient(198deg, #ffffff 0%, #f5f7f8 55%, #eceff2 100%)',
  },
  {
    id: 'lt-gauge',
    label: '工业仪器',
    hint: '底部仪表刻度尺 + 右侧铭牌分区',
    style: 'lone-star',
    base: '#f3f4f3',
    bg:
      // 底部密集刻度尺
      'repeating-linear-gradient(90deg, rgba(16,25,35,0.30) 0 1px, transparent 1px 9px) 0 100% / 100% 16px no-repeat,'
      // 底部刻度基准线
      + 'linear-gradient(180deg, transparent 0 calc(100% - 17px), rgba(16,25,35,0.38) calc(100% - 17px) calc(100% - 16px), transparent calc(100% - 16px)),'
      // 右侧铭牌分区底板
      + 'linear-gradient(90deg, transparent 0 76%, rgba(113,129,138,0.16) 76% 100%),'
      // 右上状态标签块
      + 'linear-gradient(90deg, rgba(216,121,56,0.34) 0 100%) 76% 0 / 24% 26px no-repeat,'
      + 'linear-gradient(180deg, #fbfbfa 0%, #f3f4f3 70%, #eaebea 100%)',
  },
]

/* ── P3R 风格：斜切海报 / 月相轨迹 / 都市拼贴 ── */
const P3R_BGS = [
  {
    id: 'p3r-slash',
    label: '斜切海报',
    hint: '大面积斜切色块 + 明黄细切线',
    style: 'p3r',
    base: '#f2f7fd',
    bg:
      // 左侧大面积斜切蓝块
      'linear-gradient(118deg, rgba(18,100,200,0.17) 0 25%, transparent 25% 100%),'
      // 明黄细切线（贴着斜边）
      + 'linear-gradient(118deg, transparent 0 25.2%, rgba(245,216,61,0.9) 25.2% 25.9%, transparent 25.9%),'
      // 右下斜切青蓝块（与左侧错位）
      + 'linear-gradient(118deg, transparent 0 64%, rgba(40,184,242,0.15) 64% 100%),'
      + 'linear-gradient(155deg, #ffffff 0%, #f2f7fd 100%)',
  },
  {
    id: 'p3r-moon',
    label: '月相轨迹',
    hint: '右上环形轨迹 + 月相 + 底部时间刻度',
    style: 'p3r',
    base: '#f0f6fc',
    bg:
      // 外环轨迹
      'radial-gradient(circle at 84% 10%, transparent 0 86px, rgba(18,100,200,0.20) 86px 89px, transparent 89px 130px, rgba(18,100,200,0.12) 130px 132px, transparent 132px),'
      // 月相（实心圆 + 冷白切口）
      + 'radial-gradient(circle at 84% 10%, rgba(40,184,242,0.24) 0 40%, transparent 40.5%),'
      + 'radial-gradient(circle at 78% 6%, #ffffff 0 30%, transparent 30.5%),'
      // 底部时间刻度
      + 'repeating-linear-gradient(90deg, rgba(7,27,58,0.12) 0 1px, transparent 1px 12px) 0 100% / 100% 12px no-repeat,'
      + 'linear-gradient(200deg, #ffffff 0%, #f1f7fc 58%, #e7effa 100%)',
  },
  {
    id: 'p3r-collage',
    label: '都市拼贴',
    hint: '错位矩形分区 + 方向性色块',
    style: 'p3r',
    base: '#f4f7fb',
    bg:
      // 左上蓝色横条分区
      'linear-gradient(90deg, rgba(18,100,200,0.19) 0 38%, transparent 38%) 0 0 / 100% 24% no-repeat,'
      // 右下明黄斜块
      + 'linear-gradient(105deg, transparent 0 52%, rgba(245,216,61,0.46) 52% 100%) 0 100% / 100% 22% no-repeat,'
      // 底部青蓝细带
      + 'linear-gradient(0deg, rgba(40,184,242,0.16) 0 100%) 0 100% / 100% 7% no-repeat,'
      // 右缘竖向深蓝指示条
      + 'linear-gradient(90deg, transparent 0 calc(100% - 6px), rgba(7,27,58,0.30) calc(100% - 6px) 100%),'
      + 'linear-gradient(180deg, #ffffff 0%, #f4f7fb 100%)',
  },
]

export const REPORT_BACKGROUNDS = [DEFAULT_BG, ...LONE_STAR_BGS, ...P3R_BGS]

/* 选择器按「默认 / 孤星风格 / P3R 风格」分组展示 */
export const REPORT_BG_GROUPS = [
  { id: 'default', label: '默认', items: [DEFAULT_BG] },
  { id: 'lone-star', label: '孤星风格', items: LONE_STAR_BGS },
  { id: 'p3r', label: 'P3R 风格', items: P3R_BGS },
]

export const DEFAULT_REPORT_BG = DEFAULT_BG.id
export const REPORT_BG_IDS = REPORT_BACKGROUNDS.map(b => b.id)

export function normalizeReportBgId(value) {
  const raw = String(value == null ? '' : value).trim()
  return REPORT_BG_IDS.includes(raw) ? raw : DEFAULT_REPORT_BG
}

export function findReportBg(id) {
  const key = normalizeReportBgId(id)
  return REPORT_BACKGROUNDS.find(b => b.id === key) || REPORT_BACKGROUNDS[0]
}

/* ── 持久化（独立键，不与应用主题互相覆盖）── */
export function readReportBg() {
  try { return normalizeReportBgId(readJSON(KEYS.REPORT_BG, null)) } catch { return DEFAULT_REPORT_BG }
}

export function writeReportBg(id) {
  const key = normalizeReportBgId(id)
  try { writeJSON(KEYS.REPORT_BG, key) } catch { /* 存储失败不影响当前会话 */ }
  return key
}

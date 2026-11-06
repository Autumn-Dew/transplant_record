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
     · 终末地风格 —— 工业纸 / 石墨黑（配终末地系列主题，也配深色皮肤）
     · 瑞士风格 —— 12 栏网格 / 不对称留白 / 墨底（国际主义平面设计）
     · 风格派 —— 粗黑线切格 / 三原色（新造型主义，装饰全部贴边，不横穿正文）
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
     style               风格系列（'default' | 'lone-star' | 'p3r' | 'endfield' | 'swiss' | 'stijl'），仅用于分组
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
      'linear-gradient(180deg, rgba(20,27,34,0.10) 0, rgba(20,27,34,0.10) 34px, transparent 34px),'
      // 竖向索引网格
      + 'repeating-linear-gradient(90deg, rgba(20,27,34,0.042) 0, rgba(20,27,34,0.042) 1px, transparent 1px, transparent 46px),'
      // 左侧工业橙装订线
      + 'linear-gradient(90deg, rgba(216,121,56,0.85) 0, rgba(216,121,56,0.85) 4px, transparent 4px),'
      // 右下角档案索引框（细边）
      + 'linear-gradient(180deg, transparent 0, transparent 86%, rgba(113,129,138,0.18) 86%, rgba(113,129,138,0.18) 86.4%, transparent 86.4%),'
      + 'linear-gradient(90deg, transparent 0, transparent 10px, rgba(20,27,34,0.22) 10px, rgba(20,27,34,0.22) 11px, transparent 11px),'
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
      'radial-gradient(circle at 94% 98%, transparent 0, transparent 148px, rgba(16,25,35,0.17) 148px, rgba(16,25,35,0.17) 150px, transparent 150px, transparent 206px, rgba(216,121,56,0.32) 206px, rgba(216,121,56,0.32) 208px, transparent 208px),'
      // 45° 工程制图线
      + 'repeating-linear-gradient(45deg, rgba(16,25,35,0.045) 0, rgba(16,25,35,0.045) 1px, transparent 1px, transparent 26px),'
      // 左上坐标原点十字（横 + 竖）
      + 'linear-gradient(90deg, rgba(16,25,35,0.22) 0, rgba(16,25,35,0.22) 1px, transparent 1px) 56px 56px / 26px 1px no-repeat,'
      + 'linear-gradient(180deg, rgba(16,25,35,0.22) 0, rgba(16,25,35,0.22) 1px, transparent 1px) 56px 56px / 1px 26px no-repeat,'
      + 'linear-gradient(90deg, rgba(16,25,35,0.35) 0, rgba(16,25,35,0.35) 1px, transparent 1px) right 56px top 56px / 18px 1px no-repeat,'
      + 'linear-gradient(180deg, rgba(16,25,35,0.35) 0, rgba(16,25,35,0.35) 1px, transparent 1px) right 56px top 56px / 1px 18px no-repeat,'
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
      'repeating-linear-gradient(90deg, rgba(16,25,35,0.30) 0, rgba(16,25,35,0.30) 1px, transparent 1px, transparent 9px) 0 100% / 100% 16px no-repeat,'
      // 底部刻度基准线
      + 'linear-gradient(180deg, transparent 0 calc(100% - 17px), rgba(16,25,35,0.38) calc(100% - 17px) calc(100% - 16px), transparent calc(100% - 16px)),'
      // 右侧铭牌分区底板
      + 'linear-gradient(90deg, transparent 0, transparent 76%, rgba(113,129,138,0.16) 76%, rgba(113,129,138,0.16) 100%),'
      // 右上状态标签块
      + 'linear-gradient(90deg, rgba(216,121,56,0.34) 0, rgba(216,121,56,0.34) 100%) 76% 0 / 24% 26px no-repeat,'
      + 'repeating-linear-gradient(180deg, rgba(16,25,35,0.28) 0, rgba(16,25,35,0.28) 1px, transparent 1px, transparent 12px) right 18px top 0 / 10px 100% no-repeat,'
      + 'linear-gradient(180deg, #fbfbfa 0%, #f3f4f3 70%, #eaebea 100%)',
  },
  {
    id: 'lt-grid',
    label: '工程细网格',
    hint: '22px 双向细网格 + 左缘橙线',
    style: 'lone-star',
    base: '#f5f7f7',
    bg:
      'linear-gradient(90deg, rgba(20,27,34,0.055) 0, rgba(20,27,34,0.055) 1px, transparent 1px) 0 0 / 22px 22px repeat,'
      + 'linear-gradient(180deg, rgba(20,27,34,0.055) 0, rgba(20,27,34,0.055) 1px, transparent 1px) 0 0 / 22px 22px repeat,'
      + 'linear-gradient(90deg, rgba(216,121,56,0.8) 0, rgba(216,121,56,0.8) 3px, transparent 3px),'
      + 'linear-gradient(180deg, rgba(20,27,34,0.10) 0, rgba(20,27,34,0.10) 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'linear-gradient(180deg, #fbfcfc 0%, #f5f7f7 100%)',
  },
  {
    id: 'lt-timeline',
    label: '时间轴',
    hint: '底部时间轴 + 左缘刻度 + 橙点标记',
    style: 'lone-star',
    base: '#f4f6f5',
    bg:
      'linear-gradient(180deg, transparent 0 calc(100% - 26px), rgba(20,27,34,0.32) calc(100% - 26px) calc(100% - 25px), transparent calc(100% - 25px)),'
      + 'repeating-linear-gradient(90deg, rgba(20,27,34,0.20) 0, rgba(20,27,34,0.20) 1px, transparent 1px, transparent 40px) left 0 bottom 26px / 100% 10px no-repeat,'
      + 'linear-gradient(90deg, rgba(20,27,34,0.16) 0, rgba(20,27,34,0.16) 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'radial-gradient(circle at 16% calc(100% - 26px), rgba(216,121,56,0.85) 0, rgba(216,121,56,0.85) 4px, transparent 4.5px),'
      + 'radial-gradient(circle at 52% calc(100% - 26px), rgba(216,121,56,0.45) 0, rgba(216,121,56,0.45) 3px, transparent 3.5px),'
      + 'linear-gradient(180deg, #fbfbfa 0%, #f4f6f5 100%)',
  },
  {
    id: 'lt-corner',
    label: '角标',
    hint: '右上 L 形直角 + 左下小方块 + 浅底',
    style: 'lone-star',
    base: '#f6f7f6',
    bg:
      'linear-gradient(90deg, transparent 0 calc(100% - 36px), rgba(20,27,34,0.42) calc(100% - 36px) calc(100% - 35px), transparent calc(100% - 35px)) 0 0 / 100% 36px no-repeat,'
      + 'linear-gradient(180deg, transparent 0 calc(100% - 36px), rgba(20,27,34,0.42) calc(100% - 36px) calc(100% - 35px), transparent calc(100% - 35px)) 0 0 / 36px 100% no-repeat,'
      + 'linear-gradient(90deg, rgba(216,121,56,0.75) 0, rgba(216,121,56,0.75) 100%) 0 100% / 14px 14px no-repeat,'
      + 'linear-gradient(180deg, #fbfbfa 0%, #f6f7f6 100%)',
  },
  {
    id: 'lt-stamp',
    label: '印章',
    hint: '右下同心环 + 45° 斜线纹',
    style: 'lone-star',
    base: '#f5f6f4',
    bg:
      'radial-gradient(circle at 86% 88%, transparent 0, transparent 44px, rgba(20,27,34,0.18) 44px, rgba(20,27,34,0.18) 45px, transparent 45px, transparent 52px, rgba(216,121,56,0.5) 52px, rgba(216,121,56,0.5) 53px, transparent 53px),'
      + 'repeating-linear-gradient(-45deg, rgba(20,27,34,0.045) 0, rgba(20,27,34,0.045) 1px, transparent 1px, transparent 9px),'
      + 'linear-gradient(90deg, rgba(20,27,34,0.28) 0, rgba(20,27,34,0.28) 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'linear-gradient(180deg, #fafbf9 0%, #f5f6f4 100%)',
  },
  {
    id: 'lt-night',
    label: '夜航',
    hint: '深蓝底 + 冷白细网格 + 橙色基线',
    style: 'lone-star',
    base: '#101923',
    bg:
      'linear-gradient(90deg, rgba(232,226,211,0.06) 0, rgba(232,226,211,0.06) 1px, transparent 1px) 0 0 / 24px 24px repeat,'
      + 'linear-gradient(180deg, rgba(232,226,211,0.06) 0, rgba(232,226,211,0.06) 1px, transparent 1px) 0 0 / 24px 24px repeat,'
      + 'linear-gradient(90deg, rgba(216,121,56,0.55) 0, rgba(216,121,56,0.55) 3px, transparent 3px),'
      + 'linear-gradient(180deg, transparent 0 calc(100% - 1px), rgba(232,226,211,0.18) calc(100% - 1px) 100%),'
      + 'linear-gradient(180deg, #16222E 0%, #101923 100%)',
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
      'linear-gradient(118deg, rgba(18,100,200,0.17) 0, rgba(18,100,200,0.17) 25%, transparent 25%, transparent 100%),'
      // 明黄细切线（贴着斜边）
      + 'linear-gradient(118deg, transparent 0, transparent 25.2%, rgba(245,216,61,0.9) 25.2%, rgba(245,216,61,0.9) 25.9%, transparent 25.9%),'
      // 右下斜切青蓝块（与左侧错位）
      + 'linear-gradient(118deg, transparent 0, transparent 64%, rgba(40,184,242,0.15) 64%, rgba(40,184,242,0.15) 100%),'
      + 'linear-gradient(118deg, transparent 0, transparent 78.2%, rgba(18,100,200,0.85) 78.2%, rgba(18,100,200,0.85) 78.8%, transparent 78.8%),'
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
      'radial-gradient(circle at 84% 10%, transparent 0, transparent 86px, rgba(18,100,200,0.20) 86px, rgba(18,100,200,0.20) 89px, transparent 89px, transparent 130px, rgba(18,100,200,0.12) 130px, rgba(18,100,200,0.12) 132px, transparent 132px),'
      // 月相（实心圆 + 冷白切口）
      + 'radial-gradient(circle at 84% 10%, rgba(40,184,242,0.24) 0, rgba(40,184,242,0.24) 40%, transparent 40.5%),'
      + 'radial-gradient(circle at 78% 6%, #ffffff 0, #ffffff 30%, transparent 30.5%),'
      // 底部时间刻度
      + 'repeating-linear-gradient(90deg, rgba(7,27,58,0.12) 0, rgba(7,27,58,0.12) 1px, transparent 1px, transparent 12px) 0 100% / 100% 12px no-repeat,'
      + 'repeating-linear-gradient(90deg, rgba(7,27,58,0.18) 0, rgba(7,27,58,0.18) 1px, transparent 1px, transparent 6px) 0 100% / 100% 6px no-repeat,'
      + 'linear-gradient(200deg, #ffffff 0%, #f1f7fc 58%, #e7effa 100%)',
  },
  {
    id: 'p3r-collage',
    label: '都市拼贴',
    hint: '错位矩形分区 + 方向性色块 + 一道竖向接缝',
    style: 'p3r',
    base: '#f4f7fb',
    bg:
      // 左上蓝色横条分区
      'linear-gradient(90deg, rgba(18,100,200,0.19) 0, rgba(18,100,200,0.19) 38%, transparent 38%) 0 0 / 100% 24% no-repeat,'
      // 右下琥珀斜块（与主题的动作色同一个）
      + 'linear-gradient(105deg, transparent 0, transparent 52%, rgba(255,176,31,0.42) 52%, rgba(255,176,31,0.42) 100%) 0 100% / 100% 22% no-repeat,'
      // 62% 处一道竖向接缝：拼贴的「纸与纸之间」
      + 'linear-gradient(90deg, transparent 0, transparent 62%, rgba(7,27,58,0.16) 62%, rgba(7,27,58,0.16) 62.3%, transparent 62.3%),'
      // 底部青蓝细带
      + 'linear-gradient(0deg, rgba(40,184,242,0.16) 0, rgba(40,184,242,0.16) 100%) 0 100% / 100% 7% no-repeat,'
      // 右缘竖向深蓝指示条
      + 'linear-gradient(90deg, transparent 0 calc(100% - 6px), rgba(7,27,58,0.30) calc(100% - 6px) 100%),'
      + 'linear-gradient(90deg, transparent 0, transparent 82%, rgba(18,100,200,0.45) 82%, rgba(18,100,200,0.45) 100%) 0 0 / 100% 18px no-repeat,'
      + 'linear-gradient(180deg, #ffffff 0%, #f4f7fb 100%)',
  },
  {
    id: 'p3r-split',
    label: '对角分割',
    hint: '45° 对角两色 + 明黄细线',
    style: 'p3r',
    base: '#f3f7fd',
    bg:
      'linear-gradient(45deg, rgba(18,100,200,0.16) 0, rgba(18,100,200,0.16) 38%, transparent 38%, transparent 100%),'
      + 'linear-gradient(45deg, transparent 0, transparent 38.4%, rgba(245,216,61,0.85) 38.4%, rgba(245,216,61,0.85) 39%, transparent 39%),'
      + 'linear-gradient(45deg, transparent 0, transparent 72%, rgba(40,184,242,0.14) 72%, rgba(40,184,242,0.14) 100%),'
      + 'linear-gradient(180deg, #ffffff 0%, #f3f7fd 100%)',
  },
]

/* ── 终末地风格：工业纸 / 石墨黑（终末地主题的配套底层）── */
const ENDFIELD_BGS = [
  {
    id: 'ef-paper',
    label: '工业纸',
    hint: '纸白底 + 45° 细斜线纹 + 顶边三色条',
    style: 'endfield',
    base: '#f4f4f2',
    bg:
      // 顶边三色条（品红 / lime / 薄荷绿）—— 屏幕开始的位置
      'linear-gradient(90deg, rgba(255,0,240,0.85) 0, rgba(255,0,240,0.85) 12%, rgba(184,255,61,0.9) 12%, rgba(184,255,61,0.9) 24%, rgba(0,255,162,0.85) 24%, rgba(0,255,162,0.85) 36%, transparent 36%) 0 0 / 100% 3px no-repeat,'
      // 45° 工业细斜线纹
      + 'repeating-linear-gradient(-45deg, rgba(22,22,22,0.05) 0, rgba(22,22,22,0.05) 1px, transparent 1px, transparent 6.5px),'
      // 右缘墨色分区线
      + 'linear-gradient(90deg, transparent 0 calc(100% - 96px), rgba(22,22,22,0.10) calc(100% - 96px)),'
      // 右下角记录区细线
      + 'linear-gradient(180deg, transparent 0, transparent 88%, rgba(22,22,22,0.12) 88%, rgba(22,22,22,0.12) 88.3%, transparent 88.3%),'
      + 'linear-gradient(180deg, #f8f8f6 0%, #f4f4f2 60%, #ededeb 100%)',
  },
  {
    id: 'ef-night',
    label: '石墨夜班',
    hint: '石墨黑底 + lime 顶边 + 极淡斜线纹',
    style: 'endfield',
    base: '#191919',
    bg:
      // 顶边三色条（深色底上同样保留，只是更亮一档）
      'linear-gradient(90deg, rgba(255,0,240,0.75) 0, rgba(255,0,240,0.75) 12%, rgba(184,255,61,0.85) 12%, rgba(184,255,61,0.85) 24%, rgba(0,255,162,0.75) 24%, rgba(0,255,162,0.75) 36%, transparent 36%) 0 0 / 100% 3px no-repeat,'
      // 浅墨色斜线纹（深底上才看得见）
      + 'repeating-linear-gradient(-45deg, rgba(237,237,237,0.055) 0, rgba(237,237,237,0.055) 1px, transparent 1px, transparent 6.5px),'
      // 右缘 lime 细分区
      + 'linear-gradient(90deg, transparent 0, transparent 82%, rgba(184,255,61,0.10) 82%),'
      // 底部数据线
      + 'linear-gradient(180deg, transparent 0, transparent 86%, rgba(237,237,237,0.14) 86%, rgba(237,237,237,0.14) 86.3%, transparent 86.3%),'
      + 'linear-gradient(180deg, #202020 0%, #191919 55%, #131313 100%)',
  },
  {
    id: 'ef-blueprint',
    label: '工程网格',
    hint: '纸白 + 工程坐标网格 + 顶边三色条',
    style: 'endfield',
    base: '#f2f2ef',
    bg:
      // 顶边三色条
      'linear-gradient(90deg, rgba(255,0,240,0.75) 0, rgba(255,0,240,0.75) 10%, rgba(184,255,61,0.85) 10%, rgba(184,255,61,0.85) 20%, rgba(0,255,162,0.75) 20%, rgba(0,255,162,0.75) 30%, transparent 30%) 0 0 / 100% 3px no-repeat,'
      // 工程坐标网格（竖向 + 横向细线，24px 一格）
      + 'linear-gradient(90deg, rgba(22,22,22,0.07) 0, rgba(22,22,22,0.07) 1px, transparent 1px) 0 0 / 24px 24px repeat,'
      + 'linear-gradient(180deg, rgba(22,22,22,0.07) 0, rgba(22,22,22,0.07) 1px, transparent 1px) 0 0 / 24px 24px repeat,'
      // 右缘编号栏
      + 'linear-gradient(90deg, transparent 0 calc(100% - 120px), rgba(22,22,22,0.12) calc(100% - 120px)),'
      // 右下角标题框
      + 'linear-gradient(180deg, transparent 0, transparent 90%, rgba(22,22,22,0.10) 90%, rgba(22,22,22,0.10) 90.3%, transparent 90.3%),'
      + 'linear-gradient(165deg, #f6f6f3 0%, #f2f2ef 60%, #ececea 100%)',
  },
  {
    id: 'ef-rail',
    label: '导轨',
    hint: '左侧导轨 + 主次刻度 + 顶边三色条',
    style: 'endfield',
    base: '#f3f4f2',
    bg:
      // 顶边三色条（只占开头 24%，不再横贯整页）
      'linear-gradient(90deg, rgba(255,0,240,0.7) 0, rgba(255,0,240,0.7) 8%, rgba(184,255,61,0.85) 8%, rgba(184,255,61,0.85) 16%, rgba(0,255,162,0.7) 16%, rgba(0,255,162,0.7) 24%, transparent 24%) 0 0 / 100% 3px no-repeat,'
      // 左侧导轨：深灰底面
      + 'linear-gradient(90deg, rgba(22,22,22,0.14) 0, rgba(22,22,22,0.14) 12px, transparent 12px),'
      // 导轨上的短刻度（每 14px）
      + 'repeating-linear-gradient(180deg, rgba(22,22,22,0.34) 0, rgba(22,22,22,0.34) 1px, transparent 1px, transparent 14px) 0 0 / 12px 100% no-repeat,'
      // 底部主轴：每 50px 一条主刻度（长刻度，与导轨区分）
      + 'repeating-linear-gradient(90deg, rgba(22,22,22,0.26) 0, rgba(22,22,22,0.26) 1px, transparent 1px, transparent 50px) 0 100% / 100% 12px no-repeat,'
      + 'linear-gradient(180deg, rgba(22,22,22,0.32) 0, rgba(22,22,22,0.32) 1px, transparent 1px) left 0 bottom 12px / 100% 1px no-repeat,'
      + 'linear-gradient(180deg, #fafaf8 0%, #f3f4f2 100%)',
  },
  /* ── 追加四套：按 endfield-ui 的「底纹 / 强调色 / 纸色」维度各取一路 ──
     共同规则：3px 三色条只贴在页顶、极淡细线分区、只用一个强调色。 */
  {
    id: 'ef-coldstore',
    label: '冷库格栅',
    hint: '冷灰白 + 16px 格栅 + 冰蓝三色条 + 左侧基准线',
    style: 'endfield',
    base: '#f0f4f5',
    bg:
      // 顶边三色条（冰蓝为强调色）
      'linear-gradient(90deg, rgba(255,0,240,0.85) 0, rgba(255,0,240,0.85) 12%, rgba(125,230,255,0.95) 12%, rgba(125,230,255,0.95) 24%, rgba(0,255,162,0.85) 24%, rgba(0,255,162,0.85) 36%, transparent 36%) 0 0 / 100% 3px no-repeat,'
      // 库位分隔：25% / 50% / 75% 三条粗竖线
      + 'linear-gradient(90deg, rgba(16,40,54,0.20) 0, rgba(16,40,54,0.20) 1px, transparent 1px) 25% 0 / 1px 100% no-repeat,'
      + 'linear-gradient(90deg, rgba(16,40,54,0.20) 0, rgba(16,40,54,0.20) 1px, transparent 1px) 50% 0 / 1px 100% no-repeat,'
      + 'linear-gradient(90deg, rgba(16,40,54,0.20) 0, rgba(16,40,54,0.20) 1px, transparent 1px) 75% 0 / 1px 100% no-repeat,'
      // 16px 细格
      + 'linear-gradient(90deg, rgba(16,40,54,0.055) 0, rgba(16,40,54,0.055) 1px, transparent 1px) 0 0 / 16px 16px repeat,'
      + 'linear-gradient(180deg, rgba(16,40,54,0.055) 0, rgba(16,40,54,0.055) 1px, transparent 1px) 0 0 / 16px 16px repeat,'
      // 顶部刻度尺（8px 一格，只占顶部 10px）
      + 'linear-gradient(90deg, rgba(16,40,54,0.30) 0, rgba(16,40,54,0.30) 1px, transparent 1px) 0 0 / 8px 10px repeat-x,'
      // 左侧竖尺（24px 一格）
      + 'linear-gradient(180deg, rgba(16,40,54,0.30) 0, rgba(16,40,54,0.30) 1px, transparent 1px) 0 0 / 10px 24px repeat-y,'
      + 'linear-gradient(180deg, #f7fafb 0%, #eef4f6 60%, #e6eef1 100%)',
  },
  {
    id: 'ef-hatch',
    label: '工地斜纹',
    hint: '暖米底 + 45° 斜线纹 + 琥珀三色条 + 底部双线',
    style: 'endfield',
    base: '#f6f2e8',
    bg:
      // 顶边三色条（琥珀为强调色）
      'linear-gradient(90deg, rgba(255,0,240,0.80) 0, rgba(255,0,240,0.80) 12%, rgba(255,179,31,0.95) 12%, rgba(255,179,31,0.95) 24%, rgba(0,255,162,0.80) 24%, rgba(0,255,162,0.80) 36%, transparent 36%) 0 0 / 100% 3px no-repeat,'
      // 左侧警示斜条（黄黑相间，10px 宽）
      + 'repeating-linear-gradient(45deg, rgba(255,179,31,0.55) 0, rgba(255,179,31,0.55) 6px, rgba(60,44,20,0.55) 6px, rgba(60,44,20,0.55) 12px) left 0 top 0 / 10px 100% no-repeat,'
      // 右侧警示斜条
      + 'repeating-linear-gradient(-45deg, rgba(255,179,31,0.55) 0, rgba(255,179,31,0.55) 6px, rgba(60,44,20,0.55) 6px, rgba(60,44,20,0.55) 12px) right 0 top 0 / 10px 100% no-repeat,'
      // 中部极淡斜纹
      + 'repeating-linear-gradient(45deg, rgba(60,44,20,0.045) 0, rgba(60,44,20,0.045) 1px, transparent 1px, transparent 9px),'
      // 底部粗线
      + 'linear-gradient(180deg, transparent 0, transparent calc(100% - 5px), rgba(60,44,20,0.26) calc(100% - 5px), rgba(60,44,20,0.26) 100%),'
      + 'linear-gradient(180deg, #fcf9f2 0%, #f6f2e8 60%, #efe9dc 100%)',
  },
  {
    id: 'ef-contour',
    label: '等高线',
    hint: '中性纸 + 双角度细线（等高线感）+ 明黄三色条 + 右上角标',
    style: 'endfield',
    base: '#f7f7f4',
    bg:
      // 顶边三色条（明黄为强调色）
      'linear-gradient(90deg, rgba(255,0,240,0.85) 0, rgba(255,0,240,0.85) 12%, rgba(255,250,0,0.92) 12%, rgba(255,250,0,0.92) 24%, rgba(0,255,162,0.85) 24%, rgba(0,255,162,0.85) 36%, transparent 36%) 0 0 / 100% 3px no-repeat,'
      // 同心环：两组不等距的径向细环，做出等高线的疏密
      + 'radial-gradient(circle at 74% 22%, transparent 33.6%, rgba(26,26,26,0.075) 33.8%, transparent 34.2%, transparent 41%, rgba(26,26,26,0.055) 41.2%, transparent 41.6%),'
      + 'radial-gradient(circle at 22% 78%, transparent 27.6%, rgba(26,26,26,0.07) 27.8%, transparent 28.2%, transparent 35%, rgba(26,26,26,0.05) 35.2%, transparent 35.6%, transparent 44%, rgba(26,26,26,0.04) 44.2%, transparent 44.6%),'
      // 极淡斜纹打底
      + 'repeating-linear-gradient(31deg, rgba(26,26,26,0.022) 0, rgba(26,26,26,0.022) 1px, transparent 1px, transparent 22px),'
      // 右上角标
      + 'linear-gradient(90deg, rgba(26,26,26,0.85) 0, rgba(26,26,26,0.85) 100%) right 24px top 24px / 22px 2px no-repeat,'
      + 'linear-gradient(180deg, #fbfbf8 0%, #f7f7f4 60%, #f2f2ed 100%)',
  },
  {
    id: 'ef-console',
    label: '终端扫描线',
    hint: '墨黑底 + 3px 扫描线 + lime 三色条 + 底部基准线',
    style: 'endfield',
    base: '#12140f',
    bg:
      // 顶边三色条（lime 为强调色）
      'linear-gradient(90deg, rgba(255,0,240,0.70) 0, rgba(255,0,240,0.70) 12%, rgba(184,255,61,0.95) 12%, rgba(184,255,61,0.95) 24%, rgba(0,255,162,0.70) 24%, rgba(0,255,162,0.70) 36%, transparent 36%) 0 0 / 100% 3px no-repeat,'
      // 8px 点阵（不是线，和另外三套一眼区分）
      + 'radial-gradient(circle, rgba(184,255,61,0.16) 1px, transparent 1.3px) 0 0 / 8px 8px repeat,'
      // 四角 L 形括号
      + 'linear-gradient(90deg, rgba(184,255,61,0.42) 0, rgba(184,255,61,0.42) 100%) 16px 16px / 26px 1px no-repeat,'
      + 'linear-gradient(180deg, rgba(184,255,61,0.42) 0, rgba(184,255,61,0.42) 100%) 16px 16px / 1px 26px no-repeat,'
      + 'linear-gradient(90deg, rgba(184,255,61,0.42) 0, rgba(184,255,61,0.42) 100%) right 16px top 16px / 26px 1px no-repeat,'
      + 'linear-gradient(180deg, rgba(184,255,61,0.42) 0, rgba(184,255,61,0.42) 100%) right 16px top 16px / 1px 26px no-repeat,'
      + 'linear-gradient(180deg, #1a1d14 0%, #12140f 60%, #0b0d09 100%)',
  },]

/* ── 瑞士风格：12 栏网格 / 米白 / 墨底（国际主义平面设计）──
   只有三种颜色与细线：网格线一律 1px，不叠纹理、不做渐变底。 */
const SWISS_BGS = [
  {
    id: 'ch-grid',
    label: '十二栏版式',
    hint: '米白 + 12 栏竖线 + 24px 基线网格 + 红角标',
    style: 'swiss',
    base: '#f2efe9',
    bg:
      // 12 栏竖向细线（每栏 8.3333%）
      'repeating-linear-gradient(90deg, rgba(17,17,17,0.10) 0, rgba(17,17,17,0.10) 1px, transparent 1px, transparent 8.3333%),'
      // 基线网格：每 24px 一条横线（版式稿的骨架）
      + 'repeating-linear-gradient(180deg, rgba(17,17,17,0.055) 0, rgba(17,17,17,0.055) 1px, transparent 1px, transparent 24px),'
      // 顶部墨线（版面开始，2px 更明确）
      + 'linear-gradient(180deg, rgba(17,17,17,0.85) 0, rgba(17,17,17,0.85) 2px, transparent 2px) 0 0 / 100% 100% no-repeat,'
      // 左上角红色角标（正方形，不是细条）
      + 'linear-gradient(90deg, rgba(218,41,28,0.9) 0, rgba(218,41,28,0.9) 100%) 0 0 / 18px 18px no-repeat,'
      + 'linear-gradient(180deg, #f6f3ed 0%, #f2efe9 100%)',
  },
  {
    id: 'ch-asym',
    label: '不对称留白',
    hint: '米白 + 左侧三分栏线 + 底部留白面 + 长红线',
    style: 'swiss',
    base: '#f2efe9',
    bg:
      // 只画出左侧三分栏的竖线：留白由缺线表达
      'repeating-linear-gradient(90deg, rgba(17,17,17,0.12) 0, rgba(17,17,17,0.12) 1px, transparent 1px, transparent 8.3333%) 0 0 / 33.3333% 100% no-repeat,'
      // 右侧一条竖向分区线
      + 'linear-gradient(90deg, transparent 0 calc(100% - 1px), rgba(17,17,17,0.35) calc(100% - 1px) 100%),'
      // 底部 1/3 的极淡灰面：把「留白」画成一块面，而不只是没有线
      + 'linear-gradient(180deg, transparent 0 calc(100% - 33.3333%), rgba(17,17,17,0.035) calc(100% - 33.3333%) 100%),'
      // 顶部墨线
      + 'linear-gradient(180deg, rgba(17,17,17,0.85) 0, rgba(17,17,17,0.85) 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      // 红线拉满左侧那一栏（33.3333%），和栏线对齐
      + 'linear-gradient(90deg, rgba(218,41,28,0.9) 0, rgba(218,41,28,0.9) 100%) 0 0 / 33.3333% 3px no-repeat,'
      + 'linear-gradient(180deg, #f6f3ed 0%, #f2efe9 100%)',
  },
  {
    id: 'ch-black',
    label: '墨底',
    hint: '墨黑底 + 米白栏线 + 红角标 + 右下页码块',
    style: 'swiss',
    base: '#111111',
    bg:
      // 12 栏细线（深底上换成米白 10%）
      'repeating-linear-gradient(90deg, rgba(242,239,233,0.10) 0, rgba(242,239,233,0.10) 1px, transparent 1px, transparent 8.3333%),'
      // 顶部米白细线（2px，反白版的版面线）
      + 'linear-gradient(180deg, rgba(242,239,233,0.9) 0, rgba(242,239,233,0.9) 2px, transparent 2px) 0 0 / 100% 100% no-repeat,'
      // 左上角红色角标
      + 'linear-gradient(90deg, rgba(218,41,28,0.92) 0, rgba(218,41,28,0.92) 100%) 0 0 / 18px 18px no-repeat,'
      // 右下角红色页码块（索引感）
      + 'linear-gradient(90deg, rgba(218,41,28,0.75) 0, rgba(218,41,28,0.75) 100%) right 26px bottom 26px / 26px 3px no-repeat,'
      + 'linear-gradient(180deg, #161616 0%, #111111 100%)',
  },
  {
    id: 'ch-columns',
    label: '双栏',
    hint: '中缝双线分成两栏 + 栏内细线 + 底部基线',
    style: 'swiss',
    base: '#f2efe9',
    bg:
      // 中缝：细-粗-细的三层（印刷版式的中缝，比一条线更像版面）
      'linear-gradient(90deg, transparent 0 calc(50% - 2px), rgba(17,17,17,0.30) calc(50% - 2px) calc(50% - 1px), rgba(17,17,17,0.65) calc(50% - 1px) calc(50% + 1px), rgba(17,17,17,0.30) calc(50% + 1px) calc(50% + 2px), transparent calc(50% + 2px)),'
      // 两栏各自的 12 栏细线
      + 'repeating-linear-gradient(90deg, rgba(17,17,17,0.08) 0, rgba(17,17,17,0.08) 1px, transparent 1px, transparent 8.3333%),'
      // 顶部墨线
      + 'linear-gradient(180deg, rgba(17,17,17,0.85) 0, rgba(17,17,17,0.85) 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      // 底部基线（版心结束）
      + 'linear-gradient(180deg, transparent 0 calc(100% - 24px), rgba(17,17,17,0.35) calc(100% - 24px) calc(100% - 23px), transparent calc(100% - 23px)),'
      // 顶部红色标尺
      + 'linear-gradient(90deg, rgba(218,41,28,0.9) 0, rgba(218,41,28,0.9) 100%) 0 0 / 26px 3px no-repeat,'
      + 'linear-gradient(180deg, #f6f3ed 0%, #f2efe9 100%)',
  },
]

/* ── 风格派：新造型主义（粗黑线切格 / 三原色 / 全是平涂）──
   只用百分比色标的单层渐变叠起来 —— 不写 background-size / position 列表，
   这样 html2canvas 不会把某一层色块铺满整张画布（见 §19.1 的坑）。 */
const STIJL_BGS = [
  {
    id: 'st-grid',
    label: '粗格',
    hint: '外框粗黑线 + 左上红带 + 右下蓝角',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      // 顶部红带（落在上留白里，不压标题）
      'linear-gradient(180deg, rgba(208,48,42,0.94) 0, rgba(208,48,42,0.94) 1.4%, transparent 1.4%),'
      // 上边粗线
      + 'linear-gradient(180deg, transparent 0, transparent 1.4%, rgba(17,17,17,0.94) 1.4%, rgba(17,17,17,0.94) 2%, transparent 2%),'
      // 左缘粗线
      + 'linear-gradient(90deg, rgba(17,17,17,0.94) 0, rgba(17,17,17,0.94) 1.2%, transparent 1.2%),'
      // 右下蓝角（横 + 竖两条贴边）
      + 'linear-gradient(180deg, transparent 0, transparent 98%, rgba(29,63,140,0.9) 98%, rgba(29,63,140,0.9) 100%),'
      + 'linear-gradient(90deg, transparent 0, transparent 98.4%, rgba(29,63,140,0.9) 98.4%, rgba(29,63,140,0.9) 100%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-block',
    label: '色块',
    hint: '左缘黄条 + 右缘红条 + 上下墨线',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(90deg, rgba(235,194,38,0.9) 0, rgba(235,194,38,0.9) 1.4%, transparent 1.4%),'
      + 'linear-gradient(90deg, transparent 0, transparent 98.6%, rgba(208,48,42,0.9) 98.6%, rgba(208,48,42,0.9) 100%),'
      + 'linear-gradient(180deg, rgba(17,17,17,0.94) 0, rgba(17,17,17,0.94) 1.1%, transparent 1.1%),'
      + 'linear-gradient(180deg, transparent 0, transparent 98.9%, rgba(17,17,17,0.94) 98.9%, rgba(17,17,17,0.94) 100%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-rule',
    label: '粗线',
    hint: '上下粗黑边 + 左缘蓝条 + 右缘黄线',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(180deg, rgba(17,17,17,0.94) 0, rgba(17,17,17,0.94) 1.6%, transparent 1.6% calc(100% - 1.6%), rgba(17,17,17,0.94) calc(100% - 1.6%) 100%),'
      + 'linear-gradient(90deg, rgba(29,63,140,0.9) 0, rgba(29,63,140,0.9) 1.2%, transparent 1.2%),'
      + 'linear-gradient(90deg, transparent 0, transparent 99.2%, rgba(235,194,38,0.9) 99.2%, rgba(235,194,38,0.9) 100%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-corner',
    label: '角块',
    hint: '左上红角 + 右下黄角 + 一圈细黑框',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(90deg, rgba(208,48,42,0.94) 0, rgba(208,48,42,0.94) 2.2%, transparent 2.2%),'
      + 'linear-gradient(180deg, rgba(208,48,42,0.94) 0, rgba(208,48,42,0.94) 1.6%, transparent 1.6%),'
      + 'linear-gradient(90deg, transparent 0, transparent 97.8%, rgba(235,194,38,0.9) 97.8%, rgba(235,194,38,0.9) 100%),'
      + 'linear-gradient(180deg, transparent 0, transparent 98.4%, rgba(235,194,38,0.9) 98.4%, rgba(235,194,38,0.9) 100%),'
      + 'linear-gradient(180deg, transparent 0, transparent 0.6%, rgba(17,17,17,0.6) 0.6%, rgba(17,17,17,0.6) 0.9%, transparent 0.9% calc(100% - 0.9%), rgba(17,17,17,0.6) calc(100% - 0.9%) calc(100% - 0.6%), transparent calc(100% - 0.6%)),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-band',
    label: '横带',
    hint: '顶部黄带 + 红短线 + 底部墨线',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(180deg, rgba(235,194,38,0.9) 0, rgba(235,194,38,0.9) 1.4%, transparent 1.4%),'
      + 'linear-gradient(180deg, transparent 0, transparent 1.4%, rgba(17,17,17,0.94) 1.4%, rgba(17,17,17,0.94) 1.9%, transparent 1.9%),'
      + 'linear-gradient(90deg, rgba(208,48,42,0.94) 0, rgba(208,48,42,0.94) 1.2%, transparent 1.2%),'
      + 'linear-gradient(180deg, transparent 0, transparent 99%, rgba(17,17,17,0.94) 99%, rgba(17,17,17,0.94) 100%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-column',
    label: '竖栏',
    hint: '右缘蓝栏 + 竖粗线 + 左上黄块',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(90deg, transparent 0, transparent 97.6%, rgba(29,63,140,0.9) 97.6%, rgba(29,63,140,0.9) 100%),'
      + 'linear-gradient(90deg, transparent 0, transparent 97.1%, rgba(17,17,17,0.94) 97.1%, rgba(17,17,17,0.94) 97.6%, transparent 97.6%),'
      + 'linear-gradient(90deg, rgba(235,194,38,0.9) 0, rgba(235,194,38,0.9) 1.6%, transparent 1.6%),'
      + 'linear-gradient(180deg, rgba(235,194,38,0.9) 0, rgba(235,194,38,0.9) 1.2%, transparent 1.2%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-letter',
    label: '方块字母',
    hint: '顶部三色小方块 + 一条墨线 + 右缘蓝线',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(90deg, rgba(17,17,17,0.94) 0, rgba(17,17,17,0.94) 1%, transparent 1%, transparent 1.8%, rgba(208,48,42,0.94) 1.8%, rgba(208,48,42,0.94) 2.8%, transparent 2.8%, transparent 3.6%, rgba(235,194,38,0.94) 3.6%, rgba(235,194,38,0.94) 4.6%, transparent 4.6%),'
      + 'linear-gradient(180deg, transparent 0, transparent 1.6%, rgba(17,17,17,0.94) 1.6%, rgba(17,17,17,0.94) 2.1%, transparent 2.1%),'
      + 'linear-gradient(90deg, transparent 0, transparent 99%, rgba(29,63,140,0.85) 99%, rgba(29,63,140,0.85) 100%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-inverse',
    label: '反白',
    hint: '黑底 + 米白粗边 + 四角三原色',
    style: 'stijl',
    base: '#111111',
    bg:
      'linear-gradient(180deg, rgba(244,241,234,0.9) 0, rgba(244,241,234,0.9) 1.2%, transparent 1.2%),'
      + 'linear-gradient(90deg, rgba(244,241,234,0.9) 0, rgba(244,241,234,0.9) 0.9%, transparent 0.9%),'
      + 'linear-gradient(90deg, rgba(208,48,42,0.94) 0, rgba(208,48,42,0.94) 1.8%, transparent 1.8%),'
      + 'linear-gradient(90deg, transparent 0, transparent 98.2%, rgba(29,63,140,0.92) 98.2%, rgba(29,63,140,0.92) 100%),'
      + 'linear-gradient(180deg, transparent 0, transparent 98.8%, rgba(235,194,38,0.92) 98.8%, rgba(235,194,38,0.92) 100%),'
      + 'linear-gradient(180deg, #171717 0%, #111111 100%)',
  },
]


/* 一条平铺列表：背景不再按风格系列分组，选择器里从头到尾只有一条。
   纯白底不在这条列表里 —— 它跟着「经典外观」按钮走（见 CLASSIC_REPORT_BG）。
   每个原本的风格系列各留前四个。 */
export const REPORT_BACKGROUNDS = [...P3R_BGS, ...ENDFIELD_BGS, ...SWISS_BGS]

export const CLASSIC_REPORT_BG = DEFAULT_BG
export const DEFAULT_REPORT_BG = DEFAULT_BG.id
/* ids 仍包含纯白：老用户存的就是 'plain'，回落逻辑不能把它当非法值 */
export const REPORT_BG_IDS = [DEFAULT_BG.id, ...REPORT_BACKGROUNDS.map(b => b.id)]

export function normalizeReportBgId(value) {
  const raw = String(value == null ? '' : value).trim()
  return REPORT_BG_IDS.includes(raw) ? raw : DEFAULT_REPORT_BG
}

export function findReportBg(id) {
  const key = normalizeReportBgId(id)
  return [DEFAULT_BG, ...REPORT_BACKGROUNDS].find(b => b.id === key) || DEFAULT_BG
}

/* 背景的明暗：按 base 底色的相对亮度判断（用于在选择器里标「深 / 浅」，
   和汇报主题的「暗 / 浅」一起看，就知道该配哪一套） */
export function bgTone(bg) {
  const hex = String((bg && bg.base) || '#ffffff').replace('#', '')
  if (hex.length < 6) return 'light'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum < 128 ? 'dark' : 'light'
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

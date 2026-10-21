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
      'linear-gradient(180deg, rgba(20,27,34,0.10) 0 34px, transparent 34px),'
      // 竖向索引网格
      + 'repeating-linear-gradient(90deg, rgba(20,27,34,0.042) 0 1px, transparent 1px 46px),'
      // 左侧工业橙装订线
      + 'linear-gradient(90deg, rgba(216,121,56,0.85) 0 4px, transparent 4px),'
      // 右下角档案索引框（细边）
      + 'linear-gradient(180deg, transparent 0 86%, rgba(113,129,138,0.18) 86% 86.4%, transparent 86.4%),'
      + 'linear-gradient(90deg, transparent 0 10px, rgba(20,27,34,0.22) 10px 11px, transparent 11px),'
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
      + 'linear-gradient(90deg, rgba(16,25,35,0.35) 0 1px, transparent 1px) calc(100% - 56px) 56px / 18px 1px no-repeat,'
      + 'linear-gradient(180deg, rgba(16,25,35,0.35) 0 1px, transparent 1px) calc(100% - 56px) 56px / 1px 18px no-repeat,'
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
      + 'repeating-linear-gradient(180deg, rgba(16,25,35,0.28) 0 1px, transparent 1px 12px) calc(100% - 18px) 0 / 10px 100% no-repeat,'
      + 'linear-gradient(180deg, #fbfbfa 0%, #f3f4f3 70%, #eaebea 100%)',
  },
  {
    id: 'lt-grid',
    label: '工程细网格',
    hint: '22px 双向细网格 + 左缘橙线',
    style: 'lone-star',
    base: '#f5f7f7',
    bg:
      'linear-gradient(90deg, rgba(20,27,34,0.055) 0 1px, transparent 1px) 0 0 / 22px 22px repeat,'
      + 'linear-gradient(180deg, rgba(20,27,34,0.055) 0 1px, transparent 1px) 0 0 / 22px 22px repeat,'
      + 'linear-gradient(90deg, rgba(216,121,56,0.8) 0 3px, transparent 3px),'
      + 'linear-gradient(180deg, rgba(20,27,34,0.10) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
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
      + 'repeating-linear-gradient(90deg, rgba(20,27,34,0.20) 0 1px, transparent 1px 40px) 0 calc(100% - 26px) / 100% 10px no-repeat,'
      + 'linear-gradient(90deg, rgba(20,27,34,0.16) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'radial-gradient(circle at 16% calc(100% - 26px), rgba(216,121,56,0.85) 0 4px, transparent 4.5px),'
      + 'radial-gradient(circle at 52% calc(100% - 26px), rgba(216,121,56,0.45) 0 3px, transparent 3.5px),'
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
      + 'linear-gradient(90deg, rgba(216,121,56,0.75) 0 100%) 0 100% / 14px 14px no-repeat,'
      + 'linear-gradient(180deg, #fbfbfa 0%, #f6f7f6 100%)',
  },
  {
    id: 'lt-stamp',
    label: '印章',
    hint: '右下同心环 + 45° 斜线纹',
    style: 'lone-star',
    base: '#f5f6f4',
    bg:
      'radial-gradient(circle at 86% 88%, transparent 0 44px, rgba(20,27,34,0.18) 44px 45px, transparent 45px 52px, rgba(216,121,56,0.5) 52px 53px, transparent 53px),'
      + 'repeating-linear-gradient(-45deg, rgba(20,27,34,0.045) 0 1px, transparent 1px 9px),'
      + 'linear-gradient(90deg, rgba(20,27,34,0.28) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'linear-gradient(180deg, #fafbf9 0%, #f5f6f4 100%)',
  },
  {
    id: 'lt-night',
    label: '夜航',
    hint: '深蓝底 + 冷白细网格 + 橙色基线',
    style: 'lone-star',
    base: '#101923',
    bg:
      'linear-gradient(90deg, rgba(232,226,211,0.06) 0 1px, transparent 1px) 0 0 / 24px 24px repeat,'
      + 'linear-gradient(180deg, rgba(232,226,211,0.06) 0 1px, transparent 1px) 0 0 / 24px 24px repeat,'
      + 'linear-gradient(90deg, rgba(216,121,56,0.55) 0 3px, transparent 3px),'
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
      'linear-gradient(118deg, rgba(18,100,200,0.17) 0 25%, transparent 25% 100%),'
      // 明黄细切线（贴着斜边）
      + 'linear-gradient(118deg, transparent 0 25.2%, rgba(245,216,61,0.9) 25.2% 25.9%, transparent 25.9%),'
      // 右下斜切青蓝块（与左侧错位）
      + 'linear-gradient(118deg, transparent 0 64%, rgba(40,184,242,0.15) 64% 100%),'
      + 'linear-gradient(118deg, transparent 0 78.2%, rgba(18,100,200,0.85) 78.2% 78.8%, transparent 78.8%),'
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
      + 'repeating-linear-gradient(90deg, rgba(7,27,58,0.18) 0 1px, transparent 1px 6px) 0 100% / 100% 6px no-repeat,'
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
      + 'linear-gradient(90deg, transparent 0 82%, rgba(18,100,200,0.45) 82% 100%) 0 0 / 100% 18px no-repeat,'
      + 'linear-gradient(180deg, #ffffff 0%, #f4f7fb 100%)',
  },
  {
    id: 'p3r-split',
    label: '对角分割',
    hint: '45° 对角两色 + 明黄细线',
    style: 'p3r',
    base: '#f3f7fd',
    bg:
      'linear-gradient(45deg, rgba(18,100,200,0.16) 0 38%, transparent 38% 100%),'
      + 'linear-gradient(45deg, transparent 0 38.4%, rgba(245,216,61,0.85) 38.4% 39%, transparent 39%),'
      + 'linear-gradient(45deg, transparent 0 72%, rgba(40,184,242,0.14) 72% 100%),'
      + 'linear-gradient(180deg, #ffffff 0%, #f3f7fd 100%)',
  },
  {
    id: 'p3r-neon',
    label: '霓虹夜',
    hint: '深蓝底 + 青蓝霓虹边线 + 明黄点',
    style: 'p3r',
    base: '#071B3A',
    bg:
      'linear-gradient(90deg, rgba(40,184,242,0.35) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'linear-gradient(180deg, rgba(245,216,61,0.28) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'linear-gradient(118deg, rgba(40,184,242,0.20) 0 22%, transparent 22% 100%),'
      + 'radial-gradient(circle at 88% 12%, rgba(245,216,61,0.42) 0 5px, transparent 5.5px),'
      + 'linear-gradient(180deg, #0B2450 0%, #071B3A 100%)',
  },
  {
    id: 'p3r-band',
    label: '三色横带',
    hint: '上中下三条横带 + 细线收口',
    style: 'p3r',
    base: '#f5f8fd',
    bg:
      'linear-gradient(90deg, rgba(18,100,200,0.22) 0 100%) 0 0 / 100% 18% no-repeat,'
      + 'linear-gradient(90deg, rgba(40,184,242,0.18) 0 100%) 0 62% / 100% 10% no-repeat,'
      + 'linear-gradient(90deg, rgba(245,216,61,0.55) 0 100%) 0 100% / 100% 4% no-repeat,'
      + 'linear-gradient(180deg, rgba(7,27,58,0.18) 0 1px, transparent 1px) 0 18% / 100% 1px no-repeat,'
      + 'linear-gradient(180deg, #ffffff 0%, #f5f8fd 100%)',
  },
  {
    id: 'p3r-frame',
    label: '细框',
    hint: '内缩细框 + 四角小十字',
    style: 'p3r',
    base: '#f4f7fc',
    bg:
      'linear-gradient(90deg, transparent 0 22px, rgba(7,27,58,0.30) 22px 23px, transparent 23px calc(100% - 23px), rgba(7,27,58,0.30) calc(100% - 23px) calc(100% - 22px), transparent calc(100% - 22px)),'
      + 'linear-gradient(180deg, transparent 0 22px, rgba(7,27,58,0.30) 22px 23px, transparent 23px calc(100% - 23px), rgba(7,27,58,0.30) calc(100% - 23px) calc(100% - 22px), transparent calc(100% - 22px)),'
      + 'linear-gradient(90deg, rgba(18,100,200,0.7) 0 1px, transparent 1px) 22px 22px / 14px 1px no-repeat,'
      + 'linear-gradient(180deg, rgba(18,100,200,0.7) 0 1px, transparent 1px) 22px 22px / 1px 14px no-repeat,'
      + 'linear-gradient(180deg, #ffffff 0%, #f4f7fc 100%)',
  },
  {
    id: 'p3r-dots',
    label: '点阵',
    hint: '网点底纹 + 右缘色带',
    style: 'p3r',
    base: '#f3f7fd',
    bg:
      'radial-gradient(circle, rgba(7,27,58,0.16) 0 1px, transparent 1.2px) 0 0 / 12px 12px repeat,'
      + 'linear-gradient(90deg, transparent 0 calc(100% - 40px), rgba(18,100,200,0.22) calc(100% - 40px) 100%),'
      + 'linear-gradient(90deg, transparent 0 calc(100% - 6px), rgba(245,216,61,0.7) calc(100% - 6px) 100%),'
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
      'linear-gradient(90deg, rgba(255,0,240,0.85) 0 12%, rgba(184,255,61,0.9) 12% 24%, rgba(0,255,162,0.85) 24% 36%, transparent 36%) 0 0 / 100% 3px no-repeat,'
      // 45° 工业细斜线纹
      + 'repeating-linear-gradient(-45deg, rgba(22,22,22,0.05) 0 1px, transparent 1px 6.5px),'
      // 右缘墨色分区线
      + 'linear-gradient(90deg, transparent 0 calc(100% - 96px), rgba(22,22,22,0.10) calc(100% - 96px)),'
      // 右下角记录区细线
      + 'linear-gradient(180deg, transparent 0 88%, rgba(22,22,22,0.12) 88% 88.3%, transparent 88.3%),'
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
      'linear-gradient(90deg, rgba(255,0,240,0.75) 0 12%, rgba(184,255,61,0.85) 12% 24%, rgba(0,255,162,0.75) 24% 36%, transparent 36%) 0 0 / 100% 3px no-repeat,'
      // 浅墨色斜线纹（深底上才看得见）
      + 'repeating-linear-gradient(-45deg, rgba(237,237,237,0.055) 0 1px, transparent 1px 6.5px),'
      // 右缘 lime 细分区
      + 'linear-gradient(90deg, transparent 0 82%, rgba(184,255,61,0.10) 82%),'
      // 底部数据线
      + 'linear-gradient(180deg, transparent 0 86%, rgba(237,237,237,0.14) 86% 86.3%, transparent 86.3%),'
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
      'linear-gradient(90deg, rgba(255,0,240,0.75) 0 10%, rgba(184,255,61,0.85) 10% 20%, rgba(0,255,162,0.75) 20% 30%, transparent 30%) 0 0 / 100% 3px no-repeat,'
      // 工程坐标网格（竖向 + 横向细线，24px 一格）
      + 'linear-gradient(90deg, rgba(22,22,22,0.07) 0 1px, transparent 1px) 0 0 / 24px 24px repeat,'
      + 'linear-gradient(180deg, rgba(22,22,22,0.07) 0 1px, transparent 1px) 0 0 / 24px 24px repeat,'
      // 右缘编号栏
      + 'linear-gradient(90deg, transparent 0 calc(100% - 120px), rgba(22,22,22,0.12) calc(100% - 120px)),'
      // 右下角标题框
      + 'linear-gradient(180deg, transparent 0 90%, rgba(22,22,22,0.10) 90% 90.3%, transparent 90.3%),'
      + 'linear-gradient(165deg, #f6f6f3 0%, #f2f2ef 60%, #ececea 100%)',
  },
  {
    id: 'ef-rail',
    label: '导轨',
    hint: '左侧导轨 + 底部刻度 + 顶边三色条',
    style: 'endfield',
    base: '#f3f4f2',
    bg:
      'linear-gradient(90deg, rgba(255,0,240,0.7) 0 8%, rgba(184,255,61,0.85) 8% 16%, rgba(0,255,162,0.7) 16% 24%, transparent 24%) 0 0 / 100% 3px no-repeat,'
      + 'linear-gradient(90deg, rgba(22,22,22,0.16) 0 10px, transparent 10px),'
      + 'repeating-linear-gradient(180deg, rgba(22,22,22,0.24) 0 1px, transparent 1px 14px) 0 0 / 10px 100% no-repeat,'
      + 'repeating-linear-gradient(90deg, rgba(22,22,22,0.22) 0 1px, transparent 1px 10px) 0 100% / 100% 14px no-repeat,'
      + 'linear-gradient(180deg, rgba(22,22,22,0.30) 0 1px, transparent 1px) 0 calc(100% - 14px) / 100% 1px no-repeat,'
      + 'linear-gradient(180deg, #fafaf8 0%, #f3f4f2 100%)',
  },
  {
    id: 'ef-scan',
    label: '扫描线',
    hint: '横向扫描线 + 右缘 lime 细线',
    style: 'endfield',
    base: '#f2f3f1',
    bg:
      'linear-gradient(90deg, rgba(255,0,240,0.65) 0 8%, rgba(184,255,61,0.8) 8% 16%, rgba(0,255,162,0.65) 16% 24%, transparent 24%) 0 0 / 100% 3px no-repeat,'
      + 'repeating-linear-gradient(180deg, rgba(22,22,22,0.055) 0 1px, transparent 1px 4px),'
      + 'linear-gradient(90deg, transparent 0 calc(100% - 3px), rgba(184,255,61,0.5) calc(100% - 3px) 100%),'
      + 'linear-gradient(180deg, #f8f9f7 0%, #f2f3f1 100%)',
  },
  {
    id: 'ef-batch',
    label: '批次格',
    hint: '右上批次方块 + 底部编号带',
    style: 'endfield',
    base: '#f3f4f2',
    bg:
      'linear-gradient(90deg, rgba(255,0,240,0.65) 0 8%, rgba(184,255,61,0.8) 8% 16%, rgba(0,255,162,0.65) 16% 24%, transparent 24%) 0 0 / 100% 3px no-repeat,'
      + 'linear-gradient(90deg, rgba(22,22,22,0.14) 0 100%) calc(100% - 88px) 0 / 88px 44px no-repeat,'
      + 'linear-gradient(90deg, rgba(184,255,61,0.45) 0 100%) calc(100% - 88px) 44px / 88px 3px no-repeat,'
      + 'repeating-linear-gradient(90deg, rgba(22,22,22,0.20) 0 1px, transparent 1px 8px) 0 100% / 100% 10px no-repeat,'
      + 'linear-gradient(180deg, #fafaf8 0%, #f3f4f2 100%)',
  },
  {
    id: 'ef-stamp',
    label: '盖章',
    hint: '右下斜线纹方块 + 顶边三色条',
    style: 'endfield',
    base: '#f4f4f2',
    bg:
      'linear-gradient(90deg, rgba(255,0,240,0.6) 0 8%, rgba(184,255,61,0.78) 8% 16%, rgba(0,255,162,0.6) 16% 24%, transparent 24%) 0 0 / 100% 3px no-repeat,'
      + 'repeating-linear-gradient(-45deg, rgba(22,22,22,0.10) 0 1px, transparent 1px 7px) calc(100% - 132px) calc(100% - 84px) / 132px 84px no-repeat,'
      + 'linear-gradient(90deg, rgba(22,22,22,0.22) 0 1px, transparent 1px) calc(100% - 132px) calc(100% - 84px) / 1px 84px no-repeat,'
      + 'linear-gradient(180deg, rgba(22,22,22,0.22) 0 1px, transparent 1px) calc(100% - 132px) calc(100% - 84px) / 132px 1px no-repeat,'
      + 'linear-gradient(180deg, #fbfbf9 0%, #f4f4f2 100%)',
  },
  {
    id: 'ef-carbon',
    label: '暗碳',
    hint: '碳灰底 + 45° 斜线纹 + lime 细线',
    style: 'endfield',
    base: '#171717',
    bg:
      'linear-gradient(90deg, rgba(184,255,61,0.55) 0 3px, transparent 3px),'
      + 'repeating-linear-gradient(-45deg, rgba(237,237,237,0.05) 0 1px, transparent 1px 6px),'
      + 'linear-gradient(180deg, rgba(237,237,237,0.10) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'linear-gradient(180deg, #1E1E1E 0%, #171717 100%)',
  },
]

/* ── 瑞士风格：12 栏网格 / 米白 / 墨底（国际主义平面设计）──
   只有三种颜色与细线：网格线一律 1px，不叠纹理、不做渐变底。 */
const SWISS_BGS = [
  {
    id: 'ch-grid',
    label: '十二栏版式',
    hint: '米白 + 12 栏竖向细线 + 顶部墨线',
    style: 'swiss',
    base: '#f2efe9',
    bg:
      // 12 栏竖向细线（每栏 8.3333%）
      'repeating-linear-gradient(90deg, rgba(17,17,17,0.10) 0 1px, transparent 1px 8.3333%),'
      // 顶部墨线（版面开始）
      + 'linear-gradient(180deg, rgba(17,17,17,0.85) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      // 左上角红色编号块（很小的实心块，靠 background-size 限定尺寸）
      + 'linear-gradient(90deg, rgba(218,41,28,0.9) 0 100%) 0 0 / 26px 3px no-repeat,'
      + 'linear-gradient(180deg, #f6f3ed 0%, #f2efe9 100%)',
  },
  {
    id: 'ch-asym',
    label: '不对称留白',
    hint: '米白 + 左侧 1/3 栏线 + 大留白',
    style: 'swiss',
    base: '#f2efe9',
    bg:
      // 只画出左侧三分栏的竖线：留白由缺线表达
      'repeating-linear-gradient(90deg, rgba(17,17,17,0.12) 0 1px, transparent 1px 8.3333%) 0 0 / 33.3333% 100% no-repeat,'
      // 右侧一条竖向分区线
      + 'linear-gradient(90deg, transparent 0 calc(100% - 1px), rgba(17,17,17,0.35) calc(100% - 1px) 100%),'
      // 顶部墨线 + 红色编号块
      + 'linear-gradient(180deg, rgba(17,17,17,0.85) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'linear-gradient(90deg, rgba(218,41,28,0.9) 0 100%) 0 0 / 60px 2px no-repeat,'
      + 'linear-gradient(180deg, #f6f3ed 0%, #f2efe9 100%)',
  },
  {
    id: 'ch-black',
    label: '墨底',
    hint: '墨黑底 + 米白细线 + 红色编号块',
    style: 'swiss',
    base: '#111111',
    bg:
      // 12 栏细线（深底上换成米白 10%）
      'repeating-linear-gradient(90deg, rgba(242,239,233,0.10) 0 1px, transparent 1px 8.3333%),'
      // 顶部米白细线 + 红色编号块
      + 'linear-gradient(180deg, rgba(242,239,233,0.9) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'linear-gradient(90deg, rgba(218,41,28,0.92) 0 100%) 0 0 / 26px 3px no-repeat,'
      + 'linear-gradient(180deg, #161616 0%, #111111 100%)',
  },
  {
    id: 'ch-columns',
    label: '双栏',
    hint: '中间竖线分成两栏 + 12 栏细线 + 红块',
    style: 'swiss',
    base: '#f2efe9',
    bg:
      'linear-gradient(90deg, transparent 0 calc(50% - 1px), rgba(17,17,17,0.55) calc(50% - 1px) 50%, transparent 50%),'
      + 'repeating-linear-gradient(90deg, rgba(17,17,17,0.09) 0 1px, transparent 1px 8.3333%),'
      + 'linear-gradient(180deg, rgba(17,17,17,0.85) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'linear-gradient(90deg, rgba(218,41,28,0.9) 0 100%) 0 0 / 26px 3px no-repeat,'
      + 'linear-gradient(180deg, #f6f3ed 0%, #f2efe9 100%)',
  },
  {
    id: 'ch-rule',
    label: '横线',
    hint: '上中下三条墨线 + 米白底',
    style: 'swiss',
    base: '#f2efe9',
    bg:
      'linear-gradient(180deg, rgba(17,17,17,0.85) 0 2px, transparent 2px calc(50% - 1px), rgba(17,17,17,0.35) calc(50% - 1px) 50%, transparent 50% calc(100% - 1px), rgba(17,17,17,0.85) calc(100% - 1px) 100%),'
      + 'linear-gradient(90deg, rgba(218,41,28,0.9) 0 100%) 0 0 / 40px 3px no-repeat,'
      + 'linear-gradient(180deg, #f6f3ed 0%, #f2efe9 100%)',
  },
  {
    id: 'ch-corner',
    label: '角标',
    hint: '左上红块 + 右下墨线角',
    style: 'swiss',
    base: '#f2efe9',
    bg:
      'linear-gradient(90deg, rgba(218,41,28,0.92) 0 100%) 0 0 / 44px 44px no-repeat,'
      + 'linear-gradient(90deg, transparent 0 calc(100% - 60px), rgba(17,17,17,0.35) calc(100% - 60px) calc(100% - 59px), transparent calc(100% - 59px)) 0 100% / 100% 60px no-repeat,'
      + 'linear-gradient(180deg, transparent 0 calc(100% - 60px), rgba(17,17,17,0.35) calc(100% - 60px) calc(100% - 59px), transparent calc(100% - 59px)) 100% 0 / 60px 100% no-repeat,'
      + 'repeating-linear-gradient(90deg, rgba(17,17,17,0.07) 0 1px, transparent 1px 8.3333%),'
      + 'linear-gradient(180deg, #f6f3ed 0%, #f2efe9 100%)',
  },
  {
    id: 'ch-numbers',
    label: '大编号',
    hint: '右上编号灰块 + 左侧栏线',
    style: 'swiss',
    base: '#f2efe9',
    bg:
      'linear-gradient(90deg, rgba(17,17,17,0.10) 0 100%) calc(100% - 120px) 0 / 120px 72px no-repeat,'
      + 'linear-gradient(90deg, rgba(218,41,28,0.9) 0 100%) calc(100% - 120px) 72px / 120px 3px no-repeat,'
      + 'linear-gradient(90deg, rgba(17,17,17,0.35) 0 1px, transparent 1px) 33.3333% 0 / 1px 100% no-repeat,'
      + 'repeating-linear-gradient(90deg, rgba(17,17,17,0.07) 0 1px, transparent 1px 8.3333%),'
      + 'linear-gradient(180deg, #f6f3ed 0%, #f2efe9 100%)',
  },
  {
    id: 'ch-inverse',
    label: '反白',
    hint: '墨底 + 米白细线 + 红色标记',
    style: 'swiss',
    base: '#111111',
    bg:
      'linear-gradient(90deg, rgba(242,239,233,0.12) 0 1px, transparent 1px) 0 0 / 33.3333% 100% no-repeat,'
      + 'linear-gradient(180deg, rgba(242,239,233,0.9) 0 1px, transparent 1px) 0 0 / 100% 100% no-repeat,'
      + 'linear-gradient(90deg, rgba(218,41,28,0.92) 0 100%) 0 0 / 40px 3px no-repeat,'
      + 'linear-gradient(180deg, #161616 0%, #111111 100%)',
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
      'linear-gradient(180deg, rgba(208,48,42,0.94) 0 1.4%, transparent 1.4%),'
      // 上边粗线
      + 'linear-gradient(180deg, transparent 0 1.4%, rgba(17,17,17,0.94) 1.4% 2%, transparent 2%),'
      // 左缘粗线
      + 'linear-gradient(90deg, rgba(17,17,17,0.94) 0 1.2%, transparent 1.2%),'
      // 右下蓝角（横 + 竖两条贴边）
      + 'linear-gradient(180deg, transparent 0 98%, rgba(29,63,140,0.9) 98% 100%),'
      + 'linear-gradient(90deg, transparent 0 98.4%, rgba(29,63,140,0.9) 98.4% 100%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-block',
    label: '色块',
    hint: '左缘黄条 + 右缘红条 + 上下墨线',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(90deg, rgba(235,194,38,0.9) 0 1.4%, transparent 1.4%),'
      + 'linear-gradient(90deg, transparent 0 98.6%, rgba(208,48,42,0.9) 98.6% 100%),'
      + 'linear-gradient(180deg, rgba(17,17,17,0.94) 0 1.1%, transparent 1.1%),'
      + 'linear-gradient(180deg, transparent 0 98.9%, rgba(17,17,17,0.94) 98.9% 100%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-rule',
    label: '粗线',
    hint: '上下粗黑边 + 左缘蓝条 + 右缘黄线',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(180deg, rgba(17,17,17,0.94) 0 1.6%, transparent 1.6% calc(100% - 1.6%), rgba(17,17,17,0.94) calc(100% - 1.6%) 100%),'
      + 'linear-gradient(90deg, rgba(29,63,140,0.9) 0 1.2%, transparent 1.2%),'
      + 'linear-gradient(90deg, transparent 0 99.2%, rgba(235,194,38,0.9) 99.2% 100%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-corner',
    label: '角块',
    hint: '左上红角 + 右下黄角 + 一圈细黑框',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(90deg, rgba(208,48,42,0.94) 0 2.2%, transparent 2.2%),'
      + 'linear-gradient(180deg, rgba(208,48,42,0.94) 0 1.6%, transparent 1.6%),'
      + 'linear-gradient(90deg, transparent 0 97.8%, rgba(235,194,38,0.9) 97.8% 100%),'
      + 'linear-gradient(180deg, transparent 0 98.4%, rgba(235,194,38,0.9) 98.4% 100%),'
      + 'linear-gradient(180deg, transparent 0 0.6%, rgba(17,17,17,0.6) 0.6% 0.9%, transparent 0.9% calc(100% - 0.9%), rgba(17,17,17,0.6) calc(100% - 0.9%) calc(100% - 0.6%), transparent calc(100% - 0.6%)),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-band',
    label: '横带',
    hint: '顶部黄带 + 红短线 + 底部墨线',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(180deg, rgba(235,194,38,0.9) 0 1.4%, transparent 1.4%),'
      + 'linear-gradient(180deg, transparent 0 1.4%, rgba(17,17,17,0.94) 1.4% 1.9%, transparent 1.9%),'
      + 'linear-gradient(90deg, rgba(208,48,42,0.94) 0 1.2%, transparent 1.2%),'
      + 'linear-gradient(180deg, transparent 0 99%, rgba(17,17,17,0.94) 99% 100%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-column',
    label: '竖栏',
    hint: '右缘蓝栏 + 竖粗线 + 左上黄块',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(90deg, transparent 0 97.6%, rgba(29,63,140,0.9) 97.6% 100%),'
      + 'linear-gradient(90deg, transparent 0 97.1%, rgba(17,17,17,0.94) 97.1% 97.6%, transparent 97.6%),'
      + 'linear-gradient(90deg, rgba(235,194,38,0.9) 0 1.6%, transparent 1.6%),'
      + 'linear-gradient(180deg, rgba(235,194,38,0.9) 0 1.2%, transparent 1.2%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-letter',
    label: '方块字母',
    hint: '顶部三色小方块 + 一条墨线 + 右缘蓝线',
    style: 'stijl',
    base: '#f4f1ea',
    bg:
      'linear-gradient(90deg, rgba(17,17,17,0.94) 0 1%, transparent 1% 1.8%, rgba(208,48,42,0.94) 1.8% 2.8%, transparent 2.8% 3.6%, rgba(235,194,38,0.94) 3.6% 4.6%, transparent 4.6%),'
      + 'linear-gradient(180deg, transparent 0 1.6%, rgba(17,17,17,0.94) 1.6% 2.1%, transparent 2.1%),'
      + 'linear-gradient(90deg, transparent 0 99%, rgba(29,63,140,0.85) 99% 100%),'
      + 'linear-gradient(180deg, #f7f4ee 0%, #f4f1ea 100%)',
  },
  {
    id: 'st-inverse',
    label: '反白',
    hint: '黑底 + 米白粗边 + 四角三原色',
    style: 'stijl',
    base: '#111111',
    bg:
      'linear-gradient(180deg, rgba(244,241,234,0.9) 0 1.2%, transparent 1.2%),'
      + 'linear-gradient(90deg, rgba(244,241,234,0.9) 0 0.9%, transparent 0.9%),'
      + 'linear-gradient(90deg, rgba(208,48,42,0.94) 0 1.8%, transparent 1.8%),'
      + 'linear-gradient(90deg, transparent 0 98.2%, rgba(29,63,140,0.92) 98.2% 100%),'
      + 'linear-gradient(180deg, transparent 0 98.8%, rgba(235,194,38,0.92) 98.8% 100%),'
      + 'linear-gradient(180deg, #171717 0%, #111111 100%)',
  },
]


export const REPORT_BACKGROUNDS = [DEFAULT_BG, ...LONE_STAR_BGS, ...P3R_BGS, ...ENDFIELD_BGS, ...SWISS_BGS, ...STIJL_BGS]

/* 选择器按「默认 / 孤星风格 / P3R 风格 / 终末地风格 / 瑞士风格」分组展示 */
export const REPORT_BG_GROUPS = [
  { id: 'default', label: '默认', items: [DEFAULT_BG] },
  { id: 'lone-star', label: '孤星风格', items: LONE_STAR_BGS },
  { id: 'p3r', label: 'P3R 风格', items: P3R_BGS },
  { id: 'endfield', label: '终末地风格', items: ENDFIELD_BGS },
  { id: 'swiss', label: '瑞士风格', items: SWISS_BGS },
  { id: 'stijl', label: '风格派', items: STIJL_BGS },
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

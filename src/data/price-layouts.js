// ═══════════════════════════════════════════════════════════════════
// 价格表排版预设与自由调整配置
//
// 设计原则（硬约束）：
//   1. 「原版」必须作为正式预设完整保留 —— classic 的所有取值等于
//      重构前 PricePage 的既有样式，切换回来必须与原来一模一样。
//   2. 预设只描述「排版」，不携带任何业务数据（游戏 / 服务 / 价格
//      始终来自 tr-prices）。切换预设绝不改动、也绝不丢业务数据。
//   3. 所有字段都有默认值，配置文件可安全地增量扩展。
// ═══════════════════════════════════════════════════════════════════

export const LAYOUT_SCHEMA = 1

// 页面方向
export const ORIENTATION = { PORTRAIT: 'portrait', LANDSCAPE: 'landscape' }
// 分类区块布局
export const CAT_LAYOUT = { CARD: 'card', PLAIN: 'plain', COLUMNS: 'columns', POSTER: 'poster' }
// 装饰方式（静态图形，不使用发光 / 粒子 / 扫光）
export const DECOR = { NONE: 'none', GRID: 'grid', NUMBERING: 'numbering', RULES: 'rules' }

// 页面构图（第二轮）：一个预设 = 一种真正不同的排版结构，而不是同一结构换参数
export const PRICE_STRUCTURES = {
  classic: 'stack',    // 单列：店铺信息 + 分类卡片（原版）
  archive: 'split',    // 左右分区：左信息栏 + 右价目区 + 页脚档案信息
  terminal: 'panels',  // 模块化：左状态栏 + 右双列面板
  catalog: 'dense',    // 单列高密度：去卡片边框的紧凑列表
  poster: 'block',     // 大块分区：大标题 + 加粗分区块
}
export function structureOf(presetId) {
  return PRICE_STRUCTURES[presetId] || 'stack'
}

export function defaultLayout() {
  return {
    schema: LAYOUT_SCHEMA,
    preset: 'classic',
    structure: 'stack',
    page: {
      orientation: ORIENTATION.PORTRAIT,
      width: 900,
      padding: 24,
      paddingTop: 80,
      background: '#ffffff',
      minHeight: 0,
    },
    text: { color: '#0d0d0d', font: '', scale: 1 },
    accent: '#0d0d0d',
    lines: { color: 'rgba(0,0,0,0.12)', soft: 'rgba(0,0,0,0.1)' },
    head: { background: 'transparent', soft: 'rgba(0,0,0,0.02)', strong: false, letterSpacing: 2 },
    category: { layout: CAT_LAYOUT.CARD, columns: 1, gap: 16, badge: true, numbering: false },
    title: { show: false, text: '', align: 'left', size: 22, letterSpacing: 2 },
    decor: DECOR.NONE,
    density: 1,
    export: { scale: 2 },
  }
}

// 四种内置预设（+ 原版）。取值刻意贴近各自的设计语言：
//   档案式 = 暖白 + 细线 + 工程编号；终端式 = 深空蓝黑 + 工业橙；
//   目录式 = 高密度双列；海报式 = 大标题构图。
export const PRESETS = [
  {
    id: 'classic',
    name: '原版',
    desc: '重构前的原始价格表设计（默认）',
    layout: defaultLayout(),
  },
  {
    id: 'archive',
    name: '航天档案式',
    desc: '暖白档案纸 · 工程编号 · 细线分隔',
    layout: {
      ...defaultLayout(),
      preset: 'archive',
      page: { orientation: ORIENTATION.PORTRAIT, width: 900, padding: 28, paddingTop: 72, background: '#E8E2D3', minHeight: 0 },
      text: { color: '#1d232a', font: '', scale: 1 },
      accent: '#101923',
      lines: { color: 'rgba(16,25,35,0.35)', soft: 'rgba(16,25,35,0.18)' },
      head: { background: 'rgba(16,25,35,0.05)', soft: 'rgba(16,25,35,0.04)', strong: true, letterSpacing: 3 },
      category: { layout: CAT_LAYOUT.PLAIN, columns: 1, gap: 18, badge: true, numbering: true },
      title: { show: true, text: '', align: 'left', size: 24, letterSpacing: 3 },
      decor: DECOR.NUMBERING,
      density: 1,
    },
  },
  {
    id: 'terminal',
    name: '工业终端式',
    desc: '深空蓝黑 · 工业橙强调 · 模块卡片',
    layout: {
      ...defaultLayout(),
      preset: 'terminal',
      page: { orientation: ORIENTATION.PORTRAIT, width: 880, padding: 20, paddingTop: 56, background: '#101923', minHeight: 0 },
      text: { color: '#E8E2D3', font: '', scale: 1 },
      accent: '#D87938',
      lines: { color: 'rgba(232,226,211,0.22)', soft: 'rgba(232,226,211,0.12)' },
      head: { background: 'rgba(216,121,56,0.14)', soft: 'rgba(232,226,211,0.05)', strong: true, letterSpacing: 2 },
      category: { layout: CAT_LAYOUT.CARD, columns: 1, gap: 14, badge: true, numbering: false },
      title: { show: true, text: '', align: 'left', size: 22, letterSpacing: 4 },
      decor: DECOR.GRID,
      density: 0.96,
    },
  },
  {
    id: 'catalog',
    name: '简约目录式',
    desc: '信息密度高 · 双列分区 · 适合手机浏览',
    layout: {
      ...defaultLayout(),
      preset: 'catalog',
      page: { orientation: ORIENTATION.PORTRAIT, width: 760, padding: 18, paddingTop: 40, background: '#ffffff', minHeight: 0 },
      text: { color: '#14181c', font: '', scale: 0.96 },
      accent: '#1d232a',
      lines: { color: 'rgba(20,24,28,0.16)', soft: 'rgba(20,24,28,0.08)' },
      head: { background: 'rgba(20,24,28,0.04)', soft: 'rgba(20,24,28,0.03)', strong: true, letterSpacing: 1 },
      category: { layout: CAT_LAYOUT.COLUMNS, columns: 2, gap: 12, badge: false, numbering: false },
      title: { show: true, text: '', align: 'left', size: 20, letterSpacing: 1 },
      decor: DECOR.NONE,
      density: 0.92,
    },
  },
  {
    id: 'poster',
    name: '宣传海报式',
    desc: '强调构图与标题 · 适合对外宣传',
    layout: {
      ...defaultLayout(),
      preset: 'poster',
      page: { orientation: ORIENTATION.PORTRAIT, width: 820, padding: 32, paddingTop: 96, background: '#101923', minHeight: 0 },
      text: { color: '#E8E2D3', font: '', scale: 1.06 },
      accent: '#D87938',
      lines: { color: 'rgba(232,226,211,0.3)', soft: 'rgba(232,226,211,0.14)' },
      head: { background: 'transparent', soft: 'rgba(232,226,211,0.06)', strong: true, letterSpacing: 6 },
      category: { layout: CAT_LAYOUT.POSTER, columns: 1, gap: 22, badge: false, numbering: false },
      title: { show: true, text: '', align: 'center', size: 34, letterSpacing: 8 },
      decor: DECOR.RULES,
      density: 1.08,
    },
  },
]

export function presetById(id) {
  return PRESETS.find(p => p.id === id) || PRESETS[0]
}

export function presetLayout(id) {
  return JSON.parse(JSON.stringify(presetById(id).layout))
}

function num(v, d) {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}
function str(v, d) {
  return v == null || v === '' ? d : String(v)
}

// 规范化：任何来源（本地存储 / 旧版本配置 / 用户模板）都补全为完整结构
export function normalizeLayout(raw) {
  const base = defaultLayout()
  if (!raw || typeof raw !== 'object') return base
  const g = raw
  const preset = PRESETS.some(p => p.id === g.preset) ? g.preset : base.preset
  return {
    schema: LAYOUT_SCHEMA,
    preset,
    structure: structureOf(preset),
    page: {
      orientation: g.page?.orientation === ORIENTATION.LANDSCAPE ? ORIENTATION.LANDSCAPE : ORIENTATION.PORTRAIT,
      width: Math.max(320, num(g.page?.width, base.page.width)),
      padding: Math.max(0, num(g.page?.padding, base.page.padding)),
      paddingTop: Math.max(0, num(g.page?.paddingTop, base.page.paddingTop)),
      background: str(g.page?.background, base.page.background),
      minHeight: Math.max(0, num(g.page?.minHeight, 0)),
    },
    text: {
      color: str(g.text?.color, base.text.color),
      font: str(g.text?.font, ''),
      scale: Math.max(0.6, Math.min(2, num(g.text?.scale, 1))),
    },
    accent: str(g.accent, base.accent),
    lines: {
      color: str(g.lines?.color, base.lines.color),
      soft: str(g.lines?.soft, base.lines.soft),
    },
    head: {
      background: str(g.head?.background, base.head.background),
      soft: str(g.head?.soft, base.head.soft),
      strong: !!g.head?.strong,
      letterSpacing: Math.max(0, Math.min(12, num(g.head?.letterSpacing, 2))),
    },
    category: {
      layout: Object.values(CAT_LAYOUT).includes(g.category?.layout) ? g.category.layout : base.category.layout,
      columns: Math.max(1, Math.min(4, num(g.category?.columns, 1))),
      gap: Math.max(0, Math.min(64, num(g.category?.gap, 16))),
      badge: g.category?.badge !== false,
      numbering: !!g.category?.numbering,
    },
    title: {
      show: g.title?.show === true,
      text: str(g.title?.text, ''),
      align: ['left', 'center', 'right'].includes(g.title?.align) ? g.title.align : 'left',
      size: Math.max(12, Math.min(72, num(g.title?.size, base.title.size))),
      letterSpacing: Math.max(0, Math.min(16, num(g.title?.letterSpacing, 2))),
    },
    decor: Object.values(DECOR).includes(g.decor) ? g.decor : DECOR.NONE,
    density: Math.max(0.7, Math.min(1.6, num(g.density, 1))),
    export: { scale: Math.max(1, Math.min(4, num(g.export?.scale, 2))) },
  }
}

// ═══════════════════════════════════════════════════════════════════
// 日报卡片布局
//
// 以前六张卡（日常 / 周常 / 资源 / 计划 / 备注 / 截图）是写死在
// ReportSheet.vue 里的 div：顺序、能不能并排、能不能删都改不了。
// 现在拆成一份「卡片清单」：
//   · 内置卡可调顺序、可切「整行 / 半宽」、可临时隐藏；
//   · 可加任意多张自定义卡（标题 + 若干条目行）；
//   · 宽度只有两档，靠 flex-wrap 自动折行即可表达并排，
//     不需要在数据里写「第几行第几列」这种容易写坏的坐标。
//
// 清单会跟模板一起走草稿（tr-report-draft）与全局预设（game.report.layout）。
// ═══════════════════════════════════════════════════════════════════

/** 可选的卡片宽度：full = 独占一行；half = 半宽，相邻两张自动并排 */
export const CARD_WIDTHS = ['full', 'half']

export const CARD_WIDTH_LABEL = { full: '整行', half: '半宽' }

/* ── 条目行：两种形态 ──
   check  按钮型：标签 + 「完成 / 未完成」（与日报里的「每日任务」一致）
   text   文本型：标签 + 一个输入框（与「理智剩余」一致，直接填数字或文字） */
export const ROW_KINDS = ['check', 'text']
export const ROW_KIND_LABEL = { check: '按钮', text: '文本' }

/**
 * 规范化条目行。兼容两种历史写法：
 *   '每日任务'                     → { label: '每日任务', kind: 'check' }
 *   { label: '理智剩余', kind: 'text' } → 原样保留
 */
export function normalizeRows(list, { allowEmpty = false } = {}) {
  return (Array.isArray(list) ? list : [])
    .map(item => {
      if (typeof item === 'string') {
        const label = item.trim()
        if (!label && !allowEmpty) return null
        return { label, kind: 'check' }
      }
      if (!item || typeof item !== 'object') return null
      const label = String(item.label == null ? '' : item.label).trim()
      if (!label && !allowEmpty) return null
      const row = { label, kind: item.kind === 'text' ? 'text' : 'check' }
      // 日报里填的运行时状态（勾选 / 文本值）一并保留，避免改布局时被清掉
      if (item.done !== undefined) row.done = item.done !== false
      if (item.value !== undefined) row.value = String(item.value)
      // 条目也可以「隐藏」：配置留着，只是日报里不显示
      if (item.visible === false) row.visible = false
      return row
    })
    .filter(Boolean)
}

/** 内置卡片（缺省布局就是它们在数组里的顺序） */
export const BUILTIN_CARDS = [
  { id: 'daily', kind: 'daily', width: 'half', titleKey: 'cardDaily' },
  { id: 'weekly', kind: 'weekly', width: 'half', titleKey: 'cardWeekly' },
  { id: 'resources', kind: 'resources', width: 'full', titleKey: 'cardResources' },
  { id: 'plan', kind: 'plan', width: 'full', titleKey: 'cardPlan' },
  { id: 'note', kind: 'note', width: 'full', titleKey: 'cardNote' },
  { id: 'shots', kind: 'shots', width: 'full', titleKey: 'cardShots' },
]

const BUILTIN_BY_ID = new Map(BUILTIN_CARDS.map(c => [c.id, c]))

let seq = 0
/** 新自定义卡片的 id（时间 + 序号，够用且不必查重） */
export function newCardId() {
  seq += 1
  return `c${Date.now().toString(36)}${seq.toString(36)}`
}

function str(v) {
  return v == null ? '' : String(v)
}

function widthOf(value, fallback) {
  return CARD_WIDTHS.includes(value) ? value : fallback
}

function lineList(v) {
  // 默认「完成」：自定义卡片的按钮型条目一新建就是选中状态（和内置任务项一致）
  return normalizeRows(v, { allowEmpty: true }).map(row => ({ done: true, ...row }))
}

/** 规范化单张卡片；非法输入返回 null */
export function normalizeCard(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = str(raw.id).trim()
  if (!id) return null
  const builtin = BUILTIN_BY_ID.get(id)
  if (builtin) {
    return {
      id,
      kind: builtin.kind,
      titleKey: builtin.titleKey,
      width: widthOf(raw.width, builtin.width),
      visible: raw.visible !== false,
    }
  }
  return {
    id,
    kind: 'custom',
    title: str(raw.title) || '自定义卡片',
    width: widthOf(raw.width, 'half'),
    visible: raw.visible !== false,
    lines: lineList(raw.lines),
  }
}

/**
 * 规范化整份布局。
 * 用户清单为准；清单里缺的内置卡补在末尾（隐藏用 visible 表达，不会因为老草稿丢卡）。
 */
export function normalizeReportLayout(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.cards) ? raw.cards : [])
  const out = []
  const seen = new Set()
  for (const item of list) {
    const card = normalizeCard(item)
    if (!card || seen.has(card.id)) continue
    seen.add(card.id)
    out.push(card)
  }
  for (const b of BUILTIN_CARDS) {
    if (!seen.has(b.id)) out.push(normalizeCard({ id: b.id }))
  }
  return out
}

/** 渲染用：只保留可见卡片（数组顺序就是显示顺序） */
export function visibleCards(layout) {
  return normalizeReportLayout(layout).filter(c => c.visible !== false)
}

/** 新增一张自定义卡片（附在末尾，默认半宽、三行空条目；行默认「文本」型） */
export function appendCustomCard(layout, title = '自定义卡片') {
  return [...normalizeReportLayout(layout), {
    id: newCardId(),
    kind: 'custom',
    title: str(title) || '自定义卡片',
    width: 'half',
    visible: true,
    lines: [
      { label: '', kind: 'text', done: true },
      { label: '', kind: 'text', done: true },
      { label: '', kind: 'text', done: true },
    ],
  }]
}

/** 上移 / 下移一张卡片（返回新数组，越界时原样返回） */
export function moveCard(layout, id, delta) {
  const list = normalizeReportLayout(layout)
  const i = list.findIndex(c => c.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return list
  const next = [...list]
  const [card] = next.splice(i, 1)
  next.splice(j, 0, card)
  return next
}

/** 删除一张卡片（内置卡不允许删除，只能隐藏） */
export function removeCard(layout, id) {
  if (BUILTIN_BY_ID.has(id)) return normalizeReportLayout(layout)
  return normalizeReportLayout(layout).filter(c => c.id !== id)
}

/** 改某张卡片的一个字段（内置卡只接受 width / visible） */
export function patchCard(layout, id, patch) {
  return normalizeReportLayout(layout).map(card => {
    if (card.id !== id) return card
    const merged = { ...card, ...patch, id: card.id, kind: card.kind }
    if (card.kind !== 'custom') {
      delete merged.title
      delete merged.lines
      merged.titleKey = card.titleKey
    }
    return normalizeCard(merged)
  })
}

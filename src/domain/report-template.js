// ═══════════════════════════════════════════════════════════════════
// 日报模板文案（可编辑）
//
// 以前这些字都写死在模板里，想改一个「日常」得动组件源码。
// 现在拆成一份键表：`game.report.text` 存全局覆盖值，日报页的「临时草稿」再覆盖它。
//
// 三层优先级（后者覆盖前者）：
//   1. DEFAULT_REPORT_TEXT —— 本文件的默认值
//   2. game.report.text   —— 「数据管理 → 游戏与服务 → 日报预设」里的全局配置
//   3. tr-report-draft    —— 日报页「模板」面板里的临时草稿（落盘，直到点「恢复默认」）
// ═══════════════════════════════════════════════════════════════════

export const REPORT_TEXT_FIELDS = [
  { group: '标题与信息栏', items: [
    { key: 'titleTpl', label: '日报标题', def: '{sign}的每日汇报' },
    { key: 'authorLabel', label: '汇报人标签', def: '汇报人' },
    { key: 'metaPrefix', label: '托管信息前缀', def: '托管：第' },
    { key: 'metaDaysSuffix', label: '托管天数后缀', def: '天（' },
    { key: 'metaClose', label: '托管信息收尾', def: '）' },
  ] },
  { group: '卡片标题', placement: 'card', items: [
    { key: 'cardDaily', label: '日常卡片', def: '日常' },
    { key: 'cardWeekly', label: '周常卡片', def: '周常' },
    { key: 'cardResources', label: '资源卡片', def: '今日获取资源' },
    { key: 'cardPlan', label: '计划卡片', def: '明日计划' },
    { key: 'cardNote', label: '备注卡片', def: '备注' },
    { key: 'cardShots', label: '截图卡片', def: '截图' },
  ] },
  { group: '专属行标签', placement: 'card', items: [
    // games：只有这些游戏才有这一行（模板面板按当前游戏过滤，避免出现用不到的字段）
    { key: 'rowSanity', label: '理智剩余', def: '理智剩余', games: ['ak', 'endfield'] },
    { key: 'rowClue', label: '线索传递', def: '线索传递', games: ['ak', 'endfield'] },
    { key: 'rowPixel', label: '本性像素剩余', def: '本性像素剩余', games: ['nte'] },
    { key: 'rowGift', label: '送礼', def: '送礼', games: ['nte'] },
    { key: 'rowStamina', label: '都市体力剩余', def: '都市体力剩余', games: ['nte'] },
  ] },
  { group: '按钮与新增项', items: [
    { key: 'btnExport', label: '导出图片', def: '导出图片' },
    { key: 'btnCopy', label: '复制到剪切板', def: '复制到剪切板' },
    { key: 'btnShare', label: '分享', def: '分享' },
    { key: 'btnReset', label: '重置', def: '重置' },
    { key: 'btnAppearance', label: '外观按钮', def: '外观' },
    { key: 'btnAddImage', label: '添加图片', def: '+ 图片' },
    { key: 'btnAddTask', label: '添加日常任务', def: '+ 添加任务' },
    { key: 'btnAddWeekly', label: '添加周常', def: '+ 添加周常' },
    { key: 'btnAddResource', label: '添加资源', def: '+ 添加资源' },
    { key: 'btnSaveGlobal', label: '存为全局预设', def: '存为全局预设' },
    { key: 'btnTemplate', label: '模板按钮', def: '模板' },
    { key: 'hintPaste', label: '粘贴提示', def: 'Ctrl+V 粘贴截图' },
  ] },
]

export const DEFAULT_REPORT_TEXT = Object.fromEntries(
  REPORT_TEXT_FIELDS.flatMap(g => g.items.map(i => [i.key, i.def])),
)

const KEY_SET = new Set(Object.keys(DEFAULT_REPORT_TEXT))

/**
 * 规范化文案对象：只认已知 key，空值回落默认，其余忽略。
 * 允许空字符串（用户可能确实想清空某个标签）。
 */
export function normalizeReportText(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const key of KEY_SET) {
    if (Object.prototype.hasOwnProperty.call(r, key)) {
      out[key] = String(r[key] == null ? '' : r[key])
    }
  }
  return out
}

/** 把（可能不完整的）覆盖值合并到默认值上 */
export function mergeReportText(...layers) {
  const out = { ...DEFAULT_REPORT_TEXT }
  for (const layer of layers) {
    const norm = normalizeReportText(layer)
    for (const key of Object.keys(norm)) out[key] = norm[key]
  }
  return out
}

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
    { key: 'btnTemplate', label: '模板按钮', def: '模板' },

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

/* ══════════════════════════════════════════════════════════════════
   可用的占位符变量

   模板文案里写 {day} {left} 这类花括号变量，渲染时自动替换成当前值。
   这样同一份模板能「随天数变化」，不用维护多套模板。

   替换发生在 ReportSheet 的 templateText() 里 —— 所有文案字段
   （标题、托管信息、卡片标题、按钮文字…）一次全生效。
   写错的变量名会原样保留，不会变成空白，方便看出拼错了。
   ══════════════════════════════════════════════════════════════════ */
export const REPORT_VARIABLES = [
  { key: 'sign', label: '汇报人', sample: 'Autumn' },
  { key: 'day', label: '托管第几天', sample: '12' },
  { key: 'left', label: '剩余天数', sample: '18' },
  { key: 'total', label: '托管总天数', sample: '30' },
  { key: 'date', label: '今天日期', sample: '2026-11-17' },
  { key: 'md', label: '月-日', sample: '11-17' },
  { key: 'weekday', label: '星期几', sample: '星期一' },
  { key: 'game', label: '游戏名', sample: '明日方舟' },
  { key: 'project', label: '托管项目', sample: '日常托管' },
  { key: 'start', label: '托管开始日', sample: '2026-11-06' },
  { key: 'end', label: '托管结束日', sample: '2026-12-05' },
];

/** 把模板文案里的 {var} 替换成实际值；未知变量原样保留 */
export function fillReportVars(text, vars) {
  const src = String(text == null ? '' : text);
  if (!src || src.indexOf('{') < 0) return src;
  const table = vars && typeof vars === 'object' ? vars : {};
  return src.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (whole, key) => {
    if (!Object.prototype.hasOwnProperty.call(table, key)) return whole;
    const v = table[key];
    // 没有值时保留变量原文：比留一片空白更容易看出「这里没数据」
    if (v == null || v === '') return whole;
    return String(v);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 日报模板文案与临时草稿（domain/report-template.js + data/report-draft.js）
//
// 两层状态：
//   · 数据管理 → 日报预设：改全局（game.report）
//   · 每日汇报 → 模板面板：改草稿（tr-report-draft），落盘、重启仍在、重置才清
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'

const LS = new Map()
globalThis.localStorage = {
  getItem: k => (LS.has(k) ? LS.get(k) : null),
  setItem: (k, v) => { LS.set(k, String(v)) },
  removeItem: k => { LS.delete(k) },
  clear: () => LS.clear(),
  key: i => [...LS.keys()][i] ?? null,
  get length() { return LS.size },
}

const {
  DEFAULT_REPORT_TEXT, REPORT_TEXT_FIELDS, normalizeReportText, mergeReportText,
} = await import('../src/domain/report-template.js')
const { readReportDrafts, writeReportDrafts, clearReportDraft } = await import('../src/data/report-draft.js')
const { KEYS } = await import('../src/data/storage.js')

test('默认文案覆盖了日报上的全部可改文案', () => {
  const keys = Object.keys(DEFAULT_REPORT_TEXT)
  assert.ok(keys.length >= 25, `文案项应有 25 个以上，实际 ${keys.length}`)
  for (const key of ['cardDaily', 'cardWeekly', 'cardResources', 'cardPlan', 'cardNote', 'cardShots',
    'rowSanity', 'rowClue', 'rowPixel', 'rowGift', 'rowStamina',
    'btnExport', 'btnCopy', 'btnShare', 'btnReset', 'btnAddTask', 'btnAddWeekly', 'btnAddResource',
    'authorLabel', 'hintPaste']) {
    assert.ok(key in DEFAULT_REPORT_TEXT, `缺少文案项 ${key}`)
  }
  // 分组表里的 key 与默认值表必须一致（面板按分组渲染）
  const grouped = REPORT_TEXT_FIELDS.flatMap(g => g.items.map(i => i.key))
  assert.deepEqual([...grouped].sort(), [...keys].sort(), '分组表与默认值表要一一对应')
})

test('normalizeReportText：只认已知 key，空字符串保留', () => {
  const norm = normalizeReportText({ cardDaily: '本日', 未知: 'x', cardWeekly: '' })
  assert.deepEqual(norm, { cardDaily: '本日', cardWeekly: '' })
  assert.deepEqual(normalizeReportText(null), {})
})

test('mergeReportText：后者覆盖前者，缺的回落默认', () => {
  const merged = mergeReportText({ cardDaily: '全局' }, { cardDaily: '草稿', btnExport: '出图' })
  assert.equal(merged.cardDaily, '草稿', '草稿胜出')
  assert.equal(merged.btnExport, '出图')
  assert.equal(merged.cardWeekly, '周常', '没覆盖的回落默认')
  assert.equal(merged.btnShare, '分享')
})

test('草稿按游戏分开存，能原样读回', () => {
  LS.clear()
  writeReportDrafts({
    ak: { text: { cardDaily: '本日' }, daily: ['甲'], weekly: ['乙'], resources: ['丙'] },
    endfield: { text: {}, daily: [], weekly: [], resources: [] },
  })
  const back = readReportDrafts()
  assert.deepEqual(back.ak, { text: { cardDaily: '本日' }, daily: ['甲'], weekly: ['乙'], resources: ['丙'] })
  assert.deepEqual(back.endfield.daily, [])
  assert.equal(KEYS.REPORT_DRAFT, 'tr-report-draft')
})

test('草稿写入会过滤非法项与空白项', () => {
  LS.clear()
  writeReportDrafts({
    ak: { daily: ['  甲  ', '', null], weekly: 'not-array', text: 'not-object' },
    '': { daily: ['丢弃'] },
    bad: null,
  })
  const back = readReportDrafts()
  assert.deepEqual(back.ak.daily, ['甲'])
  assert.deepEqual(back.ak.weekly, [])
  assert.deepEqual(back.ak.text, {})
  assert.equal('' in back, false, '空 gameId 被丢弃')
  assert.equal('bad' in back, false, '非对象草稿被丢弃')
})

test('clearReportDraft 只清指定游戏', () => {
  LS.clear()
  writeReportDrafts({ ak: { daily: ['a'] }, endfield: { daily: ['b'] } })
  clearReportDraft('ak')
  const back = readReportDrafts()
  assert.equal('ak' in back, false)
  assert.deepEqual(back.endfield.daily, ['b'], '别的游戏不受影响')
})

test('损坏的草稿 JSON 不会抛错', () => {
  LS.clear()
  LS.set(KEYS.REPORT_DRAFT, '{ 不是 JSON')
  assert.deepEqual(readReportDrafts(), {})
})

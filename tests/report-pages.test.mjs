// ═══════════════════════════════════════════════════════════════════
// 每日汇报的页签持久化（data/report-pages.js）
//   · 最多 8 页；id 去重；label 一律字符串
//   · 损坏 / 空数据不抛错，由页面补一页空白
//   · 只存页签身份与标题，不碰汇报正文 / 主题 / 背景
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

const { normalizeReportPages, readReportPages, writeReportPages, MAX_REPORT_PAGES } =
  await import('../src/data/report-pages.js')
const { KEYS } = await import('../src/data/storage.js')

const reset = () => LS.clear()
let n = 0
const makeId = () => `t${++n}`

test('上限 8 页，超出部分丢弃', () => {
  reset()
  assert.equal(MAX_REPORT_PAGES, 8)
  const many = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, label: '' }))
  assert.equal(normalizeReportPages(many).length, 8)
})

test('丢弃非法项、补缺失 id、重复 id 只留第一个', () => {
  reset()
  const out = normalizeReportPages([
    { id: 'a', label: '甲' },
    null,
    'x',
    { label: '无 id' },
    { id: 'a', label: '重复' },
    { id: 'b', label: 123 },
  ], { makeId })
  assert.deepEqual(out.map(p => p.id), ['a', 't1', 'b'])
  assert.equal(out[0].label, '甲')
  assert.equal(out[2].label, '123', 'label 一律转成字符串')
})

test('没存过 → 空列表（由页面补一页空白）', () => {
  reset()
  assert.deepEqual(readReportPages(), { pages: [], current: 0 })
})

test('写回后能原样读回，current 跟随保存', () => {
  reset()
  writeReportPages({ pages: [{ id: 'p1', label: '甲' }, { id: 'p2', label: '' }], current: 1 })
  const back = readReportPages()
  assert.deepEqual(back.pages.map(p => p.id), ['p1', 'p2'])
  assert.equal(back.current, 1)
  // 存的是对象形态，键名固定在 tr-report-pages
  const raw = JSON.parse(LS.get(KEYS.REPORT_PAGES))
  assert.ok(Array.isArray(raw.pages))
  assert.equal(raw.current, 1)
})

test('current 越界会被钳制到合法下标', () => {
  reset()
  writeReportPages({ pages: [{ id: 'p1' }], current: 5 })
  assert.equal(readReportPages().current, 0)

  // 直接写坏数据也能读回合法值
  LS.set(KEYS.REPORT_PAGES, JSON.stringify({ pages: [{ id: 'p1' }, { id: 'p2' }], current: 99 }))
  assert.equal(readReportPages().current, 1)
})

test('损坏 JSON / 非数组数据不会抛错', () => {
  reset()
  LS.set(KEYS.REPORT_PAGES, '{ 不是 JSON')
  assert.deepEqual(readReportPages(), { pages: [], current: 0 })
  LS.set(KEYS.REPORT_PAGES, JSON.stringify({ pages: 'nope' }))
  assert.deepEqual(readReportPages(), { pages: [], current: 0 })
})

test('兼容早期「直接存数组」的形态', () => {
  reset()
  LS.set(KEYS.REPORT_PAGES, JSON.stringify([{ id: 'old1', label: '旧页' }]))
  const back = readReportPages()
  assert.deepEqual(back.pages, [{ id: 'old1', label: '旧页' }])
  assert.equal(back.current, 0)
})

test('缺少 id 的记录用 makeId() 补字符串 id（不能是对象）', () => {
  reset()
  LS.set(KEYS.REPORT_PAGES, JSON.stringify({ pages: [{ label: '没有 id' }], current: 0 }))
  // 页面传入的是「生成 id 的函数」，必须返回字符串
  const back = readReportPages(() => 'generated-1')
  assert.deepEqual(back.pages, [{ id: 'generated-1', label: '没有 id' }])
  assert.equal(typeof back.pages[0].id, 'string')
})

test('写入时不会把页面上的临时字段一起存进去', () => {
  reset()
  writeReportPages({ pages: [{ id: 'p1', label: '甲', _tmp: 'x', content: '不应该被存' }], current: 0 })
  const raw = JSON.parse(LS.get(KEYS.REPORT_PAGES))
  assert.deepEqual(Object.keys(raw.pages[0]).sort(), ['id', 'label'])
})

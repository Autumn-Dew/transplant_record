// ═══════════════════════════════════════════════════════════════════
// 价格画布背景图（data/price-bg.js）
//   · 只接受 data:image/* 的 dataURL，且不超过 2MB（避免塞满 localStorage）
//   · 读取时也做校验：损坏 / 超限一律当成「没有背景」
//   · 清除写空串
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

const { readPriceBg, writePriceBg, MAX_BG_DATA_URL } = await import('../src/data/price-bg.js')
const { KEYS } = await import('../src/data/storage.js')

const PNG = 'data:image/png;base64,iVBORw0KGgo='

test('没存过 → 空串（界面按纯色底处理）', () => {
  LS.clear()
  assert.equal(readPriceBg(), '')
})

test('存合法 dataURL → 能原样读回', () => {
  LS.clear()
  assert.equal(writePriceBg(PNG), PNG)
  assert.equal(readPriceBg(), PNG)
})

test('非图片内容不写盘，读的时候也当没有', () => {
  LS.clear()
  assert.equal(writePriceBg('hello'), '')
  assert.equal(LS.has(KEYS.PRICE_BG), false, '非法值不应落盘')

  LS.set(KEYS.PRICE_BG, JSON.stringify('https://example.com/a.png'))
  assert.equal(readPriceBg(), '', 'http 地址不算背景图')
})

test('超过 2MB 上限就拒绝（防止塞满 localStorage）', () => {
  LS.clear()
  const huge = PNG + 'A'.repeat(MAX_BG_DATA_URL)
  assert.equal(writePriceBg(huge), '')
  assert.equal(LS.has(KEYS.PRICE_BG), false)

  // 直接写进存储的超长值也不会被读出来
  LS.set(KEYS.PRICE_BG, JSON.stringify(huge))
  assert.equal(readPriceBg(), '')
})

test('传空串 = 清除', () => {
  LS.clear()
  writePriceBg(PNG)
  assert.equal(readPriceBg(), PNG)
  assert.equal(writePriceBg(''), '')
  assert.equal(readPriceBg(), '')
})

test('损坏的 JSON 不会抛错', () => {
  LS.clear()
  LS.set(KEYS.PRICE_BG, '{ 不是 JSON')
  assert.equal(readPriceBg(), '')
})

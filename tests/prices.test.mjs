// 价格表数据安全测试：版本升级必须「合并」，绝不丢弃用户修改
import test from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)) },
  removeItem: k => { store.delete(k) },
  clear: () => store.clear(),
  key: i => [...store.keys()][i],
  get length() { return store.size },
}
globalThis.window = { dispatchEvent: () => {}, addEventListener: () => {}, removeEventListener: () => {} }

// 预置「用户已经改过的价格表」：改了默认项价格、删了一个默认分类、加了自己的分类与新游戏
store.set('tr-prices', JSON.stringify({
  __version: 1,
  endfield: {
    categories: [
      { name: '托管', mode: 'preset', items: [{ key: 3, name: '普托', price: 999, unit: '月', note: '用户改价' }] },
      { name: '我自己的分类', mode: 'custom', items: [{ key: 90, name: '自定服务', price: 50 }] },
    ],
  },
  ak: { categories: [] },
  '鸣潮': { categories: [{ name: '日常', mode: 'preset', items: [{ key: 1, name: '清体力', price: 10 }] }] },
}))

const { usePrices } = await import('../src/composables/usePrices.js')
const { prices, save, getGame, resetGame, removeGame } = usePrices()

test('加载时保留用户已修改的价格（不被内置默认覆盖）', () => {
  const endfield = getGame('endfield')
  const host = endfield.categories.find(c => c.name === '托管')
  const basic = host.items.find(i => i.name === '普托')
  assert.equal(basic.price, 999, '用户改过的价格必须保留')
  assert.equal(basic.note, '用户改价')
})

test('用户自建的分类与项目原样保留', () => {
  const cats = getGame('endfield').categories
  const mine = cats.find(c => c.name === '我自己的分类')
  assert.ok(mine)
  assert.equal(mine.items[0].name, '自定服务')
  assert.equal(mine.items[0].price, 50)
})

test('用户已有该游戏数据的：完全按用户数据，不合并内置（对老数据零改动）', () => {
  const cats = getGame('endfield').categories
  const names = cats.map(c => c.name)
  // 用户自己的分类仍在；内置「新增」的分类不会被塞进来
  assert.ok(names.includes('托管'))
  assert.ok(names.includes('我自己的分类'))
  assert.equal(names.includes('当期活动'), false, '不得把内置分类合并进用户已有数据')
  // 用户删掉的内置项目也不会被补回
  assert.equal(cats.find(c => c.name === '托管').items.length, 1, '不得补回用户删掉的内置项目')
})

test('升级旧价格表：用户已有数据逐字节零改动（影响最小）', () => {
  const raw = JSON.parse(localStorage.getItem('tr-prices'))
  assert.deepEqual(getGame('endfield').categories, raw.endfield.categories, '用户数据零改动')
})

test('空白的游戏价格表会补齐内置分类，同时不影响其它数据', () => {
  // 预置数据中 ak 被清空 → 合并时补回内置分类（而不是留下空表）
  const names = getGame('ak').categories.map(c => c.name)
  assert.ok(names.length > 0)
  assert.equal(getGame('endfield').categories.find(c => c.name === '我自己的分类').items.length, 1)
})

test('通过游戏管理新增的游戏价格数据保留', () => {
  const wuwa = getGame('鸣潮')
  assert.equal(wuwa.categories[0].name, '日常')
  assert.equal(wuwa.categories[0].items[0].price, 10)
})

test('save() 写入时带上版本号，且不丢数据', () => {
  save()
  const raw = JSON.parse(localStorage.getItem('tr-prices'))
  assert.ok(raw.__version >= 1)
  assert.equal(raw.endfield.categories.find(c => c.name === '托管').items.find(i => i.name === '普托').price, 999)
  assert.ok(raw['鸣潮'])
})

test('resetGame 只重置指定游戏的分类', () => {
  resetGame('endfield')
  const cats = getGame('endfield').categories
  assert.equal(cats.some(c => c.name === '我自己的分类'), false, '重置会恢复为内置数据')
  assert.equal(getGame('鸣潮').categories[0].items[0].price, 10, '其它游戏不受影响')
})

test('removeGame 移除对应游戏的价格数据', () => {
  removeGame('鸣潮')
  assert.equal(prices.value['鸣潮'], undefined)
  assert.ok(prices.value.endfield)
})

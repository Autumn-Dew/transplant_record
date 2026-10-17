import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(ROOT, p), 'utf8')

globalThis.localStorage = {
  _s: new Map(),
  getItem(k) { return this._s.has(k) ? this._s.get(k) : null },
  setItem(k, v) { this._s.set(k, String(v)) },
  removeItem(k) { this._s.delete(k) },
  clear() { this._s.clear() },
  key(i) { return [...this._s.keys()][i] },
  get length() { return this._s.size },
}

const {
  REPORT_BACKGROUNDS,
  REPORT_BG_GROUPS,
  REPORT_BG_IDS,
  DEFAULT_REPORT_BG,
  normalizeReportBgId,
  findReportBg,
  readReportBg,
  writeReportBg,
} = await import('../src/data/report-backgrounds.js')

test('提供多套浅色背景，且都带底色与背景值', () => {
  assert.ok(REPORT_BACKGROUNDS.length >= 5, '至少 5 套可选背景')
  assert.equal(new Set(REPORT_BG_IDS).size, REPORT_BACKGROUNDS.length, '背景 id 不得重复')
  for (const b of REPORT_BACKGROUNDS) {
    assert.ok(b.id && b.label && b.hint, `${b.id} 需要 id / label / hint`)
    assert.match(b.base, /^#[0-9a-f]{6}$/i, `${b.id} 需要十六进制底色（导出兜底用）`)
    assert.ok(b.bg && b.bg.length > 0, `${b.id} 需要 background 值`)
  }
})

test('背景覆盖纯色 / 渐变 / 几何 / 装饰 / 蓝白 / 暖白几类', () => {
  const kinds = REPORT_BACKGROUNDS.map(b => ({
    id: b.id,
    plain: /^#[0-9a-f]{6}$/i.test(b.bg),
    gradient: /linear-gradient|radial-gradient/.test(b.bg),
    geometry: /repeating-linear-gradient/.test(b.bg),
  }))
  assert.ok(kinds.some(k => k.plain), '需要一套纯色')
  assert.ok(kinds.some(k => k.gradient), '需要柔和渐变')
  assert.ok(kinds.some(k => k.geometry), '需要几何构成')
  assert.ok(kinds.length >= 6, '首批六套')
})

test('未知 / 空值回落到默认背景', () => {
  assert.equal(normalizeReportBgId(null), DEFAULT_REPORT_BG)
  assert.equal(normalizeReportBgId(''), DEFAULT_REPORT_BG)
  assert.equal(normalizeReportBgId('dark'), DEFAULT_REPORT_BG)
  REPORT_BG_IDS.forEach(id => assert.equal(normalizeReportBgId(id), id))
  assert.equal(findReportBg('不存在').id, DEFAULT_REPORT_BG)
})

test('每套背景都有明确的构图重心，且不压住正文', () => {
  for (const b of REPORT_BACKGROUNDS) {
    if (b.id === 'plain') continue
    const alphas = [...b.bg.matchAll(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([0-9.]+)\s*\)/g)].map(m => Number(m[1]))
    assert.ok(alphas.length >= 3, `${b.id} 应由多层渐变构成（构图靠分层，不是单一色差）`)
    assert.ok(Math.max(...alphas) >= 0.15, `${b.id} 需要至少一个明显的构图元素（alpha ≥ 0.15），否则只剩一层几乎看不见的色差`)
    assert.ok(Math.max(...alphas) <= 0.95, `${b.id} 不得用大面积不透明色块压住正文`)
    assert.match(b.bg, /gradient\(/, `${b.id} 需要渐变构图`)
  }
})

test('背景按「默认 / 孤星风格 / P3R 风格」分组，分组即风格系列', () => {
  assert.deepEqual(REPORT_BG_GROUPS.map(g => g.id), ['default', 'lone-star', 'p3r'], '三个分组顺序固定')
  const grouped = REPORT_BG_GROUPS.flatMap(g => g.items.map(b => b.id))
  assert.deepEqual([...grouped].sort(), [...REPORT_BG_IDS].sort(), '分组必须覆盖全部背景且不重复')
  for (const g of REPORT_BG_GROUPS) {
    assert.ok(g.label, `${g.id} 需要分组名`)
    assert.ok(g.items.length > 0, `${g.id} 不得为空组`)
    // 分组依据是「风格系列」，不是深色/浅色：同组内 style 与组 id 一致
    for (const b of g.items) assert.equal(b.style, g.id, `${b.id} 的 style 必须等于所在分组`)
  }
  assert.equal(REPORT_BG_GROUPS[0].items.length, 1, '默认组只有纯白一套')
  assert.ok(REPORT_BG_GROUPS[1].items.length >= 3, '孤星风格至少 3 套')
  assert.ok(REPORT_BG_GROUPS[2].items.length >= 3, 'P3R 风格至少 3 套')
})

test('背景独立持久化到 tr-report-bg，不占用主题键', () => {
  assert.equal(writeReportBg('p3r-moon'), 'p3r-moon')
  assert.equal(JSON.parse(localStorage.getItem('tr-report-bg')), 'p3r-moon')
  assert.equal(localStorage.getItem('tr-theme'), null, '写背景不得碰主题键')
  assert.equal(readReportBg(), 'p3r-moon')
  // 非法值写入时自动归一
  assert.equal(writeReportBg('乱写'), DEFAULT_REPORT_BG)
  assert.equal(readReportBg(), DEFAULT_REPORT_BG)
})

test('背景不引用任何主题变量（与应用主题解耦）', () => {
  const src = read('src/data/report-backgrounds.js')
  assert.equal(/var\(--/.test(src), false, '背景色值必须是固定浅色，不能跟随主题变量')
})

test('画布与导出都使用当前背景', () => {
  const sheet = read('src/components/ReportSheet.vue')
  // 预览：画布自身绑定背景
  assert.match(sheet, /class="rp-wrap"[^>]*:style="\{ background: reportBg\.bg \}"/, '画布绑定背景')
  // 导出：html2canvas 的兜底底色取当前背景，而不是写死白色
  assert.match(sheet, /backgroundColor:\s*reportBg\.value\.base/, '导出使用当前背景底色')
  assert.equal(/backgroundColor:\s*'#ffffff'/.test(sheet), false, '不能写死纯白背景')
})

test('编辑器内有紧凑的背景选择入口（与主题分区并列）', () => {
  const sheet = read('src/components/ReportSheet.vue')
  // 分组浮层：外层遍历「默认 / 孤星风格 / P3R 风格」，内层遍历各背景
  assert.match(sheet, /v-for="g in REPORT_BG_GROUPS"/, '按风格分组遍历')
  assert.match(sheet, /v-for="b in g\.items"/, '组内遍历背景缩略图')
  assert.match(sheet, /class="rp-bg-card"/, '缩略图按钮')
  assert.match(sheet, /class="rp-bg-thumb"/, '缩略图色块')
  assert.match(sheet, /class="rp-bg-thumb"\s+:style="\{ background: b\.bg \}"/, '缩略图用与画布相同的背景值')
  assert.match(sheet, /:class="\{ active: reportBgId === b\.id \}"/, '标识当前选中背景')
  assert.match(sheet, /@click="setReportBg\(b\.id\)/, '点击即切换')
  // 选择入口是侧边弹窗（与项目详情窗口同一套版式），展开时不挤压工作区
  assert.match(sheet, /class="edit-popup pd-popup rp-look"/, '外观选择在侧边弹窗内')
  assert.match(sheet, /\.rp-bg-thumb\s*\{[^}]*height:\s*52px/, '缩略图为固定高度（够大才看得出构图差异）')
  assert.match(sheet, /\.rp-bg-thumb\s*\{[^}]*width:\s*100%/, '缩略图铺满色卡宽度')
})

test('背景不再决定内容皮肤：画布皮肤只跟着汇报主题走', () => {
  const sheet = read('src/components/ReportSheet.vue')
  assert.match(sheet, /class="rp-wrap"[^>]*:class="`rp-theme-\$\{reportTheme\.id\}`"/, '画布挂汇报主题类')
  assert.equal(/rp-style-\$\{reportBg\.style\}/.test(sheet), false, '画布类名不得再取自背景')
  assert.equal(/reportBg\.style/.test(sheet), false, '组件不再读背景的 style 字段决定样式')
})

test('切换背景不会写入主题键，切换主题不会动背景键', () => {
  const bgSrc = read('src/data/report-backgrounds.js')
  assert.equal(/readJSON\(KEYS\.THEME/.test(bgSrc), false, '背景模块不得读主题键')
  assert.equal(/writeJSON\(KEYS\.THEME/.test(bgSrc), false, '背景模块不得写主题键')
  assert.equal(/REPORT_THEME|tr-report-theme/.test(bgSrc), false, '背景模块不得碰汇报主题键')
  const themeSrc = read('src/composables/useGlobalTheme.js')
  assert.equal(/REPORT_BG|tr-report-bg/.test(themeSrc), false, '主题模块不得读写背景键')
  assert.equal(/REPORT_THEME|tr-report-theme/.test(themeSrc), false, '应用主题模块不得读写汇报主题键')
})

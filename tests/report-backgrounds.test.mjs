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
  CLASSIC_REPORT_BG,
  REPORT_BG_IDS,
  DEFAULT_REPORT_BG,
  normalizeReportBgId,
  findReportBg,
  readReportBg,
  writeReportBg,
  bgTone,
} = await import('../src/data/report-backgrounds.js')

test('提供多套浅色背景，且都带底色与背景值', () => {
  assert.ok(REPORT_BACKGROUNDS.length >= 5, '至少 5 套可选背景')
  assert.equal(new Set(REPORT_BG_IDS).size, REPORT_BG_IDS.length, '背景 id 不得重复')
  for (const b of REPORT_BACKGROUNDS) {
    assert.ok(b.id && b.label && b.hint, `${b.id} 需要 id / label / hint`)
    assert.match(b.base, /^#[0-9a-f]{6}$/i, `${b.id} 需要十六进制底色（导出兜底用）`)
    assert.ok(b.bg && b.bg.length > 0, `${b.id} 需要 background 值`)
  }
})

test('背景覆盖渐变 / 几何 / 装饰几类；纯色改由「经典外观」按钮提供', () => {
  const kinds = REPORT_BACKGROUNDS.map(b => ({
    id: b.id,
    plain: /^#[0-9a-f]{6}$/i.test(b.bg),
    gradient: /linear-gradient|radial-gradient/.test(b.bg),
    geometry: /repeating-linear-gradient/.test(b.bg),
  }))
  assert.equal(kinds.some(k => k.plain), false, '纯色不再占卡片位（点击「经典外观」即回到纯白）')
  assert.match(CLASSIC_REPORT_BG.bg, /^#[0-9a-f]{6}$/i, '经典外观的底必须是纯色')
  assert.ok(kinds.some(k => k.gradient), '需要柔和渐变')
  assert.ok(kinds.some(k => k.geometry), '需要几何构成')
  assert.ok(kinds.length >= 6, '至少六套带构图的背景')
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

test('背景是一条平铺列表，不按风格系列分组，且每族只留四套', async () => {
  const mod = await import('../src/data/report-backgrounds.js')
  assert.equal('REPORT_BG_GROUPS' in mod, false, '不再导出分组结构（选择器里从头到尾只有一条）')
  for (const style of ['p3r', 'endfield', 'swiss']) {
    const items = REPORT_BACKGROUNDS.filter(b => b.style === style)
    assert.equal(items.length, 4, `${style} 风格保留四套（原八套删掉后四个）`)
  }
  assert.equal(REPORT_BACKGROUNDS.length, 12, '三族各 4 套；纯白不在列表里')
  // 纯白底仍在数据里，作为「经典外观」按钮的预设
  assert.equal(mod.CLASSIC_REPORT_BG.id, 'plain')
  assert.equal(REPORT_BG_IDS[0], 'plain', 'ids 含纯白（老用户的存储值要能读回来）')
  assert.equal(findReportBg('plain').id, 'plain')
})

test('背景独立持久化到 tr-report-bg，不占用主题键', () => {  assert.equal(writeReportBg('p3r-moon'), 'p3r-moon')
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
  // 导出：兜底底色取当前背景（导出流程在 composables/useReportExport.js）
  assert.match(sheet, /backgroundBase: \(\) => reportBg\.value\.base/, '组件把当前背景底色传给导出流程')
  const exporter = read('src/composables/useReportExport.js')
  assert.match(exporter, /backgroundColor:\s*backgroundBase\(\)/, '导出兜底底色跟着当前背景走')
  for (const src of [sheet, exporter]) {
    assert.equal(/backgroundColor:\s*'#ffffff'/.test(src), false, '不能写死纯白背景')
  }
})

test('编辑器内有紧凑的背景选择入口（与主题分区并列）', () => {
  const sheet = read('src/components/ReportSheet.vue')
  // 平铺浮层：一条列表遍历全部背景（不再按风格系列分组）
  assert.match(sheet, /v-for="b in REPORT_BACKGROUNDS"/, '平铺遍历全部背景')
  assert.match(sheet, /class="rp-bg-card"/, '缩略图按钮')
  assert.match(sheet, /class="rp-bg-thumb"/, '缩略图色块')
  assert.match(sheet, /class="rp-bg-thumb"\s+:style="\{ background: b\.bg \}"/, '缩略图用与画布相同的背景值')
  assert.match(sheet, /:class="\{ active: reportBgId === b\.id \}"/, '标识当前选中背景')
  assert.match(sheet, /@click="setReportBg\(b\.id\)/, '点击即切换')
  // 选择入口是侧边弹窗（与项目详情窗口同一套版式），展开时不挤压工作区
  assert.match(sheet, /class="edit-popup pd-popup rp-look"/, '外观选择在侧边弹窗内')
  assert.match(sheet, /\.rp-bg-thumb\s*\{[^}]*height:\s*34px/, '缩略图为固定高度（一行四张仍看得出构图差异）')
  assert.match(sheet, /\.rp-bg-thumb\s*\{[^}]*width:\s*100%/, '缩略图铺满色卡宽度')
})

test('背景不再决定内容皮肤：画布皮肤只跟着汇报主题走', () => {
  const sheet = read('src/components/ReportSheet.vue')
  assert.match(sheet, /class="rp-wrap"[^>]*:class="`rp-theme-\$\{reportTheme\.id\}`"/, '画布挂汇报主题类')
  assert.equal(/rp-style-\$\{reportBg\.style\}/.test(sheet), false, '画布类名不得再取自背景')
  assert.equal(/reportBg\.style/.test(sheet), false, '组件不再读背景的 style 字段决定样式')
})

test('背景标出「深 / 浅」，和主题的「暗 / 浅」一起看就能配对', () => {
  // bgTone 由 base 底色的相对亮度判断
  assert.equal(bgTone({ base: '#ffffff' }), 'light')
  assert.equal(bgTone({ base: '#191919' }), 'dark')
  assert.equal(bgTone({ base: '#111111' }), 'dark')
  assert.equal(bgTone(null), 'light')

  const darkIds = REPORT_BACKGROUNDS.filter(b => bgTone(b) === 'dark').map(b => b.id)
  assert.ok(darkIds.includes('ef-night'), '石墨夜班是深色画布')
  assert.ok(darkIds.includes('ch-black'), '墨底是深色画布')
  assert.ok(darkIds.length >= 2, '至少两套深色背景')

  // 选择器里显示「深 / 浅」标签
  const sheet = read('src/components/ReportSheet.vue')
  assert.match(sheet, /bgTone\(b\) === 'dark' \? '深' : '浅'/, '背景卡标出深/浅')
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

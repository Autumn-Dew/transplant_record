import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(ROOT, p), 'utf8')

// node 环境没有 document，useGlobalTheme 里已做守卫，可以安全 import
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
  THEMES,
  THEME_IDS,
  DEFAULT_THEME_ID,
  normalizeThemeId,
} = await import('../src/composables/useGlobalTheme.js')

test('十套主题平级存在，ID 唯一', () => {
  assert.equal(THEME_IDS.length, 10)
  assert.equal(new Set(THEME_IDS).size, 10, '主题 ID 不得重复')
  assert.deepEqual(
    [...THEME_IDS].sort(),
    ['endfield-dark', 'endfield-light', 'lone-star-dark', 'lone-star-light', 'p3r-dark', 'p3r-light', 'stijl-dark', 'stijl-light', 'swiss-dark', 'swiss-light'],
  )
  THEMES.forEach(t => {
    assert.ok(t.label && t.hint, `${t.id} 需要 label 与 hint`)
  })
})

test('旧版 dark / light 映射到对应的孤星主题（存储键语义不变）', () => {
  assert.equal(normalizeThemeId('dark'), 'lone-star-dark')
  assert.equal(normalizeThemeId('light'), 'lone-star-light')
  // 已经是新 ID 的原样返回
  THEME_IDS.forEach(id => assert.equal(normalizeThemeId(id), id))
})

test('未知值回落到默认主题，不会把用户留在无主题状态', () => {
  assert.equal(normalizeThemeId(null), DEFAULT_THEME_ID)
  assert.equal(normalizeThemeId(''), DEFAULT_THEME_ID)
  assert.equal(normalizeThemeId('P3R-Dark'), DEFAULT_THEME_ID, '大小写不匹配时回落默认')
  assert.equal(normalizeThemeId('theme-p3r-dark'), DEFAULT_THEME_ID, '不接受带前缀的类名')
})

test('深色与浅色是两套独立主题，不是运行时组合', () => {
  // 两者在 CSS 中各自成块，各自定义完整变量集
  const theme = read('src/assets/css/global-theme.css')
  for (const sel of [
    '.theme-lone-star-light', '.theme-lone-star-dark',
    '.theme-p3r-light', '.theme-p3r-dark',
    '.theme-endfield-light', '.theme-endfield-dark',
    '.theme-swiss-light', '.theme-swiss-dark',
    '.theme-stijl-light', '.theme-stijl-dark',
  ]) {
    const block = theme.slice(theme.indexOf(sel))
    const body = block.slice(0, block.indexOf('}'))
    for (const v of ['--bg-primary', '--bg-secondary', '--bg-sidebar', '--text-primary', '--border-color', '--accent']) {
      assert.ok(body.includes(`${v}:`), `${sel} 必须自己定义 ${v}`)
    }
  }
})

test('P3R 使用约定的调色板', () => {
  const theme = read('src/assets/css/global-theme.css')
  assert.match(theme, /--bg-primary:\s*#071B3A/i, 'P3R 深色背景 = 深海军蓝')
  assert.match(theme, /--bg-primary:\s*#F4F6FA/i, 'P3R 浅色背景 = 冷白')
  const p3r = read('src/assets/css/theme-p3r.css')
  for (const hex of ['#071B3A', '#1264C8', '#28B8F2', '#F5D83D', '#F4F6FA', '#A8B8D0', '#F07858']) {
    assert.ok(p3r.includes(hex), `theme-p3r.css 应包含调色板色 ${hex}`)
  }
})

test('终末地使用约定的调色板（纸 / 墨 / 唯一强调色 lime）', () => {
  const theme = read('src/assets/css/global-theme.css')
  for (const [sel, paper] of [['.theme-endfield-light', '#F4F4F2'], ['.theme-endfield-dark', '#191919']]) {
    const block = theme.slice(theme.indexOf(sel))
    const body = block.slice(0, block.indexOf('}'))
    assert.match(body, new RegExp(`--bg-primary:\\s*${paper}`, 'i'), `${sel} 的纸色应是 ${paper}`)
    assert.match(body, /--ef-signal:\s*#B8FF3D/i, `${sel} 的唯一强调色应是 lime`)
    assert.match(body, /--ef-trace:/, `${sel} 需要 trace 色（标出当前位置的线）`)
  }
  const css = read('src/assets/css/theme-endfield.css')
  for (const hex of ['#161616', '#EDEDED']) {
    assert.ok(css.includes(hex), `theme-endfield.css 应包含调色板色 ${hex}`)
  }
  // 三色条的三格颜色定义在主题变量里
  assert.match(theme, /--ef-tri-a:\s*#FF00F0/i, '三色条第一格 = 品红')
  assert.match(theme, /--ef-tri-c:\s*#00FFA2/i, '三色条第三格 = 薄荷绿')
  // 切角只给可点击的东西：导航 / 按钮 / 筛选块共用同一个 --ef-cut
  assert.match(css, /--ef-cut-corner:/, '切角需要统一的 polygon 定义')
  assert.match(css, /clip-path:\s*var\(--ef-cut-corner\)/, '可点击控件用切角')
})

test('主题标记用 classList 增删，不整体覆盖根元素 className', () => {
  const src = read('src/composables/useGlobalTheme.js')
  assert.equal(
    /document\.documentElement\.className\s*=/.test(src),
    false,
    '不得覆盖 documentElement.className（会清掉其他状态类）',
  )
  assert.match(src, /classList\.add\(/, '用 classList 添加主题类')
  assert.match(src, /classList\.remove\(/, '用 classList 移除旧主题类')
  assert.match(src, /const THEME_CLASS = \/\^theme-\//, '只清理 theme- 前缀的类')
})

test('主题切换即时生效并持久化到同一存储键', () => {
  const src = read('src/composables/useGlobalTheme.js')
  assert.match(src, /writeJSON\(KEYS\.THEME, val\)/, '沿用 KEYS.THEME 存储')
  assert.match(src, /watch\(themeId/, '主题变化后同步')
})

test('P3R 动效尊重 prefers-reduced-motion', () => {
  const p3r = read('src/assets/css/theme-p3r.css')
  assert.match(p3r, /@media \(prefers-reduced-motion: reduce\)/, '必须有减动效降级')
})

test('设置页提供平级主题选项（不额外加深/浅开关）', () => {
  const settings = read('src/views/SettingsPage.vue')
  assert.match(settings, /v-for="t in themes"/, '遍历全部主题')
  assert.match(settings, /setTheme\(t\.id\)/, '点击直接选主题')
  assert.equal(/isDark\s*=\s*!/.test(settings), false, '没有独立的明暗切换开关')
})

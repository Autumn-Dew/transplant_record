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

test('四套主题平级存在，ID 唯一', () => {
  assert.equal(THEME_IDS.length, 4)
  assert.equal(new Set(THEME_IDS).size, 4, '主题 ID 不得重复')
  assert.deepEqual(
    [...THEME_IDS].sort(),
    ['lone-star-dark', 'lone-star-light', 'p3r-dark', 'p3r-light'],
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

test('P3R 深色与浅色是两套独立主题，不是运行时组合', () => {
  // 两者在 CSS 中各自成块，各自定义完整变量集
  const theme = read('src/assets/css/global-theme.css')
  for (const sel of ['.theme-lone-star-light', '.theme-lone-star-dark', '.theme-p3r-light', '.theme-p3r-dark']) {
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

test('设置页提供四个平级主题选项（不额外加深/浅开关）', () => {
  const settings = read('src/views/SettingsPage.vue')
  assert.match(settings, /v-for="t in themes"/, '遍历四套主题')
  assert.match(settings, /setTheme\(t\.id\)/, '点击直接选主题')
  assert.equal(/isDark\s*=\s*!/.test(settings), false, '没有独立的明暗切换开关')
})

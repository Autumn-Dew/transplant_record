// 风格派（De Stijl / 新造型主义）主题
// 契约：粗黑线只能水平或垂直；三原色 + 黑 + 米白 + 浅灰；全部平涂（无渐变底、
// 无模糊阴影、无圆角、无旋转）；字重只有 400 / 700；不动字号与布局。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(path.join(ROOT, p), 'utf8')

const RED = '#D0302A'
const YELLOW = '#EBC226'
const BLUE = '#1D3F8C'

test('界面新增风格派两套，由 theme-stijl.css 承载', () => {
  const theme = read('src/composables/useGlobalTheme.js')
  assert.match(theme, /id: 'stijl-light'/, '风格派 · 米白')
  assert.match(theme, /id: 'stijl-dark'/, '风格派 · 反白')
  assert.match(theme, /\{ id: 'stijl', label: '风格派'/, '浮层里的族')

  const app = read('src/App.vue')
  assert.match(app, /@import '@\/assets\/css\/theme-stijl\.css';/, 'App.vue 引入主题文件')
  assert.ok(
    app.indexOf('theme-stijl.css') < app.indexOf('page-common.css'),
    'theme-stijl.css 要在 page-common.css 之前引入',
  )
})

test('风格派调色板：三原色 + 黑 + 米白 + 浅灰', () => {
  const global = read('src/assets/css/global-theme.css')
  for (const sel of ['.theme-stijl-light', '.theme-stijl-dark']) {
    const block = global.slice(global.indexOf(sel))
    const body = block.slice(0, block.indexOf('}'))
    assert.ok(body.includes('--st-red: ' + RED), `${sel} 需要红`)
    assert.ok(body.includes('--st-yellow: ' + YELLOW), `${sel} 需要黄`)
    assert.ok(body.includes('--st-blue: ' + BLUE), `${sel} 需要蓝`)
    assert.ok(body.includes('--st-ink:'), `${sel} 需要墨色变量`)
    assert.ok(body.includes('--st-paper:'), `${sel} 需要纸色变量`)
    assert.ok(body.includes('--accent: ' + RED), `${sel} 的强调色是红`)
  }
  const light = global.slice(global.indexOf('.theme-stijl-light'))
  assert.ok(light.slice(0, light.indexOf('}')).includes('--bg-primary: #F4F1EA'), '米白纸面')
  const dark = global.slice(global.indexOf('.theme-stijl-dark'))
  assert.ok(dark.slice(0, dark.indexOf('}')).includes('--bg-primary: #111111'), '反白：黑纸面')
})

test('粗黑线只走横竖：没有斜线、曲线、旋转、圆角', () => {
  const css = read('src/assets/css/theme-stijl.css').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.equal(/rotate\(/.test(css), false, '不旋转')
  assert.equal(/skew/.test(css), false, '不斜切')
  assert.equal(/border-radius:\s*[1-9]/.test(css), false, '圆角一律 0')
  assert.equal(/radial-gradient|conic-gradient/.test(css), false, '不用曲线渐变')
  assert.equal(/linear-gradient/.test(css), false, '界面不用渐变（全部平涂）')
  // 阴影只能是「纯色块 / 纯线」：不允许带模糊半径
  const shadows = [...css.matchAll(/box-shadow:\s*([^;]+);/g)].map(m => m[1])
  for (const s of shadows) {
    assert.equal(/\d+px\s+\d+px\s+[1-9]\d*px/.test(s), false, `box-shadow 不允许模糊：${s}`)
  }
})

test('界面字重只有 400 / 700，且不改字号', () => {
  const css = read('src/assets/css/theme-stijl.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const weights = [...css.matchAll(/font-weight:\s*(\d+)/g)].map(m => m[1])
  assert.ok(weights.length > 0, '需要显式声明字重')
  for (const w of weights) assert.ok(w === '400' || w === '700', `只允许 400 / 700，出现了 ${w}`)
  assert.equal(/font-size\s*:/.test(css), false, '不得设置字号（沿用页面原有值）')
})

test('汇报新增风格派 8 套主题 + 8 套背景，并单独成组', () => {
  const themes = read('src/data/report-themes.js')
  const ids = ['st-grid', 'st-block', 'st-rule', 'st-corner', 'st-band', 'st-column', 'st-letter', 'st-inverse']
  for (const id of ids) assert.ok(themes.includes(`id: '${id}'`), `汇报主题 ${id} 已登记`)
  assert.match(themes, /\{ id: 'stijl', label: '风格派', items: STIJL_THEMES \}/, '风格派分组')

  const bgs = read('src/data/report-backgrounds.js')
  for (const id of ['st-grid', 'st-block', 'st-rule', 'st-corner', 'st-band', 'st-column', 'st-letter', 'st-inverse']) {
    assert.ok(bgs.includes(`id: '${id}'`), `背景 ${id} 已登记`)
  }
  assert.match(bgs, /\{ id: 'stijl', label: '风格派', items: STIJL_BGS \}/, '风格派背景分组')
  assert.ok(bgs.includes(`style: 'stijl'`), '背景的 style 是 stijl')
})

test('汇报里的风格派：粗线与色块都走 inset 阴影 / 伪元素，且只 400 与 700', () => {
  const sheet = read('src/components/ReportSheet.vue')
  const section = sheet.slice(sheet.indexOf('风格派套（De Stijl'), sheet.indexOf('汇报字体基线'))
  assert.ok(section.length > 500, '需要风格派的样式段落')
  for (const id of ['st-grid', 'st-block', 'st-rule', 'st-corner', 'st-band', 'st-column', 'st-letter', 'st-inverse']) {
    assert.ok(section.includes(`.rp-theme-${id} {`), `${id} 需要变量块`)
    assert.ok(section.includes(`.rp-wrap.rp-theme-${id} .rp-title`), `${id} 的标题字重要压过通用基线`)
  }
  for (const hex of [RED, YELLOW, BLUE, '#111111']) assert.ok(section.includes(hex), `需要颜色 ${hex}`)
  const weights = [...section.matchAll(/font-weight:\s*(\d+)/g)].map(m => m[1])
  for (const w of weights) assert.ok(w === '400' || w === '700', `只允许 400 / 700，出现了 ${w}`)
  // 不改布局：没有 padding / margin / 字号
  assert.equal(/padding\s*:/.test(section), false, '不得改 padding')
  assert.equal(/font-size\s*:/.test(section), false, '不得改字号')
  // 圆角与旋转一律没有
  assert.equal(/border-radius:\s*[1-9]/.test(section), false, '圆角一律 0')
  assert.equal(/rotate\(|skew/.test(section), false, '不旋转、不斜切')
})

test('风格派动效只走横竖：切进 / 刷满，不弹跳不旋转', () => {
  const motion = read('src/assets/css/motion-themes.css')
  assert.match(motion, /:is\(\.theme-stijl-light, \.theme-stijl-dark\) \{[\s\S]{0,400}--mv-tick/, '风格派动效族')
  assert.match(motion, /@keyframes st-line-cut/, '黑线切进')
  const section = motion.slice(motion.indexOf('风格派 · 米白 / 反白'), motion.indexOf('减少动态效果'))
  assert.equal(/rotate|scale\(/.test(section), false, '不用旋转 / 缩放')
  assert.match(section, /clip-path: inset/, '用 clip-path 擦入（横竖方向）')

  const hover = read('src/assets/css/hover-states.css')
  assert.match(hover, /:is\(\.theme-stijl-light\) \{[\s\S]{0,300}--hv-mark: #D0302A/, '米白悬停变量')
  assert.match(hover, /:is\(\.theme-stijl-dark\) \{[\s\S]{0,300}--hv-mark: #EBC226/, '反白悬停变量')
})

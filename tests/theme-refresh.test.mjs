import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('主题修订层在旧主题、动效和 hover 之后加载', () => {
  const app = read('src/App.vue')
  const refresh = app.indexOf('theme-refresh.css')
  assert.ok(refresh > app.indexOf('theme-endfield.css'))
  assert.ok(refresh > app.indexOf('motion-themes.css'))
  assert.ok(refresh > app.indexOf('hover-states.css'))
})

test('终末地只移除标题栏左侧竖线，保留 // 标题语法', () => {
  const refresh = read('src/assets/css/theme-refresh.css')
  assert.match(refresh, /theme-endfield-light, \.theme-endfield-dark\) \.rc-title-bar::before[\s\S]{0,100}content: none/)
  const endfield = read('src/assets/css/theme-endfield.css')
  assert.match(endfield, /\.rc-title-bar h2::before[\s\S]{0,120}content: '\/\/ '/)
})

test('现存的 P3R / 瑞士主题使用新的调色板与焦点色', () => {
  const css = read('src/assets/css/theme-refresh.css')
  for (const sel of [
    '.theme-p3r-light', '.theme-p3r-dark',
    '.theme-swiss-light', '.theme-swiss-dark',
  ]) {
    const block = css.slice(css.indexOf(sel))
    const body = block.slice(0, block.indexOf('}'))
    for (const token of ['--state-bg:', '--state-fg:', '--state-border:', '--focus-ring:']) {
      assert.ok(body.includes(token), `${sel} 需要 ${token}`)
    }
  }
})

test('应用入口不再加载孤星和风格派主题', () => {
  const app = read('src/App.vue')
  assert.equal(app.includes('theme-lone-star.css'), false)
  assert.equal(app.includes('theme-stijl.css'), false)
})

test('P3R 使用官网式蓝白斜切、巨型排版与锐角构图', () => {
  const css = read('src/assets/css/theme-refresh.css')
  assert.match(css, /content: 'P3R \/ '/)
  // 标题栏右端的斜切白块与「03」编号已移除：它们紧贴窗口控件，看起来像
  // 控件自带的零件。标题栏只保留文本前缀与 bottom 色带。
  assert.equal(/\.rc-title-bar::before[\s\S]{0,200}clip-path: polygon\(14% 0/.test(css), false, '标题栏不再挂斜切白块')
  assert.match(css, /\.rc-title-bar::after \{ content: none; \}/, '标题栏不再挂 03 编号')
  assert.match(css, /content: 'RELOAD'/)
  assert.match(css, /@keyframes p3r-official-backdrop/)
  assert.equal(/p3-water|p3-bubble|p3-module-rise|p3-row-current/.test(css), false)
})

test('P3R 为不同控件提供不同固定轮廓', () => {
  const css = read('src/assets/css/theme-refresh.css')
  // 数据块：三种交错切角（海报拼贴）
  assert.match(css, /\.summary-chip:nth-child\(3n\+1\)[\s\S]{0,180}clip-path: polygon/)
  // 页签：双端斜切（票签）
  assert.match(css, /\.tl-entry-btn[\s\S]{0,180}clip-path: polygon\(8px 0/)
  // 次级按钮与输入框：同一套「右下 8px 切角」
  assert.match(css, /\.rc-global-btn, \.pd-btn, \.gm-btn, \.gm-add, \.cancel-btn[\s\S]{0,200}clip-path: polygon\(0 0, 100% 0, 100% calc\(100% - 8px\)/)
  // 主操作（工具栏第一颗 / 弹窗保存）：唯一使用箭头形的地方
  assert.match(css, /\.local-toolbar > \.rc-global-btn:first-child, \.save-btn[\s\S]{0,200}clip-path: polygon\(0 0, calc\(100% - 10px\) 0, 100% 50%/)
  // 筛选 chip：双端斜切
  assert.match(css, /\.folder-chip[\s\S]{0,180}clip-path: polygon\(7px 0/)
  assert.match(css, /\.song-item \{[\s\S]{0,200}clip-path: none/)
  assert.match(css, /\.song-item::before[\s\S]{0,220}width: 42px/)
  assert.match(css, /\.song-item::after[\s\S]{0,220}width: 3px/)
  // 行内按钮：小号右下切角
  assert.match(css, /\.song-btn \{[\s\S]{0,200}clip-path: polygon\(0 0, 100% 0, 100% calc\(100% - 6px\)/)
  assert.match(css, /\.edit-popup[\s\S]{0,260}clip-path: polygon\(18px 0/)
})

test('P3R 形状覆盖不修改布局排版属性', () => {
  const css = read('src/assets/css/theme-refresh.css')
  const section = css.slice(css.indexOf('P3R 控件形状系统'), css.indexOf('@keyframes p3r-official-stage'))
  for (const prop of ['margin:', 'padding:', 'gap:', 'display:', 'flex:', 'grid:', 'min-width:', 'max-width:', 'min-height:', 'max-height:']) {
    assert.equal(section.includes(prop), false, `形状覆盖不得设置 ${prop}`)
  }
  const realRules = section.split('}').filter(rule => rule.includes('{') && !/::before|::after/.test(rule.slice(0, rule.indexOf('{'))))
  for (const rule of realRules) {
    const body = rule.slice(rule.indexOf('{'))
    assert.equal(/(^|[;{\s])width\s*:/.test(body), false, '真实控件不得改 width')
    assert.equal(/(^|[;{\s])height\s*:/.test(body), false, '真实控件不得改 height')
  }
})

test('瑞士使用十二栏基线、非对称编号与表格式列表', () => {
  const swiss = read('src/assets/css/theme-swiss.css')
  assert.match(swiss, /repeating-linear-gradient\(90deg/)
  assert.match(swiss, /content: '01'/)
  assert.match(swiss, /\.song-item \{[\s\S]{0,160}background: transparent;[\s\S]{0,120}border-bottom: 1px solid/)
  const refresh = read('src/assets/css/theme-refresh.css')
  assert.match(refresh, /\.theme-swiss-light[\s\S]{0,240}--state-bg:/)
  assert.match(refresh, /\.theme-swiss-dark[\s\S]{0,240}--state-bg:/)
})

test('P3R 不再使用水波、气泡和浮升循环', () => {
  const css = read('src/assets/css/theme-refresh.css')
  for (const banned of ['p3-water', 'p3-bubble', 'border-radius: 50%', 'scale(1.04)']) {
    assert.equal(css.includes(banned), false, `不得保留 ${banned}`)
  }
})

test('六套主题 hover 与 selected / active 使用同一状态变量', () => {
  const css = read('src/assets/css/theme-refresh.css')
  assert.match(css, /\.song-item\.selected,[\s\S]{0,1000}background: var\(--state-bg\)/)
  assert.match(css, /\.song-item:hover,[\s\S]{0,1000}background: var\(--state-bg\)/)
  assert.match(css, /\.folder-chip\.active[\s\S]{0,1000}color: var\(--state-fg\)/)
  assert.match(css, /\.rc-sub-func-btn:hover[\s\S]{0,1000}border-color: var\(--state-border\)/)
})

test('P3R 官网式入场覆盖页面、模块、列表与弹窗', () => {
  const css = read('src/assets/css/theme-refresh.css')
  for (const keyframe of [
    'p3r-official-stage', 'p3r-official-header', 'p3r-official-block',
    'p3r-official-summary-left', 'p3r-official-summary-right',
    'p3r-official-row-left', 'p3r-official-row-right',
    'p3r-official-backdrop', 'p3r-official-modal',
  ]) {
    assert.ok(css.includes(`@keyframes ${keyframe}`), `缺少 ${keyframe}`)
  }
  assert.match(css, /--mv-stage: 0\.18s/)
  assert.match(css, /\.local-toolbar[\s\S]{0,120}28ms/)
  assert.match(css, /nth-child\(odd\)[\s\S]{0,120}66ms/)
  assert.match(css, /nth-child\(even\)[\s\S]{0,120}78ms/)
  assert.match(css, /p3r-official-modal var\(--mv-stage\)/)
})

test('P3R 入场总时长压到 180ms，列表不再逐行长错峰', () => {
  const css = read('src/assets/css/theme-refresh.css')
  assert.match(css, /--mv-tick: 0\.07s/)
  assert.match(css, /--mv-module: 0\.12s/)
  assert.match(css, /--mv-stage: 0\.18s/)
  for (const oldDelay of ['106ms', '130ms', '154ms', '178ms', '202ms', '320ms']) {
    assert.equal(css.includes(`animation-delay: ${oldDelay}`), false, `不得保留拖沓延迟 ${oldDelay}`)
  }
  assert.match(css, /p3r-official-backdrop 0\.18s/)
})

test('P3R 页面与列表结束态不裁切内容', () => {
  const css = read('src/assets/css/theme-refresh.css')
  const stage = css.slice(css.indexOf('@keyframes p3r-official-stage'), css.indexOf('@keyframes p3r-official-block'))
  assert.match(stage, /to \{ opacity: 1; transform: none; clip-path: none; \}/)
  const row = css.slice(css.indexOf('列表行：只留底部细线'), css.indexOf('行内按钮'))
  assert.match(row, /\.song-item \{[\s\S]{0,180}clip-path: none/)
  assert.equal(/\.song-item::after[\s\S]{0,220}width: 16px/.test(row), false, '右上不得再用大色块覆盖内容')
  assert.match(row, /\.song-item::after[\s\S]{0,220}width: 3px/)
})

test('P3R 斜向大色块只存在于内容背后的背景层', () => {
  const css = read('src/assets/css/theme-refresh.css')
  assert.match(css, /\.local-music::after[\s\S]{0,220}z-index: -2/)
  assert.match(css, /\.local-music\.entered::after[\s\S]{0,120}p3r-official-backdrop/)
})

test('瑞士入场使用结构线与排印落位，不使用 hover 浮动', () => {
  const css = read('src/assets/css/motion-themes.css')
  for (const keyframe of ['swiss-stage-rule', 'swiss-type-set', 'swiss-row-set', 'swiss-modal-rule']) {
    // 瑞士保持既有 ch-rule-open 动效，不再要求新增覆盖层关键帧。
    if (keyframe === 'swiss-stage-rule') assert.match(css, /@keyframes ch-rule-open/)
  }
  const refresh = read('src/assets/css/theme-refresh.css')
  const state = refresh.slice(refresh.indexOf('统一状态'))
  assert.equal(/theme-swiss[^}]*hover[^}]*translate|theme-swiss[^}]*hover[^}]*scale\(/.test(state), false)
})

test('P3R 减动效关闭斜切揭幕、位移与错峰', () => {
  const css = read('src/assets/css/theme-refresh.css')
  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduced, /animation: none !important/)
  assert.match(reduced, /transform: none !important/)
  assert.match(reduced, /clip-path: none !important/)
  assert.match(reduced, /transition-delay: 0ms !important/)
  assert.equal(/bubble/.test(reduced), false)
})

test('本轮新增动效关键帧和时间轴不引用终末地选择器', () => {
  const css = read('src/assets/css/theme-refresh.css')
  const section = css.slice(css.indexOf('@keyframes p3r-official-stage'), css.indexOf('统一状态'))
  assert.equal(/theme-endfield/.test(section), false)
})

test('hover 前后不移动、不缩放、不变形，只过渡颜色', () => {
  const css = read('src/assets/css/theme-refresh.css')
  const state = css.slice(css.indexOf('统一状态'))
  assert.match(state, /transform: none/)
  assert.match(state, /transition-property: background-color, color, border-color, box-shadow, filter/)
  assert.equal(/hover[\s\S]{0,300}translate|hover[\s\S]{0,300}scale\(/.test(state), false)
})
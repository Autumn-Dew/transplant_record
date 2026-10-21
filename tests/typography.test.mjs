// 字体：六套界面主题 + 十套汇报主题统一成 P3R 那套字形与字重
// 契约：字体族全站一套（Bahnschrift 栈）、字重按 P3R（900/800/700）、
// 字距保留各主题自己的个性（不做统一）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(path.join(ROOT, p), 'utf8')

test('字体分工：--font-ui 是正文字体栈，--font-mono 是等宽字体栈', () => {
  const tokens = read('src/assets/css/design-tokens.css')
  assert.match(tokens, /--font-ui:\s*'Bahnschrift', 'Microsoft YaHei'/, '--font-ui 是 Bahnschrift + 中文黑体')
  assert.match(
    tokens,
    /--font-mono:\s*"Fira Code", "Cascadia Code", Consolas, "Courier New", monospace/,
    '--font-mono 仍是等宽字体（同一 font-size 下视觉更小，换成正文字体会让数字 / 备注看起来变大）',
  )
  // 两者必须不同：把 --font-mono 指到 --font-ui 会让等宽位置的字明显变大
  assert.notEqual(
    tokens.match(/--font-ui:\s*([^;]+);/)[1],
    tokens.match(/--font-mono:\s*([^;]+);/)[1],
    '--font-mono 不能等于 --font-ui',
  )
})

test('全站不再硬编码 font-family: monospace（统一走 --font-mono）', () => {
  const hits = []
  ;(function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name)
      if (statSync(p).isDirectory()) { walk(p); continue }
      if (!/\.(vue|css)$/.test(name)) continue
      const text = readFileSync(p, 'utf8')
      // 允许注释里提到 monospace（说明文字），只查真的声明
      const decl = text.replace(/\/\*[\s\S]*?\*\//g, '')
      if (/font-family:\s*monospace\b/.test(decl)) hits.push(path.relative(path.join(ROOT, 'src'), p))
      // 等宽字体栈只允许出现在 design-tokens 的定义里
      if (/Fira Code/.test(decl) && !/design-tokens\.css$/.test(p)) hits.push(`${path.relative(path.join(ROOT, 'src'), p)} (Fira Code)`)
    }
  })(path.join(ROOT, 'src'))
  assert.deepEqual(hits, [], `这些文件还在硬编码等宽字体：${hits.join(', ')}`)
})

test('界面主题的字重与 P3R 一致（900 / 800 / 700）', () => {
  const common = read('src/assets/css/page-common.css')
  // 排版基线：标题 900、名称 800、汇总数字 900、费用 800
  assert.match(common, /html\[data-theme\] \.local-music \.local-header h2 \{ font-weight: 900; \}/, '页面标题 900')
  assert.match(common, /html\[data-theme\] \.local-music \.song-name \{ font-weight: 800; \}/, '列表名称 800')
  assert.match(common, /html\[data-theme\] \.local-music \.summary-chip strong \{ font-weight: 900; \}/, '汇总数字 900')
  assert.match(common, /html\[data-theme\] \.local-music \.fee-main \{ font-weight: 800; \}/, '金额 800')

  const lone = read('src/assets/css/theme-lone-star.css')
  assert.match(lone, /\.local-header h2 \{\s*font-weight: 900;/, '孤星标题 900')
  assert.match(lone, /\.summary-chip strong \{\s*font-family: var\(--font-mono\);\s*font-weight: 900;/, '孤星汇总数字 900')
  assert.match(lone, /\.song-name \{\s*font-weight: 800;/, '孤星名称 800')
  assert.match(lone, /\.rc-title-bar h2 \{\s*font-weight: 800;/, '孤星窗口标题 800')
  assert.match(lone, /\.folder-chip \{[\s\S]{0,160}font-weight: 700;/, '孤星筛选项 700')
  assert.match(lone, /\.local-toolbar > \.rc-global-btn:first-child \{[\s\S]{0,160}font-weight: 900;/, '孤星主操作按钮 900')

  const ef = read('src/assets/css/theme-endfield.css')
  assert.match(ef, /\.local-header h2 \{\s*font-weight: 900;/, '终末地标题 900')
  assert.match(ef, /\.summary-chip strong \{\s*font-family: var\(--font-mono\);\s*font-weight: 900;/, '终末地汇总数字 900')
  assert.match(ef, /\.song-name \{\s*font-weight: 800;/, '终末地名称 800')
  assert.match(ef, /\.folder-chip \{[\s\S]{0,160}font-weight: 700;/, '终末地筛选项 700')
  assert.match(ef, /\.local-toolbar > \.rc-global-btn:first-child \{[\s\S]{0,400}font-weight: 900;/, '终末地主操作按钮 900')
  assert.match(
    ef,
    /\.rc-global-btn,[\s\S]{0,400}font-weight: 700;/,
    '终末地按钮 700',
  )

  // P3R 是基准，值本身不变
  const p3r = read('src/assets/css/theme-p3r.css')
  assert.match(p3r, /\.local-header h2 \{[\s\S]{0,120}font-weight: 900;/, 'P3R 标题 900')
})

test('汇报主题的字重也与 P3R 一致（标题 / 卡片头 / 金额 / 任务名）', () => {
  const sheet = read('src/components/ReportSheet.vue')
  // 末尾的排印基线对所有 .rp-theme-* 生效
  assert.match(sheet, /\.rp-wrap \.rp-title \{ font-weight: 900;/, '汇报标题 900')
  assert.match(sheet, /\.rp-wrap \.rp-card-head \{ font-weight: 900;/, '卡片头 900')
  assert.match(sheet, /\.rp-wrap \.rp-task-label \{ font-weight: 700;/, '任务名 700')
  assert.match(sheet, /\.rp-wrap \.rp-inp \{ font-weight: 800;/, '输入框 800（基线）')
  assert.match(sheet, /\.rp-wrap \.rp-meta \.rp-inp \{ font-weight: 900; \}/, '信息栏输入框 900（classic 也吃这条）')

  // 各主题自己的「信息栏输入框」也要 900 —— 特异性比基线高，必须逐个对齐
  for (const theme of ['ls-archive', 'ls-gauge', 'p3r-poster', 'p3r-tiles', 'ef-ledger', 'ef-nightshift', 'ef-workorder']) {
    const re = new RegExp(`\\.rp-theme-${theme} \\.rp-meta \\.rp-inp \\{[^}]*font-weight: 900`)
    assert.match(sheet, re, `${theme} 的信息栏输入框 900`)
  }
})

test('字距保留各主题个性（本轮不统一）', () => {
  const lone = read('src/assets/css/theme-lone-star.css')
  assert.match(lone, /\.rc-title-bar h2 \{\s*font-weight: 800;\s*letter-spacing: 3px;/, '孤星仍保留 3px 宽字距')
  const sheet = read('src/components/ReportSheet.vue')
  assert.match(sheet, /\.rp-theme-p3r-poster \.rp-title \{ font-weight: 900; letter-spacing: -0\.4px; \}/, 'P3R 海报标题负字距保留')
  assert.match(sheet, /\.rp-theme-ls-archive \.rp-card-head \{ letter-spacing: 2\.2px; \}/, '科研档案卡片头字距保留')
})

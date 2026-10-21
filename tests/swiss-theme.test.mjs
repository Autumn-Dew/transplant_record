// 瑞士风格主题（Swiss Style / International Typographic Style）
// 契约：
//   · 三种颜色（墨 / 米白 / 红），全部平涂：无渐变底、无阴影、无纹理
//   · 字重只有 400 与 700 两档
//   · 不改字号（用户明确要求：字体大小不能动）
//   · 界面两套（纸面 / 墨底）+ 汇报两套 + 背景三套，各自登记到分组里
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(path.join(ROOT, p), 'utf8')

test('界面新增瑞士两套主题，由 theme-swiss.css 承载', () => {
  const theme = read('src/composables/useGlobalTheme.js')
  assert.match(theme, /id: 'swiss-light'/, '瑞士 · 纸面')
  assert.match(theme, /id: 'swiss-dark'/, '瑞士 · 墨底')
  assert.equal(/THEMES\.length/.test(theme), false, '主题数量由数组决定，不写死')

  const app = read('src/App.vue')
  assert.match(app, /@import '@\/assets\/css\/theme-swiss\.css';/, 'App.vue 引入主题文件')
  // 必须排在 page-common 之前（页面通用样式在主题之后加载，覆盖不冲突）
  assert.ok(
    app.indexOf("theme-swiss.css") < app.indexOf("page-common.css"),
    'theme-swiss.css 要在 page-common.css 之前引入',
  )
})

test('瑞士调色板：墨 #111111 / 米白 #F2EFE9 / 强调红 #DA291C', () => {
  const global = read('src/assets/css/global-theme.css')
  for (const sel of ['.theme-swiss-light', '.theme-swiss-dark']) {
    const block = global.slice(global.indexOf(sel))
    const body = block.slice(0, block.indexOf('}'))
    assert.ok(body.includes('--accent: #DA291C'), `${sel} 的强调色必须是国际主义红`)
    assert.ok(body.includes('--ch-red: #DA291C'), `${sel} 需要 --ch-red`)
    assert.ok(body.includes('--ch-grid-line:'), `${sel} 需要 12 栏网格线变量`)
  }
  const light = global.slice(global.indexOf('.theme-swiss-light'))
  const lightBody = light.slice(0, light.indexOf('}'))
  assert.ok(lightBody.includes('--bg-primary: #F2EFE9'), '纸面是米白')
  assert.ok(lightBody.includes('--text-primary: #111111'), '文字是墨黑')
  const dark = global.slice(global.indexOf('.theme-swiss-dark'))
  const darkBody = dark.slice(0, dark.indexOf('}'))
  assert.ok(darkBody.includes('--bg-primary: #111111'), '墨底是 #111111')
  assert.ok(darkBody.includes('--text-primary: #F2EFE9'), '墨底上的文字是米白')
})

test('瑞士主题只用 400 / 700 两档字重，且不改任何字号', () => {
  const swiss = read('src/assets/css/theme-swiss.css')
  const decls = swiss.replace(/\/\*[\s\S]*?\*\//g, '')
  const weights = [...decls.matchAll(/font-weight:\s*(\d+)/g)].map(m => m[1])
  assert.ok(weights.length > 0, '需要显式声明字重')
  for (const w of weights) assert.ok(w === '400' || w === '700', `只允许 400 / 700，出现了 ${w}`)
  // 唯一允许的 font-size 是「红色编号」伪元素（新加的装饰，不是既有文字）
  const sizes = [...decls.matchAll(/font-size:\s*([^;]+);/g)].map(m => m[1].trim())
  for (const s of sizes) assert.equal(s, '10px', `除编号伪元素(10px)外不得设置字号，出现了 ${s}`)
  for (const s of sizes) {
    const head = decls.slice(0, decls.indexOf(`font-size: ${s};`))
    assert.ok(head.includes('::before'), '唯一设置字号的地方是 ::before 编号')
  }
})

test('瑞士主题平涂：不用阴影、不用渐变底、不做圆角', () => {
  const swiss = read('src/assets/css/theme-swiss.css').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.equal(/text-shadow\s*:/.test(swiss), false, '不用文字阴影')
  // 只允许 inset 的「细线」阴影（当 1px 线用），不允许带模糊半径的投影
  const shadows = [...swiss.matchAll(/box-shadow:\s*([^;]+);/g)].map(m => m[1])
  for (const s of shadows) {
    assert.ok(/inset|none/.test(s), `box-shadow 只能是 inset 细线或 none：${s}`)
  }
  // 背景只允许 12 栏网格这一种 repeating 细线，不做渐变色块
  const bgs = [...swiss.matchAll(/background(-image)?:\s*([^;]+);/g)].map(m => m[2])
  for (const b of bgs) {
    assert.ok(!/linear-gradient|radial-gradient/.test(b), `不要用渐变做色块：${b}`)
  }
  // 圆角一律 0（这套风格是直角）
  const radius = [...swiss.matchAll(/border-radius:\s*([^;]+);/g)].map(m => m[1].trim())
  for (const r of radius) assert.equal(r, '0', `圆角必须是 0：${r}`)
})

test('汇报新增瑞士两套：变量块 + 皮肤，字重同样只有 400 / 700', () => {
  const sheet = read('src/components/ReportSheet.vue')
  const section = sheet.slice(sheet.indexOf('瑞士风格 · 国际主义平面设计'))
  assert.ok(section.length > 500, '需要瑞士主题的样式段落')
  for (const id of ['swiss-rule', 'swiss-index']) {
    assert.ok(section.includes(`.rp-theme-${id} {`), `${id} 需要变量块`)
    assert.ok(section.includes(`.rp-wrap.rp-theme-${id} .rp-title`), `${id} 的标题字重要压过通用基线`)
  }
  const weights = [...section.matchAll(/font-weight:\s*(\d+)/g)].map(m => m[1])
  for (const w of weights) assert.ok(w === '400' || w === '700', `汇报里也只允许 400 / 700，出现了 ${w}`)
  assert.equal(/font-size\s*:/.test(section.replace(/font-size:\s*8px/g, '')), false, '只允许编号伪元素用 8px，其余不得改字号')
})

test('汇报背景新增瑞士三套，并归到「瑞士风格」组', () => {
  const bgs = read('src/data/report-backgrounds.js')
  for (const id of ['ch-grid', 'ch-asym', 'ch-black']) {
    assert.ok(bgs.includes(`id: '${id}'`), `背景 ${id} 已登记`)
    assert.ok(bgs.includes(`style: 'swiss'`), '风格系列是 swiss')
  }
  assert.match(bgs, /\{ id: 'swiss', label: '瑞士风格', items: SWISS_BGS \}/, '瑞士分组')
  // 12 栏网格：每组背景都必须画竖线
  assert.match(bgs, /repeating-linear-gradient\(90deg, rgba\(17,17,17,0\.10\) 0 1px, transparent 1px 8\.3333%\)/, '12 栏竖向细线')
})

test('瑞士族的动效与悬停也接上了', () => {
  const motion = read('src/assets/css/motion-themes.css')
  assert.match(motion, /:is\(\.theme-swiss-light, \.theme-swiss-dark\) \{[\s\S]{0,400}--mv-tick/, '瑞士动效族')
  assert.match(motion, /@keyframes ch-rule-open/, '版面落定的入场动画')
  const hover = read('src/assets/css/hover-states.css')
  assert.match(hover, /:is\(\.theme-swiss-light\) \{[\s\S]{0,300}--hv-mark: #DA291C/, '纸面悬停变量')
  assert.match(hover, /:is\(\.theme-swiss-dark\) \{[\s\S]{0,300}--hv-mark: #DA291C/, '墨底悬停变量')
  assert.match(hover, /:is\(\.theme-swiss-light, \.theme-swiss-dark\) \.local-music \.song-item:hover/, '瑞士的行悬停造型')
})

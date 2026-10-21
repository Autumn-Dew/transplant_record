// 价格一览的画布外观：原版（默认）+ 终末地风格
// 契约：外观独立持久化、不动业务数据；终末地风格只改画布内的布局 / 排版 / 元素。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const STORAGE = 'src/data/storage.js'
const PAGE = 'src/views/PricePage.vue'

test('价格画布外观有独立存储键，且与业务数据分开', () => {
  const storage = read(STORAGE)
  assert.match(storage, /PRICE_THEME:\s*'tr-price-theme'/, 'KEYS 需登记 PRICE_THEME')
  // 不允许把外观塞进业务键（价格数据是 tr-prices）
  assert.equal(/PRICE_THEME:\s*'tr-prices'/.test(storage), false, '外观不得占用 tr-prices')
})

test('原版是默认：未设置 / 未知值都回落到 classic', () => {
  const page = read(PAGE)
  assert.match(page, /const PRICE_THEMES = \['classic', 'endfield'\]/, '两套外观')
  assert.match(
    page,
    /PRICE_THEMES\.includes\(raw\) \? raw : 'classic'/,
    '未知值回落原版（不留「无外观」状态）',
  )
  assert.match(page, /const priceTheme = ref\(normalizePriceTheme\(readJSON\(KEYS\.PRICE_THEME, null\)\)\)/, '默认从存储读，没有就回落')
})

test('工具栏提供两套外观入口，点击即切换并持久化', () => {
  const page = read(PAGE)
  assert.match(page, /@click="setTheme\('classic'\)"/, '原版入口')
  assert.match(page, /@click="setTheme\('endfield'\)"/, '终末地入口')
  assert.match(page, /:class="\{ active: !isEf \}"/, '原版高亮')
  assert.match(page, /:class="\{ active: isEf \}"/, '终末地高亮')
  assert.match(page, /writeJSON\(KEYS\.PRICE_THEME, priceTheme\.value\)/, '切换即写入独立键')
  assert.match(page, /:class="\{ 'pr-ef': isEf \}"/, '画布按外观挂类名')
})

test('终末地风格改的是画布内的布局 / 排版 / 元素', () => {
  const page = read(PAGE)
  // 结构：原版 = 每分类一块表格；终末地 = 分类卡片（flex 两列）+ 每项一行
  assert.match(page, /<template v-if="!isEf">/, '原版才走表格结构')
  assert.match(page, /<div class="pr-ef-cards" v-else/, '终末地风格用卡片容器')
  assert.match(page, /class="pr-ef-card"/, '每个分类一张卡片')
  assert.match(page, /:class="\{ wide: ci === 0 \}"/, '第一张卡片占满一行')
  assert.match(page, /<div v-for="\(item, idx\) in cat\.items"[^>]*class="pr-ef-item"/, '每个单项独占一行')
  assert.match(page, /class="pr-ef-no"/, '每行带编号')
  // 布局：两列 flex + wide 占满
  assert.match(page, /\.pr-ef \.pr-ef-cards\s*\{[\s\S]{0,160}flex-wrap:\s*wrap/, '卡片容器按 flex 折行')
  assert.match(page, /\.pr-ef \.pr-ef-card\s*\{[\s\S]{0,240}flex:\s*1 1 calc\(50% - 5px\)/, '默认并排两列')
  assert.match(page, /\.pr-ef \.pr-ef-card\.wide\s*\{[^}]*flex:\s*1 1 100%/, 'wide 卡片占满一整行')
  assert.match(page, /\.pr-ef \.pr-ef-item\s*\{[\s\S]{0,200}display:\s*flex/, '单项按行排（编号 / 项目 / 说明 / 价格）')
  assert.match(page, /\.pr-ef \.pr-ef-pr\s*\{[\s\S]{0,200}tabular-nums/, '价格用等宽数字')
  // 装饰：三色条 / 眉标 / 条码 / 斜线纹 / 卡片角块与刻度
  assert.match(page, /\.pr-wrap\.pr-ef::before\s*\{[\s\S]{0,240}height:\s*3px/, '顶边三色条')
  assert.match(page, /\.pr-wrap\.pr-ef::after\s*\{[\s\S]{0,240}PRICE LIST/, '`//` 眉标')
  assert.match(page, /\.pr-ef \.pr-content::before\s*\{[\s\S]{0,260}repeating-linear-gradient/, '右缘条码')
  assert.match(page, /\.pr-ef \.pr-content::after\s*\{[\s\S]{0,260}repeating-linear-gradient/, '右下斜线纹')
  assert.match(page, /\.pr-ef \.pr-ef-card::before\s*\{[\s\S]{0,200}background:\s*#b8ff3d/, '卡片右上角块')
  assert.match(page, /\.pr-ef \.pr-ef-card::after\s*\{[\s\S]{0,260}repeating-linear-gradient/, '卡片右下刻度')
  assert.match(page, /\.pr-ef \.pr-ef-card-head::after\s*\{[\s\S]{0,200}background:\s*#b8ff3d/, '卡片头 lime 刻度')
  // 布局：竖版价目单，上留白给三色条与眉标让位
  assert.match(page, /\.pr-wrap\.pr-ef\s*\{[\s\S]{0,160}max-width:\s*1080px/, '画布宽度（1080，两列卡片更舒展）')
  assert.match(page, /\.pr-wrap\.pr-ef\s*\{[\s\S]{0,200}padding:\s*50px/, '上留白给三色条与眉标')
})

test('导出底色跟随外观，且不使用导出不支持的 CSS', () => {
  const page = read(PAGE)
  assert.match(
    page,
    /backgroundColor:\s*isEf\.value \? '#f4f4f2' : '#ffffff'/,
    '导出兜底底色跟随外观',
  )
  const style = page.slice(page.indexOf('.pr-wrap.pr-ef'))
  assert.equal(/clip-path\s*:/.test(style), false, '终末地风格不得使用 clip-path（html2canvas 不可靠）')
  assert.equal(/filter\s*:/.test(style), false, '不得使用 filter')
  assert.equal(/display:\s*grid/.test(style), false, '不使用 grid（导出排版不可靠）')
})

test('复制到剪切板：与每日汇报同款（ClipboardItem + PNG blob）', () => {
  const page = read(PAGE)
  // 入口：工具栏两个按钮，导出图片显式传 false、复制传 true
  assert.match(page, /@click="exportImage\(false\)"/, '导出图片入口')
  assert.match(page, /@click="exportImage\(true\)"/, '复制到剪切板入口')
  assert.match(page, /<span>复制到剪切板<\/span>/, '按钮文案与每日汇报一致')
  // 实现：canvas → blob → ClipboardItem('image/png')
  assert.match(page, /async function exportImage\(toClipboard = false\)/, '按参数分流')
  assert.match(page, /canvas\.toBlob\(r, 'image\/png'\)/, '导出为 PNG blob')
  assert.match(
    page,
    /navigator\.clipboard\.write\(\[new ClipboardItem\(\{ 'image\/png': blob \}\)\]\)/,
    '写系统剪贴板',
  )
  // 只复制时不触发下载（不建 a[download]）
  const fn = page.slice(page.indexOf('async function exportImage'), page.indexOf('</script>'))
  const copyBranch = fn.slice(fn.indexOf('if (toClipboard)'), fn.indexOf('const url = URL.createObjectURL(blob)'))
  assert.equal(/a\.download/.test(copyBranch), false, '复制分支不下载文件')
})

test('备注列占最大比例，且列宽按固定值对齐', () => {  const page = read(PAGE)
  // 名称列不写死百分比：宽度 = 所有单项名称里最宽的那个（JS 量出来 → CSS 变量）
  assert.match(
    page,
    /\.pr-ef \.pr-ef-nm\s*\{[\s\S]{0,160}flex:\s*0 0 var\(--pr-ef-nm-w/,
    '名称列宽度由最长名称决定',
  )
  assert.match(page, /function measureNameColumn\(\)/, '有测量名称宽度的方法')
  assert.match(page, /el\.getBoundingClientRect\(\)\.width/, '逐条量名称宽度')
  assert.match(
    page,
    /'--pr-ef-nm-w': cardNameWidths\[ci\] \? cardNameWidths\[ci\] \+ 'px'/,
    '每张卡片各自写自己的名称列宽（占满整行的类别不会被全局最大值撑宽）',
  )
  assert.match(page, /\.pr-ef-measure\s*\{[\s\S]{0,240}white-space:\s*nowrap/, '量尺不换行，量的是自然宽度')
  assert.match(page, /\.pr-ef \.pr-ef-pr\s*\{[\s\S]{0,120}flex:\s*0 0 84px/, '价格列 84px 固定宽')
  assert.match(
    page,
    /\.pr-ef \.pr-ef-note\s*\{[\s\S]{0,240}flex:\s*1 1 auto/,
    '备注列吃掉剩余宽度（四列里最宽）',
  )
  // 备注短的时候右半边会空着，用点线引导把「备注 → 价格」连起来，不然看着孤立
  assert.match(
    page,
    /\.pr-ef \.pr-ef-note::after\s*\{[\s\S]{0,240}border-bottom:\s*1px dotted/,
    '备注到价格之间有点线引导',
  )
  assert.match(page, /\.pr-ef \.pr-ef-note\.is-empty::after\s*\{\s*content:\s*none/, '空备注不画点线')
  assert.match(page, /class="pr-ef-note-text"/, '备注文字单独一层，点线才不会被当成文字内容')
})

test('装饰不用多层 background-image 定位实心色块（导出会整层铺满变黑）', () => {
  const page = read(PAGE)
  // 去掉注释再断言：注释里解释了这个坑，会把「实心渐变」字样带进来
  const style = page.slice(page.indexOf('.pr-wrap.pr-ef')).replace(/\/\*[\s\S]*?\*\//g, '')
  assert.equal(
    /linear-gradient\(90deg,\s*#161616 0 100%\)/.test(style),
    false,
    '不得用实心渐变层做定位色块：html2canvas 忽略 background-size，会铺满画布',
  )
  assert.equal(
    /linear-gradient\(90deg,\s*#b8ff3d 0 100%\)/.test(style),
    false,
    'lime 角块同样不能用背景层',
  )
  // 定位色块改由真实元素承担（绝对定位，不占布局）
  assert.match(page, /<div class="pr-ef-deco" v-if="isEf" aria-hidden="true">/, '画布装饰层')
  assert.match(page, /<i class="pr-ef-card-deco" aria-hidden="true"><\/i>/, '卡片装饰层')
  assert.match(page, /\.pr-ef \.pr-ef-corner-lime\s*\{[\s\S]{0,160}background:\s*#b8ff3d/, '角块用元素 + 纯色')
  // 保留的 background-image 只能是平铺纹理（画布底纹块）
  const canvasBlocks = [...style.matchAll(/\.pr-wrap\.pr-ef\s*\{([\s\S]*?)\}/g)].map(m => m[1])
  const canvasBg = canvasBlocks.find(b => b.includes('background-image'))
  assert.ok(canvasBg, '画布底纹块存在')
  assert.equal(
    (canvasBg.match(/linear-gradient/g) || []).length,
    2,
    '画布底色只剩两层平铺网格（每层都是网格线，不是实心块）',
  )
  assert.match(canvasBg, /background-size: 24px 24px, 24px 24px;/, '网格步长 24px')
})

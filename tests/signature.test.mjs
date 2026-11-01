// 个人标签（署名）：价格表画布 + 设置页 + 日报
// 契约：署名只在 data/app-info.js 定义一次（APP_SIGN），其它地方一律引用它；
//       价格表的署名在画布内，会随导出图一起带出。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(path.join(ROOT, p), 'utf8')

const SIGN = '秋の露'
const HARDCODED = new RegExp(`(['"\`])${SIGN}\\1`)

test('价格表画布带个人标签，且随导出一起带出', () => {
  const page = read('src/views/PricePage.vue')
  assert.match(page, /const SIGNATURE = APP_SIGN/, '价格页引用统一的署名常量')
  // 署名节点在 .pr-content 里（画布内），不是 .rp-no-export
  assert.match(page, /<div class="pr-sign" :class="\{ 'pr-sign-ef': isEf \}">/, '署名节点在画布内')
  assert.match(page, /class="pr-sign-name">\{\{ SIGNATURE \}\}/, '署名用同一个标签')
  assert.equal(/pr-sign[^>]*rp-no-export/.test(page), false, '署名不能被排除在导出之外')
  // 两套外观都有配色（原版灰字 + 终末地等宽小字）
  assert.match(page, /\.pr-sign\s*\{[\s\S]{0,200}justify-content: flex-end/, '署名右对齐')
  assert.match(page, /\.pr-sign\.pr-sign-ef \.pr-sign-name\s*\{[\s\S]{0,160}font-family: var\(--font-mono\)/, '终末地用等宽小字')
})

test('设置页显示同一个个人标签', () => {
  const page = read('src/views/SettingsPage.vue')
  assert.match(page, /const SIGNATURE = APP_SIGN/, '设置页引用统一的署名常量')
  assert.match(page, /<span class="setting-label">个人标签<\/span>/, '设置项标题')
  assert.match(page, /class="setting-sign-name">\{\{ SIGNATURE \}\}/, '署名用同一个标签')

  const css = read('src/assets/css/page-common.css')
  assert.match(css, /\.setting-sign\s*\{[\s\S]{0,200}border: 1px solid var\(--border-color\)/, '签名有细边框')
  assert.match(css, /\.setting-sign-mark\s*\{[\s\S]{0,120}background: var\(--accent\)/, '签名短线跟随主题强调色')
})

test('署名只有一个来源：data/app-info.js 的 APP_SIGN', () => {
  const info = read('src/data/app-info.js')
  assert.match(info, new RegExp(`export const APP_SIGN = '${SIGN}'`), '常量在这里定义')

  // 其它源文件不得再写死署名（注释与样式除外）
  const files = [
    'src/views/PricePage.vue',
    'src/views/SettingsPage.vue',
    'src/components/ReportSheet.vue',
  ]
  for (const f of files) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.equal(HARDCODED.test(src), false, `${f} 不应再硬编码署名`)
  }

  // 日报的标题与作者按钮同样走常量
  const sheet = read('src/components/ReportSheet.vue')
  // 日报引用署名常量（汇报人默认值）；具体人名只在 app-info 出现一次
  assert.match(sheet, /import \{ APP_SIGN[^}]*\} from '@\/data\/app-info\.js'/, '日报引用署名常量')
  assert.match(sheet, /const currentAuthor = computed/, '汇报人是每游戏固定值')
  assert.equal(/'小野'/.test(sheet), false, '组件里不再出现人名')
})

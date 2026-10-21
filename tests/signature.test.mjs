// 个人标签（署名）：价格表画布 + 设置页
// 契约：两处用同一个标签文字；价格表的署名在画布内，会随导出图一起带出。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(path.join(ROOT, p), 'utf8')

const SIGN = '秋の露'

test('价格表画布带个人标签，且随导出一起带出', () => {
  const page = read('src/views/PricePage.vue')
  assert.match(page, new RegExp(`const SIGNATURE = '${SIGN}'`), '价格页定义个人标签')
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
  assert.match(page, new RegExp(`const SIGNATURE = '${SIGN}'`), '设置页定义个人标签')
  assert.match(page, /<span class="setting-label">个人标签<\/span>/, '设置项标题')
  assert.match(page, /class="setting-sign-name">\{\{ SIGNATURE \}\}/, '署名用同一个标签')

  const css = read('src/assets/css/page-common.css')
  assert.match(css, /\.setting-sign\s*\{[\s\S]{0,200}border: 1px solid var\(--border-color\)/, '签名有细边框')
  assert.match(css, /\.setting-sign-mark\s*\{[\s\S]{0,120}background: var\(--accent\)/, '签名短线跟随主题强调色')
})

test('两处标签文字一致', () => {
  const price = read('src/views/PricePage.vue').match(/const SIGNATURE = '([^']+)'/)[1]
  const settings = read('src/views/SettingsPage.vue').match(/const SIGNATURE = '([^']+)'/)[1]
  assert.equal(price, settings, '价格表与设置页用同一个署名')
  assert.equal(price, SIGN, '署名就是「秋の露」')
})

// ═══════════════════════════════════════════════════════════════════
// 展示层两个公共件：页面入场节奏（usePageEnter）与列表竖线配色（utils/fee）
//
//   · 入场节奏以前在 8 个页面各写一份，改动要改 8 处；
//   · 金额阈值以前在代肝代办 / 代肝记录各写一份，容易漂移。
// 这里锁定纯函数行为，并用源码契约防止页面又长出各自的副本。
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { staggerStyle, ENTER_BASE_DELAY, ENTER_STAGGER_STEP } from '../src/composables/usePageEnter.js'
import { feeColor, typeColor, rowBarStyle, FEE_COLOR, TYPE_COLOR, FEE_THRESHOLDS } from '../src/utils/fee.js'

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url))
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// ── 入场节奏 ──
test('staggerStyle：0.24s 起、每项 0.023s 递进', () => {
  assert.equal(ENTER_BASE_DELAY, 0.24)
  assert.equal(ENTER_STAGGER_STEP, 0.023)
  assert.deepEqual(staggerStyle(0), { transitionDelay: '0.24s' })
  assert.deepEqual(staggerStyle(1), { transitionDelay: '0.263s' })
  assert.deepEqual(staggerStyle(2), { transitionDelay: '0.286s' })
})

test('staggerStyle：非法 / 负数下标按第 0 项处理', () => {
  assert.deepEqual(staggerStyle(-3), staggerStyle(0))
  assert.deepEqual(staggerStyle(undefined), staggerStyle(0))
  assert.deepEqual(staggerStyle('x'), staggerStyle(0))
})

// ── 金额配色 ──
test('feeColor：四档阈值', () => {
  assert.equal(feeColor(0), FEE_COLOR.none)
  assert.equal(feeColor(''), FEE_COLOR.none)
  assert.equal(feeColor(undefined), FEE_COLOR.none)
  assert.equal(feeColor(1), FEE_COLOR.low)
  assert.equal(feeColor(49), FEE_COLOR.low)
  assert.equal(feeColor(50), FEE_COLOR.mid)
  assert.equal(feeColor(99), FEE_COLOR.mid)
  assert.equal(feeColor(100), FEE_COLOR.high)
  assert.equal(feeColor(999), FEE_COLOR.high)
  assert.deepEqual(FEE_THRESHOLDS, { high: 100, mid: 50, low: 0 })
})

test('typeColor：托管 / 单次 / 灰显', () => {
  assert.equal(typeColor(true), TYPE_COLOR.hosting)
  assert.equal(typeColor(false), TYPE_COLOR.oneoff)
  assert.equal(typeColor(true, { muted: true }), TYPE_COLOR.muted)
  assert.equal(typeColor(false, { muted: true }), TYPE_COLOR.muted)
})

test('rowBarStyle：上下段颜色 + 入场延迟一起给出', () => {
  const style = rowBarStyle({ isHosting: true, amount: 120, delayStyle: { transitionDelay: '0.24s' } })
  assert.equal(style['--bar-top'], TYPE_COLOR.hosting)
  assert.equal(style['--bar-bottom'], FEE_COLOR.high)
  assert.equal(style.transitionDelay, '0.24s')
  // 金额为 0 时下段退回类型色（不是灰色，避免整条竖线看板化）
  const zero = rowBarStyle({ isHosting: false, amount: 0 })
  assert.equal(zero['--bar-top'], TYPE_COLOR.oneoff)
  assert.equal(zero['--bar-bottom'], FEE_COLOR.none)
})

// ── 源码契约：不再有各自的副本 ──
test('所有页面共用 usePageEnter，不再各写一份「双 rAF 置真」', () => {
  const pages = readdirSync(path.join(srcRoot, 'views')).filter(f => f.endsWith('.vue'))
  const offenders = []
  for (const f of pages) {
    const src = readFileSync(path.join(srcRoot, 'views', f), 'utf8')
    if (/requestAnimationFrame\(\(\) => requestAnimationFrame/.test(src)) offenders.push(f)
  }
  assert.deepEqual(offenders, [], `这些页面还在自己写入场动画：${offenders.join(', ')}`)

  // 有入场效果的页面必须从公共件取
  const withEnter = pages.filter(f => /class="[^"]*\{ entered/.test(readFileSync(path.join(srcRoot, 'views', f), 'utf8')) || /:class="\{ entered/.test(readFileSync(path.join(srcRoot, 'views', f), 'utf8')))
  assert.ok(withEnter.length >= 6, '应当有多个页面使用入场效果')
  for (const f of withEnter) {
    const src = readFileSync(path.join(srcRoot, 'views', f), 'utf8')
    assert.match(src, /usePageEnter/, `${f} 应从 composables/usePageEnter 取入场状态`)
  }
})

test('金额与类型配色只有一处阈值定义', () => {
  for (const f of ['AccountPage.vue', 'WorkDiary.vue']) {
    const src = read('./src/views/' + f)
    assert.equal(/fee\s*>=\s*100/.test(src), false, `${f} 不应再写死金额阈值`)
    assert.match(src, /from '@\/utils\/fee\.js'/, `${f} 应引用 utils/fee`)
  }
})

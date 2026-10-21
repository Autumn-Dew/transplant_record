// 主题动效方案：每套主题一套动效性格（时长阶梯 + 曲线 + 入场语法）
// 依据 onetake skill 的三条基础曲线（snap / mech / ease）与三条时长档位。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const CSS = 'src/assets/css/motion-themes.css'

const FAMILIES = [
  { name: '孤星（仪表）', sels: ['.theme-lone-star-light', '.theme-lone-star-dark'] },
  { name: 'P3R（海报）', sels: ['.theme-p3r-light', '.theme-p3r-dark'] },
  { name: '终末地（工作台）', sels: ['.theme-endfield-light', '.theme-endfield-dark'] },
]

test('三套动效性格覆盖全部六套主题', () => {
  const css = read(CSS)
  for (const f of FAMILIES) {
    const sel = `:is(${f.sels.join(', ')})`
    assert.ok(css.includes(sel), `缺少 ${f.name} 的主题选择器 ${sel}`)
    const block = css.slice(css.indexOf(sel))
    const body = block.slice(0, block.indexOf('}'))
    assert.match(body, /--mv-tick:/, `${f.name} 需要定义高频档时长`)
    assert.match(body, /--mv-stage:/, `${f.name} 需要定义页面级时长`)
    assert.match(body, /--mv-ease-frame:/, `${f.name} 需要定义入场曲线`)
  }
})

test('时长阶梯有条理：tick < module < stage，且页面级不超过 400ms', () => {
  const css = read(CSS)
  const grab = (sel, key) => {
    const block = css.slice(css.indexOf(sel))
    const m = block.slice(0, block.indexOf('}')).match(new RegExp(`${key}:\\s*([0-9.]+)s`))
    return m ? Number(m[1]) : NaN
  }
  for (const f of FAMILIES) {
    const sel = `:is(${f.sels.join(', ')})`
    const tick = grab(sel, '--mv-tick')
    const module = grab(sel, '--mv-module')
    const stage = grab(sel, '--mv-stage')
    assert.ok(tick < module && module < stage, `${f.name} 的时长阶梯必须是 tick < module < stage`)
    assert.ok(stage > 0.2 && stage <= 0.4, `${f.name} 的页面级时长应落在 200–400ms（回应操作，不是慢动画）`)
  }
})

test('三套性格的曲线互不相同（不是同一套改名）', () => {
  const css = read(CSS)
  const curves = FAMILIES.map(f => {
    const sel = `:is(${f.sels.join(', ')})`
    const block = css.slice(css.indexOf(sel))
    const m = block.slice(0, block.indexOf('}')).match(/--mv-ease-frame:\s*([^;]+);/)
    return m ? m[1].trim() : null
  })
  assert.ok(curves.every(Boolean), '每套性格都要有自己的入场曲线')
  assert.equal(new Set(curves).size, curves.length, '三套性格的入场曲线必须各不相同')
})

test('动效只碰 transform / opacity / clip-path，不做尺寸动画', () => {
  const css = read(CSS)
  for (const prop of ['width', 'height', 'left:', 'top:', 'margin']) {
    assert.equal(css.includes(`${prop}:`), false, `主题动效不得动画 ${prop}`)
  }
  assert.equal(/transition:[^;]*filter/.test(css), false, '不使用 filter（导出与性能都不可靠）')
  assert.match(css, /clip-path/, '终末地 / P3R 的擦入依赖 clip-path')
})

test('三套性格都支持 prefers-reduced-motion（变轻而不是变零）', () => {
  const css = read(CSS)
  const media = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.ok(media.length > 0, '必须有减动效降级段')
  // 关闭位移与擦开，但保留淡入：时长压到 150ms 一档，而不是全部归零
  assert.match(media, /--mv-stage:\s*0\.15s/, '减动效时把时长压到 150ms')
  assert.match(media, /--mv-module:\s*0\.15s/, '模块级同样压到 150ms')
  assert.match(media, /animation:\s*none/, '减动效时关闭主题入场动画')
  assert.match(media, /transform:\s*none/, '减动效时去掉位移动画')
})

test('保留通用动效契约：页面级入场关键帧与离场定位仍在 motion-system 里', () => {
  const sys = read('src/assets/css/motion-system.css')
  assert.match(sys, /@keyframes mv-page-enter/, '通用入场关键帧不得被主题方案删除')
  for (const name of ['list', 'form', 'doc', 'quiet']) {
    assert.ok(sys.includes(`.local-music.mv-page-${name}-leave-active`), `缺少 ${name} 的离场规则`)
  }
  // 主题方案只覆盖，不复制一份转场实现
  const themed = read(CSS)
  assert.equal(/\.local-music\s*\{[^}]*opacity:\s*0/.test(themed), false, '页面根元素不得默认 opacity: 0（会白屏）')
})

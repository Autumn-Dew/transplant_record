// 样式与转场的静态回归测试
// 背景：页面白屏事故 —— 页面根元素把「是否可见」交给 JS 状态（opacity: 0 → entered），
//       叠加 page-transition 的 leave-to 被更高特异性规则覆盖，
//       导致离开动画不产生过渡、mode="out-in" 永久阻塞、新页面无法插入。
// 这些断言把这个教训固化下来。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('页面根元素默认必须可见，不得依赖 JS 状态决定可见性', () => {
  const css = read('src/assets/css/page-common.css')
  const block = css.match(/\.local-music\s*\{[^}]*\}/)
  assert.ok(block, '未找到 .local-music 规则')
  assert.equal(/opacity\s*:\s*0\b/.test(block[0]), false, '.local-music 不得默认 opacity: 0（会导致整页白屏）')
  assert.equal(/visibility\s*:\s*hidden/.test(block[0]), false, '.local-music 不得默认隐藏')
  // 入场动效只能作为「动画增强」，不能作为可见性开关
  assert.match(css, /\.local-music\.entered\s*\{[^}]*animation/, '入场动效应为 animation 增强')
})

test('页面转场不得使用 out-in（离开动画被阻断会永久阻塞新页面）', () => {
  const app = read('src/App.vue')
  assert.equal(app.includes('mode="out-in"'), false, 'App.vue 不应使用 mode="out-in"')
  assert.match(app, /<Transition :name="pageTransition">/, '应使用普通模式转场')
})

test('离开页面的元素必须脱离文档流，避免与新页面叠加造成布局跳动', () => {
  const css = read('src/assets/css/motion-system.css')
  assert.match(
    css,
    /\.local-music\.mv-page-quiet-leave-active[\s\S]{0,200}position:\s*absolute/,
    'leave-active 需要 position: absolute',
  )
  for (const name of ['list', 'form', 'doc', 'quiet']) {
    assert.ok(
      css.includes(`.local-music.mv-page-${name}-leave-active`),
      `缺少 mv-page-${name} 的 leave-active 规则`,
    )
  }
})

test('页面级入场动画的关键帧存在，且结束态可见', () => {
  const css = read('src/assets/css/motion-system.css')
  const kf = css.match(/@keyframes mv-page-enter\s*\{[\s\S]*?\n\}/)
  assert.ok(kf, '缺少 mv-page-enter 关键帧')
  assert.match(kf[0], /to\s*\{[^}]*opacity:\s*1/, '入场动画结束态必须可见')
})

test('动效系统支持 prefers-reduced-motion', () => {
  const css = read('src/assets/css/motion-system.css')
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, '必须支持减少动态效果')
  const tokens = read('src/assets/css/design-tokens.css')
  assert.match(tokens, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, '设计令牌层同样需要降级')
})

test('页面根容器为转场提供定位上下文', () => {
  const app = read('src/App.vue')
  const block = app.match(/\.rc-player-content\s*\{[^}]*\}/)
  assert.ok(block, '未找到 .rc-player-content 规则')
  assert.match(block[0], /position:\s*relative/, '转场的绝对定位需要一个定位上下文')
})

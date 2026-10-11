// ═══════════════════════════════════════════════════════════════════
// 统一的「多次点击确认」机制（composables/useConfirmClick）
//   · 连点 4 次才生效（第 4 次返回 true）
//   · 停手 3 秒自动复位
//   · 颜色 红 → 橙 → 紫 递进，title 提示还差几次
//   · 全站写操作都接入**同一套**机制（不再各页面各写一份）
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const { useConfirmClick, CONFIRM_COLORS, CONFIRM_TIMES, CONFIRM_RESET_MS } =
  await import('../src/composables/useConfirmClick.js')

test('连点 4 次才生效：前 3 次返回 false，第 4 次返回 true', () => {
  const cfm = useConfirmClick()
  assert.equal(cfm.trigger('k'), false)
  assert.equal(cfm.countOf('k'), 1)
  assert.equal(cfm.trigger('k'), false)
  assert.equal(cfm.trigger('k'), false)
  assert.equal(cfm.countOf('k'), 3)
  assert.equal(cfm.trigger('k'), true, '第 4 次才放行')
  assert.equal(cfm.countOf('k'), 0, '放行后计数归零')
})

test('不同目标互不影响（每条记录独立计数）', () => {
  const cfm = useConfirmClick()
  cfm.trigger('a')
  cfm.trigger('a')
  assert.equal(cfm.countOf('a'), 2)
  assert.equal(cfm.countOf('b'), 0)
})

test('颜色 红 → 橙 → 紫 递进，执行后归零', () => {
  const cfm = useConfirmClick()
  assert.deepEqual(cfm.styleOf('k'), {})
  cfm.trigger('k')
  assert.deepEqual(cfm.styleOf('k'), { borderColor: CONFIRM_COLORS[1], color: CONFIRM_COLORS[1] })
  cfm.trigger('k')
  assert.deepEqual(cfm.styleOf('k'), { borderColor: CONFIRM_COLORS[2], color: CONFIRM_COLORS[2] })
  cfm.trigger('k')
  assert.deepEqual(cfm.styleOf('k'), { borderColor: CONFIRM_COLORS[3], color: CONFIRM_COLORS[3] })
  cfm.trigger('k')
  assert.deepEqual(cfm.styleOf('k'), {}, '执行后回到无色')
})

test('title 提示还差几次', () => {
  const cfm = useConfirmClick()
  assert.match(cfm.titleOf('k', '删除'), /点 4 次生效/)
  cfm.trigger('k')
  assert.match(cfm.titleOf('k', '删除'), /再次点击删除（2\/4）/)
  cfm.trigger('k')
  assert.match(cfm.titleOf('k', '删除'), /再次点击删除（3\/4）/)
  cfm.trigger('k')
  assert.match(cfm.titleOf('k', '删除'), /最后一次点击删除（4\/4）/)
})

test('停手 3 秒自动复位', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const cfm = useConfirmClick()
  cfm.trigger('k')
  cfm.trigger('k')
  assert.equal(cfm.countOf('k'), 2)
  t.mock.timers.tick(CONFIRM_RESET_MS + 10)
  assert.equal(cfm.countOf('k'), 0, '超时后回到初始状态')
})

test('机制参数全站一致：4 次 / 3 秒 / 三档配色', () => {
  assert.equal(CONFIRM_TIMES, 4)
  assert.equal(CONFIRM_RESET_MS, 3000)
  assert.deepEqual(Object.values(CONFIRM_COLORS), ['#ff4444', '#ff8800', '#aa44ff'])
})

test('每次点击都播放逐层音效（与删除按钮一致）', () => {
  const impl = read('src/composables/useConfirmClick.js')
  assert.match(impl, /import \{ playOvercharge \} from '\.\.\/utils\/sound\.js'/, '机制内置音效')
  assert.match(impl, /playOvercharge\(n\)/, '按当前层级播放')

  // 四次点击四个不同音效
  const sound = read('src/utils/sound.js')
  const files = [...sound.matchAll(/'(magic_basic_mag_overcharge_\d_\d+\.wav)'/g)].map(m => m[1])
  assert.equal(files.length, 4, '四次点击各有音效')
  assert.equal(new Set(files).size, 4, '四个音效互不相同')

  // 各页面不再自行播音效（统一由机制负责），因此详情窗口 / 新增记录 / 数据管理也自动有了音效
  for (const f of WRITE_UI) {
    assert.equal(/playOvercharge/.test(read(f)), false, `${f} 不应再自行播音效`)
  }
})

// ══════════ 全站接入（源码级） ══════════
const WRITE_UI = [
  'src/views/AccountPage.vue',        // 确认完成 / 删除 / 跳过今天
  'src/views/WorkDiary.vue',          // 删除记录
  'src/views/BlueprintPage.vue',      // 删除 / 保存详情 / 以此为基础新建
  'src/views/AddPage.vue',            // 添加·保存（任务 / 蓝图）/ 确认加天数
  'src/views/SettingsPage.vue',       // 清除所有数据
  'src/components/ReportSheet.vue',   // 确认完成
  'src/components/ProjectDetail.vue', // 保存 / 归档 / 删除 / 确认续费
]

test('所有写操作界面都接入同一套机制，且不再各自维护一份实现', () => {
  for (const f of WRITE_UI) {
    const src = read(f)
    assert.match(src, /useConfirmClick/, `${f} 应使用统一的多次点击确认`)
    assert.match(src, /\.trigger\(/, `${f} 应在执行前调用 trigger`)
    // 旧的分散实现（各页面自建的配色表 / 定时器）不得再出现
    assert.equal(/const (CONFIRM_COLORS|DELETE_COLORS|CLEAR_COLORS) = /.test(src), false, `${f} 不应再自建配色表`)
    assert.equal(/(actionTimers|deleteTimers|confirmTimers|clearTimer)/.test(src), false, `${f} 不应再自建复位定时器`)
  }
})

test('同一动作的点击次数与复位时间在所有页面都一样', () => {
  const css = read('src/composables/useConfirmClick.js')
  assert.match(css, /CONFIRM_TIMES = 4/, '统一 4 次')
  assert.match(css, /CONFIRM_RESET_MS = 3000/, '统一 3 秒复位')
  // 每个页面都从同一处取值，不再出现写死的 3/4 段判断
  for (const f of WRITE_UI) {
    const src = read(f)
    assert.equal(/cur >= 3/.test(src), false, `${f} 不应再写死段数判断`)
  }
})

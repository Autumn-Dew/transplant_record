// 领域层纯逻辑测试：日期工具
import test from 'node:test'
import assert from 'node:assert/strict'
import { fmtDate, addMonth, monthSpanDays, addDays, diffDays, todayLocal, isYmd } from '../src/utils/date.js'

test('addMonth：月末天数不足时回退到上月末', () => {
  assert.equal(addMonth('2026-01-31'), '2026-02-28')
  assert.equal(addMonth('2026-03-15'), '2026-04-15')
})

test('monthSpanDays：按创建日 + 1 个月计算周期天数', () => {
  assert.equal(monthSpanDays('2026-09-15'), 30)
  assert.equal(monthSpanDays('2026-10-15'), 31)
})

test('addDays / diffDays：本地日期加减与差值', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(diffDays('2026-01-01', '2026-01-31'), 30)
  assert.equal(diffDays('2026-02-01', '2026-01-31'), -1)
})

test('todayLocal 返回本地 yyyy-MM-dd（不受 UTC 偏移影响）', () => {
  const now = new Date()
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  assert.equal(todayLocal(), expected)
  assert.ok(isYmd(todayLocal()))
})

test('fmtDate：支持 Date / ISO 输入', () => {
  assert.equal(fmtDate(new Date(2026, 0, 5)), '2026-01-05')
  assert.equal(fmtDate('2026-01-05T20:00:00.000Z').length, 10)
})

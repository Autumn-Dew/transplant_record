// 每日刷新时间：托管 / 日报的「今天」跨过设置里的时间点才翻页
// 约定：默认 00:00（等价于自然日）；只影响「今天」的判定，不改任何数据格式。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(path.join(ROOT, p), 'utf8')

// node 下没有 localStorage：给一个最小实现，键名与 storage.js 的 KEYS 一致
function withStorage(init = {}) {
  const store = new Map(Object.entries(init))
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: k => { store.delete(k) },
    clear: () => store.clear(),
    key: i => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
  return store
}

withStorage()
const date = await import('../src/utils/date.js')

test('刷新时间归一化：非法值一律回落 00:00', () => {
  assert.equal(date.normalizeResetTime('04:00'), '04:00')
  assert.equal(date.normalizeResetTime('4:5'), '04:05', '补零')
  assert.equal(date.normalizeResetTime('4:00'), '04:00')
  assert.equal(date.normalizeResetTime('24:00'), '00:00', '小时越界')
  assert.equal(date.normalizeResetTime('04:60'), '00:00', '分钟越界')
  assert.equal(date.normalizeResetTime('abc'), '00:00')
  assert.equal(date.normalizeResetTime(''), '00:00')
  assert.equal(date.normalizeResetTime(null), '00:00')
  assert.equal(date.normalizeResetTime(undefined), '00:00')
  assert.equal(date.DEFAULT_RESET_TIME, '00:00')
})

test('默认 00:00 时「今天」就是自然日', () => {
  withStorage()
  assert.equal(date.resetTime(), '00:00')
  assert.equal(date.todayLocal(new Date(2026, 9, 30, 0, 0)), '2026-10-30')
  assert.equal(date.todayLocal(new Date(2026, 9, 30, 23, 59)), '2026-10-30')
})

test('刷新时间 04:00：03:30 仍算前一天，04:00 起才算新的一天', () => {
  withStorage({ 'tr-daily-reset': JSON.stringify('04:00') })
  assert.equal(date.resetTime(), '04:00')
  assert.equal(date.resetMinutes(), 240)
  assert.equal(date.todayLocal(new Date(2026, 9, 30, 0, 10)), '2026-10-29')
  assert.equal(date.todayLocal(new Date(2026, 9, 30, 3, 59)), '2026-10-29')
  assert.equal(date.todayLocal(new Date(2026, 9, 30, 4, 0)), '2026-10-30')
  assert.equal(date.todayLocal(new Date(2026, 9, 30, 12, 0)), '2026-10-30')
})

test('回退跨月 / 跨年也正确', () => {
  withStorage({ 'tr-daily-reset': JSON.stringify('04:00') })
  assert.equal(date.todayLocal(new Date(2026, 10, 1, 2, 0)), '2026-10-31', '11-01 凌晨属于 10-31')
  assert.equal(date.todayLocal(new Date(2027, 0, 1, 1, 0)), '2026-12-31', '元旦凌晨属于去年')
})

test('gameNow 返回 Date，并按刷新时间回退一天', () => {
  withStorage({ 'tr-daily-reset': JSON.stringify('04:00') })
  const g = date.gameNow(new Date(2026, 9, 30, 2, 0))
  assert.ok(g instanceof Date)
  assert.equal(date.fmtDate(g), '2026-10-29')
  const keep = date.gameNow(new Date(2026, 9, 30, 9, 0))
  assert.equal(date.fmtDate(keep), '2026-10-30')
})

test('writeResetTime 落盘并归一化', () => {
  const store = withStorage()
  assert.equal(date.writeResetTime('4:5'), '04:05')
  assert.equal(store.get('tr-daily-reset'), JSON.stringify('04:05'))
  assert.equal(date.resetTime(), '04:05')
  // 再写回默认值
  assert.equal(date.writeResetTime('00:00'), '00:00')
  assert.equal(date.resetTime(), '00:00')
})

test('读取端已接入刷新时间（源码断言）', () => {
  assert.match(read('src/services/projectService.js'), /todayLocal/, '托管服务用 todayLocal 判定今天')
  assert.match(read('src/utils/taskComplete.js'), /export const localToday = \(\) => todayLocal\(\)/, '确认完成的入口跟随刷新时间')
  assert.match(read('src/components/ReportSheet.vue'), /const todayStr = todayLocal\(\)/, '日报日期跟随刷新时间')
  assert.match(read('src/components/ReportSheet.vue'), /const now = gameNow\(\)/, '日报天数跟随刷新时间')
  assert.match(read('src/views/AccountPage.vue'), /const todayStr = ref\(localToday\(\)\)/, '代办「今日已确认」跟随刷新时间')
  assert.match(read('src/data/storage.js'), /DAILY_RESET: 'tr-daily-reset'/, '独立存储键')
})

test('设置页可改刷新时间', () => {
  const page = read('src/views/SettingsPage.vue')
  assert.match(page, /<span class="setting-label">每日刷新时间<\/span>/, '有「每日刷新时间」一行')
  assert.match(page, /type="time"/, '用时间控件填写')
  assert.match(page, /v-model="resetTimeValue"/)
  assert.match(page, /@change="saveResetTime"/, '改完即保存')
  assert.match(page, /usePresetResetTime\('00:00'\)/)
  assert.match(page, /usePresetResetTime\('04:00'\)/, '常用「四点」预置')
  assert.match(page, /writeResetTime/, '保存走 writeResetTime')
})

// 领域层纯逻辑测试：项目 / 托管周期 / 执行记录 / 游戏目录 / 迁移
import test from 'node:test'
import assert from 'node:assert/strict'

import { KIND, STATE, PLAN_MODE } from '../src/domain/project.js'
import { migrateProjects, migrateCompletions, makeBackup, rollbackFrom } from '../src/domain/migrate.js'
import { normalizeProject, hostProgress, plannedTimesFor, isHosting, isCompleted, isExpired } from '../src/domain/project.js'
import { buildCompletion, RESULT, normalizeCompletion } from '../src/domain/completion.js'
import { normalizeGames, ensureGamesForRecords, gameKeyOf, gameNameOf, usableGames, defaultGames } from '../src/domain/games.js'
import { maskAccount, getDisplayName } from '../src/domain/mask.js'
import { todayLocal, addMonth, fmtDate } from '../src/utils/date.js'

// ── v1 数据样本 ──
const V1_HOSTING = {
  id: 'abc123',
  account: '13800138000',
  game: '终末地',
  service: '普托',
  status: 2,
  remainingDays: 22,
  lastConfirmDate: '2026-10-10',
  createdAt: '2026-09-15T04:00:00.000Z',
  wechatName: '老板A',
  preferredPlatform: 'wechat',
  totalFee: 30,
}

const V1_ONEOFF = {
  id: 'one001', account: '13900139000', game: '明日方舟', service: '主线推图',
  status: 1, remainingDays: 1, createdAt: '2026-10-01T12:00:00.000Z', totalFee: 15,
}

const V1_LOCKED = {
  id: 'ren001', account: '13800138000', game: '终末地', status: 2, locked: true,
  prevTaskId: 'abc123', createdAt: '2026-10-15T00:00:00.000Z',
}

test('迁移：托管记录补出显式托管周期与次数，且保留全部原有字段', () => {
  const { records, changed } = migrateProjects([V1_HOSTING])
  assert.ok(changed >= 1)
  const p = records[0]
  // 原有字段一字不改
  assert.equal(p.id, 'abc123')
  assert.equal(p.account, '13800138000')
  assert.equal(p.remainingDays, 22)
  assert.equal(p.lastConfirmDate, '2026-10-10')
  assert.equal(p.createdAt, V1_HOSTING.createdAt)
  // 新增字段
  assert.equal(p.kind, KIND.HOSTING)
  assert.equal(p.state, STATE.ACTIVE)
  assert.equal(p.schemaVersion, 3)
  assert.equal(p.host.startDate, fmtDate(V1_HOSTING.createdAt))
  assert.equal(p.host.endDate, addMonth(fmtDate(V1_HOSTING.createdAt)))
  assert.ok(p.host.cycleDays >= 28)
  // 剩余 22 天 → 计划次数取 max(周期, 22)
  assert.equal(p.host.plannedTimes, Math.max(p.host.cycleDays, 22))
  assert.equal(p.host.completedTimes, p.host.plannedTimes - 22)
})

test('迁移幂等：已迁移数据不会被二次加工', () => {
  const first = migrateProjects([V1_HOSTING]).records
  const second = migrateProjects(first)
  assert.equal(second.changed, 0)
  assert.deepEqual(second.records[0], first[0])
})

test('迁移：单次 / 待激活（续费未生效）状态映射正确', () => {
  const { records } = migrateProjects([V1_ONEOFF, V1_LOCKED])
  const one = records.find(r => r.id === 'one001')
  assert.equal(one.kind, KIND.ONE_OFF)
  assert.equal(one.state, STATE.PENDING)
  assert.equal(one.host, undefined)
  const locked = records.find(r => r.id === 'ren001')
  assert.equal(locked.kind, KIND.HOSTING)
  assert.equal(locked.state, STATE.SCHEDULED)
  assert.equal(locked.locked, true)
  assert.equal(locked.prevTaskId, 'abc123')
})

test('迁移：执行记录补齐 plannedDate / completedDate / result，且是本地日期', () => {
  const v1 = [{ id: 'c1', taskId: 'abc123', date: '2026-10-10', time: '21:00:00', game: '终末地', fee: 30, wasHosting: true }]
  const { records, changed } = migrateCompletions(v1)
  assert.equal(changed, 1)
  const c = records[0]
  assert.equal(c.plannedDate, '2026-10-10')
  assert.equal(c.completedDate, '2026-10-10')
  assert.equal(c.result, RESULT.DONE)
  assert.equal(c.projectId, 'abc123')
  assert.equal(c.fee, 30)
  assert.equal(c.wasHosting, true)
  assert.equal(migrateCompletions(records).changed, 0)
})

test('托管进度：计划次数 / 已完成次数 / 剩余互不混淆', () => {
  const p = normalizeProject({
    ...V1_HOSTING,
    host: { startDate: '2026-09-15', endDate: '2026-10-15', cycleDays: 30, plannedTimes: 30, completedTimes: 8 },
  })
  const prog = hostProgress(p)
  assert.equal(prog.planned, 30)
  assert.equal(prog.completed, 8)
  assert.equal(prog.remaining, 22)
  assert.equal(prog.totalDays, 30)
  // v1 兼容视图仍可取到 remainingDays
  assert.equal(prog.legacyRemaining, 22)
})

test('托管是否到期由结束日期派生，不改写存储状态', () => {
  const p = normalizeProject({
    kind: KIND.HOSTING, status: 2, state: STATE.ACTIVE,
    host: { startDate: '2026-01-01', endDate: '2026-01-31', cycleDays: 30, plannedTimes: 30, completedTimes: 5 },
  })
  assert.equal(isExpired(p, '2026-02-05'), true)
  assert.equal(isExpired(p, '2026-01-20'), false)
  assert.equal(p.state, STATE.ACTIVE)
})

test('planTimesFor：每日 / 每周指定日期的计划次数推导', () => {
  assert.equal(plannedTimesFor({ mode: PLAN_MODE.DAILY, timesPerDay: 1 }, 30), 30)
  assert.equal(plannedTimesFor({ mode: PLAN_MODE.DAILY, timesPerDay: 2 }, 30), 60)
  // 每周三天 × 4.28 周 ≈ 13
  assert.equal(plannedTimesFor({ mode: PLAN_MODE.WEEKLY, weekdays: [1, 3, 5], timesPerDay: 1 }, 30), 13)
})

test('类型与完成状态判定兼容 v1（无 kind / state 字段）', () => {
  assert.equal(isHosting({ status: 2 }), true)
  assert.equal(isHosting({ status: 1 }), false)
  assert.equal(isCompleted({ status: 0 }), true)
  assert.equal(isCompleted({ status: 2 }), false)
})

test('执行记录由项目快照生成：字段独立、日期为本地日期', () => {
  const p = normalizeProject(V1_HOSTING)
  const rec = buildCompletion(p, { result: RESULT.DONE, content: '基建收菜完成' })
  assert.equal(rec.projectId, 'abc123')
  assert.equal(rec.taskId, 'abc123')
  assert.equal(rec.gameName, '终末地')
  assert.equal(rec.gameKey, '')                 // 未传 gameKey 时不臆造
  assert.equal(rec.service, '普托')
  assert.equal(rec.displayName, '老板A')
  assert.equal(rec.plannedDate, todayLocal())
  assert.equal(rec.completedDate, todayLocal())
  assert.equal(rec.date, todayLocal())
  assert.equal(rec.result, RESULT.DONE)
  assert.equal(rec.wasHosting, true)
  assert.equal(rec.totalFee, 30)
  // 快照不随项目后续修改而变
  const changed = { ...p, service: '全托', totalFee: 150 }
  assert.equal(rec.service, '普托')
  assert.equal(rec.totalFee, 30)
  assert.equal(changed.totalFee, 150)
})

test('执行记录支持跳过 / 异常结果与图片', () => {
  const rec = buildCompletion(normalizeProject(V1_HOSTING), {
    result: RESULT.SKIPPED, note: '账号异常', images: ['blob:1'],
  })
  assert.equal(rec.result, RESULT.SKIPPED)
  assert.equal(rec.note, '账号异常')
  assert.deepEqual(rec.images, ['blob:1'])
  assert.equal(RESULT.ABNORMAL, 'abnormal')
})

test('normalizeCompletion 兼容 v1 记录', () => {
  const c = normalizeCompletion({ id: 'x', taskId: 'p1', date: '2026-05-01' })
  assert.equal(c.result, RESULT.DONE)
  assert.equal(c.projectId, 'p1')
  assert.deepEqual(c.images, [])
})

test('游戏目录：规范化、去重、按 id / 名称 / 简称解析', () => {
  const games = normalizeGames([
    { id: 'endfield', name: '终末地', short: 'EF', services: [{ name: '普托', price: 30 }] },
    { id: 'endfield', name: '重复项' },
    { id: 'ak', name: '明日方舟', short: 'AK' },
  ])
  assert.equal(games.length, 2)
  assert.equal(games[0].services[0].name, '普托')
  assert.equal(games[0].services[0].enabled, true)
  assert.equal(gameKeyOf(games, '终末地'), 'endfield')
  assert.equal(gameKeyOf(games, 'EF'), 'endfield')
  assert.equal(gameKeyOf(games, '明日方舟'), 'ak')
  assert.equal(gameNameOf(games, 'ak'), '明日方舟')
  // 未知游戏原样返回（不丢弃数据）
  assert.equal(gameKeyOf(games, '异环'), '异环')
})

test('游戏目录：停用/归档的游戏不出现在可用列表', () => {
  const games = normalizeGames([
    { id: 'a', name: 'A', enabled: false },
    { id: 'b', name: 'B', archived: true },
    { id: 'c', name: 'C' },
  ])
  assert.deepEqual(usableGames(games).map(g => g.id), ['c'])
})

test('游戏目录：历史数据里的陌生游戏名会被幂等补全', () => {
  const base = defaultGames()
  const records = [{ game: '终末地' }, { game: '新游戏X' }, { game: '新游戏X' }]
  const once = ensureGamesForRecords(base, records)
  const twice = ensureGamesForRecords(once, records)
  assert.equal(once.length, base.length + 1)
  assert.equal(twice.length, once.length)
  assert.ok(once.some(g => g.name === '新游戏X'))
  assert.ok(once.some(g => g.name === '终末地'))
})

test('备份与回滚：备份可完整还原迁移前数据', () => {
  const original = [V1_HOSTING, V1_ONEOFF]
  const backup = makeBackup(original, { label: 'accounts' })
  const migrated = migrateProjects(original).records
  assert.equal(migrated[0].schemaVersion, 3)
  const restored = rollbackFrom(backup)
  assert.deepEqual(restored, original)
  assert.equal(rollbackFrom({ nope: 1 }), null)
})

test('脱敏与展示名', () => {
  assert.equal(maskAccount('13800138000'), '138****8000')
  assert.equal(maskAccount('123'), '1***3')
  assert.equal(maskAccount(''), '')
  assert.equal(getDisplayName({ wechatName: 'A', qqName: 'B' }), 'A')
  assert.equal(getDisplayName({ qqName: 'B' }), 'B')
  assert.equal(getDisplayName({ qqName: 'B', preferredPlatform: 'douyin', douyinName: 'D' }), 'D')
})

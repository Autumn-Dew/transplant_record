import test from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
  key: i => [...store.keys()][i],
  get length() { return store.size },
}
globalThis.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} }

const { projectsRepo, completionsRepo, gamesRepo } = await import('../src/data/repos.js')
const svc = await import('../src/services/projectService.js')
const { addDays } = await import('../src/utils/date.js')

const TODAY = '2026-11-01'
function reset() {
  store.clear()
  projectsRepo.replaceAll([])
  completionsRepo.replaceAll([])
  gamesRepo.reload()
}
function hosting(extra = {}) {
  return svc.createProject({
    account: '1', game: 'ak', service: '托管', status: 2,
    hostStart: TODAY, hostDays: 30, plannedTimes: 30, ...extra,
  })
}

test('todayTasks 与 todayTaskItems 来自同一 read model', () => {
  reset()
  const p = hosting()
  assert.deepEqual(svc.todayTasks(TODAY).map(x => x.id), [p.id])
  assert.deepEqual(svc.todayTaskItems(TODAY).map(x => x.id), [p.id])
  assert.equal(svc.todayTaskItems(TODAY)[0].runnable, true)
})

test('暂停、延期、未开始和非计划日不会进入汇报候选', () => {
  reset()
  const paused = hosting({ state: 'paused' })
  const postponed = hosting({ host: { skippedDates: [TODAY] } })
  const future = hosting({ hostStart: addDays(TODAY, 2) })
  const weekly = hosting({ planMode: 'weekly', planWeekdays: [2] })
  const ids = new Set(svc.todayWorkItems(TODAY, { hostingOnly: true }).map(x => x.id))
  for (const p of [paused, postponed, future, weekly]) assert.equal(ids.has(p.id), false)
})

test('includeBlocked 返回明确阻塞原因', () => {
  reset()
  const p = hosting({ locked: true })
  const item = svc.todayWorkItems(TODAY, { includeBlocked: true, hostingOnly: true }).find(x => x.id === p.id)
  assert.equal(item.runnable, false)
  assert.equal(item.blockedReason, 'not-started')
})

test('已确认项目仍是今日工作项，但带 confirmedToday 标记', () => {
  reset()
  const p = hosting({ lastConfirmDate: TODAY })
  const item = svc.todayWorkItems(TODAY, { hostingOnly: true }).find(x => x.id === p.id)
  assert.ok(item)
  assert.equal(item.confirmedToday, true)
})

test('单次项目延期后不再进入今日工作项', () => {
  reset()
  const p = svc.createProject({ account: '2', game: 'ak', status: 1, plannedDate: addDays(TODAY, 1) })
  assert.equal(svc.todayWorkItems(TODAY).some(x => x.id === p.id), false)
})
// 强制删除（forceDeleteProject）
//   背景：普通删除在「有执行记录」或「被后继项目引用」时会退化成归档，界面上也就没有
//         删除入口。早期数据与后期数据冲突（同一托管出现两条、天数不同）时，其中一条
//         会变得「删不掉、也控制不了」。这里固定住强制删除的语义。
import test from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)) },
  removeItem: k => { store.delete(k) },
  clear: () => store.clear(),
  key: i => [...store.keys()][i],
  get length() { return store.size },
}
globalThis.window = { dispatchEvent: () => {}, addEventListener: () => {}, removeEventListener: () => {} }

const { projectsRepo, completionsRepo, gamesRepo } = await import('../src/data/repos.js')
const svc = await import('../src/services/projectService.js')
const { availableActions } = await import('../src/services/projectDetail.js')
const { KIND } = await import('../src/domain/project.js')

function reset() {
  store.clear()
  projectsRepo.replaceAll([])
  completionsRepo.replaceAll([])
  gamesRepo.reload()
}

function makeHosting(extra = {}) {
  return svc.createProject({
    account: '13800138000',
    wechatName: '老板A',
    gameName: '终末地',
    service: '普托',
    kind: KIND.HOSTING,
    status: 2,
    totalFee: 100,
    actualFee: 100,
    hostDays: 30,
    ...extra,
  })
}

test('有执行记录的项目：普通删除不可用，但有强制删除入口', () => {
  reset()
  const p = makeHosting()
  svc.confirmExecution(p.id, { result: 'done', date: '2026-01-02' })
  assert.ok(completionsRepo.state.value.length >= 1, '已产生执行记录')

  const check = svc.canHardDelete(p.id)
  assert.equal(check.ok, false, '有历史记录 → 不允许普通删除')
  assert.equal(availableActions(p.id).remove, false, '详情里不显示普通删除')
  assert.equal(availableActions(p.id).forceRemove, true, '但必须给出强制删除入口')
})

test('强制删除会连执行记录一起删掉，项目本身不再存在', () => {
  reset()
  const p = makeHosting()
  svc.confirmExecution(p.id, { result: 'done', date: '2026-01-02' })
  const before = completionsRepo.state.value.length

  const r = svc.forceDeleteProject(p.id)
  assert.equal(r.ok, true)
  assert.ok(r.removedCompletions >= 1, '执行记录随项目一起删除')
  assert.equal(completionsRepo.state.value.length, before - r.removedCompletions)
  assert.equal(projectsRepo.find(p.id), null, '项目已删除')
  assert.equal(
    completionsRepo.state.value.some(c => String(c.projectId || c.taskId) === String(p.id)),
    false,
    '不留下指向已删项目的执行记录',
  )
})

test('强制删除会清理其它项目对它的引用（prevTaskId / hostingChainId）', () => {
  reset()
  const first = makeHosting()
  // 历史形态：续费 = 新建一条项目，prevTaskId 指向前一期
  const second = makeHosting({ prevTaskId: first.id, hostingChainId: first.id, locked: true })
  assert.equal(projectsRepo.find(second.id).prevTaskId, first.id, '先构造出引用关系')

  const r = svc.forceDeleteProject(first.id)
  assert.equal(r.ok, true)
  assert.equal(r.clearedRefs, 1, '有 1 条引用被清理')
  const rest = projectsRepo.find(second.id)
  assert.ok(rest, '后一期项目保留')
  assert.equal(rest.prevTaskId, null, 'prevTaskId 不再指向已删项目')
  assert.equal(rest.hostingChainId, second.id, 'hostingChainId 挂到自己身上，避免悬空')
})

test('项目不存在时强制删除返回 not-found，不动其它数据', () => {
  reset()
  const p = makeHosting()
  const r = svc.forceDeleteProject('不存在的-id')
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'not-found')
  assert.ok(projectsRepo.find(p.id), '其它项目不受影响')
})

test('withHistory=false 只删项目，保留执行记录', () => {
  reset()
  const p = makeHosting()
  svc.confirmExecution(p.id, { result: 'done', date: '2026-01-02' })
  const before = completionsRepo.state.value.length

  const r = svc.forceDeleteProject(p.id, { withHistory: false })
  assert.equal(r.ok, true)
  assert.equal(r.removedCompletions, 0)
  assert.equal(completionsRepo.state.value.length, before, '执行记录保留')
})

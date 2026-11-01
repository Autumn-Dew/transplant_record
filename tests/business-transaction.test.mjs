import test from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
let failKey = ''
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem(k, v) {
    if (k === failKey) throw new Error('injected write failure')
    store.set(k, String(v))
  },
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
  key: i => [...store.keys()][i],
  get length() { return store.size },
}
globalThis.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} }

const { projectsRepo, completionsRepo, gamesRepo, commitBusinessSnapshot } = await import('../src/data/repos.js')
const service = await import('../src/services/projectService.js')

function reset() {
  failKey = ''
  store.clear()
  projectsRepo.replaceAll([])
  completionsRepo.replaceAll([])
  gamesRepo.reload()
}

test('业务快照同时发布项目与执行记录', () => {
  reset()
  const result = commitBusinessSnapshot({
    projects: [{ id: 'p1', account: '1', status: 1, kind: 'oneoff', state: 'pending' }],
    completions: [{ id: 'c1', projectId: 'p1', taskId: 'p1', date: '2026-11-01', result: 'done' }],
  })
  assert.equal(result.ok, true)
  assert.equal(projectsRepo.find('p1').id, 'p1')
  assert.equal(completionsRepo.state.value[0].projectId, 'p1')
})

test('任一 localStorage 写入失败时两边都不发布', () => {
  reset()
  projectsRepo.replaceAll([{ id: 'old', account: 'old', status: 1, kind: 'oneoff', state: 'pending' }])
  completionsRepo.replaceAll([{ id: 'old-c', projectId: 'old', taskId: 'old', date: '2026-10-31', result: 'done' }])
  failKey = 'tr-completions'

  const result = commitBusinessSnapshot({
    projects: [{ id: 'new', account: 'new', status: 1, kind: 'oneoff', state: 'pending' }],
    completions: [{ id: 'new-c', projectId: 'new', taskId: 'new', date: '2026-11-01', result: 'done' }],
  })
  failKey = ''
  assert.equal(result.ok, false)
  assert.ok(projectsRepo.find('old'))
  assert.equal(projectsRepo.find('new'), null)
  assert.equal(completionsRepo.state.value[0].id, 'old-c')
})

test('确认执行通过单一快照提交，项目进度与历史同步变化', () => {
  reset()
  const project = service.createProject({ account: '1', game: 'ak', status: 1, service: '主线' })
  const result = service.confirmExecution(project.id)
  assert.equal(result.ok, true)
  assert.equal(projectsRepo.find(project.id).state, 'completed')
  assert.equal(completionsRepo.state.value.filter(c => c.projectId === project.id).length, 1)
  assert.ok(result.durable instanceof Promise)
})

test('完成前一期与解锁后继项目在同一业务快照中发布', () => {
  reset()
  const first = service.createProject({
    account: '1', game: 'ak', status: 2, service: '托管', plannedTimes: 1,
  })
  const second = service.createProject({
    account: '1', game: 'ak', status: 2, service: '托管', plannedTimes: 1,
    locked: true, prevTaskId: first.id, hostingChainId: first.id,
  })
  assert.equal(projectsRepo.find(second.id).locked, true)

  const result = service.confirmExecution(first.id, { force: true })
  assert.equal(result.ok, true)
  assert.equal(projectsRepo.find(first.id).state, 'completed')
  assert.equal(projectsRepo.find(second.id).locked, false)
  assert.equal(projectsRepo.find(second.id).state, 'active')
})
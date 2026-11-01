// ═══════════════════════════════════════════════════════════════════
// 备份 / 恢复 / 清除（services/backupService.js）
//   · 备份只含 tr- 键，排除 tr-backup-*（迁移前快照不进备份）
//   · 恢复 = 写回 localStorage + 同步 Electron 文件 + 刷新内存单例（无需重载页面）
//   · 清除 = 清 tr- 键 + 文件写空 + 内存回落默认值
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'

// ── 浏览器 + Electron 双通道模拟（与 legacy-compat 同一套替身接口）──
const LS = new Map()
globalThis.localStorage = {
  getItem: k => (LS.has(k) ? LS.get(k) : null),
  setItem: (k, v) => { LS.set(k, String(v)) },
  removeItem: k => { LS.delete(k) },
  clear: () => LS.clear(),
  key: i => [...LS.keys()][i] ?? null,
  get length() { return LS.size },
}
const FILES = new Map()
const clone = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)))
const save = name => d => { FILES.set(name, clone(d)) }
globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  electron: {
    loadRecords: async () => clone(FILES.get('records')) ?? [],
    saveRecords: save('records'),
    loadCompletions: async () => clone(FILES.get('completions')) ?? [],
    saveCompletions: save('completions'),
    loadGames: async () => clone(FILES.get('games')) ?? null,
    saveGames: save('games'),
    loadBlueprints: async () => clone(FILES.get('blueprints')) ?? [],
    saveBlueprints: save('blueprints'),
    loadWorkDiary: async () => clone(FILES.get('workdiary')) ?? [],
    saveWorkDiary: save('workdiary'),
    loadPrices: async () => clone(FILES.get('prices')) ?? null,
    savePrices: save('prices'),
  },
}

const { projectsRepo, completionsRepo } = await import('../src/data/repos.js')
const { exportSnapshot, restoreSnapshot, clearAllData } = await import('../src/services/backupService.js')
const { isSoundEnabled, reloadSoundEnabled } = await import('../src/utils/sound.js')

// 让 usePrices 启动时那次异步「本地/文件对账」先跑完，避免与用例互相干扰
await new Promise(r => setTimeout(r, 0))

function reset() {
  LS.clear()
  FILES.clear()
  projectsRepo.reload()
  completionsRepo.reload()
}

test('备份只含 tr- 键，排除迁移前快照', () => {
  reset()
  LS.set('tr-accounts', JSON.stringify([{ id: 'p1' }]))
  LS.set('tr-theme', JSON.stringify('p3r-dark'))
  LS.set('tr-backup-accounts', JSON.stringify({ ___backup: true, records: [] }))
  LS.set('unrelated-key', 'x')

  const snap = exportSnapshot({ appName: '代肝记录', version: '1.0.0' })
  assert.equal(snap.app, '代肝记录')
  assert.equal(snap.version, '1.0.0')
  assert.ok(snap.exportedAt)
  assert.deepEqual(Object.keys(snap.keys).sort(), ['tr-accounts', 'tr-theme'])
  // 值是原始字符串，恢复时无需再解析
  assert.equal(snap.keys['tr-accounts'], LS.get('tr-accounts'))
  assert.equal('tr-backup-accounts' in snap.keys, false)
})

test('恢复会写回数据、同步 Electron 文件并刷新内存单例（无需重载页面）', () => {
  reset()
  const payload = {
    keys: {
      'tr-accounts': JSON.stringify([{ id: 'p1', account: '13800138000', game: '终末地', service: '普托', status: 1 }]),
      'tr-completions': JSON.stringify([{ id: 'c1', projectId: 'p1', result: 'done' }]),
    },
  }
  const r = restoreSnapshot(payload)
  assert.equal(r.ok, true)
  assert.equal(r.restored, 2)

  // ① localStorage
  assert.equal(JSON.parse(LS.get('tr-accounts'))[0].id, 'p1')
  // ② Electron 文件
  assert.equal(FILES.get('records')[0].id, 'p1')
  assert.equal(FILES.get('completions')[0].id, 'c1')
  // ③ 内存单例（不需要 location.reload 就能看到）
  assert.equal(projectsRepo.state.value.length, 1)
  assert.equal(projectsRepo.state.value[0].id, 'p1')
  assert.equal(completionsRepo.state.value.length, 1)
})

test('恢复只同步备份里出现过的文件通道，不碰其它文件', async () => {
  reset()
  FILES.set('blueprints', [{ id: 'bp-existing' }])
  restoreSnapshot({ keys: { 'tr-accounts': JSON.stringify([{ id: 'p2' }]) } })
  assert.equal(FILES.get('records')[0].id, 'p2')
  // 备份里没有 tr-blueprints → 旧文件保持不动
  assert.equal(FILES.get('blueprints')[0].id, 'bp-existing')
})

test('非法备份返回明确原因，不做任何写入', () => {
  reset()
  assert.equal(restoreSnapshot('{ 不是 JSON').reason, 'invalid-json')
  assert.equal(restoreSnapshot({}).reason, 'invalid-backup')
  assert.equal(restoreSnapshot({ keys: { 'not-a-tr-key': 'x' } }).reason, 'empty-backup')
  assert.equal(LS.size, 0, '失败时不应写入任何键')
})

test('字符串形式的备份（文件内容）可以直接恢复', () => {
  reset()
  const text = JSON.stringify({ keys: { 'tr-accounts': JSON.stringify([{ id: 'p3' }]) } })
  assert.equal(restoreSnapshot(text).ok, true)
  assert.equal(projectsRepo.state.value[0].id, 'p3')
})

test('清除数据：tr- 键清空、文件写空、内存回落默认值', () => {
  reset()
  LS.set('tr-accounts', JSON.stringify([{ id: 'p1' }]))
  LS.set('tr-theme', JSON.stringify('p3r-dark'))
  LS.set('tr-sound-enabled', 'false')
  projectsRepo.reload()
  reloadSoundEnabled()
  assert.equal(projectsRepo.state.value.length, 1)
  assert.equal(isSoundEnabled(), false)

  const r = clearAllData()
  assert.equal(r.ok, true)
  assert.equal(LS.size, 0, 'tr- 键应全部清除')
  assert.deepEqual(FILES.get('records'), [])
  assert.equal(FILES.get('prices'), null)
  assert.equal(projectsRepo.state.value.length, 0, '内存单例同步清空')
  assert.equal(isSoundEnabled(), true, '音效开关回落默认（开启）')
})

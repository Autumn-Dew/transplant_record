// ═══════════════════════════════════════════════════════════════════
// 数据访问层（Repository）— 业务数据的唯一入口
//
// 页面不再各自读写 localStorage：
//   页面 → service → repository → 持久化层（localStorage + Electron 文件）
//
// 每个 repo 是全局单例，通过 ref 暴露响应式数据；写入时同步落盘
// （localStorage 立即写 + Electron 文件异步写），并广播变更事件。
// ═══════════════════════════════════════════════════════════════════

import { ref } from 'vue'
import { KEYS, readJSON, writeJSON, electronApi } from './storage.js'
import { normalizeProjects } from '../domain/project.js'
import { normalizeCompletions } from '../domain/completion.js'
import { normalizeGames, ensureGamesForRecords, defaultGames } from '../domain/games.js'

function clone(v) {
  try { return JSON.parse(JSON.stringify(v)) } catch { return v }
}

function emitChange(event) {
  try { window.dispatchEvent(new CustomEvent(event)) } catch { /* ignore */ }
}

function persistSnapshot(key, ipcSave, snapshot) {
  const localOk = writeJSON(key, snapshot)
  const api = electronApi()
  const save = api?.[ipcSave]
  let file
  if (typeof save === 'function') {
    try {
      file = Promise.resolve(save(snapshot))
        .then(result => result && typeof result === 'object' ? result : { ok: result !== false })
        .catch(error => ({ ok: false, error: String(error && error.message ? error.message : error) }))
    } catch (error) {
      file = Promise.resolve({ ok: false, error: String(error && error.message ? error.message : error) })
    }
  } else {
    file = Promise.resolve({ ok: true, skipped: true })
  }

  return { ok: localOk, localOk, file }
}

// ── 数组型仓库 ──
function createCollectionRepo({ key, ipcLoad, ipcSave, normalize, changeEvent }) {
  const state = ref(normalize(readJSON(key, [])))
  let hydratePromise = null

  function plain() {
    return clone(state.value) || []
  }

  function persist() {
    const result = persistSnapshot(key, ipcSave, plain())
    if (changeEvent) emitChange(changeEvent)
    return result
  }

  // 仅在本地为空时从 Electron 文件补数据（与 v1 行为一致，不覆盖本地修改）。
  // 并发/重复调用共享同一个 Promise：调用方可以 await 它来决定「数据就绪后的初值」。
  function hydrate() {
    if (!hydratePromise) {
      hydratePromise = (async () => {
        if (Array.isArray(state.value) && state.value.length) return
        try {
          const d = await electronApi()?.[ipcLoad]?.()
          if (Array.isArray(d) && d.length) { state.value = normalize(d); persist() }
        } catch { /* ignore */ }
      })()
    }
    return hydratePromise
  }

  function reload() {
    state.value = normalize(readJSON(key, []))
  }

  function replaceAll(list, { silent = false } = {}) {
    state.value = normalize(list)
    if (silent) return persistSnapshot(key, ipcSave, plain())
    return persist()
  }

  function find(id) {
    return state.value.find(r => String(r.id) === String(id)) || null
  }

  function add(record) {
    state.value = normalize([record, ...state.value])
    persist()
    return record
  }

  function update(id, patch) {
    let changed = null
    state.value = state.value.map(r => {
      if (String(r.id) !== String(id)) return r
      changed = { ...r, ...patch }
      return changed
    })
    if (changed) persist()
    return changed
  }

  function remove(id) {
    const before = state.value.length
    state.value = state.value.filter(r => String(r.id) !== String(id))
    if (state.value.length !== before) persist()
  }

  return { state, plain, persist, hydrate, reload, replaceAll, find, add, update, remove }
}

// ── 对象型仓库（单项数据，如游戏目录、价格表）──
function createObjectRepo({ key, ipcLoad, ipcSave, normalize, defaultValue }) {
  const state = ref(normalize(readJSON(key, clone(defaultValue()))))
  let hydratePromise = null

  function plain() { return clone(state.value) }
  function persist() {
    return persistSnapshot(key, ipcSave, plain())
  }
  // 与数组型仓库同一语义：只在「本地没有这个键」时用文件补齐，且并发调用共享同一个 Promise
  function hydrate() {
    if (!hydratePromise) {
      hydratePromise = (async () => {
        let localExists = false
        try { localExists = localStorage.getItem(key) != null } catch { /* ignore */ }
        if (localExists) return
        try {
          const d = await electronApi()?.[ipcLoad]?.()
          if (d && typeof d === 'object') { state.value = normalize(d); persist() }
        } catch { /* ignore */ }
      })()
    }
    return hydratePromise
  }
  function reload() { state.value = normalize(readJSON(key, clone(defaultValue()))) }
  function replace(next) { state.value = normalize(next); persist() }
  return { state, plain, persist, hydrate, reload, replace }
}

// ══════════ 项目（单次 / 托管）══════════
const projects = createCollectionRepo({
  key: KEYS.ACCOUNTS,
  ipcLoad: 'loadRecords',
  ipcSave: 'saveRecords',
  normalize: normalizeProjects,
  changeEvent: 'tr-accounts-changed',
})

// ══════════ 执行记录 ══════════
const completions = createCollectionRepo({
  key: KEYS.COMPLETIONS,
  ipcLoad: 'loadCompletions',
  ipcSave: 'saveCompletions',
  normalize: normalizeCompletions,
  changeEvent: 'tr-completions-changed',
})

// ══════════ 游戏与服务项目目录 ══════════
const games = createObjectRepo({
  key: KEYS.GAMES,
  ipcLoad: 'loadGames',
  ipcSave: 'saveGames',
  normalize: normalizeGames,
  defaultValue: defaultGames,
})

// ══════════ 蓝图记录 ══════════
function normalizeBlueprints(list) {
  const arr = (Array.isArray(list) ? list : []).filter(r => r && typeof r === 'object')
  return arr.map((r, i) => (r.id ? r : { ...r, id: `bp-${i}-${Date.now().toString(36)}` }))
}

const blueprints = createCollectionRepo({
  key: KEYS.BLUEPRINTS,
  ipcLoad: 'loadBlueprints',
  ipcSave: 'saveBlueprints',
  normalize: normalizeBlueprints,
  changeEvent: 'tr-blueprints-changed',
})

// 蓝图分组（纯字符串数组）
function normalizeGroupList(list) {
  return (Array.isArray(list) ? list : []).map(s => String(s).trim()).filter(Boolean)
}

const blueprintGroups = {
  state: ref(normalizeGroupList(readJSON(KEYS.BLUEPRINT_GROUPS, []))),
  save(list) {
    this.state.value = normalizeGroupList(list)
    return { ok: writeJSON(KEYS.BLUEPRINT_GROUPS, this.state.value) }
  },
  reload() { this.state.value = normalizeGroupList(readJSON(KEYS.BLUEPRINT_GROUPS, [])) },
}

export const projectsRepo = {
  ...projects,
  /** 让目录覆盖历史数据中出现过的全部游戏名（幂等） */
  syncGamesWithRecords() {
    const next = ensureGamesForRecords(games.state.value, projects.state.value)
    if (next.length !== games.state.value.length) games.replace(next)
  },
}

export const completionsRepo = completions
export const gamesRepo = games
export const blueprintsRepo = blueprints
export const blueprintGroupsRepo = blueprintGroups

/**
 * 启动时统一从 Electron 文件补齐数据（`main.js` 在挂载之后调用）。
 *
 * 之前是各页面在 `onMounted` 里自己 hydrate，于是「谁忘了写谁就没有数据」：
 * 代肝代办拿不到游戏目录、新增记录拿不到服务/蓝图、日报拿不到托管项目。
 * 现在补齐只发生在这一个地方；各 repo 的 hydrate 幂等且共享同一个 Promise，
 * 重复调用不会多读文件。
 *
 * `blueprintGroups` 没有文件通道（只存 localStorage），不参与。
 */
export function hydrateAll() {
  return Promise.all([
    projects.hydrate(),
    completions.hydrate(),
    games.hydrate(),
    blueprints.hydrate(),
  ])
}

/**
 * 业务快照提交 seam：项目与执行记录必须作为一个逻辑单位更新。
 *
 * localStorage 两边都成功后才发布响应式状态与变更事件；任一写入失败会恢复旧值，
 * 避免出现「项目进度已变但记录缺失」或相反的半提交状态。
 * Electron 文件写入仍是异步 adapter，但结果通过 durable Promise 统一汇总给调用方。
 */
export function commitBusinessSnapshot({ projects: nextProjects, completions: nextCompletions }) {
  const beforeProjects = projects.plain()
  const beforeCompletions = completions.plain()
  const normalizedProjects = normalizeProjects(nextProjects)
  const normalizedCompletions = normalizeCompletions(nextCompletions)

  const projectsOk = writeJSON(KEYS.ACCOUNTS, normalizedProjects)
  const completionsOk = projectsOk && writeJSON(KEYS.COMPLETIONS, normalizedCompletions)
  if (!projectsOk || !completionsOk) {
    writeJSON(KEYS.ACCOUNTS, beforeProjects)
    writeJSON(KEYS.COMPLETIONS, beforeCompletions)
    return { ok: false, reason: 'local-persist-failed', durable: Promise.resolve({ ok: false, skipped: true }) }
  }

  projects.state.value = normalizedProjects
  completions.state.value = normalizedCompletions
  emitChange('tr-accounts-changed')
  emitChange('tr-completions-changed')

  const api = electronApi()
  const saveFile = (name, value) => {
    const save = api?.[name]
    if (typeof save !== 'function') return Promise.resolve({ ok: true, skipped: true })
    try {
      return Promise.resolve(save(clone(value)))
        .then(result => result && typeof result === 'object' ? result : { ok: result !== false })
        .catch(error => ({ ok: false, error: String(error && error.message ? error.message : error) }))
    } catch (error) {
      return Promise.resolve({ ok: false, error: String(error && error.message ? error.message : error) })
    }
  }
  const durable = Promise.all([
    saveFile('saveRecords', normalizedProjects),
    saveFile('saveCompletions', normalizedCompletions),
  ]).then(([projectFile, completionFile]) => ({
    ok: projectFile.ok !== false && completionFile.ok !== false,
    projectFile,
    completionFile,
  }))

  return { ok: true, durable }
}

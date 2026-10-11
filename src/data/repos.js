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

// ── 数组型仓库 ──
function createCollectionRepo({ key, ipcLoad, ipcSave, normalize, changeEvent }) {
  const state = ref(normalize(readJSON(key, [])))
  let hydrated = false

  function plain() {
    return clone(state.value) || []
  }

  function persist() {
    writeJSON(key, plain())
    try { electronApi()?.[ipcSave]?.(plain()) } catch { /* ignore */ }
    if (changeEvent) emitChange(changeEvent)
  }

  // 仅在本地为空时从 Electron 文件补数据（与 v1 行为一致，不覆盖本地修改）
  async function hydrate() {
    if (hydrated) return
    hydrated = true
    if (Array.isArray(state.value) && state.value.length) return
    try {
      const d = await electronApi()?.[ipcLoad]?.()
      if (Array.isArray(d) && d.length) { state.value = normalize(d); persist() }
    } catch { /* ignore */ }
  }

  function reload() {
    state.value = normalize(readJSON(key, []))
  }

  function replaceAll(list, { silent = false } = {}) {
    state.value = normalize(list)
    if (silent) { writeJSON(key, plain()); try { electronApi()?.[ipcSave]?.(plain()) } catch {} ; return }
    persist()
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
  let hydrated = false

  function plain() { return clone(state.value) }
  function persist() {
    writeJSON(key, plain())
    try { electronApi()?.[ipcSave]?.(plain()) } catch { /* ignore */ }
  }
  async function hydrate() {
    if (hydrated) return
    hydrated = true
    // 仅当本地键不存在时才用文件数据补齐（避免用旧文件覆盖用户修改）
    let localExists = false
    try { localExists = localStorage.getItem(key) != null } catch { /* ignore */ }
    if (localExists) return
    try {
      const d = await electronApi()?.[ipcLoad]?.()
      if (d && typeof d === 'object') { state.value = normalize(d); persist() }
    } catch { /* ignore */ }
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
    writeJSON(KEYS.BLUEPRINT_GROUPS, this.state.value)
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

// ═══════════════════════════════════════════════════════════════════
// 游戏与服务项目管理服务
//
// 规则：
//   * 游戏完全自由自定义（数量不限、不依赖固定列表）。
//   * 游戏 id 是价格表 key，创建后不再变更；改名不影响历史与价格数据。
//   * 停用 / 归档不等于删除历史数据。
//   * 有项目引用的游戏不允许物理删除，只能归档。
// ═══════════════════════════════════════════════════════════════════

import { gamesRepo, projectsRepo } from '../data/repos.js'
import { normalizeGames, normalizeGame } from '../domain/games.js'
import { newId } from '../domain/completion.js'

function all() { return gamesRepo.state.value }
function commit(next) { gamesRepo.replace(normalizeGames(next)); return gamesRepo.state.value }

function othersIds(excludeId) {
  return new Set(all().filter(g => g.id !== excludeId).map(g => g.id))
}

function uniqueGameId(name, excludeId) {
  const base = String(name || '').trim() || 'game'
  let id = base
  let i = 1
  const used = othersIds(excludeId)
  while (used.has(id)) id = `${base}-${++i}`
  return id
}

function nextOrder(list) {
  return list.reduce((m, x) => Math.max(m, Number(x.order) || 0), 0) + 1
}

// 是否有项目 / 历史记录引用了该游戏
export function gameUsage(gameId, gameName) {
  const list = projectsRepo.state.value
  const used = list.filter(p => p.gameKey === gameId || p.game === gameName || p.gameName === gameName)
  return { count: used.length, projects: used }
}

// ── 游戏 ──
// 游戏不使用图标：不再接受 icon 参数（旧数据里的 icon 由 normalizeGame 原样透传）
export function addGame({ name, short = '' } = {}) {
  const list = all()
  const id = uniqueGameId(name)
  const game = normalizeGame({ id, name: name || id, short, order: nextOrder(list), enabled: true, services: [] }, list.length)
  commit([...list, game])
  return game
}

export function updateGame(id, patch = {}) {
  const list = all()
  const next = list.map(g => (g.id === id ? normalizeGame({ ...g, ...patch, id: g.id }, g.order - 1) : g))
  commit(next)
  return gamesRepo.state.value.find(g => g.id === id) || null
}

// 删除：有引用则拒绝（调用方应改为归档）
export function removeGame(id) {
  const game = all().find(g => g.id === id)
  if (!game) return { ok: false, reason: 'not-found' }
  const usage = gameUsage(id, game.name)
  if (usage.count > 0) return { ok: false, reason: 'in-use', ...usage }
  commit(all().filter(g => g.id !== id))
  return { ok: true }
}

export function archiveGame(id) {
  return updateGame(id, { archived: true, enabled: false })
}

export function restoreGame(id) {
  return updateGame(id, { archived: false, enabled: true })
}

export function toggleGame(id) {
  const g = all().find(x => x.id === id)
  if (!g) return null
  return updateGame(id, { enabled: !g.enabled })
}

export function moveGame(id, dir) {
  const list = [...all()]
  const i = list.findIndex(g => g.id === id)
  const t = i + dir
  if (i < 0 || t < 0 || t >= list.length) return null
  const [x] = list.splice(i, 1)
  list.splice(t, 0, x)
  commit(list.map((g, idx) => ({ ...g, order: idx + 1 })))
  return true
}

// ── 服务项目 ──
export function addService(gameId, data = {}) {
  const list = all()
  const game = list.find(g => g.id === gameId)
  if (!game) return null
  const svc = {
    id: newId(`${gameId}-svc-`),
    name: data.name || '新服务项目',
    price: data.price ?? '',
    unit: data.unit || '',
    note: data.note || '',
    enabled: true,
    order: nextOrder(game.services || []),
  }
  commit(list.map(g => (g.id === gameId ? { ...g, services: [...(g.services || []), svc] } : g)))
  return svc
}

export function updateService(gameId, serviceId, patch = {}) {
  const list = all()
  commit(list.map(g => {
    if (g.id !== gameId) return g
    return {
      ...g,
      services: (g.services || []).map(s => (s.id === serviceId ? { ...s, ...patch, id: s.id } : s)),
    }
  }))
  return true
}

export function removeService(gameId, serviceId) {
  const list = all()
  commit(list.map(g => (g.id === gameId ? { ...g, services: (g.services || []).filter(s => s.id !== serviceId) } : g)))
  return true
}

export function moveService(gameId, serviceId, dir) {
  const list = [...all()]
  const game = list.find(g => g.id === gameId)
  if (!game) return null
  const items = [...(game.services || [])]
  const i = items.findIndex(s => s.id === serviceId)
  const t = i + dir
  if (i < 0 || t < 0 || t >= items.length) return null
  const [x] = items.splice(i, 1)
  items.splice(t, 0, x)
  const reordered = items.map((s, idx) => ({ ...s, order: idx + 1 }))
  commit(list.map(g => (g.id === gameId ? { ...g, services: reordered } : g)))
  return true
}

// ── 统计 ──
export function gameStats() {
  const list = all()
  return {
    total: list.length,
    enabled: list.filter(g => g.enabled && !g.archived).length,
    archived: list.filter(g => g.archived).length,
    services: list.reduce((s, g) => s + (g.services || []).length, 0),
  }
}

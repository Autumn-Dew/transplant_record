// ═══════════════════════════════════════════════════════════════════
// 启动迁移：v1 → v2
//
// 在 Vue 挂载之前同步执行（只操作 localStorage；Electron 文件由 repo 层接管）。
//   1. 迁移前把原始数据整体备份到 tr-backup-*（仅首次写入，保留可回滚快照）。
//   2. 迁移幂等，可重复执行不会重复造数据。
//   3. 失败不阻断启动：保留原始数据，仅记录错误。
//   4. 不删除任何旧字段，不更改任何既有存储键名。
// ═══════════════════════════════════════════════════════════════════

import { KEYS, SCHEMA_VERSION, backupKey, readJSON, writeJSON } from '../data/storage.js'
import { migrateProjects, migrateCompletions, makeBackup, rollbackFrom } from '../domain/migrate.js'
import { normalizeGames, defaultGames, ensureGamesForRecords, gameKeyOf, gameNameOf } from '../domain/games.js'

function backupOnce(name, records) {
  const key = backupKey(name)
  const existing = readJSON(key, null)
  if (existing && existing.___backup === true) return false
  writeJSON(key, makeBackup(records, { label: name }))
  return true
}

export function runStartupMigration() {
  const report = { version: SCHEMA_VERSION, projects: 0, completions: 0, games: 0, gamesNormalized: 0, backups: [], errors: [] }
  if (typeof localStorage === 'undefined') { report.skipped = true; return report }

  try {
    // ── 1. 项目（tr-accounts）──
    const rawProjects = readJSON(KEYS.ACCOUNTS, [])
    const mp = migrateProjects(rawProjects)
    if (mp.changed > 0) {
      if (backupOnce('accounts', rawProjects)) report.backups.push(backupKey('accounts'))
      writeJSON(KEYS.ACCOUNTS, mp.records)
      report.projects = mp.changed
    }

    // ── 2. 执行记录（tr-completions）──
    const rawCompletions = readJSON(KEYS.COMPLETIONS, [])
    const mc = migrateCompletions(rawCompletions)
    if (mc.changed > 0) {
      if (backupOnce('completions', rawCompletions)) report.backups.push(backupKey('completions'))
      writeJSON(KEYS.COMPLETIONS, mc.records)
      report.completions = mc.changed
    }

    // ── 3. 游戏与服务项目目录（tr-games）──
    const rawGames = readJSON(KEYS.GAMES, null)
    const base = normalizeGames(Array.isArray(rawGames) && rawGames.length ? rawGames : defaultGames())
    // 历史数据中出现过的游戏名一律补进目录，保证旧数据不会「消失」
    const withRecords = ensureGamesForRecords(base, Array.isArray(mp.records) ? mp.records : [])
    const gamesChanged = !Array.isArray(rawGames) || rawGames.length === 0 || withRecords.length !== base.length
    if (gamesChanged) {
      writeJSON(KEYS.GAMES, withRecords)
      report.games = withRecords.length
    }

    // ── 4. 项目的 game 字段统一为「游戏名」（与 v1.0.42 的老数据一致）──
    // v1.0.42 里 game 存的就是游戏名（「终末地」/「明日方舟」），而重构后的新建项目写的是游戏 id。
    // 混用会让同一个游戏在筛选/统计里被拆成两条，因此统一回**游戏名**；价格表仍按 gameKey(id) 匹配。
    // 找不到对应游戏的（游戏已被删）原样保留。
    const normalizedProjects = []
    let gameFixed = 0
    for (const p of (Array.isArray(mp.records) ? mp.records : [])) {
      if (!p || typeof p !== 'object') { normalizedProjects.push(p); continue }
      const name = gameNameOf(withRecords, p.game)
      if (!name || name === p.game) { normalizedProjects.push(p); continue }
      gameFixed++
      normalizedProjects.push({ ...p, game: name, gameName: name })
    }
    if (gameFixed > 0) {
      writeJSON(KEYS.ACCOUNTS, normalizedProjects)
      report.gamesNormalized = gameFixed
    }

    // ── 5. 记录数据版本 ──
    writeJSON(KEYS.SCHEMA, SCHEMA_VERSION)
  } catch (e) {
    report.errors.push(String(e && e.message ? e.message : e))
  }
  return report
}

// ── 回滚：从备份还原为迁移前的原始数据 ──
export function rollback(name) {
  const records = rollbackFrom(readJSON(backupKey(name), null))
  if (!records) return false
  const key = name === 'accounts' ? KEYS.ACCOUNTS : name === 'completions' ? KEYS.COMPLETIONS : null
  if (!key) return false
  writeJSON(key, records)
  return true
}

export function hasBackup(name) {
  const b = readJSON(backupKey(name), null)
  return !!(b && b.___backup === true)
}

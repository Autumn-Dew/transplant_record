// ═══════════════════════════════════════════════════════════════════
// 数据迁移（纯函数）— v1 → v2
//
// 原则：
//   1. 不删除、不改名、不改写任何原有字段，只做「新增」。
//   2. 幂等：schemaVersion 已达标的数据原样返回，不会重复加工。
//   3. 失败可回滚：调用方在写入前保存备份（makeBackup），
//      rollbackFrom(backup) 可完整还原。
//   4. 无法确认含义的旧数据一律保留原字段，不猜测、不丢弃。
// ═══════════════════════════════════════════════════════════════════

import { normalizeProject, needsMigration as projectNeedsMigration, PROJECT_SCHEMA_VERSION } from './project.js'
import { normalizeCompletion, COMPLETION_SCHEMA_VERSION } from './completion.js'
import { assignChainIds } from './hosting-chain.js'

export function makeBackup(records, { label = '', now = new Date() } = {}) {
  return {
    ___backup: true,
    label,
    createdAt: now.toISOString(),
    count: Array.isArray(records) ? records.length : 0,
    records: JSON.parse(JSON.stringify(records ?? [])),
  }
}

export function rollbackFrom(backup) {
  if (!backup || backup.___backup !== true || !Array.isArray(backup.records)) return null
  return JSON.parse(JSON.stringify(backup.records))
}

export function needsMigration(rawRecord, currentVersion) {
  return Number(rawRecord?.schemaVersion || 1) < currentVersion
}

// ── 项目（tr-accounts / boosting-records.json）v1/v2 → v3 ──
export function migrateProjects(rawList, { now } = {}) {
  const list = Array.isArray(rawList) ? rawList : []
  let changed = 0
  const step = list.map(raw => {
    if (!raw || typeof raw !== 'object') return raw
    if (!projectNeedsMigration(raw)) return raw
    const p = normalizeProject(raw, now ? { now } : undefined)
    changed++
    return { ...p, schemaVersion: PROJECT_SCHEMA_VERSION, migratedFrom: Number(raw.schemaVersion || 1) }
  })
  // 第二轮新增：连续托管关系 ID（幂等；已有该字段的记录原样保留）
  const chain = assignChainIds(step)
  return { records: chain.records, changed: changed + chain.changed, version: PROJECT_SCHEMA_VERSION }
}

// ── 执行记录（tr-completions）v1 → v2 ──
export function migrateCompletions(rawList, { now } = {}) {
  const list = Array.isArray(rawList) ? rawList : []
  let changed = 0
  const records = list.map(raw => {
    if (!raw || typeof raw !== 'object') return raw
    if (!needsMigration(raw, COMPLETION_SCHEMA_VERSION)) return raw
    const c = normalizeCompletion(raw)
    changed++
    return { ...c, schemaVersion: COMPLETION_SCHEMA_VERSION, migratedFrom: Number(raw.schemaVersion || 1) }
  })
  return { records, changed, version: COMPLETION_SCHEMA_VERSION }
}

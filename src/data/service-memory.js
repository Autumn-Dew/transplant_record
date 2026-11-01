// ═══════════════════════════════════════════════════════════════════
// 手动记忆的服务项目（`tr-services`）
//
// 「新增记录」里的服务项目下拉，来源有三：游戏目录的服务项目、这里手动记忆过的、
// 历史执行记录里出现过的。本模块只管中间那一份记忆：
//   * 去重、最新在前、最多保留 MAX_REMEMBERED 条
//   * 没有记忆时回落到 v1 遗留的默认服务名（LEGACY_DEFAULT_SERVICES）
// 页面不再直接 readJSON/writeJSON 这个键。
// ═══════════════════════════════════════════════════════════════════

import { KEYS, readJSON, writeJSON } from './storage.js'
import { LEGACY_DEFAULT_SERVICES } from '../domain/games.js'

export const MAX_REMEMBERED = 50

function normalizeList(list) {
  const out = []
  const seen = new Set()
  for (const raw of (Array.isArray(list) ? list : [])) {
    const v = String(raw == null ? '' : raw).trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
    if (out.length >= MAX_REMEMBERED) break
  }
  return out
}

/** 读取记忆列表；从未记录过时回落到 v1 默认服务名 */
export function readRememberedServices() {
  const saved = readJSON(KEYS.SERVICES, null)
  if (Array.isArray(saved) && saved.length) {
    const list = normalizeList(saved)
    if (list.length) return list
  }
  return [...LEGACY_DEFAULT_SERVICES]
}

/** 记住一个服务项目（去重、最新在前），返回更新后的列表 */
export function rememberService(name) {
  const v = String(name == null ? '' : name).trim()
  if (!v) return readRememberedServices()
  const current = readRememberedServices()
  if (current.includes(v)) return current
  const next = normalizeList([v, ...current])
  writeJSON(KEYS.SERVICES, next)
  return next
}

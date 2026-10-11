// ═══════════════════════════════════════════════════════════════════
// 店铺信息：**每个游戏独立一份**（存储键名不变：tr-shop-info）
//
//   新结构：{ [游戏 id]: [ { id, label, value, position } ] }
//   旧结构兼容（读取时自动迁移，幂等）：
//     · 数组            —— 原先全局共享，迁移时**整份复制给每个游戏**（不丢内容）
//     · { contact, gameName } —— 最早的 v1 结构，同样复制
// ═══════════════════════════════════════════════════════════════════

import { KEYS, readJSON, writeJSON } from './storage.js'

export function defaultShopList() {
  return [
    { id: 'c1', label: '代肝联系方式', value: '', position: 'head' },
    { id: 'c2', label: '代肝游戏名称', value: '', position: 'head' },
  ]
}

export function normalizeShopList(list) {
  return (Array.isArray(list) ? list : []).map((s, i) => ({
    id: String((s && s.id) || `s${i}`),
    label: String((s && s.label) || ''),
    value: String((s && s.value) || ''),
    position: s && s.position === 'tail' ? 'tail' : 'head',
  }))
}

function isLegacy(raw) {
  return Array.isArray(raw) || (!!raw && typeof raw === 'object' && ('contact' in raw || 'gameName' in raw))
}

function legacyList(raw) {
  if (Array.isArray(raw)) return normalizeShopList(raw)
  if (raw && typeof raw === 'object') {
    return normalizeShopList([
      { id: 'c1', label: '代肝联系方式', value: raw.contact || '', position: 'head' },
      { id: 'c2', label: '代肝游戏名称', value: raw.gameName || '', position: 'head' },
    ])
  }
  return []
}

/**
 * 旧结构 → 「每游戏一份」的映射；已是新结构则原样规整。
 * migrated=true 表示发生过迁移（调用方应落盘一次，幂等）。
 */
export function migrateShopMap(raw, gameKeys) {
  const keys = (Array.isArray(gameKeys) ? gameKeys : []).map(String).filter(Boolean)

  if (isLegacy(raw)) {
    const shared = legacyList(raw)
    const map = {}
    keys.forEach(k => { map[k] = shared.length ? shared.map(s => ({ ...s })) : defaultShopList() })
    return { map, migrated: keys.length > 0 }
  }

  const map = {}
  if (raw && typeof raw === 'object') Object.keys(raw).forEach(k => { map[k] = normalizeShopList(raw[k]) })
  keys.forEach(k => { if (!map[k]) map[k] = defaultShopList() })
  return { map, migrated: false }
}

/** 读取当前游戏的店铺信息（必要时先迁移并落盘） */
export function readShopForGame(game, gameKeys) {
  const { map, migrated } = migrateShopMap(readJSON(KEYS.SHOP_INFO, null), gameKeys)
  if (migrated) writeJSON(KEYS.SHOP_INFO, map)
  return { map, list: map[game] || defaultShopList() }
}

/** 只写当前游戏那一份（其他游戏保持不动） */
export function writeShopForGame(game, list, gameKeys) {
  const { map } = migrateShopMap(readJSON(KEYS.SHOP_INFO, null), gameKeys)
  map[game] = normalizeShopList(list)
  writeJSON(KEYS.SHOP_INFO, map)
  return map
}

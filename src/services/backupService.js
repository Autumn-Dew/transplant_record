// ═══════════════════════════════════════════════════════════════════
// 备份 / 恢复 / 清除 —— 唯一落点（设置页只负责触发与提示）
//
// 约束：
//   1. 页面不直接碰 localStorage；键的整体遍历/写回都在这里。
//   2. 恢复与清除必须同时做三件事：
//        ① 写回 localStorage（业务数据的权威来源）
//        ② 同步 Electron 侧文件（否则下次启动的 hydrate 会拿旧文件）
//        ③ 刷新各内存单例（repo / 价格表 / 主题 / 音效），界面立即生效 —— 不需要重载页面
//   3. 备份只含 `tr-` 前缀键，排除 `tr-backup-*`（迁移前快照不进备份）。
// ═══════════════════════════════════════════════════════════════════

import { listKeys, getRaw, setRaw, removeKey, electronApi } from '../data/storage.js'
import {
  projectsRepo, completionsRepo, gamesRepo, blueprintsRepo, blueprintGroupsRepo,
} from '../data/repos.js'
import { reloadPrices } from '../composables/usePrices.js'
import { reloadTheme } from '../composables/useGlobalTheme.js'
import { reloadSoundEnabled } from '../utils/sound.js'

const KEY_PREFIX = 'tr-'
const BACKUP_PREFIX = 'tr-backup-'

// 存储键 → Electron 文件通道。恢复时只同步备份里出现过的键；清除时全部写空。
// `tr-workdiary` 是 v1 遗留键（当前界面不再写入），保留同步只为兼容旧备份与旧文件。
const FILE_CHANNELS = [
  { key: 'tr-accounts', channel: 'saveRecords', empty: [] },
  { key: 'tr-blueprints', channel: 'saveBlueprints', empty: [] },
  { key: 'tr-workdiary', channel: 'saveWorkDiary', empty: [] },
  { key: 'tr-prices', channel: 'savePrices', empty: null },
  { key: 'tr-completions', channel: 'saveCompletions', empty: [] },
  { key: 'tr-games', channel: 'saveGames', empty: null },
]

function parseKeyValue(key) {
  try {
    const raw = getRaw(key)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

// 把某个键的当前 localStorage 值同步到 Electron 文件；键不存在时写空值
function syncFile({ key, channel, empty }, { onlyIfPresent = false } = {}) {
  const api = electronApi()
  const save = api?.[channel]
  if (typeof save !== 'function') return false
  const raw = getRaw(key)
  if (raw == null && onlyIfPresent) return false
  const value = raw == null ? empty : parseKeyValue(key)
  try {
    save(value === null ? null : value)
    return true
  } catch {
    return false
  }
}

// 刷新全部内存单例，使界面与刚写入的 localStorage 一致
function refreshMemory() {
  projectsRepo.reload()
  completionsRepo.reload()
  gamesRepo.reload()
  blueprintsRepo.reload()
  blueprintGroupsRepo.reload()
  reloadPrices()
  reloadTheme()
  reloadSoundEnabled()
}

/** 生成备份快照（纯数据，不落盘不下载） */
export function exportSnapshot({ appName = '', version = '' } = {}) {
  const keys = {}
  listKeys(KEY_PREFIX)
    .filter(k => !k.startsWith(BACKUP_PREFIX))
    .forEach(k => {
      const raw = getRaw(k)
      if (raw != null) keys[k] = raw
    })
  return {
    app: appName,
    version,
    exportedAt: new Date().toISOString(),
    note: '还原：把 keys 里每一项按原键名写回 localStorage 即可（键名与结构均未改动）',
    keys,
  }
}

/** 生成备份并触发浏览器下载（Electron 里就是保存文件对话框） */
export function downloadSnapshot({ appName = '', version = '', fileName = '' } = {}) {
  const payload = exportSnapshot({ appName, version })
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || `代肝记录备份_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return payload
}

/**
 * 从备份恢复：
 *   payload 可以是解析后的备份对象，也可以是 JSON 字符串。
 * 返回 { ok, restored, keys } 或 { ok:false, reason }
 *   reason: 'invalid-json' | 'invalid-backup' | 'empty-backup'
 */
export function restoreSnapshot(payload) {
  let data = payload
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { return { ok: false, reason: 'invalid-json', restored: 0 } }
  }
  const keys = data && data.keys
  if (!keys || typeof keys !== 'object') return { ok: false, reason: 'invalid-backup', restored: 0 }

  const entries = Object.entries(keys).filter(([k]) => String(k).startsWith(KEY_PREFIX))
  if (!entries.length) return { ok: false, reason: 'empty-backup', restored: 0 }

  entries.forEach(([k, v]) => {
    if (v == null) removeKey(k)
    else setRaw(k, typeof v === 'string' ? v : JSON.stringify(v))
  })

  // Electron 文件：只同步备份里存在的键，避免把未涉及的旧文件也清掉
  const restoredKeys = entries.map(([k]) => k)
  FILE_CHANNELS
    .filter(f => restoredKeys.includes(f.key))
    .forEach(f => syncFile(f, { onlyIfPresent: true }))

  refreshMemory()
  return { ok: true, restored: entries.length, keys: restoredKeys }
}

/**
 * 清除全部数据：localStorage 的 tr- 键 + Electron 六个数据文件 + 内存单例。
 * 清除后各 repo 会回落到默认值（游戏目录回落内置三游戏，价格表回落打包默认）。
 */
export function clearAllData() {
  const removed = listKeys(KEY_PREFIX)
  removed.forEach(removeKey)
  FILE_CHANNELS.forEach(f => syncFile(f))
  refreshMemory()
  return { ok: true, removed: removed.length }
}

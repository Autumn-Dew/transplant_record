/**
 * 日报 · 按托管项目存的数据（`tr-report-runtime`）
 *
 * 分工：
 *   tr-report-draft     模板 = 每个游戏「有哪些行、叫什么、什么类型」（基准项）
 *   tr-report-runtime   数据 = 勾选状态 / 文本内容 / 资源数字，按 taskId 各存一份
 *   tr-report-countdown 倒计时，也按 taskId
 *
 * 为什么分开：同一个游戏开两次托管，勾的进度和填的数字完全是两回事，
 * 放模板里会互相串。
 *
 * 结构：
 *   {
 *     [taskId]: {
 *       rows: { daily: { [行名]: { done, value } }, weekly: { ... } },
 *       resources: { [资源名]: { before, after } }
 *     }
 *   }
 *
 * 没选托管项目时落到 `__none`，不丢数据，等选中了再正经记。
 */

import { readJSON, writeJSON } from './storage.js'

const KEY = 'tr-report-runtime'
const NO_TASK = '__none'

export function readRuntimeMap() {
  const raw = readJSON(KEY, null)
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

export function taskKey(taskId) {
  return taskId || NO_TASK
}

/** 取某个托管的整份运行时数据 */
export function readRuntime(taskId) {
  const map = readRuntimeMap()
  const own = map[taskKey(taskId)]
  return own && typeof own === 'object' ? own : {}
}

/**
 * 合并写入。patch 形如：
 *   { rows: { daily: { '每日任务': { done: true } } } }
 *   { resources: { '龙门币': { before: '1200' } } }
 */
export function writeRuntime(taskId, patch) {
  const map = readRuntimeMap()
  const key = taskKey(taskId)
  const own = map[key] && typeof map[key] === 'object' ? map[key] : {}
  const rows = own.rows && typeof own.rows === 'object' ? own.rows : {}
  const resources = own.resources && typeof own.resources === 'object' ? own.resources : {}

  if (patch && patch.rows) {
    for (const [kind, byLabel] of Object.entries(patch.rows)) {
      const bucket = rows[kind] && typeof rows[kind] === 'object' ? rows[kind] : {}
      for (const [label, value] of Object.entries(byLabel || {})) {
        bucket[label] = { ...(bucket[label] || {}), ...value }
      }
      rows[kind] = bucket
    }
  }
  if (patch && patch.resources) {
    for (const [label, value] of Object.entries(patch.resources)) {
      resources[label] = { ...(resources[label] || {}), ...value }
    }
  }

  const next = { rows, resources }
  const empty = !Object.keys(rows).some(k => Object.keys(rows[k] || {}).length)
    && Object.keys(resources).length === 0
  if (empty) delete map[key]
  else map[key] = next

  try { writeJSON(KEY, map) } catch { /* 存储失败不影响当前会话 */ }
  return map
}

/** 清掉某个托管的数据（日报页「重置」用） */
export function clearRuntime(taskId) {
  const map = readRuntimeMap()
  delete map[taskKey(taskId)]
  try { writeJSON(KEY, map) } catch { /* 忽略 */ }
  return map
}

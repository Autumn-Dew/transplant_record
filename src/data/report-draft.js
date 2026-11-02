// ═══════════════════════════════════════════════════════════════════
// 日报临时草稿（`tr-report-draft`）
//
// 日报页里对「模板」的所有修改都落在草稿里，**不直接改全局配置**：
//   · 数据管理 → 日报预设：改全局，所有时候生效；
//   · 每日汇报 → 模板面板：改草稿，只影响当前这份日报；
//   · 「存为全局预设」：把草稿写回该游戏的 game.report；
//   · 「恢复默认」：清掉该游戏的草稿，回到全局预设。
//
// 草稿按游戏分开存，且**落盘**（重启仍在），直到手动恢复默认。
// ═══════════════════════════════════════════════════════════════════

import { KEYS, readJSON, writeJSON } from './storage.js'
import { normalizeReportLayout, normalizeRows } from '../domain/report-layout.js'

function str(v) {
  return v == null ? '' : String(v)
}

function strList(v) {
  return (Array.isArray(v) ? v : []).map(s => str(s).trim()).filter(Boolean)
}

/** 读取全部草稿：{ [gameId]: { text, author, daily, weekly, resources, layout } } */
export function readReportDrafts() {
  const raw = readJSON(KEYS.REPORT_DRAFT, null)
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const out = {}
  for (const [gameId, draft] of Object.entries(src)) {
    if (!gameId || !draft || typeof draft !== 'object') continue
    const entry = {
      text: draft.text && typeof draft.text === 'object' ? { ...draft.text } : {},
      daily: normalizeRows(draft.daily),
      weekly: normalizeRows(draft.weekly),
      resources: strList(draft.resources),
      layout: normalizeReportLayout(draft.layout),
    }
    // 汇报人：只有草稿里真的填过才带（区分「没设过」与「主动清空」）
    if (Object.prototype.hasOwnProperty.call(draft, 'author')) entry.author = str(draft.author)
    out[gameId] = entry
  }
  return out
}

/** 写回全部草稿（内部会丢掉非法项） */
export function writeReportDrafts(drafts) {
  const src = drafts && typeof drafts === 'object' ? drafts : {}
  const out = {}
  for (const [gameId, draft] of Object.entries(src)) {
    if (!gameId || !draft || typeof draft !== 'object') continue
    const entry = {
      text: draft.text && typeof draft.text === 'object' ? { ...draft.text } : {},
      daily: normalizeRows(draft.daily),
      weekly: normalizeRows(draft.weekly),
      resources: strList(draft.resources),
      layout: normalizeReportLayout(draft.layout),
    }
    if (Object.prototype.hasOwnProperty.call(draft, 'author')) entry.author = str(draft.author)
    out[gameId] = entry
  }
  writeJSON(KEYS.REPORT_DRAFT, out)
  return out
}

/** 清掉某个游戏的草稿（「恢复默认」） */
export function clearReportDraft(gameId) {
  const all = readReportDrafts()
  if (!gameId || !all[gameId]) return all
  delete all[gameId]
  writeReportDrafts(all)
  return all
}

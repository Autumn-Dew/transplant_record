// ═══════════════════════════════════════════════════════════════════
// 每日汇报的页签（多页并行时的标题与当前页）
//
// 只存「页签身份与标题」——不存任何汇报内容：正文、主题、背景各在各的位置。
// 上限 8 页；损坏数据 / 空数组一律返回空列表，由页面补一页空白，绝不让界面进不去。
// ═══════════════════════════════════════════════════════════════════

import { KEYS, readJSON, writeJSON } from './storage.js'

export const MAX_REPORT_PAGES = 20

let fallbackSeq = 0
// 保存的数据缺 id 时补一个（保证每页都有稳定 key）
function fallbackId() { return 'rp-restored-' + (++fallbackSeq) + '-' + Date.now().toString(36) }

/**
 * 规整页签列表：
 *   · 最多 MAX_REPORT_PAGES 项
 *   · 丢弃非对象项；id 缺失时用 makeId() 补；重复 id 只留第一个
 *   · label 一律字符串
 */
export function normalizeReportPages(raw, { makeId = fallbackId } = {}) {
  const list = (Array.isArray(raw) ? raw : []).slice(0, MAX_REPORT_PAGES)
  const seen = new Set()
  const out = []
  for (const p of list) {
    if (!p || typeof p !== 'object') continue
    const id = String(p.id || '') || makeId()
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, label: String(p.label || '') })
  }
  return out
}

/** 读取上次的页签与当前页（`current` 会被钳制到合法下标） */
export function readReportPages(makeId) {
  const saved = readJSON(KEYS.REPORT_PAGES, null)
  // 兼容早期可能直接存数组的形态
  const rawList = Array.isArray(saved) ? saved : (saved && Array.isArray(saved.pages) ? saved.pages : [])
  const pages = normalizeReportPages(rawList, makeId ? { makeId } : undefined)
  const rawCurrent = Array.isArray(saved) ? 0 : (Number(saved && saved.current) || 0)
  return {
    pages,
    current: pages.length ? Math.min(Math.max(0, rawCurrent), pages.length - 1) : 0,
  }
}

/** 落盘（写入前再规整一次，避免把 UI 里的临时字段存进去） */
export function writeReportPages({ pages, current = 0 } = {}) {
  const list = normalizeReportPages(pages)
  const idx = list.length ? Math.min(Math.max(0, Number(current) || 0), list.length - 1) : 0
  writeJSON(KEYS.REPORT_PAGES, { pages: list, current: idx })
  return { pages: list, current: idx }
}

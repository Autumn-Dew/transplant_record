// ═══════════════════════════════════════════════════════════════════
// 日报「复制文字」按钮的显隐开关
//   默认关闭：需要在「设置 → 使用偏好」里手动打开。
//   存 tr-report-copy-btn；变更时广播事件，日报页即时跟随。
// ═══════════════════════════════════════════════════════════════════

import { KEYS, readJSON, writeJSON } from './storage.js'

export const COPY_BTN_EVENT = 'tr-report-copy-btn-changed'

export function readCopyTextEnabled() {
  try { return readJSON(KEYS.REPORT_COPY_BTN, false) === true } catch { return false }
}

export function writeCopyTextEnabled(on) {
  const v = on === true
  try { writeJSON(KEYS.REPORT_COPY_BTN, v) } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(COPY_BTN_EVENT, { detail: { on: v } })) } catch { /* ignore */ }
  return v
}

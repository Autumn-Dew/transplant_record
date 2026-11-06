// ═══════════════════════════════════════════════════════════════════
// 统一收口"静默失败"
//
//   以前各处写 `catch { /* ignore */ }`，出问题时界面毫无反应、控制台也安静，
//   排查只能靠猜（「重启后资源空了」就是这样被藏了两轮）。
//
//   约定：
//     · 开发环境（vite dev）→ console.warn，带模块名与原始错误
//     · 生产环境 → 静默（不影响用户），但可通过 window.__TR_WARN__ 查看最后若干条
// ═══════════════════════════════════════════════════════════════════

const MAX_LOG = 50
const log = []

/** 记录一次被忽略的错误。scope 用「模块:动作」，例如 'report:resources' */
export function warn(scope, err) {
  const entry = {
    scope: String(scope || 'unknown'),
    message: String((err && err.message) || err || ''),
    at: new Date().toISOString(),
  }
  log.push(entry)
  if (log.length > MAX_LOG) log.shift()
  try {
    if (typeof window !== 'undefined') window.__TR_WARN__ = log
  } catch { /* ignore */ }
  try {
    // vite 注入；非 vite 环境下 import.meta.env 为 undefined，走 catch
    const dev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
    if (dev) console.warn('[TR] ' + entry.scope + ' → ' + entry.message)
  } catch { /* ignore */ }
  return entry
}

/** 读最近被忽略的错误（排查用：控制台执行 __trWarnings()） */
export function recentWarnings() {
  return log.slice()
}

try {
  if (typeof window !== 'undefined') window.__trWarnings = recentWarnings
} catch { /* ignore */ }

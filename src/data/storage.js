// ═══════════════════════════════════════════════════════════════════
// 存储层基座：集中管理存储键 + 安全的 JSON 读写
//
// 约束（与既有安装保持兼容）：
//   * 键名一律沿用 v1 既有值，不得更改。
//   * 新增键只用于新增数据（游戏目录、迁移备份、模板等）。
//   * 任何读写失败都静默降级，绝不打断交互。
// ═══════════════════════════════════════════════════════════════════

export const KEYS = {
  // ── v1 既有键（不得更改）──
  THEME: 'tr-theme',
  ACCOUNTS: 'tr-accounts',
  COMPLETIONS: 'tr-completions',
  BLUEPRINTS: 'tr-blueprints',
  BLUEPRINT_GROUPS: 'tr-blueprint-groups',
  PRICES: 'tr-prices',
  SHOP_INFO: 'tr-shop-info',
  SERVICES: 'tr-services',
  REPORT_ROLL: 'tr-report-roll',
  SELECT_LIMIT: 'tr-select-limit',
  // ── 重构新增键 ──
  GAMES: 'tr-games',
  SCHEMA: 'tr-schema-version',
  SHOP_HIDDEN: 'tr-shop-hidden',
  // 每日汇报背景（独立于应用主题，两者互不覆盖）
  REPORT_BG: 'tr-report-bg',
  // 每日汇报主题皮肤（与背景、应用主题三方各自独立）
  REPORT_THEME: 'tr-report-theme',
}

export const SCHEMA_VERSION = 2

export function backupKey(name) {
  return `tr-backup-${name}`
}

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const v = JSON.parse(raw)
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

// 是否可用的 electron 通道
export function electronApi() {
  try { return typeof window !== 'undefined' ? window.electron : null } catch { return null }
}

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
  // 价格一览的画布外观（原版 / 终末地风格，独立于应用主题）
  PRICE_THEME: 'tr-price-theme',
  // 价格一览的画布背景图（压缩后的 dataURL；不设则用纯色底）
  PRICE_BG: 'tr-price-bg',
  // 托管的「每日刷新时间」（游戏日常重置点，'HH:mm'，默认 00:00）——
  // 跨过这个时间点才算新的一天：日报天数 +1、代办里的托管重新出现、「今日已确认」失效
  DAILY_RESET: 'tr-daily-reset',
  // 每日汇报的页签（多页并行时每页的标题）+ 当前页 —— 重启后还原
  REPORT_PAGES: 'tr-report-pages',
  // 每日汇报的临时草稿（模板文案 / 任务项 / 资源项），按游戏分开存，直到手动恢复默认
  REPORT_DRAFT: 'tr-report-draft',
  // 界面音效（点击 / 悬停）总开关，'false' 表示静音
  SOUND_ENABLED: 'tr-sound-enabled',
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

// ── 原始键操作 ──
// 仅备份 / 恢复 / 清除这类「按存储键整体处理」的操作用；业务读写一律走 readJSON/writeJSON。
export function listKeys(prefix = '') {
  try {
    const out = []
    // 用标准 Storage 接口（length + key(i)）而不是 Object.keys ——
    // 后者依赖实现的属性枚举，测试替身与某些环境下拿不到键名。
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k != null && k.startsWith(prefix)) out.push(k)
    }
    return out
  } catch {
    return []
  }
}

export function getRaw(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setRaw(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

// 是否可用的 electron 通道
export function electronApi() {
  try { return typeof window !== 'undefined' ? window.electron : null } catch { return null }
}

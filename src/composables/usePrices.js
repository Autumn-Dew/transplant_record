import { ref } from 'vue'
import endfield from '../data/prices/endfield.js'
import ak from '../data/prices/ak.js'
import { KEYS, readJSON, writeJSON, electronApi } from '../data/storage.js'

const DEFAULTS = { endfield, ak }
// 默认数据版本：每次修改 src/data/prices/*.js 时递增。
// 注意：版本升级只做「合并」，绝不丢弃用户已经修改过的价格数据。
const DEFAULTS_VERSION = 2

function clone(o) { return JSON.parse(JSON.stringify(o)) }

// 将非数字 key 规范化为连续阿拉伯数字（保留已有数字 key）
function normalizeKeys(data) {
  if (!data || !Array.isArray(data.categories)) return data
  const used = new Set()
  const pending = []
  data.categories.forEach(c => (c.items || []).forEach(it => {
    const n = Number(it.key)
    if (Number.isInteger(n) && n > 0 && !used.has(n)) {
      it.key = n
      used.add(n)
    } else {
      it.key = null
      pending.push(it)
    }
  }))
  let next = 1
  pending.forEach(it => {
    while (used.has(next)) next++
    it.key = next
    used.add(next)
  })
  return data
}

// 把内置默认数据「合并」进用户数据：
//   * 分类 / 项目以名称为主键匹配，用户已有的值优先保留（改名、改价不丢）
//   * 内置新增的分类与项目会被补进来
//   * 用户自行新增的分类与项目原样保留
// 同名分类只保留第一次出现的那一份（分类内同名项目也只保留一份）
// 用途：清理历史版本反复合并内置数据时累积出来的重复分类——
//       第一份就是用户自己的数据，后面重复的副本（含混进来的内置内容）直接丢弃
function dedupeCats(cats) {
  const out = []
  const byName = new Map()
  ;(Array.isArray(cats) ? cats : []).forEach(c => {
    const key = String((c && c.name) || '')
    if (byName.has(key)) return
    const list = Array.isArray(c && c.items) ? c.items : []
    const seen = new Set()
    const items = list.filter(i => {
      const n = String((i && i.name) || '')
      if (seen.has(n)) return false
      seen.add(n)
      return true
    })
    const fresh = { ...c, items }
    byName.set(key, fresh)
    out.push(fresh)
  })
  return out
}

// 把内置默认数据合并进用户数据：
//   * 用户**还没有**这个游戏的价格数据（首次安装 / 被清空）→ 用内置默认
//   * 用户**已经有**这个游戏的数据 → **完全按用户数据**（不合并内置），只清理历史累积的重复
//
// 为什么不做「内置缺项补齐」：升级（1.0.42 → 当前版本）时对老数据的影响要最小 ——
//   · 不合并：用户数据零改动（不去加、也不去删），只做键的规整
//   · 合并：会往用户数据里塞分类/项目，还会把用户主动删掉的内置项补回来
//   本项目的目标是「老数据无损继承」，因此选择前者。
function mergeGame(savedGame, defaultGame) {
  const savedCats = Array.isArray(savedGame?.categories) ? savedGame.categories : []
  const defaultCats = Array.isArray(defaultGame?.categories) ? defaultGame.categories : []
  // 用户已经有了这个游戏的价格数据 → **完全按用户的数据**（不合并内置），并去掉历史累积的重复
  if (savedCats.length) return { categories: clone(dedupeCats(savedCats)) }
  // 用户还没有这个游戏的价格 → 用内置默认
  return { categories: clone(defaultCats) }
}

// 任意来源（localStorage / 本地文件 / 空） → 完整价格表结构
function normalizeAll(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  Object.keys(DEFAULTS).forEach(g => {
    out[g] = normalizeKeys(src[g] ? mergeGame(src[g], DEFAULTS[g]) : clone(DEFAULTS[g]))
  })
  // 通过「游戏管理」新增的游戏：价格表 key 与游戏 id 对齐，原样保留
  Object.keys(src).forEach(k => {
    if (k === '__version' || out[k]) return
    if (src[k] && typeof src[k] === 'object') out[k] = normalizeKeys(clone(src[k]))
  })
  return out
}

function freshDefaults() { return normalizeAll({}) }

function loadFromLocal() {
  const saved = readJSON(KEYS.PRICES, null)
  const out = normalizeAll(saved)
  // 若规整时清理掉了历史累积的重复分类，落盘一次让存储也收敛（幂等）
  try {
    const changed = Object.keys(out).some(g => {
      const before = saved && saved[g] && Array.isArray(saved[g].categories) ? saved[g].categories.length : null
      const after = Array.isArray(out[g] && out[g].categories) ? out[g].categories.length : 0
      return before != null && before !== after
    })
    if (changed) writeJSON(KEYS.PRICES, { ...clone(out), __version: DEFAULTS_VERSION })
  } catch { /* ignore */ }
  return out
}

// 全局单例，PricePage 与 AdminPage 共享
const prices = ref(loadFromLocal())

// 应用启动：与 Electron 本地文件（userData/data/prices.json）同步
// 通道优先级：localStorage 为准（用户可能在应用内改过），绝不互相覆盖
try {
  electronApi()?.loadPrices?.().then(d => {
    try {
      const localRaw = readJSON(KEYS.PRICES, null)
      if (localRaw) {
        // 本地已有数据 → 以本地为准，仅把本地同步到文件
        const payload = { ...clone(prices.value), __version: DEFAULTS_VERSION }
        try { electronApi()?.savePrices?.(payload) } catch { /* ignore */ }
        return
      }
      if (!d || typeof d !== 'object' || !d.endfield) {
        // 首次安装：写入打包默认值
        const initial = freshDefaults()
        prices.value = initial
        const payload = { ...clone(initial), __version: DEFAULTS_VERSION }
        writeJSON(KEYS.PRICES, payload)
        try { electronApi()?.savePrices?.(payload) } catch { /* ignore */ }
        return
      }
      // 本地为空、文件有数据 → 用文件（与内置默认合并，保留未知游戏）
      const merged = normalizeAll(d)
      prices.value = merged
      const payload = { ...clone(merged), __version: DEFAULTS_VERSION }
      writeJSON(KEYS.PRICES, payload)
      try { electronApi()?.savePrices?.(payload) } catch { /* ignore */ }
    } catch { /* ignore */ }
  }).catch(() => {})
} catch { /* ignore */ }

export function usePrices() {
  function save() {
    // 深拷贝成纯对象：IPC 无法结构化克隆 Vue 响应式 Proxy（会同步抛错）
    let plain = null
    try { plain = JSON.parse(JSON.stringify(prices.value)) } catch { /* ignore */ }
    if (!plain) return
    const payload = { ...plain, __version: DEFAULTS_VERSION }
    writeJSON(KEYS.PRICES, payload)
    try { electronApi()?.savePrices?.(payload) } catch { /* ignore */ }
  }
  function resetGame(game) {
    prices.value[game] = clone(DEFAULTS[game] || { categories: [] })
    save()
  }
  function getGame(game) {
    return prices.value[game] || { categories: [] }
  }
  // 删除某个游戏的整套价格数据（游戏被删除时使用）
  function removeGame(game) {
    if (!prices.value[game]) return
    const next = { ...prices.value }
    delete next[game]
    prices.value = next
    save()
  }
  return { prices, save, resetGame, getGame, removeGame, defaultsVersion: DEFAULTS_VERSION }
}

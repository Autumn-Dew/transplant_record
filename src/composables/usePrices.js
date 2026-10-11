import { ref } from 'vue'
import endfield from '@/data/prices/endfield.js'
import ak from '@/data/prices/ak.js'

const DEFAULTS = { endfield, ak }
const STORAGE_KEY = 'tr-prices'
// 默认数据版本：每次修改 src/data/prices/*.js 时递增，保证打包/重启后新数据生效
const DEFAULTS_VERSION = 2
const VERSION_KEY = 'tr-prices-version'

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

function freshDefaults() {
  return {
    endfield: normalizeKeys(clone(DEFAULTS.endfield)),
    ak: normalizeKeys(clone(DEFAULTS.ak)),
  }
}

function load() {
  try {
    // 默认数据版本升级 → 丢弃旧持久化，直接使用新默认
    const savedVer = Number(localStorage.getItem(VERSION_KEY) || 0)
    if (savedVer < DEFAULTS_VERSION) {
      localStorage.setItem(VERSION_KEY, String(DEFAULTS_VERSION))
      return freshDefaults()
    }
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      endfield: normalizeKeys(saved.endfield || clone(DEFAULTS.endfield)),
      ak: normalizeKeys(saved.ak || clone(DEFAULTS.ak)),
    }
  } catch {
    return freshDefaults()
  }
}

// 全局单例，PricePage 与 AdminPage 共享
const prices = ref(load())

// 应用启动：与 Electron 本地文件（userData/data/prices.json）同步
try {
  window.electron?.loadPrices?.().then(d => {
    const fileVer = Number(d?.__version || 0)
    if (d && d.endfield && fileVer >= DEFAULTS_VERSION) {
      // 本地文件已是最新 → 直接使用本地文件（保留用户的修改）
      const norm = { endfield: normalizeKeys(d.endfield), ak: normalizeKeys(d.ak) }
      prices.value = norm
      localStorage.setItem(STORAGE_KEY, JSON.stringify(norm))
      localStorage.setItem(VERSION_KEY, String(DEFAULTS_VERSION))
      return
    }
    // 首次安装（无本地文件）或本地文件版本落后 → 以打包的初始价格表为初始数据并落盘
    const initial = freshDefaults()
    prices.value = initial
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    localStorage.setItem(VERSION_KEY, String(DEFAULTS_VERSION))
    const payload = JSON.parse(JSON.stringify({ ...initial, __version: DEFAULTS_VERSION }))
    try { window.electron?.savePrices?.(payload) } catch { /* ignore */ }
  }).catch(() => {})
} catch {}

export function usePrices() {
  function save() {
    // 深拷贝成纯对象：IPC 无法结构化克隆 Vue 响应式 Proxy（会同步抛错）
    let plain = null
    try { plain = JSON.parse(JSON.stringify(prices.value)) } catch { /* ignore */ }
    const payload = plain ? { ...plain, __version: DEFAULTS_VERSION } : prices.value
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)) } catch { /* ignore */ }
    try { localStorage.setItem(VERSION_KEY, String(DEFAULTS_VERSION)) } catch { /* ignore */ }
    try { if (plain) window.electron?.savePrices?.(payload) } catch { /* ignore */ }
  }
  function resetGame(game) {
    prices.value[game] = clone(DEFAULTS[game])
    save()
  }
  function getGame(game) {
    return prices.value[game] || { categories: [] }
  }
  return { prices, save, resetGame, getGame }
}

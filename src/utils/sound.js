// 按钮音效工具
// 路径用 import.meta.env.BASE_URL 拼接：dev=「/」，打包(file://)=「./」，两者都能取到 public 下的音频
// 注意：非 Vite 环境（如 node 下跑测试）没有 import.meta.env，必须容错，否则整个模块加载就会抛错。
import { KEYS } from '../data/storage.js'

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './'
// 非浏览器环境（无 Audio）直接跳过播放，调用方无需判断
const HAS_AUDIO = typeof Audio !== 'undefined'

// 「四次点击才生效」按钮的逐层音效（第 1、2、3、4 次点击）
export const OVERCHARGE_SFX = [
  'magic_basic_mag_overcharge_0_14.wav',
  'magic_basic_mag_overcharge_1_15.wav',
  'magic_basic_mag_overcharge_2_16.wav',
  'magic_basic_mag_overcharge_3_17.wav',
]

// 「单次点击即生效」操作的音效
export const SINGLE_SFX = 'pr_basic_getmana_pr_58.wav'

// 鼠标悬停音效（掠过可交互元素时响一次）
export const HOVER_SFX = 'ui_cursor_29.wav'

// 悬停音比点击轻一点，扫过列表时不会吵
const HOVER_VOLUME = 0.45

/* ══ 总开关（设置页「界面音效」）══
   关闭后点击 / 悬停 / 递增确认全部静音；键值存 'false' 表示静音，缺省即开启。 */
function readEnabled() {
  try { return localStorage.getItem(KEYS.SOUND_ENABLED) !== 'false' } catch { return true }
}
let enabled = readEnabled()

export function isSoundEnabled() { return enabled }
// 重新读取总开关（备份恢复 / 清除数据后同步内存状态）
export function reloadSoundEnabled() {
  enabled = readEnabled()
  return enabled
}
export function setSoundEnabled(v) {
  enabled = v !== false
  try { localStorage.setItem(KEYS.SOUND_ENABLED, String(enabled)) } catch { /* 存储不可用：仅本次生效 */ }
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tr-sound-enabled-changed', { detail: enabled }))
    }
  } catch { /* 非浏览器环境 */ }
  return enabled
}

const cache = new Map()
function getAudio(name) {
  let a = cache.get(name)
  if (!a) {
    a = new Audio(BASE + name)
    a.preload = 'auto'
    cache.set(name, a)
  }
  return a
}

// 悬停音效专用小池：连续掠过多个元素时，前一声不会被后一声截断
const HOVER_POOL_SIZE = 3
const hoverPool = []
let hoverCursor = 0
function getHoverAudio() {
  while (hoverPool.length < HOVER_POOL_SIZE) {
    const a = new Audio(BASE + HOVER_SFX)
    a.preload = 'auto'
    a.volume = HOVER_VOLUME
    hoverPool.push(a)
  }
  const a = hoverPool[hoverCursor]
  hoverCursor = (hoverCursor + 1) % hoverPool.length
  return a
}

// 播放指定音效（失败静默，绝不打断交互）
export function playSfx(name) {
  if (!enabled || !name || !HAS_AUDIO) return
  try {
    const a = getAudio(name)
    try { a.currentTime = 0 } catch { /* 尚未元数据加载完成 */ }
    const p = a.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch { /* ignore */ }
}

// 四次保护按钮：step 为「已点击次数」（首次点击传 0）
export function playOvercharge(step) {
  const i = Math.max(0, Math.min(Number(step) || 0, OVERCHARGE_SFX.length - 1))
  playSfx(OVERCHARGE_SFX[i])
}

// 单次即生效的操作
export function playClick() { playSfx(SINGLE_SFX) }

// 鼠标悬停（进入新的可交互元素）
export function playHover() {
  if (!enabled || !HAS_AUDIO) return
  try {
    const a = getHoverAudio()
    try { a.currentTime = 0 } catch { /* 尚未元数据加载完成 */ }
    const p = a.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch { /* ignore */ }
}

/* 哪些元素算「可交互」：按钮类 + 列表行 + 筛选块 + 下拉项 + 主题卡 + 色板。
   hover 只在这一层触发，元素内部移动不会重复响。 */
export const HOVER_SELECTOR = [
  'button',
  '[role="button"]',
  'a[href]',
  'label',
  'summary',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="file"]',
  '.rc-global-btn',
  '.tl-entry-btn',
  '.folder-chip',
  '.song-item',
  '.sb-trigger',
  '.sb-option',
  '.page-tab',
  '.copyable',
  '.theme-preview-option',
  '.rc-theme-item',
  '.rc-theme-mode',
  '.color-swatch',
].join(',')

let hoverBound = false
let hoverLast = null

/**
 * 全局悬停音效：进入一个新的可交互元素时响一次，同一元素内移动不重复。
 * 只在真有鼠标的设备上启用（触摸屏 / 粗指针不出声），返回是否挂上了监听。
 */
export function initHoverSound(selector = HOVER_SELECTOR) {
  if (hoverBound || typeof document === 'undefined') return false
  try {
    if (typeof window !== 'undefined' && window.matchMedia
      && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return false
  } catch { /* matchMedia 不可用：按支持处理 */ }
  hoverBound = true
  document.addEventListener('mouseover', (e) => {
    if (!enabled) return
    const target = e.target instanceof Element ? e.target : null
    if (!target) return
    const el = target.closest(selector)
    if (el === hoverLast) return          // 同一元素内部移动：不重复
    hoverLast = el
    if (!el) return                       // 移出可交互元素：只清状态
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return
    playHover()
  })
  return true
}

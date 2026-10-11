// 按钮音效工具
// 路径用 import.meta.env.BASE_URL 拼接：dev=「/」，打包(file://)=「./」，两者都能取到 public 下的音频
const BASE = import.meta.env.BASE_URL || './'

// 「四次点击才生效」按钮的逐层音效（第 1、2、3、4 次点击）
export const OVERCHARGE_SFX = [
  'magic_basic_mag_overcharge_0_14.wav',
  'magic_basic_mag_overcharge_1_15.wav',
  'magic_basic_mag_overcharge_2_16.wav',
  'magic_basic_mag_overcharge_3_17.wav',
]

// 「单次点击即生效」操作的音效
export const SINGLE_SFX = 'pr_basic_getmana_pr_58.wav'

// 全局开关（如需静音可复用）
let enabled = true
export function setSfxEnabled(v) { enabled = !!v }
export function isSfxEnabled() { return enabled }

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

// 播放指定音效（失败静默，绝不打断交互）
export function playSfx(name) {
  if (!enabled || !name) return
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

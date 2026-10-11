// ═══════════════════════════════════════════════════════════════════
// 统一的「多次点击确认」机制
//
// 用途：所有会产生后果的按钮（删除 / 归档 / 清除数据 / 确认执行 / 跳过 / 续费…）
//       都走同一套规则：**连点 4 次生效**，中途停手 3 秒自动复位，
//       点击过程中按钮边框与文字按 红 → 橙 → 紫 递进，title 提示还差几次。
//
// 这样各页面的确认手感完全一致，不会再出现「这个页面点 2 次、那个页面点 4 次」。
//
// 用法：
//   const cfm = useConfirmClick()
//   <button :style="cfm.styleOf(id)" :title="cfm.titleOf(id, '删除')" @click="onDelete">
//   function onDelete() { if (!cfm.trigger(id)) return; /* 真正执行 */ }
// ═══════════════════════════════════════════════════════════════════

import { ref } from 'vue'
import { playOvercharge } from '../utils/sound.js'

// 递进色：第 1 / 2 / 3 次点击后的边框与文字颜色
export const CONFIRM_COLORS = { 1: '#ff4444', 2: '#ff8800', 3: '#aa44ff' }
// 需要点击的总次数（含最后一次执行）
export const CONFIRM_TIMES = 4
// 中途停手多久自动复位（毫秒）
export const CONFIRM_RESET_MS = 3000

export function useConfirmClick() {
  // key → 已点击次数；key 由调用方给出（通常是记录 id，或 `动作:id`）
  const clicks = ref(new Map())
  const timers = new Map()

  function countOf(key) {
    return clicks.value.get(key) || 0
  }

  function styleOf(key) {
    const n = countOf(key)
    return (n >= 1 && n <= CONFIRM_TIMES - 1)
      ? { borderColor: CONFIRM_COLORS[n], color: CONFIRM_COLORS[n] }
      : {}
  }

  function titleOf(key, action) {
    const n = countOf(key)
    if (n === 1) return `再次点击${action}（2/${CONFIRM_TIMES}）`
    if (n === 2) return `再次点击${action}（3/${CONFIRM_TIMES}）`
    if (n === 3) return `最后一次点击${action}（4/${CONFIRM_TIMES}）`
    return `${action}（点 ${CONFIRM_TIMES} 次生效）`
  }

  function reset(key) {
    if (timers.has(key)) { clearTimeout(timers.get(key)); timers.delete(key) }
    const next = new Map(clicks.value)
    next.delete(key)
    clicks.value = next
  }

  function bump(key) {
    const next = new Map(clicks.value)
    next.set(key, countOf(key) + 1)
    clicks.value = next
    if (timers.has(key)) clearTimeout(timers.get(key))
    timers.set(key, setTimeout(() => reset(key), CONFIRM_RESET_MS))
  }

  /**
   * 记录一次点击。
   * 返回 true 表示「次数已满，可以真正执行」；返回 false 表示还没点够。
   *
   * 每次点击都会播放**逐层递进**的音效（第 1/2/3/4 次各不相同），
   * 与删除按钮完全一致 —— 所有接入本机制的按钮都会有同样的声音反馈。
   */
  function trigger(key) {
    const n = countOf(key)
    playOvercharge(n)
    if (n >= CONFIRM_TIMES - 1) {
      reset(key)
      return true
    }
    bump(key)
    return false
  }

  return { countOf, styleOf, titleOf, trigger, reset }
}

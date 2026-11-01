// ═══════════════════════════════════════════════════════════════════
// 页面入场动效（纯展示层）
//
// 所有页面共用同一套节奏：
//   · 挂载后把 `entered` 置真 → 根节点带 `.entered` 类触发 CSS 过渡；
//   · 列表项用 `staggerStyle(idx)` 做逐项延迟（0.24s 起，每项 0.023s 递进）；
//   · 排序 / 切换视图时用 `replay()` 重播。
//
// 之前每个页面各写一份（8 份），阈值改一次要改 8 处，因此收敛到这里。
// ═══════════════════════════════════════════════════════════════════

import { ref, onMounted } from 'vue'

export const ENTER_BASE_DELAY = 0.24
export const ENTER_STAGGER_STEP = 0.023

// node（测试）环境没有 requestAnimationFrame，回落到 setTimeout，避免调用即崩
const raf = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame
  : (cb) => setTimeout(cb, 0)

/** 列表项的第 idx 项延迟样式（idx 为负 / 非法值按 0 处理） */
export function staggerStyle(idx, { base = ENTER_BASE_DELAY, step = ENTER_STAGGER_STEP } = {}) {
  const i = Math.max(0, Number(idx) || 0)
  return { transitionDelay: `${base + i * step}s` }
}

/**
 * 页面入场状态。
 * 返回 { entered, replay, staggerStyle }：
 *   · entered —— 绑到根节点的 :class="{ entered }"
 *   · replay() —— 重播入场（先复位再置真，跨两帧保证过渡生效）
 *   · staggerStyle(idx) —— 列表逐项延迟
 */
export function usePageEnter() {
  const entered = ref(false)
  function replay() {
    entered.value = false
    raf(() => raf(() => { entered.value = true }))
  }
  onMounted(replay)
  return { entered, replay, staggerStyle }
}

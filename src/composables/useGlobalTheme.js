import { computed, ref, watch } from 'vue'
import { KEYS, readJSON, writeJSON } from '../data/storage.js'

/* ══════════════════════════════════════════════════════════════════
   全局主题

   四套**平级、独立**的完整主题：
     · lone-star-light  孤星 · 档案（暖白纸面 + 工业橙）
     · lone-star-dark   孤星 · 终端（深空蓝黑 + 工业橙）
     · p3r-light        P3R · 白昼（冷白 + 明蓝 + 明黄）
     · p3r-dark         P3R · 深夜（深海军蓝 + 明蓝 + 明黄）

   「深色」不是某个主题的显示模式，而是与其他主题完全平级的独立主题。
   主题标记 = 根节点上的 `theme-<id>` 类名（页面根 div 也挂同一个类，
   便于组件内 scoped 样式按主题分支）。
   ══════════════════════════════════════════════════════════════════ */

export const THEMES = [
  { id: 'lone-star-light', label: '孤星 · 档案', hint: '暖白纸面 / 工业橙' },
  { id: 'lone-star-dark', label: '孤星 · 终端', hint: '深空蓝黑 / 工业橙' },
  { id: 'p3r-light', label: 'P3R · 白昼', hint: '冷白 / 明蓝 / 明黄' },
  { id: 'p3r-dark', label: 'P3R · 深夜', hint: '深海军蓝 / 明蓝 / 明黄' },
]

export const THEME_IDS = THEMES.map(t => t.id)
export const DEFAULT_THEME_ID = 'lone-star-light'

// 旧版本只存 'dark' / 'light'，映射到对应的孤星主题，保证老用户的设置不丢
const LEGACY_IDS = { dark: 'lone-star-dark', light: 'lone-star-light' }

export function normalizeThemeId(value) {
  const raw = String(value == null ? '' : value).trim()
  if (LEGACY_IDS[raw]) return LEGACY_IDS[raw]
  if (THEME_IDS.includes(raw)) return raw
  return DEFAULT_THEME_ID
}

const themeId = ref(normalizeThemeId(readJSON(KEYS.THEME, null)))

// 根节点标记：只增删 `theme-*` 类，绝不整体覆盖 documentElement 上可能存在的其他 class
const THEME_CLASS = /^theme-/
function syncRootTheme() {
  const el = typeof document !== 'undefined' ? document.documentElement : null
  if (!el || !el.classList) return
  Array.from(el.classList).forEach(c => { if (THEME_CLASS.test(c)) el.classList.remove(c) })
  el.classList.add(`theme-${themeId.value}`)
  el.dataset.theme = themeId.value
}
syncRootTheme()

watch(themeId, (val) => {
  writeJSON(KEYS.THEME, val)
  syncRootTheme()
})

export function useGlobalTheme() {
  const setTheme = (id) => { themeId.value = normalizeThemeId(id) }
  // 侧栏按钮：按固定顺序循环切换四套主题
  const cycleTheme = () => {
    const i = THEME_IDS.indexOf(themeId.value)
    themeId.value = THEME_IDS[(i + 1) % THEME_IDS.length]
  }

  return {
    themeId,
    themes: THEMES,
    setTheme,
    cycleTheme,
    // 兼容旧调用点（侧栏按钮 / 图标切换 / 根 div 的类名）
    toggleTheme: cycleTheme,
    isDark: computed(() => themeId.value.endsWith('-dark')),
    themeClass: computed(() => `theme-${themeId.value}`),
  }
}

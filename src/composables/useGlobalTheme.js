import { computed, ref, watch } from 'vue'
import { KEYS, readJSON, writeJSON } from '../data/storage.js'

/* ══════════════════════════════════════════════════════════════════
   全局主题

   八套**平级、独立**的完整主题：
     · lone-star-light  孤星 · 档案（暖白纸面 + 工业橙）
     · lone-star-dark   孤星 · 终端（深空蓝黑 + 工业橙）
     · p3r-light        P3R · 白昼（冷白 + 明蓝 + 明黄）
     · p3r-dark         P3R · 深夜（深海军蓝 + 明蓝 + 明黄）
     · endfield-light   终末地 · 白皮书（纸白 + 墨 + lime，工业工作台）
     · endfield-dark    终末地 · 夜班（石墨黑 + 浅墨 + lime）
     · swiss-light      瑞士 · 纸面（国际主义：墨 / 米白 / 红，12 栏网格）
     · swiss-dark       瑞士 · 墨底（黑底米白 + 同一支红）

   「深色」不是某个主题的显示模式，而是与其他主题完全平级的独立主题。
   主题标记 = 根节点上的 `theme-<id>` 类名（页面根 div 也挂同一个类，
   便于组件内 scoped 样式按主题分支）。
   ══════════════════════════════════════════════════════════════════ */

export const THEMES = [
  { id: 'lone-star-light', label: '孤星 · 档案', hint: '暖白纸面 / 工业橙' },
  { id: 'lone-star-dark', label: '孤星 · 终端', hint: '深空蓝黑 / 工业橙' },
  { id: 'p3r-light', label: 'P3R · 白昼', hint: '冷白 / 明蓝 / 明黄' },
  { id: 'p3r-dark', label: 'P3R · 深夜', hint: '深海军蓝 / 明蓝 / 明黄' },
  { id: 'endfield-light', label: '终末地 · 白皮书', hint: '纸白 / 墨 / lime 强调' },
  { id: 'endfield-dark', label: '终末地 · 夜班', hint: '石墨黑 / lime 强调' },
  { id: 'swiss-light', label: '瑞士 · 纸面', hint: '国际主义 / 墨 / 米白 / 红' },
  { id: 'swiss-dark', label: '瑞士 · 墨底', hint: '国际主义 / 黑底米白 / 红' },
  { id: 'stijl-light', label: '风格派 · 米白', hint: '粗黑线切格 / 三原色平涂' },
  { id: 'stijl-dark', label: '风格派 · 反白', hint: '黑底米白 / 三原色平涂' },
]

export const THEME_IDS = THEMES.map(t => t.id)
export const DEFAULT_THEME_ID = 'lone-star-light'

/* ── 主题族：每族固定「浅色 + 深色」两套 ──
   浮层里先选族，再切明暗，不再把八套平铺出来。
   族的顺序与「设置」页一致。 */
export const THEME_FAMILIES = [
  { id: 'lone-star', label: '孤星', hint: '暖白纸面 / 工业橙', light: 'lone-star-light', dark: 'lone-star-dark' },
  { id: 'p3r', label: 'P3R', hint: '冷白与深海军蓝 / 明蓝 + 明黄', light: 'p3r-light', dark: 'p3r-dark' },
  { id: 'endfield', label: '终末地', hint: '纸白与石墨黑 / lime', light: 'endfield-light', dark: 'endfield-dark' },
  { id: 'swiss', label: '瑞士', hint: '米白与墨 / 国际主义红', light: 'swiss-light', dark: 'swiss-dark' },
  { id: 'stijl', label: '风格派', hint: '粗黑线切格 / 三原色平涂', light: 'stijl-light', dark: 'stijl-dark' },
]
export const FAMILY_IDS = THEME_FAMILIES.map(f => f.id)

/* 主题 id → 族（'p3r-dark' → 'p3r'）；未知值回落到默认主题的族 */
export function familyOfTheme(id) {
  const key = normalizeThemeId(id)
  const fam = THEME_FAMILIES.find(f => f.light === key || f.dark === key)
  return fam || THEME_FAMILIES[0]
}

/* 主题 id → 明暗（'swiss-dark' → 'dark'） */
export function modeOfTheme(id) {
  return normalizeThemeId(id).endsWith('-dark') ? 'dark' : 'light'
}

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
  // 侧栏按钮：按固定顺序循环切换（设置页 / 浮层之外的老入口仍然可用）
  const cycleTheme = () => {
    const i = THEME_IDS.indexOf(themeId.value)
    themeId.value = THEME_IDS[(i + 1) % THEME_IDS.length]
  }
  /* 浮层用的两个入口：
       setFamily 换族（保持当前明暗）
       setMode   换明暗（保持当前族） */
  const setFamily = (familyId) => {
    const fam = THEME_FAMILIES.find(f => f.id === familyId)
    if (!fam) return
    themeId.value = modeOfTheme(themeId.value) === 'dark' ? fam.dark : fam.light
  }
  const setMode = (mode) => {
    const fam = familyOfTheme(themeId.value)
    themeId.value = mode === 'dark' ? fam.dark : fam.light
  }

  return {
    themeId,
    themes: THEMES,
    families: THEME_FAMILIES,
    familyId: computed(() => familyOfTheme(themeId.value).id),
    themeMode: computed(() => modeOfTheme(themeId.value)),
    setTheme,
    setFamily,
    setMode,
    cycleTheme,
    // 兼容旧调用点（侧栏按钮 / 图标切换 / 根 div 的类名）
    toggleTheme: cycleTheme,
    isDark: computed(() => themeId.value.endsWith('-dark')),
    themeClass: computed(() => `theme-${themeId.value}`),
  }
}

import { computed, ref, watch } from 'vue'
import { KEYS, readJSON, writeJSON } from '@/data/storage.js'

const isDark = ref(false)

const saved = readJSON(KEYS.THEME, null)
if (saved) {
  isDark.value = saved === 'dark'
}

function syncTheme() {
  document.documentElement.className = isDark.value ? 'theme-dark' : ''
}
syncTheme()

watch(isDark, (val) => {
  writeJSON(KEYS.THEME, val ? 'dark' : 'light')
  syncTheme()
})

export function useGlobalTheme() {
  const toggleTheme = () => {
    isDark.value = !isDark.value
  }

  return {
    isDark,
    toggleTheme,
    themeClass: computed(() => isDark.value ? 'theme-dark' : 'theme-white')
  }
}

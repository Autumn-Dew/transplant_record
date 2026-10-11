import { computed, ref, watch } from 'vue'
import { K_THEME } from '@/constants/storage-keys'

const isDark = ref(false)

const saved = localStorage.getItem(K_THEME)
if (saved) {
  isDark.value = saved === 'dark'
}

function syncTheme() {
  document.documentElement.className = isDark.value ? 'theme-dark' : ''
}
syncTheme()

watch(isDark, (val) => {
  localStorage.setItem(K_THEME, val ? 'dark' : 'light')
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

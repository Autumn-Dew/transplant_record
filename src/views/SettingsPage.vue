<template>
  <div class="local-music" :class="{ entered: entered }">
    <div class="local-header">
      <div>
        <h2>设置</h2>
        <p class="desc">应用偏好与开机自启</p>
      </div>
    </div>

    <div class="settings-body">
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">开机自启</span>
          <span class="setting-hint">系统启动时自动运行代肝记录</span>
        </div>
        <button
          class="tl-entry-btn"
          :class="{ active: autoLaunch }"
          @click="toggleAutoLaunch"
        >
          {{ autoLaunch ? '已开启' : '已关闭' }}
        </button>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">关闭行为</span>
          <span class="setting-hint">点击 × 最小化到系统托盘，通过托盘菜单真正退出</span>
        </div>
        <span class="setting-static">最小化到托盘</span>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">数据存储</span>
          <span class="setting-hint">数据自动保存到本地，不会上传到任何服务器</span>
        </div>
        <span class="setting-static">本地存储</span>
      </div>

      <div class="setting-divider"></div>

      <button class="quit-btn" @click="handleClearData" :style="clearStyle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M10 11v6M14 11v6M5 6h14v14a2 2 0 012 2H7a2 2 0 01-2-2V6z"/></svg>
        <span>{{ clearLabel }}</span>
      </button>

      <div class="setting-divider"></div>

      <button class="quit-btn" @click="quitApp">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        <span>退出程序</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useConfirmClick } from '@/composables/useConfirmClick.js'

const entered = ref(false)
onMounted(() => { requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true })) })

const autoLaunch = ref(false)

onMounted(async () => {
  try {
    autoLaunch.value = await window.electron?.getAutoLaunch?.() || false
  } catch {}
})

async function toggleAutoLaunch() {
  autoLaunch.value = !autoLaunch.value
  try {
    await window.electron?.setAutoLaunch?.(autoLaunch.value)
  } catch {
    autoLaunch.value = !autoLaunch.value
  }
}

// 清除数据（多次点击保护，机制见 composables/useConfirmClick）
const clearCfm = useConfirmClick()
const clearStyle = computed(() => clearCfm.styleOf('clear-data'))
const clearLabel = computed(() => clearCfm.titleOf('clear-data', '清除'))
function handleClearData() {
  if (!clearCfm.trigger('clear-data')) return
  // 清除所有 tr- 开头的 localStorage 键
  Object.keys(localStorage).filter(k => k.startsWith('tr-')).forEach(k => localStorage.removeItem(k))
  // 也清除 Electron 持久化文件
  window.electron?.saveRecords?.([])
  window.electron?.saveBlueprints?.([])
  window.electron?.saveWorkDiary?.([])
  window.electron?.saveCompletions?.([])
  window.electron?.saveGames?.([])
  location.reload()
}

function quitApp() {
  window.electron?.appQuit?.()
}
</script>

<style scoped>
/* SettingsPage 所有样式均已提取到 page-common.css，此处无额外独有样式 */
</style>

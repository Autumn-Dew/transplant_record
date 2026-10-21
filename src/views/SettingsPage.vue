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
          <span class="setting-label">界面主题</span>
          <span class="setting-hint">八套主题平级独立，选择后立即生效并记住你的选择</span>
        </div>
        <div class="theme-picker">
          <button
            v-for="t in themes"
            :key="t.id"
            class="tl-entry-btn"
            :class="{ active: themeId === t.id }"
            :title="t.hint"
            @click="setTheme(t.id)"
          >{{ t.label }}</button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">数据存储</span>
          <span class="setting-hint">数据自动保存到本地，不会上传到任何服务器</span>
        </div>
        <span class="setting-static">本地存储</span>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">备份数据</span>
          <span class="setting-hint">把全部本地数据导出成一个 JSON 文件（代办 / 记录 / 蓝图 / 价格 / 游戏目录）</span>
        </div>
        <button class="tl-entry-btn" @click="backupAll">备份全部数据</button>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">加载备份</span>
          <span class="setting-hint">从备份 JSON 还原全部数据（会覆盖当前数据，需连点 4 次确认）</span>
        </div>
        <button class="tl-entry-btn" :style="restoreStyle" :title="restoreLabel" @click="pickRestore">{{ restoreLabel }}</button>
        <input ref="restoreInput" type="file" accept="application/json,.json" hidden @change="onRestoreFile" />
      </div>

      <!-- 个人标签：署名 / 水印统一用这个 -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">个人标签</span>
          <span class="setting-hint">价格表画布右下的署名用它，随导出图一起带出</span>
        </div>
        <span class="setting-sign">
          <span class="setting-sign-mark"></span>
          <span class="setting-sign-name">{{ SIGNATURE }}</span>
        </span>
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
import { useGlobalTheme } from '@/composables/useGlobalTheme.js'

// 主题选择：十套主题平级，一个入口切换（与侧栏按钮同一份状态）
const { themeId, themes, setTheme } = useGlobalTheme()

// 个人标签：署名 / 水印统一用这个
const SIGNATURE = '秋の露'

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

// 备份全部数据：把本地所有 tr- 键（不含迁移备份）导出成一个 JSON 文件。
// 还原方式见文件内的 note：按 keys 里的键名逐条写回 localStorage 即可（键名未变，可直接用）。
function backupAll() {
  const keys = {}
  Object.keys(localStorage)
    .filter(k => k.startsWith('tr-') && !k.startsWith('tr-backup-'))
    .forEach(k => { keys[k] = localStorage.getItem(k) })
  const payload = {
    app: '代肝记录',
    version: '1.0.5',
    exportedAt: new Date().toISOString(),
    note: '还原：把 keys 里每一项按原键名写回 localStorage 即可（键名与结构均未改动）',
    keys,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `代肝记录备份_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 从备份恢复：选一个备份 JSON，把 keys 逐条写回 localStorage（键名与结构都没变，可直接用）。
// 属于危险操作 —— 走 4 次点击确认，并且会覆盖当前数据。
const restoreCfm = useConfirmClick()
const restoreInput = ref(null)
const restoreStyle = computed(() => restoreCfm.styleOf('restore'))
const restoreLabel = computed(() => {
  const n = restoreCfm.countOf('restore') || 0
  return n === 0 ? '从备份恢复' : `再点 ${4 - n} 次确认`
})
function pickRestore() {
  if (!restoreCfm.trigger('restore')) return
  restoreInput.value?.click()
}
async function onRestoreFile(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const payload = JSON.parse(await file.text())
    const keys = payload && payload.keys
    if (!keys || typeof keys !== 'object') {
      alert('这不是有效的备份文件（缺少 keys）')
      return
    }
    const writable = Object.entries(keys).filter(([k]) => String(k).startsWith('tr-'))
    writable.forEach(([k, v]) => {
      if (v == null) localStorage.removeItem(k)
      else localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
    })
    // 同步 Electron 侧的文件（否则下次启动会被旧文件覆盖）
    const parse = k => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
    if (keys['tr-accounts']) window.electron?.saveRecords?.(parse('tr-accounts'))
    if (keys['tr-blueprints']) window.electron?.saveBlueprints?.(parse('tr-blueprints'))
    if (keys['tr-workdiary']) window.electron?.saveWorkDiary?.(parse('tr-workdiary'))
    if (keys['tr-completions']) window.electron?.saveCompletions?.(parse('tr-completions'))
    if (keys['tr-games']) window.electron?.saveGames?.(parse('tr-games'))
    alert(`已恢复 ${writable.length} 项数据，即将刷新`)
    location.reload()
  } catch (err) {
    alert(`恢复失败：${err && err.message ? err.message : err}`)
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

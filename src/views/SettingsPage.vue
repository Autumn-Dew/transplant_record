<template>
  <div class="local-music settings-page" :class="{ entered: entered }">
    <div class="local-header">
      <div>
        <h2>设置</h2>
        <p class="desc">应用偏好与开机自启</p>
      </div>
    </div>

    <div class="settings-body">
      <div class="settings-columns">
        <!-- 左栏：使用偏好 + 危险操作 -->
        <section class="settings-col">
          <div class="settings-group-title">使用偏好</div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">开机自启</span>
              <span class="setting-hint">系统启动时自动运行；点击 × 会最小化到托盘，从托盘菜单退出</span>
            </div>
            <button
              class="tl-entry-btn"
              :class="{ active: autoLaunch }"
              @click="toggleAutoLaunch"
            >
              {{ autoLaunch ? '已开启' : '已关闭' }}
            </button>
          </div>

          <!-- 日报「复制文字」按钮：默认隐藏，需要时打开 -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">日报「复制文字」按钮</span>
              <span class="setting-hint">在每日汇报工具栏显示「复制文字」，一键把当天日报拼成纯文本</span>
            </div>
            <button
              class="tl-entry-btn"
              :class="{ active: copyTextOn }"
              @click="toggleCopyText"
            >
              {{ copyTextOn ? '已开启' : '已关闭' }}
            </button>
          </div>

          <!-- 每日刷新时间：托管的「今天」跨过这个时间点才翻页（默认 00:00） -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">每日刷新时间</span>
              <span class="setting-hint">每天以这个时间翻页：日报天数 +1、托管任务重新出现、「今日已确认」失效</span>
            </div>
            <span class="setting-time">
              <input
                class="setting-time-input"
                type="time"
                step="60"
                aria-label="每日刷新时间"
                v-model="resetTimeValue"
                @change="saveResetTime"
              />
              <span class="setting-time-presets">
                <button
                  class="tl-entry-btn"
                  :class="{ active: resetTimeValue === '00:00' }"
                  @click="usePresetResetTime('00:00')"
                >零点</button>
                <button
                  class="tl-entry-btn"
                  :class="{ active: resetTimeValue === '04:00' }"
                  @click="usePresetResetTime('04:00')"
                >四点</button>
              </span>
            </span>
          </div>

          <!-- 界面音效总开关：点击 / 悬停 / 递增确认都受它控制 -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">界面音效</span>
              <span class="setting-hint">点击与鼠标悬停时的提示音；关闭后完全静音</span>
            </div>
            <button class="tl-entry-btn" :class="{ active: soundOn }" @click="toggleSound">{{ soundOn ? '已开启' : '已关闭' }}</button>
          </div>

          <!-- 关于：点按钮打开弹窗（版本号在按钮上就能看到，弹窗里是完整的应用与个人信息） -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">关于</span>
              <span class="setting-hint">应用版本与个人基础信息</span>
            </div>
            <button class="tl-entry-btn" @click="openAbout">
              关于本应用 · v{{ appVersion }}
            </button>
          </div>

          <!-- 危险操作：描边区块 + 两个按钮并排 -->
          <section class="settings-danger">
            <div class="settings-group-title">危险操作</div>
            <div class="settings-danger-actions">
              <button class="quit-btn" @click="handleClearData" :style="clearStyle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M10 11v6M14 11v6M5 6h14v14a2 2 0 012 2H7a2 2 0 01-2-2V6z"/></svg>
                <span>{{ clearLabel }}</span>
              </button>
              <button class="quit-btn" @click="quitApp">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                <span>退出程序</span>
              </button>
            </div>
          </section>
        </section>

        <!-- 右栏：外观 + 数据 -->
        <section class="settings-col">
          <div class="settings-group-title">外观</div>

          <div class="setting-row setting-row-themes">
            <div class="setting-info">
              <span class="setting-label">界面主题</span>
              <span class="setting-hint">{{ families.length }} 套方案 · 浅色 / 深色由侧栏的主题按钮切换</span>
            </div>
            <div class="theme-picker" role="group" aria-label="界面主题">
              <button
                v-for="f in families"
                :key="f.id"
                type="button"
                class="theme-preview-option"
                :class="{ active: familyId === f.id }"
                :aria-pressed="familyId === f.id"
                :title="f.hint"
                @click="setFamily(f.id)"
              >
                <span class="theme-preview" :class="`theme-${themeMode === 'dark' ? f.dark : f.light}`" aria-hidden="true">
                  <span class="theme-preview-rail"><i></i><i></i><i></i></span>
                  <span class="theme-preview-sheet">
                    <span class="theme-preview-top"><b>工作终端</b><i></i></span>
                    <span class="theme-preview-number">08<span> / 12</span></span>
                    <span class="theme-preview-line"></span>
                    <span class="theme-preview-line short"></span>
                  </span>
                </span>
                <span class="theme-preview-caption">
                  <span>{{ f.label }}</span>
                  <span class="theme-preview-check" aria-hidden="true">{{ familyId === f.id ? '✓' : '' }}</span>
                </span>
                <span class="theme-preview-hint">{{ f.hint }}</span>
              </button>
            </div>
          </div>

          <div class="settings-group-title settings-group-title-spaced">数据</div>

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
        </section>
      </div>
    </div>

    <!-- 关于弹窗：与项目详情 / 汇报外观同款「右侧抽屉」（Esc / 点遮罩 / 关闭按钮都能关） -->
    <div class="modal-mask" v-if="aboutOpen" @click.self="closeAbout">
      <div class="edit-popup about-popup" role="dialog" aria-modal="true" aria-label="关于">
        <h4>关于</h4>

        <!-- 先讲「这是什么、什么版本」，再讲人与数据（原来的作者卡占据顶部，主次是反的） -->
        <div class="about-hero">
          <img class="about-avatar" :src="avatarUrl" :alt="SIGNATURE" />
          <div class="about-hero-text">
            <span class="about-name">
              {{ APP_NAME_CN }}
              <span class="about-version mono">v{{ appVersion }}</span>
            </span>
            <span class="about-latin mono">{{ APP_NAME }}</span>
          </div>
        </div>

        <div class="detail-grid about-grid">
          <p class="detail-section">应用</p>
          <div class="detail-field"><span class="dl">版本</span><span class="dv mono">{{ appVersion }}</span></div>
          <div class="detail-field" v-if="runtimeLabel"><span class="dl">运行环境</span><span class="dv mono">{{ runtimeLabel }}</span></div>
          <div class="detail-field about-span"><span class="dl">简介</span><span class="dv">{{ APP_TAGLINE }}</span></div>

          <p class="detail-section">数据</p>
          <div class="detail-field about-span">
            <span class="dl">存放</span>
            <span class="dv">全部数据保存在本机应用数据目录，不上传任何服务器</span>
          </div>
          <div class="detail-field about-span">
            <span class="dl">备份</span>
            <span class="dv">设置页「数据」里的备份 / 恢复会导出一个 JSON 文件，可直接存档</span>
          </div>

          <p class="detail-section">作者</p>
          <div class="detail-field">
            <span class="dl">作者</span>
            <span class="dv">{{ APP_AUTHOR }} · {{ SIGNATURE }}</span>
          </div>
          <div class="detail-field">
            <span class="dl">B 站</span>
            <span class="dv about-repo">
              <span class="about-repo-url">{{ APP_BILI_URL }}</span>
              <button class="tl-entry-btn" @click="copyTo(APP_BILI_URL, 'bili')" aria-live="polite">{{ copiedKey === 'bili' ? '已复制' : '复制' }}</button>
            </span>
          </div>
          <div class="detail-field about-span">
            <span class="dl">仓库</span>
            <span class="dv about-repo">
              <span class="about-repo-url">{{ APP_REPO_LABEL }}</span>
              <button class="tl-entry-btn" @click="copyTo(APP_REPO, 'repo')" aria-live="polite">{{ copiedKey === 'repo' ? '已复制' : '复制' }}</button>
            </span>
          </div>
          <div class="detail-field about-span">
            <span class="dl">签名</span>
            <span class="dv about-sign-inline">{{ APP_BILI_SIGN }}</span>
          </div>
        </div>

        <p class="about-foot">{{ APP_COPYRIGHT }}</p>

        <div class="edit-actions" style="margin-top:16px">
          <button class="cancel-btn" @click="closeAbout">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useConfirmClick, CONFIRM_TIMES } from '@/composables/useConfirmClick.js'
import { useGlobalTheme } from '@/composables/useGlobalTheme.js'
import { resetTime as readResetTime, writeResetTime } from '@/utils/date.js'
import { isSoundEnabled, setSoundEnabled } from '@/utils/sound.js'
import { downloadSnapshot, restoreSnapshot, clearAllData } from '@/services/backupService.js'
import { usePageEnter } from '@/composables/usePageEnter.js'
import { readCopyTextEnabled, writeCopyTextEnabled } from '@/data/report-copy-btn.js'

// 日报「复制文字」按钮开关（默认关闭，打开后日报工具栏才显示该按钮）
const copyTextOn = ref(readCopyTextEnabled())
function toggleCopyText() {
  copyTextOn.value = writeCopyTextEnabled(!copyTextOn.value)
}
import { copyText } from '@/utils/clipboard.js'
import {
  APP_NAME_CN, APP_NAME, APP_AUTHOR, APP_TAGLINE, APP_REPO, APP_REPO_LABEL, APP_COPYRIGHT,
  APP_BILI_URL, APP_BILI_SIGN, APP_AVATAR, APP_SIGN,
} from '@/data/app-info.js'
import pkg from '../../package.json'

// 版本号只有一个来源：package.json（发版时改一处，界面与备份文件同步）
const appVersion = pkg.version

// 运行环境：不额外加 IPC 通道，直接从 UA 里取 Electron / Chromium 主版本
// （打包后形如 ... Electron/35.0.0 Chrome/134.0.6998.178 ...；dev 下没有 Electron 段，返回空串则不显示该行）
const runtimeLabel = computed(() => {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  const electron = (ua.match(/Electron\/([\d.]+)/) || [])[1]
  const chrome = (ua.match(/Chrome\/([\d.]+)/) || [])[1]
  const parts = []
  if (electron) parts.push(`Electron ${electron}`)
  if (chrome) parts.push(`Chromium ${chrome.split('.')[0]}`)
  return parts.join(' · ')
})

// 头像在 public/ 里，用 BASE_URL 拼接：dev=「/」，打包(file://)=「./」，两种都能取到
const avatarUrl = ((import.meta.env && import.meta.env.BASE_URL) || './') + APP_AVATAR

// ══════ 关于弹窗 ══════
const aboutOpen = ref(false)
function openAbout() { aboutOpen.value = true }
function closeAbout() { aboutOpen.value = false }
function onAboutKeydown(e) { if (e.key === 'Escape' && aboutOpen.value) closeAbout() }
onMounted(() => window.addEventListener('keydown', onAboutKeydown))
onUnmounted(() => window.removeEventListener('keydown', onAboutKeydown))

// 复制地址（B 站空间 / 仓库）：Electron 没有 openExternal 通道，做成复制更实际。
// 复制实现（含 file:// 下的 execCommand 回退）统一在 utils/clipboard.js。
const copiedKey = ref('')
let copyTimer = null
async function copyTo(text, key) {
  if (!(await copyText(text))) return
  copiedKey.value = key
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copiedKey.value = '' }, 1600)
}

// 主题选择：六套主题平级，一个入口切换（与侧栏按钮同一份状态）
// 设置页只选「配色方案」（族）；浅色 / 深色由侧栏的主题按钮切换，
// 所以这里不再暴露浅暗、也不在卡片上标浅 / 暗 —— 预览色板跟随当前明暗。
const { families, familyId, themeMode, setFamily } = useGlobalTheme()

// 每日刷新时间：托管 / 日报的「今天」跨过这个点才翻页（默认 00:00）
const resetTimeValue = ref(readResetTime())
// 直接取事件里的值：某些输入方式只会派发 change（v-model 尚未同步），这样不会存到旧值
function saveResetTime(e) {
  const next = (e && e.target && e.target.value) || resetTimeValue.value
  resetTimeValue.value = writeResetTime(next)
}
function usePresetResetTime(v) {
  resetTimeValue.value = writeResetTime(v)
}

// 界面音效总开关（点击 / 悬停 / 递增确认共用）
const soundOn = ref(isSoundEnabled())
function toggleSound() {
  soundOn.value = setSoundEnabled(!soundOn.value)
}

// 个人标签：署名 / 水印统一用 data/app-info.js 的 APP_SIGN（价格表与日报都引用它）
const SIGNATURE = APP_SIGN

// 入场动画（统一节奏见 composables/usePageEnter）
const { entered } = usePageEnter()

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
// 键的整体遍历与「写回」规则都在 services/backupService.js，页面只负责触发。
function backupAll() {
  downloadSnapshot({ appName: APP_NAME_CN, version: appVersion })
}

// 从备份恢复：选一个备份 JSON，把 keys 逐条写回（含 Electron 文件与内存单例同步）。
// 属于危险操作 —— 走 4 次点击确认，并且会覆盖当前数据。
const restoreCfm = useConfirmClick()
const restoreInput = ref(null)
const restoreStyle = computed(() => restoreCfm.styleOf('restore'))
const restoreLabel = computed(() => {
  const n = restoreCfm.countOf('restore') || 0
  return n === 0 ? '从备份恢复' : `再点 ${CONFIRM_TIMES - n} 次确认`
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
    const result = restoreSnapshot(await file.text())
    if (!result.ok) {
      const reason = result.reason === 'invalid-json' ? '文件不是合法 JSON'
        : result.reason === 'empty-backup' ? '备份文件里没有可恢复的数据'
          : '这不是有效的备份文件（缺少 keys）'
      alert(`恢复失败：${reason}`)
      return
    }
    alert(`已恢复 ${result.restored} 项数据`)
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
  // 清除 localStorage 的 tr- 键 + Electron 六个数据文件，并把内存单例刷新回默认值
  clearAllData()
  alert('已清除本机全部数据')
}

function quitApp() {
  window.electron?.appQuit?.()
}
</script>

<style scoped>
.settings-page .settings-body { max-width: 1200px; margin: 0 auto; padding: 24px; }
.settings-page .setting-row { gap: 24px; padding: 20px 0; border-bottom-color: var(--rule-soft); }
.settings-page .setting-info { gap: 6px; min-width: 0; flex: 1 1 auto; }
.settings-page .setting-label { font-size: 14px; }
html[data-theme] .settings-page .setting-hint,
html[data-theme] .settings-page .setting-static { font-size: 12px; line-height: 1.6; color: var(--text-primary); opacity: .8; }
.settings-page .setting-row-themes { align-items: stretch; flex-direction: column; gap: 16px; }
.settings-page .theme-picker { display: grid; width: 100%; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.theme-preview-option {
  min-width: 0; padding: 8px; text-align: left; cursor: pointer;
  background: var(--surface-raised); color: var(--text-primary);
  border: 1px solid var(--rule-strong); font: inherit;
}
.theme-preview-option.active { border-color: var(--text-primary); box-shadow: inset 0 -3px var(--text-primary); }
.theme-preview-option:hover { background: var(--surface-sunken); }
.theme-preview { display: flex; height: 102px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--rule-soft); }
.theme-preview-rail { width: 23px; flex-shrink: 0; background: var(--bg-sidebar); display: flex; flex-direction: column; align-items: center; gap: 9px; padding-top: 12px; }
.theme-preview-rail i { width: 8px; height: 8px; border: 1px solid var(--sb-fg); }
.theme-preview-rail i:first-child { background: var(--accent); border-color: var(--accent); }
.theme-preview-sheet { flex: 1; padding: 10px; min-width: 0; }
.theme-preview-top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.theme-preview-top b { font-size: 10px; white-space: nowrap; }
.theme-preview-top i { width: 14px; height: 5px; background: var(--accent); }
.theme-preview-number { display: block; font: 800 25px/1.4 var(--font-mono); font-variant-numeric: tabular-nums; }
.theme-preview-number span { font-size: 10px; }
.theme-preview-line { display: block; height: 3px; margin-top: 5px; background: var(--text-primary); opacity: .3; }
.theme-preview-line.short { width: 65%; }
.theme-preview-caption { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-top: 10px; font-size: 12px; font-weight: 800; }
.theme-preview-check { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0; }
.active .theme-preview-check { background: var(--text-primary); color: var(--bg-primary); }
.theme-preview-hint { display: block; margin: 5px 0 7px; font-size: 12px; line-height: 1.5; opacity: .8; }
/* ── 两栏布局：左「使用偏好」、右「外观 / 数据」，窄窗口回落单栏 ── */
.settings-page .settings-columns {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 28px;
  align-items: start;
}
.settings-page .settings-col { min-width: 0; }
.settings-page .settings-group-title {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 2px;
  opacity: .5;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--border-color);
}
.settings-page .settings-group-title-spaced { margin-top: 20px; }
/* 每组最后一行不画底边，交给分组标题的粗线分隔 */
.settings-page .settings-col > .setting-row:last-child { border-bottom: none; }

/* ── 危险操作：描边区块 + 两个按钮并排 ── */
.settings-page .settings-danger {
  margin-top: 24px;
  padding: 10px 12px 12px;
  border: 2px solid var(--border-color);
  background: var(--surface-sunken, transparent);
}
.settings-page .settings-danger .settings-group-title {
  color: #a84238;
  border-bottom-color: #a84238;
  opacity: .9;
}
.settings-page .settings-danger-actions { display: flex; gap: 10px; margin-top: 10px; }
.settings-page .settings-danger-actions .quit-btn { flex: 1 1 0; width: auto; }

@media (max-width: 1000px) {
  .settings-page .settings-columns { grid-template-columns: minmax(0, 1fr); gap: 20px; }
}

/* 每日刷新时间：等宽数字的时间输入 + 两个常用预置（深色主题的控件配色由 html 的 color-scheme 接管） */
/* 时间输入 + 两个预设：输入在上、预设在下一行；输入框宽度跟随两个按钮的总宽（含间距） */
.settings-page .setting-time {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  flex: 0 0 auto;
}
.settings-page .setting-time-presets { display: inline-flex; align-items: center; gap: 8px; }
.settings-page .setting-time .setting-time-input { width: 100%; min-width: 0; }
/* 设置页的行内按钮：三个主题给同一套盒模型（终末地右侧 padding 20px、瑞士 1px 边框，
   于是同样的「零点」宽出 10px）。尺寸统一后短标签还有一个共同的最小宽度。 */
.settings-page .setting-row .tl-entry-btn {
  min-width: 64px;
  height: 32px;
  padding: 0 12px;
  letter-spacing: 0.24px;
  border-width: 2px;
}
.settings-page .setting-time-input {
  width: 108px; padding: 6px 10px;
  font: 800 14px/1.2 var(--font-mono); font-variant-numeric: tabular-nums;
  color: var(--text-primary); background: var(--surface-raised);
  border: 1px solid var(--rule-strong);
}
.settings-page .setting-time-input::-webkit-calendar-picker-indicator { opacity: .7; cursor: pointer; }

/* ── 关于弹窗：与「项目详情 / 汇报外观」同一套右侧抽屉，这里只补头像与信息排版 ── */
/* ── 信息区：单列，每条信息独立一行（两列并排会让人先读左边再跳回右边） ── */
.about-popup { max-height: 84vh; }
.about-popup .about-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px 0;
}
.about-popup .about-grid .detail-section { grid-column: 1 / -1; }
.about-popup .about-grid .about-span { grid-column: 1 / -1; }
.about-popup .about-grid .detail-field { min-width: 0; }
.about-popup .about-grid .dv { min-width: 0; word-break: break-word; }

.about-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 2px 0 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border-color);
}
.about-avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  object-fit: cover;
  border: 2px solid var(--border-color);
  background: var(--surface-raised);
}
.about-hero-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
/* 应用名 + 版本徽标：名字大而重，徽标等宽反底 —— 与作者行的 LV 徽标同一套语言 */
.about-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: .5px;
}
.about-version {
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--bg-primary);
  background: var(--text-primary);
}
/* 拉丁名与简介都是辅助信息：等宽 + 一点正字距，和中文分开，不与标题抢层级 */
.about-latin {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: .14em;
  text-transform: uppercase;
  opacity: .62;
}
.about-sign-inline { font-size: 12px; line-height: 1.7; opacity: .8; }
.about-repo { display: inline-flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.about-repo-url {
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.about-foot {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--rule-soft, var(--border-color));
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
  opacity: .55;
}
@media (max-width: 1000px) {
  .settings-page .theme-picker { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; grid-auto-flow: row; }
}
@media (max-width: 540px) {
  .settings-page .settings-body { padding: 16px; }
  .settings-page .setting-row { align-items: flex-start; flex-direction: column; gap: 12px; }
}
@media (forced-colors: active) {
  .theme-preview-option.active { outline: 2px solid Highlight; }
}
</style>

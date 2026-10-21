<template>
  <div class="rc-main-container" :class="[themeClass]">
    <!-- 标题栏 -->
    <div class="rc-title-bar">
      <h2>代肝工作终端 · TRANSPLANT RECORD</h2>
      <div class="rc-window-controls">
        <button class="rc-window-btn rc-btn-minimize" @click="minimize" title="最小化">─</button>
        <button class="rc-window-btn rc-btn-maximize" @click="maximize" :title="isMaximized ? '还原' : '最大化'">{{ isMaximized ? '❐' : '□' }}</button>
        <button class="rc-window-btn rc-btn-close" @click="closeWindow" title="关闭">×</button>
      </div>
    </div>

    <!-- 主体：侧边栏 + 内容 -->
    <div class="rc-player-container">
      <!-- 左侧窄侧边栏 -->
      <div class="rc-sub-sidebar">
        <div class="rc-sub-func-group">
          <!-- 导航选中转换：工业橙标识条滑到当前页 -->
          <span class="mv-nav-indicator" :style="navIndicatorStyle"></span>
          <button
            v-for="item in navItems"
            :key="item.key"
            class="rc-sub-func-btn"
            :class="{ active: activeTab === item.key }"
            @click="activeTab = item.key"
            :title="item.label"
          >
            <svg class="rc-sub-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path :d="item.iconPath" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <div class="rc-sub-bottom-group">
          <div class="rc-sub-divider-wrapper">
            <div class="rc-sub-divider"></div>
          </div>
          <button
            class="rc-sub-func-btn rc-theme-trigger"
            @click="toggleThemeMenu"
            @mouseenter="openThemeMenu"
            @mouseleave="scheduleCloseThemeMenu"
            @focus="openThemeMenu"
            @blur="scheduleCloseThemeMenu"
            :aria-expanded="themeMenuOpen"
            aria-haspopup="true"
            title="切换主题"
          >
            <svg class="rc-sub-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path :d="themeIcon" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="rc-sub-func-btn" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'" title="设置">
            <svg class="rc-sub-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke-width="2"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 右侧内容区：按页面语义使用不同转场语法 -->
      <div class="rc-player-content">
        <Transition :name="pageTransition">
          <component :is="currentPage" v-if="activeTab !== 'report'" :key="activeTab" />
          <div v-else key="report-slot" class="rc-report-slot"></div>
        </Transition>
        <!-- 每日汇报常驻渲染（v-show）：切换到其他页面不重建，保留多页内容 -->
        <ReportPage v-show="activeTab === 'report'" />
      </div>
    </div>

    <!-- 主题快捷切换浮层：悬停 / 聚焦侧栏主题按钮时列出全部主题（只做定位，不参与布局） -->
    <div
      v-if="themeMenuOpen"
      ref="themeMenuRef"
      class="rc-theme-menu"
      :style="themeMenuStyle"
      role="menu"
      aria-label="界面主题"
      @mouseenter="cancelCloseThemeMenu"
      @mouseleave="scheduleCloseThemeMenu"
    >
      <div class="rc-theme-menu-head">
        <span class="rc-theme-menu-title">界面主题</span>
        <span class="rc-theme-menu-count">{{ families.length }} 族</span>
      </div>
      <!-- ① 选族：每族一行（色板取该族当前的明暗版本） -->
      <button
        v-for="f in families"
        :key="f.id"
        class="rc-theme-item"
        :class="{ active: familyId === f.id }"
        role="menuitemradio"
        :aria-checked="familyId === f.id"
        :title="f.hint"
        @click="setFamily(f.id)"
      >
        <span class="rc-theme-swatch" :class="`theme-${themeMode === 'dark' ? f.dark : f.light}`"></span>
        <span class="rc-theme-item-text">
          <span class="rc-theme-item-label">{{ f.label }}</span>
          <span class="rc-theme-item-hint">{{ f.hint }}</span>
        </span>
      </button>
      <!-- ② 切明暗：只管当前这一族的浅色 / 深色 -->
      <div class="rc-theme-menu-head rc-theme-menu-head-sub">
        <span class="rc-theme-menu-title">明暗</span>
        <span class="rc-theme-menu-count">{{ families.find(f => f.id === familyId)?.label }}</span>
      </div>
      <span class="rc-theme-modes">
        <button
          class="rc-theme-mode"
          :class="{ active: themeMode === 'light' }"
          :aria-pressed="themeMode === 'light'"
          @click="setMode('light')"
        >浅色</button>
        <button
          class="rc-theme-mode"
          :class="{ active: themeMode === 'dark' }"
          :aria-pressed="themeMode === 'dark'"
          @click="setMode('dark')"
        >深色</button>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, provide, nextTick } from 'vue'
import { useGlobalTheme } from '@/composables/useGlobalTheme'
import { playClick } from '@/utils/sound'
import AccountPage from '@/views/AccountPage.vue'
import BlueprintPage from '@/views/BlueprintPage.vue'
import WorkDiary from '@/views/WorkDiary.vue'
import AddPage from '@/views/AddPage.vue'
import PricePage from '@/views/PricePage.vue'
import ReportPage from '@/views/ReportPage.vue'
import AdminPage from '@/views/AdminPage.vue'
import SettingsPage from '@/views/SettingsPage.vue'

const { themeClass, isDark, families, familyId, themeMode, setFamily, setMode } = useGlobalTheme()

// ── 主题切换浮层 ──
// 点击侧栏的主题按钮才打开（不再「点一下就循环切一套」）；悬停仍可直接预览打开。
// 浮层里先选「族」，再切「暗/浅」—— 八套主题不再平铺出来。
// 浮层只做 position: fixed 定位，不参与任何布局，所以不会改变控件大小与页面结构。
const themeMenuOpen = ref(false)
const themeMenuStyle = ref({})
const themeMenuRef = ref(null)
const themeMenuPinned = ref(false)   // true = 点击打开，鼠标移开也不关
let themeMenuTimer = null
async function openThemeMenu(e) {
  cancelCloseThemeMenu()
  const el = e && (e.currentTarget || e.target)
  const rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null
  if (rect) {
    themeMenuStyle.value = {
      left: Math.round(rect.right + 12) + 'px',
      top: Math.max(8, Math.round(rect.top - 8)) + 'px',
    }
  }
  themeMenuOpen.value = true
  // 渲染后量一次实际高度：底部不能溢出窗口（窗口矮时整体上移，仍放不下就内部滚动）
  await nextTick()
  const menu = themeMenuRef.value
  if (menu && rect) {
    const h = menu.offsetHeight
    const maxTop = Math.max(8, window.innerHeight - h - 8)
    themeMenuStyle.value = {
      left: Math.round(rect.right + 12) + 'px',
      top: Math.round(Math.max(8, Math.min(rect.top - 8, maxTop))) + 'px',
    }
  }
}
/* 点击按钮：开 / 关。打开后「钉住」，鼠标移开不自动关闭，点按钮或点外面才关。 */
function toggleThemeMenu(e) {
  if (themeMenuOpen.value) { closeThemeMenu() ; return }
  themeMenuPinned.value = true
  openThemeMenu(e)
}
function closeThemeMenu() {
  cancelCloseThemeMenu()
  themeMenuOpen.value = false
  themeMenuPinned.value = false
}
function scheduleCloseThemeMenu() {
  if (themeMenuPinned.value) return
  cancelCloseThemeMenu()
  // 给指针从按钮移到浮层的时间（160ms 足够，且不会拖慢手感）
  themeMenuTimer = setTimeout(() => { themeMenuOpen.value = false; themeMenuTimer = null }, 160)
}
function cancelCloseThemeMenu() {
  if (themeMenuTimer) { clearTimeout(themeMenuTimer); themeMenuTimer = null }
}
function onThemeMenuKeydown(e) {
  if (e.key === 'Escape' && themeMenuOpen.value) closeThemeMenu()
}
/* 钉住状态下点浮层外面就关（捕获阶段，避免被页面自己的 click 拦掉） */
function onDocumentClick(e) {
  if (!themeMenuOpen.value || !themeMenuPinned.value) return
  const menu = themeMenuRef.value
  const trigger = document.querySelector('.rc-theme-trigger')
  if (menu && menu.contains(e.target)) return
  if (trigger && trigger.contains(e.target)) return
  closeThemeMenu()
}

const activeTab = ref('accounts')

const navItems = [
  {
    key: 'accounts',
    label: '代肝代办',
    iconPath: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  },
  {
    key: 'blueprints',
    label: '蓝图记录',
    iconPath: 'M4 4h16v16H4V4z M8 8h8M8 12h6M8 16h4M19 3l4 4-4 4M3 3l-4 4 4 4',
  },
  {
    key: 'diary',
    label: '代肝记录',
    iconPath: 'M12 8v4l3 3M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
  },
  {
    key: 'add',
    label: '新增记录',
    iconPath: 'M12 5v14M5 12h14',
  },
  {
    key: 'prices',
    label: '价格一览',
    iconPath: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  },
  {
    key: 'report',
    label: '代肝日报',
    iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4',
  },
  {
    key: 'admin',
    label: '数据管理',
    iconPath: 'M12 2C7.6 2 4 3.3 4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5c0-1.7-3.6-3-8-3zM4 5c0 1.7 3.6 3 8 3s8-1.3 8-3M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  },
]

// ── 页面转场：按页面语义选择动效语法（列表 / 表单 / 文档 / 低频）──
const pageComponents = {
  accounts: AccountPage, blueprints: BlueprintPage, diary: WorkDiary,
  add: AddPage, prices: PricePage, admin: AdminPage, settings: SettingsPage,
}
const currentPage = computed(() => pageComponents[activeTab.value] || null)
const pageTransition = computed(() => {
  const k = activeTab.value
  if (k === 'accounts') return 'mv-page-list'
  if (k === 'add') return 'mv-page-form'
  if (k === 'prices' || k === 'admin' || k === 'blueprints') return 'mv-page-doc'
  return 'mv-page-quiet'
})

// ── 导航选中转换：工业橙标识条滑动到当前页 ──
const NAV_STEP = 56   // 按钮 40px + 间隙 16px
const navIndicatorStyle = computed(() => {
  const i = navItems.findIndex(x => x.key === activeTab.value)
  if (i < 0) return { opacity: '0' }
  return { opacity: '1', transform: `translateY(${i * NAV_STEP + 6}px)` }
})

// 提供给子组件的新增导航函数
function navigateToAdd(type) {
  activeTab.value = 'add'
  // type 由子组件通过 useEditState 设置，AddPage 读取
}
provide('navigateToAdd', navigateToAdd)

// 通用导航（供 boosting 页面的"返回"按钮使用）
function navigateTo(tab) { activeTab.value = tab }
provide('navigateTo', navigateTo)

// 当前激活的页面标识（供常驻页面在「被切回」时重播入场动效）
provide('activeTab', activeTab)

const themeIcon = computed(() =>
  isDark.value
    ? 'M12 3v1 M12 20v1 M3 12h1 M20 12h1 M5.64 5.64l.7.7 M17.66 17.66l.7.7 M5.64 18.36l.7-.7 M17.66 6.34l.7-.7 M12 7a5 5 0 1 0 5 5'
    : 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z'
)

// 窗口控制
const isMaximized = ref(false)
const minimize = () => window.electron?.minimize()
const maximize = () => window.electron?.maximize()
const closeWindow = () => window.electron?.close()

onMounted(() => {
  if (window.electron?.onWindowMaximized) {
    window.electron.onWindowMaximized((state) => { isMaximized.value = state })
  }
  document.addEventListener('click', onGlobalClick, true)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onThemeMenuKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onGlobalClick, true)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onThemeMenuKeydown)
  cancelCloseThemeMenu()
})

// ══════ 全局按钮音效 ══════
// 命中「可点击元素」即播放单次音效；带 data-sfx-overcharge 的四次保护按钮由组件自身播放逐层音效
const SFX_SELECTOR = 'button, [role="button"], .rc-global-btn, .tl-entry-btn, .folder-chip, .sb-trigger, .sb-option, .page-tab, .copyable'
function onGlobalClick(e) {
  if (e.button !== 0) return
  const t = e.target
  if (!t || typeof t.closest !== 'function') return
  const el = t.closest(SFX_SELECTOR)
  if (!el) return
  if (el.closest('[data-sfx-overcharge]')) return
  playClick()
}
</script>

<style>
@import '@/assets/css/design-tokens.css';
@import '@/assets/css/motion-tokens.css';
@import '@/assets/css/motion-system.css';
@import '@/assets/css/global-theme.css';
@import '@/assets/css/theme-lone-star.css';
@import '@/assets/css/theme-p3r.css';
@import '@/assets/css/theme-endfield.css';
@import '@/assets/css/theme-swiss.css';
@import '@/assets/css/theme-stijl.css';
@import '@/assets/css/page-common.css';
@import '@/assets/css/motion-themes.css';
@import '@/assets/css/hover-states.css';

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body, #app {
  width: 100vw; height: 100vh; overflow: hidden;
  background: var(--bg-primary); color: var(--text-primary);
  font-family: var(--font-ui);
}

* { scrollbar-width: none; -ms-overflow-style: none; }
*::-webkit-scrollbar { display: none !important; }

.rc-main-container {
  width: 100vw; height: 100vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* ── 标题栏：工程编号 + 等宽字距（孤星风格） ── */
.rc-title-bar {
  position: relative;
  height: 32px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 12px;
  -webkit-app-region: drag;
  background: var(--bg-sidebar);
  color: var(--sb-fg);
  border-bottom: 2px solid var(--border-color);
  flex-shrink: 0;
}
.rc-title-bar::before {
  content: '';
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  width: 3px; height: 14px; background: var(--accent);
}
.rc-title-bar h2 {
  margin: 0; font-size: 12px;
  font-family: var(--font-mono);
  letter-spacing: 3px;
}

.rc-window-controls {
  position: absolute; right: 0; top: 0;
  display: flex; height: 32px;
  -webkit-app-region: no-drag;
}
.rc-window-btn {
  width: 32px; height: 100%;
  border: none; background: transparent;
  cursor: pointer; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  color: var(--sb-fg);
}
.rc-btn-minimize:hover,
.rc-btn-maximize:hover,
.rc-btn-close:hover {
  background: var(--btn-hover-bg);
  color: var(--btn-hover-text);
}

/* ── player 容器 ── */
.rc-player-container {
  flex: 1; display: flex; min-height: 0;
  background: var(--bg-primary);
}

/* ── 子侧边栏 ── */
.rc-sub-sidebar {
  width: 60px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: space-between;
  padding: 12px 0;
  background: var(--bg-sidebar);
  border-right: 2px solid var(--border-color);
  flex-shrink: 0;
}
.rc-sub-func-group {
  position: relative;
  display: flex; flex-direction: column;
  align-items: center; gap: 16px; width: 100%;
}
.rc-sub-bottom-group {
  display: flex; flex-direction: column;
  align-items: center; gap: 16px; width: 100%;
  padding-bottom: 12px;
}
.rc-sub-divider-wrapper {
  width: 70%; display: flex; justify-content: center;
  margin: 4px 0;
}
.rc-sub-divider {
  width: 80%; height: 2px;
  background: var(--sb-line);
}
.rc-sub-func-btn {
  width: 40px; height: 40px;
  border: 2px solid var(--sb-line);
  background: transparent;
  color: var(--sb-fg);
  display: flex; align-items: center; justify-content: center;
  position: relative;
  transition: var(--motion-btn-hover) var(--motion-easing-ease);
  cursor: pointer; border-radius: 0; flex-shrink: 0;
}
/* 当前页标识条改由 mv-nav-indicator 滑动呈现（布局已迁移到 motion-system.css） */
.rc-sub-func-btn:hover,
.rc-sub-func-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}
.rc-sub-icon {
  width: 20px; height: 20px;
  stroke: currentColor; fill: none;
}

/* ── 内容区域 ── */
.rc-player-content {
  flex: 1; overflow: hidden; position: relative;
}
/* 每日汇报常驻渲染时，转场仍需一个单子元素占位 */
.rc-report-slot { height: 0; overflow: hidden; }

/* ── 主题快捷切换浮层（侧栏主题按钮 hover / focus） ──
   position: fixed + 内联坐标，不参与布局，控件尺寸与页面结构都不变。
   配色跟随当前主题：surface-raised 承载面 + accent 标记当前主题。 */
.rc-theme-menu {
  position: fixed;
  z-index: 90000;
  width: 232px;
  /* 窗口再矮也不能溢出：超出时浮层内部滚动（不显示滚动条） */
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 8px;
  background: var(--surface-raised, var(--bg-secondary));
  color: var(--text-primary);
  border: 2px solid var(--border-color);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
  transform-origin: left top;
  animation: rc-theme-menu-in var(--mv-tick, 0.12s) var(--mv-ease-mech, ease-out) both;
}
/* 浮层从触发按钮那一侧展开（origin 在左上）；起点 scale 0.96，不是凭空淡入 */
@keyframes rc-theme-menu-in {
  from { opacity: 0; transform: translateX(-4px) scale(0.96); }
  to   { opacity: 1; transform: none; }
}
.rc-theme-menu-head {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 2px 6px 8px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--rule-soft, var(--border-color));
}
.rc-theme-menu::-webkit-scrollbar { display: none !important; width: 0 !important; }
.rc-theme-menu-title {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 2px;
  opacity: 0.6;
}
.rc-theme-menu-count {
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: 0.45;
}
.rc-theme-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 6px;
  border: 1px solid transparent;
  background: none;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--mv-tick, 0.12s) var(--mv-ease-mech, ease-out),
              border-color var(--mv-tick, 0.12s) var(--mv-ease-mech, ease-out);
}
/* 悬停用「轻填充 + 边框」，与「当前主题」的强调色边框区分开 */
.rc-theme-item:hover {
  background: var(--hv-soft, rgba(0, 0, 0, 0.07));
  border-color: var(--hv-line, var(--border-color));
}
.rc-theme-item.active {
  border-color: var(--accent);
  background: var(--hv-soft, rgba(0, 0, 0, 0.07));
}
.rc-theme-item.active .rc-theme-item-label { font-weight: 800; }
/* 色板：直接用该主题自己的底色 / 边框 / 强调色，一眼看出是哪一套 */
.rc-theme-swatch {
  width: 22px; height: 22px; flex-shrink: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  box-shadow: inset 3px 0 0 var(--accent);
}
.rc-theme-item-text { display: flex; flex-direction: column; min-width: 0; }
.rc-theme-item-label { font-size: 12px; font-weight: 600; }
/* 第二节（明暗）：与第一节之间只留一条细线 */
.rc-theme-menu-head-sub { margin-top: 8px; }
/* 明暗切换：两等分按钮，当前项用强调色描边 + 轻填充 */
.rc-theme-modes {
  display: flex;
  gap: 6px;
  padding: 0 6px 2px;
}
.rc-theme-mode {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid var(--border-color);
  background: none;
  color: inherit;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background var(--mv-tick, 0.12s) var(--mv-ease-mech, ease-out),
              border-color var(--mv-tick, 0.12s) var(--mv-ease-mech, ease-out);
}
.rc-theme-mode:hover {
  background: var(--hv-soft, rgba(0, 0, 0, 0.07));
  border-color: var(--hv-line, var(--border-color));
}
.rc-theme-mode.active {
  background: var(--hv-soft, rgba(0, 0, 0, 0.07));
  border-color: var(--accent);
  color: var(--accent);
}
.rc-theme-item-hint {
  font-size: 10px;
  font-family: var(--font-mono);
  opacity: 0.55;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .rc-theme-menu { animation: none !important; }
  .rc-theme-item { transition: none !important; }
}
</style>

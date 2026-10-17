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
          <button class="rc-sub-func-btn" @click="toggleTheme" title="切换主题">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
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

const { themeClass, isDark, toggleTheme } = useGlobalTheme()

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
})
onUnmounted(() => {
  document.removeEventListener('click', onGlobalClick, true)
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
@import '@/assets/css/page-common.css';

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
</style>

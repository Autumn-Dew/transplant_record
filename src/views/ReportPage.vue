<template>
  <div class="local-music" :class="{ entered: entered }">
    <div class="local-header">
      <div><h2>每日汇报</h2><p class="desc">生成代肝日报，可导出图片 · 支持多页并行</p></div>
    </div>

    <div class="local-toolbar">
      <span class="view-tabs rp-page-tabs" ref="tabsRef" @wheel="onTabsWheel">
        <span
          v-for="(p, i) in pages"
          :key="p.id"
          class="tl-entry-btn page-tab"
          :class="{ active: i === current }"
          @click="current = i"
          :title="p.label || ('页 ' + (i + 1))"
        >
          <span class="page-tab-label">{{ p.label || ('页 ' + (i + 1)) }}</span>
          <span v-if="pages.length > 1" class="page-tab-close" @click.stop="removePage(i)" title="关闭此页">×</span>
        </span>
      </span>
      <button
        class="rc-global-btn"
        @click="addPage"
        :disabled="pages.length >= MAX_PAGES"
        :title="pages.length >= MAX_PAGES ? '最多 ' + MAX_PAGES + ' 页' : '新增一页'"
      >+ 新页</button>
      <button
        class="rc-global-btn"
        title="删除所有页签，只留一个新页"
        @click="clearAllPages"
      >清除页签</button>
      <div class="toolbar-spacer"></div>
    </div>

    <div class="rp-pages" @mouseenter="refreshCurrent">
      <ReportSheet
        v-for="(p, i) in pages"
        :key="p.id"
        ref="sheetRefs"
        v-show="i === current"
        @update:label="(l) => { p.label = l }"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, inject, onMounted } from 'vue'
import ReportSheet from '@/components/ReportSheet.vue'
import { usePageEnter } from '@/composables/usePageEnter.js'
import { readReportPages, writeReportPages, MAX_REPORT_PAGES } from '@/data/report-pages.js'

const MAX_PAGES = MAX_REPORT_PAGES

const activeTab = inject('activeTab', null)

const { entered, replay } = usePageEnter()

// 页面常驻（v-show）：每次切换回日报页时重播入场动效
if (activeTab) {
  watch(() => activeTab.value, (v) => { if (v === 'report') replay() })
}

let seq = 0
// newPageId 只给 id 生成器用（保存数据缺 id 时补一个）；newPage 才是完整页签对象
function newPageId() { return 'rp' + (++seq) + '-' + Date.now().toString(36) }
function newPage() { return { id: newPageId(), label: '' } }

// 页签与当前页的读写规则在 data/report-pages.js（上限、去重、损坏数据回退都在那里）
const restored = readReportPages(newPageId)
const pages = reactive(restored.pages.length ? restored.pages : [newPage()])
const current = ref(restored.current)
const sheetRefs = ref([])
const tabsRef = ref(null)

// 页签溢出时藏了滚动条，靠滚轮横向滚动（垂直滚轮也转成横向，符合直觉）
function onTabsWheel(e) {
  const el = tabsRef.value
  if (!el) return
  if (el.scrollWidth <= el.clientWidth + 1) return
  const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
  if (!delta) return
  e.preventDefault()
  el.scrollLeft += delta
}
// 切换页后把当前页签滚进可视区（否则点了后面的页看不到它）
function scrollActiveTabIntoView() {
  const el = tabsRef.value
  if (!el) return
  const tab = el.children && el.children[current.value]
  if (!tab || typeof tab.scrollIntoView !== 'function') return
  tab.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

// 页签 / 标签 / 当前页变化即落盘（关掉窗口也不丢）
function persistPages() {
  writeReportPages({ pages: pages, current: current.value })
}
watch(pages, persistPages, { deep: true })

// 本页常驻，切换/鼠标进入时刷新当前页的托管项目列表（排除提前续费的 locked 项）
function refreshCurrent() {
  const s = sheetRefs.value[current.value]
  if (s && s.refreshHosting) s.refreshHosting()
}
watch(current, () => { persistPages(); refreshCurrent(); scrollActiveTabIntoView() })

// 进入日报页时跑一次（重启后第一次打开就会补页）
onMounted(() => { scrollActiveTabIntoView() })

function addPage() {
  if (pages.length >= MAX_PAGES) return
  pages.push(newPage())
  current.value = pages.length - 1
}
// ── 启动对齐：页签与「选择托管项目」严格一致（每次启动跑一次）──
//    · 下拉里有的项目 → 必须有且只有一个页
//    · 下拉里没有的自动页（带 projectId）→ 删掉
//    · 没有 projectId 的页是手动页，永远保留
// 清除页签：全部删掉，只留一个新页（不弹确认，点完立即生效）
function clearAllPages() {
  pages.splice(0, pages.length, newPage())
  current.value = 0
  persistPages()
}
function removePage(i) {
  if (pages.length <= 1) return
  pages.splice(i, 1)
  if (current.value >= pages.length) current.value = pages.length - 1
}
</script>

<style scoped>
.local-music { display: flex; flex-direction: column; overflow: hidden; }
.rp-pages { flex: 1; min-height: 0; display: flex; overflow: hidden; }
.rp-pages > * { width: 100%; }
/* 页签溢出时横向滚动，滚动条隐藏；自身可收缩，不会把「+ 新页」挤出去 */
.rp-page-tabs {
  display: flex; align-items: center; gap: 4px;
  flex: 0 1 auto; min-width: 0; max-width: 100%;
  overflow-x: auto; overflow-y: hidden;
  scrollbar-width: none; -ms-overflow-style: none;
  white-space: nowrap;
}
.rp-page-tabs::-webkit-scrollbar { display: none; width: 0; height: 0; }
.rp-page-tabs .page-tab { flex: 0 0 auto; }
.page-tab { display: flex; align-items: center; gap: 6px; max-width: 200px; }
.page-tab-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-tab-close { font-size: 13px; line-height: 1; padding: 0 3px; opacity: 0.6; cursor: pointer; }
.page-tab-close:hover { opacity: 1; color: #ff6d00; }
</style>

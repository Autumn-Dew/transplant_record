<template>
  <div class="local-music" :class="{ entered: entered }">
    <div class="local-header">
      <div><h2>每日汇报</h2><p class="desc">生成代肝日报，可导出图片 · 支持多页并行</p></div>
    </div>

    <div class="local-toolbar">
      <span class="view-tabs">
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
import { ref, reactive, onMounted, watch, inject } from 'vue'
import ReportSheet from '@/components/ReportSheet.vue'

const MAX_PAGES = 8

const activeTab = inject('activeTab', null)

const entered = ref(false)
function replayEnter() {
  entered.value = false
  requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true }))
}
onMounted(replayEnter)

// 页面常驻（v-show）：每次切换回日报页时重播入场动效
if (activeTab) {
  watch(() => activeTab.value, (v) => { if (v === 'report') replayEnter() })
}

let seq = 0
function newPage() { return { id: 'rp' + (++seq) + '-' + Date.now().toString(36), label: '' } }

const pages = reactive([newPage()])
const current = ref(0)
const sheetRefs = ref([])

// 本页常驻，切换/鼠标进入时刷新当前页的托管项目列表（排除提前续费的 locked 项）
function refreshCurrent() {
  const s = sheetRefs.value[current.value]
  if (s && s.refreshHosting) s.refreshHosting()
}
watch(current, () => { refreshCurrent() })

function addPage() {
  if (pages.length >= MAX_PAGES) return
  pages.push(newPage())
  current.value = pages.length - 1
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
.page-tab { display: flex; align-items: center; gap: 6px; max-width: 200px; }
.page-tab-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-tab-close { font-size: 13px; line-height: 1; padding: 0 3px; opacity: 0.6; cursor: pointer; }
.page-tab-close:hover { opacity: 1; color: #ff6d00; }
</style>

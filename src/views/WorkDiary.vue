<template>
  <div class="local-music" :class="{ entered: entered }">
    <!-- Header -->
    <div class="local-header">
      <div><h2>代肝记录</h2><p class="desc">代肝代办确认完成后的记录</p></div>
      <div class="legend">
        <div class="legend-row">
          <span class="legend-label">类型</span>
          <span class="legend-item"><span class="legend-dot" style="background:#00B0FF"></span>单次</span>
          <span class="legend-item"><span class="legend-dot" style="background:#FF6D00"></span>托管</span>
        </div>
        <div class="legend-row">
          <span class="legend-label">金额</span>
          <span class="legend-item"><span class="legend-dot" style="background:#FF1744"></span>≥100</span>
          <span class="legend-item"><span class="legend-dot" style="background:#FFEA00"></span>50-99</span>
          <span class="legend-item"><span class="legend-dot" style="background:#00E676"></span>1-49</span>
          <span class="legend-item"><span class="legend-dot" style="background:#BDBDBD"></span>无</span>
        </div>
      </div>
    </div>

    <div>
      <!-- Toolbar -->
      <div class="local-toolbar">
        <span class="view-tabs">
          <span class="tl-entry-btn" :class="{ active: sortMode === 'time' }" @click="setSortMode('time')">时间</span>
          <span class="tl-entry-btn" :class="{ active: sortMode === 'fee' }" @click="setSortMode('fee')">金额</span>
          <span class="tl-entry-btn" :class="{ active: sortMode === 'game' }" @click="setSortMode('game')">游戏</span>
        </span>
        <label class="select-limit-box" title="最多可同时选中的记录数">
          <span>选中</span>
          <input type="number" min="1" v-model.number="selectLimit" />
        </label>
        <div class="toolbar-spacer"></div>
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke-width="2"/></svg>
          <input v-model="searchQuery" type="text" placeholder="搜索…" class="search-input" />
          <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">×</button>
        </div>
      </div>

      <!-- 统计：与「代肝代办」同一套样式（一行、不换行）；收入统计跟在右侧 -->
      <div class="summary-strip wd-summary">
        <span class="summary-chip">总记录 <strong>{{ doneRecords.length }}</strong></span>
        <span class="summary-chip">已完成 <strong>{{ completedCount }}</strong></span>
        <span class="summary-chip">累计入账 <strong>¥{{ allIncome }}</strong></span>
        <span class="summary-chip">本月入账 <strong>¥{{ monthIncome }}</strong></span>
        <span class="income-inline" v-if="monthlyIncome.length">
          <span class="income-title">收入统计</span>
          <span v-for="m in monthlyIncome" :key="m.month" class="income-chip">
            {{ m.month }} <strong>¥{{ m.total }}</strong><em>{{ m.count }} 笔</em>
          </span>
        </span>
      </div>

      <!-- 数据列表：按项目聚合，一个项目一行（托管 30 天也只有一条），明细在弹窗里 -->
      <div class="song-list" :key="listKey">
        <div
          v-for="(g, idx) in groupedRecords"
          :key="g.key"
          class="song-item"
          :class="{ selected: isSelected(g.key) }"
          :style="rowStyle(g, idx)"
          @click="toggleSelect(g.key)"
        >
          <div class="song-info">
            <div class="song-name">{{ g.displayName }}</div>
            <div class="song-artist">
              {{ maskAccount(g.account) || '无账号' }} · {{ dateRangeText(g) }}<template v-if="g.count > 1"> · 共 {{ g.count }} 条</template>
            </div>
          </div>

          <div class="col-fixed">{{ g.game }}</div>

          <div class="col-fixed">
            <span v-if="g.wasHosting">{{ g.doneCount }} / {{ g.count }} 次</span>
            <span v-else-if="g.doneCount">已完成</span>
            <span v-else class="fee-dim">{{ resultLabel(g.latest) }}</span>
          </div>

          <div class="col-fixed">
            <span v-if="g.service">{{ g.service }}</span>
            <span class="fee-dim" v-else>—</span>
          </div>

          <div class="col-fixed">
            <span v-if="g.fee">¥{{ g.fee }}</span>
            <span class="fee-dim" v-else>—</span>
          </div>

          <div class="song-actions">
            <button class="song-btn" @click.stop="openDetailDialog(g)" title="详细信息（含执行明细）">
              <span style="font-size:14px;">📄</span>
            </button>
            <button
              class="song-btn"
              data-sfx-overcharge
              @click.stop="handleDelete(g)"
              :style="getDeleteStyle(g.key)"
              :title="deleteTitle(g)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M10 11v6M14 11v6M5 6h14v14a2 2 0 012 2H7a2 2 0 01-2-2V6z"/></svg>
            </button>
          </div>
        </div>

        <!-- 空状态 -->
        <EmptyState v-if="groupedRecords.length === 0 && records.length === 0" icon="doc" text="完成代肝代办后自动生成" />
        <EmptyState v-if="groupedRecords.length === 0 && records.length > 0" icon="search" text="没有匹配的记录" />
      </div>

      <!-- 详细信息弹窗：一个项目的汇总 + 逐日执行明细 -->
      <div class="modal-mask" v-if="showDetail && detailGroup" @click.self="showDetail = false">
        <div class="edit-popup">
          <h4>详细信息</h4>
          <div class="detail-grid">
            <p class="detail-section">基本信息</p>
            <div class="detail-field"><span class="dl">游戏</span><span class="dv">{{ detailGroup.game }}</span></div>
            <div class="detail-field"><span class="dl">服务项目</span><span class="dv">{{ detailGroup.service || '—' }}</span></div>
            <div class="detail-field"><span class="dl">类型</span><span class="dv">{{ detailGroup.wasHosting ? '托管' : '单次' }}</span></div>
            <div class="detail-field"><span class="dl">账号</span><span class="dv">{{ detailGroup.latest.account || '—' }}</span></div>
            <div class="detail-field"><span class="dl">密码</span><span class="dv mono">{{ maskPassword(detailGroup.latest.password) || '—' }}</span></div>
            <div class="detail-field"><span class="dl">记录条数</span><span class="dv mono">{{ detailGroup.count }} 条（已完成 {{ detailGroup.doneCount }}）</span></div>
            <div class="detail-field"><span class="dl">日期区间</span><span class="dv mono">{{ dateRangeText(detailGroup) }}</span></div>
            <p class="detail-section">平台名称</p>
            <div class="detail-field"><span class="dl">首选</span><span class="dv">{{ detailGroup.latest.preferredPlatform || '—' }}</span></div>
            <div class="detail-field"><span class="dl">微信</span><span class="dv">{{ detailGroup.latest.wechatName || '—' }}</span></div>
            <div class="detail-field"><span class="dl">QQ</span><span class="dv">{{ detailGroup.latest.qqName || '—' }}</span></div>
            <div class="detail-field"><span class="dl">B站</span><span class="dv">{{ detailGroup.latest.bilibiliName || '—' }}</span></div>
            <div class="detail-field"><span class="dl">小红书</span><span class="dv">{{ detailGroup.latest.xiaohongshuName || '—' }}</span></div>
            <div class="detail-field"><span class="dl">抖音</span><span class="dv">{{ detailGroup.latest.douyinName || '—' }}</span></div>
            <p class="detail-section">费用</p>
            <div class="detail-field"><span class="dl">总收费</span><span class="dv">{{ detailGroup.latest.totalFee ? '¥' + detailGroup.latest.totalFee : '—' }}</span></div>
            <div class="detail-field"><span class="dl">实际收费</span><span class="dv">{{ detailGroup.latest.actualFee ? '¥' + detailGroup.latest.actualFee : '—' }}</span></div>
            <div class="detail-field"><span class="dl">延后收费</span><span class="dv">{{ detailGroup.latest.delayedFee ? '¥' + detailGroup.latest.delayedFee : '—' }}</span></div>
            <div class="detail-field"><span class="dl">备注</span><span class="dv">{{ detailGroup.latest.note || '—' }}</span></div>
            <p class="detail-section">执行明细（{{ detailGroup.count }} 条）</p>
          </div>
          <div class="wd-detail-list">
            <div v-for="r in detailGroup.items" :key="r.id" class="wd-detail-row">
              <span class="wd-detail-date">{{ doneDate(r) }} {{ r.time || '' }}</span>
              <span class="wd-detail-result">{{ resultLabel(r) }}</span>
              <span class="wd-detail-note">{{ r.note || '—' }}</span>
            </div>
          </div>
          <div class="edit-actions" style="margin-top:16px">
            <button class="cancel-btn" @click="showDetail = false">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRowSelect } from '@/composables/useRowSelect'
import { useConfirmClick } from '@/composables/useConfirmClick.js'
import { maskAccount, getDisplayName, maskPassword } from '@/domain/mask.js'
import { RESULT_LABEL } from '@/domain/completion.js'
import { completionsRepo, projectsRepo } from '@/data/repos.js'
import { revenueStats, finishedProjectIds } from '@/services/projectService.js'
import { todayLocal } from '@/utils/date.js'
import { typeColor, feeColor } from '@/utils/fee.js'
import { usePageEnter } from '@/composables/usePageEnter.js'
import EmptyState from '@/components/EmptyState.vue'

const { isSelected, toggleSelect, selectLimit } = useRowSelect()

// ══════ 入场动画 ══════
// 入场动画（统一节奏见 composables/usePageEnter）
const { entered, replay, staggerStyle } = usePageEnter()

// ══════ 数据（统一经由 Repository）══════
// 数据补齐统一在 src/main.js 的 hydrateAll() 里做，页面不再各自 hydrate
const records = completionsRepo.state

// 实际完成日期（v2）；兼容 v1 的 date 字段
function doneDate(item) { return item.completedDate || item.date || '' }
function resultLabel(item) { return RESULT_LABEL[item.result || 'done'] || '已完成' }

// ══════ 搜索 ══════
const searchQuery = ref('')
const sortMode = ref('time') // time | fee | game
const listKey = ref(0)
function setSortMode(mode) {
  if (sortMode.value === mode) return
  sortMode.value = mode
  listKey.value++
  replay()  // 重新触发列表入场动画
}

// ══════ 竖线颜色：上段类型色 + 下段价格色 ══════
function getTypeColor(item) {
  return typeColor(!!item.wasHosting)  // 托管亮橙 / 单次亮蓝
}
function getFeeColor(item) {
  return feeColor(item.fee || item.totalFee)
}
function rowStyle(item, idx) {
  const base = staggerStyle(idx)
  const typeColor = getTypeColor(item)
  const feeColor = getFeeColor(item)
  return {
    ...base,
    '--bar-top': typeColor,
    '--bar-bottom': feeColor || typeColor,
  }
}

// 只统计「整个托管周期已经结束」的项目：进行中的托管项目不计入代肝记录。
// 托管 → 完成后（已完成 / 已归档 / 已到期 / 已取消）才算；单次 → 完成即算。
// 「整个周期已结束」的项目 id 由 service 判定（已完成 / 已归档 / 已取消 / 已到期），
// 组件不再自己拼业务口径。
const finishedIds = computed(() => finishedProjectIds())

const filteredRecords = computed(() => {
  const finished = finishedIds.value
  let list = records.value.filter(r => finished.has(String(r.projectId)))
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(r => (
      (r.displayName || getDisplayName(r) || '').toLowerCase().includes(q) ||
      (r.account || '').toLowerCase().includes(q) ||
      (r.game || '').toLowerCase().includes(q) ||
      String(r.service ?? '').includes(q) ||
      String(r.fee ?? '').includes(q) ||
      doneDate(r).includes(q) ||
      (r.note || '').toLowerCase().includes(q)
    ))
  }
  // 排序：时间（默认）/ 金额 / 游戏。
  // 以前无论选哪种排序，都会先把「托管记录」整体推到最前（wasHosting 分组），
  // 导致时间顺序被打乱 —— 现在按所选维度纯粹排序，不再按类型分组。
  return [...list].sort((a, b) => {
    if (sortMode.value === 'fee') {
      const diff = (Number(b.fee) || 0) - (Number(a.fee) || 0)
      if (diff !== 0) return diff
    } else if (sortMode.value === 'game') {
      const diff = String(a.game || '').localeCompare(String(b.game || ''))
      if (diff !== 0) return diff
    }
    // 时间：完成日期 + 时间倒序；完全相同时用 id 兜底保证顺序稳定
    const da = `${doneDate(a)} ${a.time || ''}`
    const db = `${doneDate(b)} ${b.time || ''}`
    const diff = db.localeCompare(da)
    return diff !== 0 ? diff : String(b.id).localeCompare(String(a.id))
  })
})

// ══════ 统计 ══════
// 只统计「整个托管周期已完成」的项目（与列表口径一致）
const doneRecords = computed(() => {
  const finished = finishedIds.value
  return records.value.filter(r => finished.has(String(r.projectId)))
})
const completedCount = computed(() => doneRecords.value.filter(r => r.status === 0).length)

// ══════ 收入统计（收入在这里统计）══════
// 口径：每一笔收费（订单 payments）独立，按「收费归属日期」归月。
// ⚠ 绝不能用「执行记录的 fee 累加」：每条执行记录都带着所属项目的收费快照，
//   同一笔钱会被重复计算 N 次（真实数据：118 条记录累加 = 9158，而实际订单总额只有 1085）。
const allIncome = computed(() => revenueStats().total)
const monthIncome = computed(() => revenueStats({ month: todayLocal().slice(0, 7) }).total)
const monthlyIncome = computed(() => revenueStats().byMonth)

// ══════ 按项目聚合 ══════
// 代肝记录是「每次执行一条」，所以一个 30 天的托管会有 30 条真实记录。
// 列表里按项目聚成一行（日期区间 + 条数），明细放进详情弹窗 —— 归档后不会一次刷出几十条。
function groupKeyOf(r) { return r.projectId ? `p:${r.projectId}` : `r:${r.id}` }

function latestOf(items) {
  return [...items].sort((a, b) => {
    const da = `${doneDate(a)} ${a.time || ''}`
    const db = `${doneDate(b)} ${b.time || ''}`
    return db.localeCompare(da)
  })[0]
}

const groupedRecords = computed(() => {
  const map = new Map()
  for (const r of filteredRecords.value) {
    const key = groupKeyOf(r)
    let g = map.get(key)
    if (!g) {
      g = { key, id: key, items: [] }
      map.set(key, g)
    }
    g.items.push(r)
  }
  for (const g of map.values()) {
    g.latest = latestOf(g.items)
    g.count = g.items.length
    g.doneCount = g.items.filter(r => (r.result || 'done') === 'done').length
    const dates = g.items.map(doneDate).filter(Boolean).sort()
    g.firstDate = dates[0] || ''
    g.lastDate = dates[dates.length - 1] || ''
    g.wasHosting = g.items.some(r => r.wasHosting)
    g.displayName = g.latest.displayName || getDisplayName(g.latest) || '未命名'
    g.account = g.latest.account
    g.game = g.latest.gameName || g.latest.game || '—'
    g.service = g.latest.service || ''
    // 收费是「项目的」金额，每条记录都带着同一份快照 —— 只能取一条，绝不能累加
    g.fee = Number(g.latest.totalFee) || Number(g.latest.fee) || 0
  }
  // 首次出现的顺序即 filteredRecords 的排序结果（时间 / 金额 / 游戏）
  return [...map.values()]
})

function dateRangeText(g) {
  if (!g.firstDate && !g.lastDate) return '—'
  if (!g.firstDate || g.firstDate === g.lastDate) return g.firstDate || g.lastDate
  return `${g.firstDate} → ${g.lastDate}`
}

// ══════ 删除（多次点击保护，机制见 composables/useConfirmClick） ══════
const deleteCfm = useConfirmClick()
function getDeleteStyle(key) { return deleteCfm.styleOf(key) }
function deleteTitle(g) {
  const base = deleteCfm.titleOf(g.key, '删除')
  return g.count > 1 ? `${base}（整个项目 ${g.count} 条记录）` : base
}
function handleDelete(g) {
  if (!deleteCfm.trigger(g.key)) return
  // 聚合成一行，删除也按项目整段删；一次替换只落盘一次，避免 N 条记录触发 N 次持久化。
  const ids = new Set(g.items.map(r => String(r.id)))
  completionsRepo.replaceAll(completionsRepo.plain().filter(r => !ids.has(String(r.id))))
}

// ══════ 详细信息弹窗（项目汇总 + 逐日明细） ══════
const showDetail = ref(false)
const detailGroup = ref(null)
function openDetailDialog(g) { detailGroup.value = g; showDetail.value = true }

// ══════ 键盘 ══════
function onKeydown(e) { if (e.key === 'Escape') { showDetail.value = false } }
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.fee-dim { opacity: 0.35; }
/* ── 统计条：与「代肝代办」一致，一行不换行；收入统计贴在右侧 ── */
.wd-summary { flex-wrap: nowrap; overflow-x: auto; align-items: center; }
.income-inline {
  display: flex; align-items: center; gap: 6px;
  margin-left: auto; padding-left: 10px; flex-wrap: nowrap;
}
.income-title { font-family: var(--font-mono); font-size: 11px; opacity: 0.5; letter-spacing: 1px; white-space: nowrap; }
.income-chip {
  font-family: var(--font-mono); font-size: 11px; padding: 2px 8px;
  border: 1px solid var(--border-color); opacity: 0.85; white-space: nowrap;
}
.income-chip strong { font-weight: 800; }
.income-chip em { font-style: normal; opacity: 0.55; margin-left: 4px; font-size: 10px; }
.song-info { flex: 1.4; }
.song-actions { margin-left: 4px; flex-shrink: 0; }
/* 详情弹窗里的「逐日执行明细」：一行一天，等宽数字，超高就内部滚动 */
.wd-detail-list {
  max-height: 240px;
  overflow-y: auto;
  margin-top: 8px;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}
/* 滚动条隐藏，滚轮 / 触控板仍可用（与汇报外观弹窗同一套做法） */
.wd-detail-list { scrollbar-width: none; }
.wd-detail-list::-webkit-scrollbar { display: none; }
.wd-detail-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 6px 2px;
  border-bottom: 1px solid var(--rule-soft, var(--border-color));
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
}
.wd-detail-row:last-child { border-bottom: 0; }
.wd-detail-date { flex: 0 0 140px; font-variant-numeric: tabular-nums; opacity: .85; }
.wd-detail-result { flex: 0 0 52px; font-weight: 800; }
.wd-detail-note { flex: 1; min-width: 0; overflow-wrap: anywhere; opacity: .75; }
.song-item { box-shadow: inset 18px 0 14px -14px var(--bar-top, rgba(128,128,128,0.35)); }
.song-item::after {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 8px;
  z-index: 1;
  background: linear-gradient(to bottom,
    var(--bar-top, var(--border-color)) 0%,
    var(--bar-top, var(--border-color)) 50%,
    var(--bar-bottom, var(--border-color)) 50%,
    var(--bar-bottom, var(--border-color)) 100%);
}
</style>

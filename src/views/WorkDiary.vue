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

      <!-- 统计 -->
      <div class="summary-strip">
        <span class="summary-chip">总记录 <strong>{{ records.length }}</strong></span>
        <span class="summary-chip">已完成 <strong>{{ completedCount }}</strong></span>
        <span class="summary-chip">总收费 <strong>¥{{ totalFee }}</strong></span>
      </div>

      <!-- 数据列表 -->
      <div class="song-list" :key="listKey">
        <div
          v-for="(item, idx) in filteredRecords"
          :key="item.id"
          class="song-item"
          :class="{ selected: isSelected(item.id) }"
          :style="rowStyle(item, idx)"
          @click="toggleSelect(item.id)"
        >
          <div class="song-info">
            <div class="song-name">{{ item.displayName || getDisplayName(item) || '未命名' }}</div>
            <div class="song-artist">{{ maskAccount(item.account) || '无账号' }} · {{ item.date }} {{ item.time || '' }}</div>
          </div>

          <div class="col-fixed">{{ item.game || '终末地' }}</div>

          <div class="col-fixed">
            <span v-if="item.service">{{ item.service }}</span>
            <span class="fee-dim" v-else>—</span>
          </div>

          <div class="col-fixed">
            <span v-if="item.fee">¥{{ item.fee }}</span>
            <span class="fee-dim" v-else>—</span>
          </div>

          <div class="song-actions">
            <button class="song-btn" @click.stop="openDetailDialog(item)" title="详细信息">
              <span style="font-size:14px;">📄</span>
            </button>
            <button
              class="song-btn"
              data-sfx-overcharge
              @click.stop="handleDelete(item)"
              :style="getDeleteStyle(item.id)"
              :title="deleteTitle(item.id)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M10 11v6M14 11v6M5 6h14v14a2 2 0 012 2H7a2 2 0 01-2-2V6z"/></svg>
            </button>
          </div>
        </div>

        <!-- 空状态 -->
        <div class="empty" v-if="filteredRecords.length === 0 && records.length === 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-width="2"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          <p>完成代肝代办后自动生成</p>
        </div>
        <div class="empty" v-if="filteredRecords.length === 0 && records.length > 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <p>没有匹配的记录</p>
        </div>
      </div>

      <!-- 详细信息弹窗 -->
      <div class="modal-mask" v-if="showDetail" @click.self="showDetail = false">
        <div class="edit-popup">
          <h4>详细信息</h4>
          <div class="detail-grid">
            <p class="detail-section">基本信息</p>
            <div class="detail-field"><span class="dl">游戏</span><span class="dv">{{ detailRecord.game || '终末地' }}</span></div>
            <div class="detail-field"><span class="dl">服务项目</span><span class="dv">{{ detailRecord.service || '—' }}</span></div>
            <div class="detail-field"><span class="dl">类型</span><span class="dv">{{ detailRecord.status === 2 ? '托管' : '单次' }}</span></div>
            <div class="detail-field"><span class="dl">账号</span><span class="dv">{{ detailRecord.account || '—' }}</span></div>
            <div class="detail-field"><span class="dl">密码</span><span class="dv">{{ detailRecord.password || '—' }}</span></div>
            <div class="detail-field"><span class="dl">收费</span><span class="dv">{{ detailRecord.fee ? '¥' + detailRecord.fee : '—' }}</span></div>
            <div class="detail-field"><span class="dl">完成时间</span><span class="dv">{{ detailRecord.date }} {{ detailRecord.time || '' }}</span></div>
            <p class="detail-section">平台名称</p>
            <div class="detail-field"><span class="dl">首选</span><span class="dv">{{ detailRecord.preferredPlatform || '—' }}</span></div>
            <div class="detail-field"><span class="dl">微信</span><span class="dv">{{ detailRecord.wechatName || '—' }}</span></div>
            <div class="detail-field"><span class="dl">QQ</span><span class="dv">{{ detailRecord.qqName || '—' }}</span></div>
            <div class="detail-field"><span class="dl">B站</span><span class="dv">{{ detailRecord.bilibiliName || '—' }}</span></div>
            <div class="detail-field"><span class="dl">小红书</span><span class="dv">{{ detailRecord.xiaohongshuName || '—' }}</span></div>
            <div class="detail-field"><span class="dl">抖音</span><span class="dv">{{ detailRecord.douyinName || '—' }}</span></div>
            <p class="detail-section">费用</p>
            <div class="detail-field"><span class="dl">总收费</span><span class="dv">{{ detailRecord.totalFee ? '¥' + detailRecord.totalFee : '—' }}</span></div>
            <div class="detail-field"><span class="dl">实际收费</span><span class="dv">{{ detailRecord.actualFee ? '¥' + detailRecord.actualFee : '—' }}</span></div>
            <div class="detail-field"><span class="dl">延后收费</span><span class="dv">{{ detailRecord.delayedFee ? '¥' + detailRecord.delayedFee : '—' }}</span></div>
            <div class="detail-field"><span class="dl">备注</span><span class="dv">{{ detailRecord.note || '—' }}</span></div>
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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRowSelect } from '@/composables/useRowSelect'
import { playOvercharge } from '@/utils/sound'

const STORAGE_KEY = 'tr-completions'
const { isSelected, toggleSelect, selectLimit } = useRowSelect()

// ══════ 入场动画 ══════
const entered = ref(false)
onMounted(() => { requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true })) })
function staggerStyle(idx) {
  return { transitionDelay: (0.24 + idx * 0.023) + 's' }
}

// ══════ 工具函数 ══════
function maskAccount(acct) {
  if (!acct) return ''
  const s = String(acct).replace(/\*/g, '')
  if (s.length <= 2) return s
  if (s.length <= 5) return s[0] + '***' + s[s.length - 1]
  if (s.length <= 7) return s.slice(0, 2) + '***' + s.slice(-2)
  return s.slice(0, 3) + '****' + s.slice(-4)
}
function getDisplayName(item) {
  const order = ['wechat', 'qq', 'bilibili', 'xiaohongshu', 'douyin']
  const map = { wechat: item.wechatName, qq: item.qqName, bilibili: item.bilibiliName, xiaohongshu: item.xiaohongshuName, douyin: item.douyinName }
  if (item.preferredPlatform && map[item.preferredPlatform]) return map[item.preferredPlatform]
  for (const p of order) { if (map[p]) return map[p] }
  return map['wechat'] || ''
}

// ══════ 数据持久化 ══════
const records = ref([])
function loadRecords() {
  try { records.value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { records.value = [] }
}
function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.value))
}
loadRecords()

// ══════ 搜索 ══════
const searchQuery = ref('')
const sortMode = ref('time') // time | fee | game
const listKey = ref(0)
function setSortMode(mode) {
  if (sortMode.value === mode) return
  sortMode.value = mode
  listKey.value++
  entered.value = false
  requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true }))
}

// ══════ 竖线颜色：上段类型色 + 下段价格色 ══════
function getTypeColor(item) {
  return item.wasHosting ? '#FF6D00' : '#00B0FF'  // 托管亮橙 / 单次亮蓝
}
function getFeeColor(item) {
  const fee = Number(item.totalFee) || Number(item.fee) || 0
  if (fee >= 100) return '#FF1744'
  if (fee >= 50) return '#FFEA00'
  if (fee > 0) return '#00E676'
  return '#BDBDBD'
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

const filteredRecords = computed(() => {
  let list = records.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(r => (
      (r.displayName || getDisplayName(r) || '').toLowerCase().includes(q) ||
      (r.account || '').toLowerCase().includes(q) ||
      (r.game || '').toLowerCase().includes(q) ||
      String(r.service ?? '').includes(q) ||
      String(r.fee ?? '').includes(q) ||
      (r.date || '').includes(q) ||
      (r.note || '').toLowerCase().includes(q)
    ))
  }
  // 排序：托管(wasHosting)永远排最后
  return [...list].sort((a, b) => {
    const ha = a.wasHosting ? 1 : 0
    const hb = b.wasHosting ? 1 : 0
    if (ha !== hb) return ha - hb
    if (sortMode.value === 'fee') return (Number(b.fee) || 0) - (Number(a.fee) || 0)
    if (sortMode.value === 'game') return (a.game || '').localeCompare(b.game || '')
    const da = (a.date || '') + (a.time || '')
    const db = (b.date || '') + (b.time || '')
    return db.localeCompare(da)
  })
})

// ══════ 统计 ══════
const totalFee = computed(() => records.value.reduce((s, r) => s + (Number(r.fee) || 0), 0))
const completedCount = computed(() => records.value.filter(r => r.status === 0).length)

// ══════ 删除（4段保护：红→橙→紫→执行） ══════
const DELETE_COLORS = { 1: '#ff4444', 2: '#ff8800', 3: '#aa44ff' }
const deleteClicks = ref(new Map())
function getDeleteStyle(id) {
  const n = deleteClicks.value.get(id) || 0
  if (n >= 1 && n <= 3) return { borderColor: DELETE_COLORS[n], color: DELETE_COLORS[n] }
  return {}
}
function deleteTitle(id) {
  const n = deleteClicks.value.get(id) || 0
  if (n === 1) return '再次点击删除（2/4）'
  if (n === 2) return '再次点击删除（3/4）'
  if (n === 3) return '最后一次点击删除（4/4）'
  return '删除'
}
function handleDelete(item) {
  const cur = deleteClicks.value.get(item.id) || 0
  playOvercharge(cur)
  if (cur >= 3) {
    deleteClicks.value.delete(item.id)
    deleteClicks.value = new Map(deleteClicks.value)
    records.value = records.value.filter(r => r.id !== item.id)
    saveRecords()
  } else {
    deleteClicks.value.set(item.id, cur + 1)
    deleteClicks.value = new Map(deleteClicks.value)
    clearTimeout(item.__deleteTimer)
    item.__deleteTimer = setTimeout(() => {
      deleteClicks.value.delete(item.id)
      deleteClicks.value = new Map(deleteClicks.value)
    }, 3000)
  }
}

// ══════ 详细信息弹窗 ══════
const showDetail = ref(false)
const detailRecord = ref({})
function openDetailDialog(item) { detailRecord.value = item; showDetail.value = true }
function copyText(text) { if (text) navigator.clipboard?.writeText(text) }

// ══════ 键盘 ══════
function onKeydown(e) { if (e.key === 'Escape') { showDetail.value = false } }
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.fee-dim { opacity: 0.35; }
.song-info { flex: 1.4; }
.song-actions { margin-left: 4px; flex-shrink: 0; }
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

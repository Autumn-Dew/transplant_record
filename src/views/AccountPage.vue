<template>
  <div class="local-music" :class="{ entered: entered }">
    <!-- Header -->
    <div class="local-header">
      <div><h2>代肝代办</h2><p class="desc">管理老板账号与托管服务</p></div>
      <div class="legend">
        <div class="legend-row">
          <span class="legend-label">类型</span>
          <span class="legend-item"><span class="legend-dot" style="background:#00B0FF"></span>单次</span>
          <span class="legend-item"><span class="legend-dot" style="background:#FF6D00"></span>托管</span>
          <span class="legend-item"><span class="legend-dot" style="background:#9E9E9E"></span>已确认</span>
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

    <!-- 列表视图 -->
    <div>
      <!-- Toolbar -->
      <div class="local-toolbar">
        <button class="rc-global-btn" @click="handleAdd">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          <span>新增</span>
        </button>
        <span class="view-tabs">
          <span class="tl-entry-btn" :class="{ active: sortMode === 'hosting' }" @click="setSortMode('hosting')">托管</span>
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

      <!-- 统计概览 -->
      <div class="summary-strip">
        <span class="summary-chip">总记录 <strong>{{ activeRecords.length }}</strong></span>
        <span class="summary-chip">未完成 <strong>{{ pendingCount }}</strong></span>
        <span class="summary-chip">托管中 <strong>{{ hostingCount }}</strong></span>
        <span class="summary-chip">总收费 <strong>¥{{ totalFeeSum }}</strong></span>
      </div>

      <!-- 游戏筛选 -->
      <div class="folder-strip" v-if="gameChips.length > 1">
        <span class="folder-chip" :class="{ active: gameFilter === '' }" @click="gameFilter = ''">全部 <span class="folder-count">{{ activeRecords.length }}</span></span>
        <span v-for="chip in gameChips" :key="chip.name" class="folder-chip" :class="{ active: gameFilter === chip.name }" @click="gameFilter = chip.name">{{ chip.name }} <span class="folder-count">{{ chip.count }}</span></span>
      </div>

      <!-- 数据列表 -->
      <div class="song-list" :key="listKey">
        <div
          v-for="(item, idx) in filteredRecords"
          :key="item.id"
          class="song-item"
          :class="{ dimmed: isGrayed(item), hosting: item.status === 2, selected: isSelected(item.id) }"
          :style="rowStyle(item, idx)"
          @click="toggleSelect(item.id)"
        >
          <div class="song-info">
            <div class="song-name">{{ getDisplayName(item) || '未命名' }}</div>
            <div class="song-artist">{{ maskAccount(item.account) || '无账号' }}</div>
          </div>

          <div class="col-fixed">{{ item.game || '终末地' }}</div>

          <div class="col-fixed">
            <span v-if="item.service">{{ item.service }}</span>
            <span class="fee-dim" v-else>—</span>
          </div>

          <div class="col-fixed">
            <span v-if="isLocked(item)">待激活</span>
            <span v-else-if="isConfirmedToday(item)">今日已确认</span>
            <span v-else-if="item.remainingDays != null && item.remainingDays !== ''">{{ item.remainingDays }}次</span>
            <span v-else-if="item.status === 2">托管</span>
            <span v-else>单次</span>
          </div>

          <div class="col-fixed col-note" :title="item.note">{{ item.note || '—' }}</div>

          <div class="col-fixed" v-if="sortMode === 'fee'">
            <span v-if="item.totalFee">¥{{ item.totalFee }}</span>
            <span class="fee-dim" v-else>—</span>
          </div>

          <div class="col-fixed col-time">{{ formatTime(item.createdAt) }}</div>

          <div class="song-actions">
            <button class="song-btn" @click.stop="openDetailDialog(item)" title="详细信息">
              <span style="font-size:14px;">📄</span>
            </button>
            <button
              class="song-btn"
              data-sfx-overcharge
              @click.stop="handleConfirm(item)"
              :style="getConfirmStyle(item.id)"
              :title="confirmButtonTitle(item)"
              :disabled="isLocked(item) || item.status === 0 || isConfirmedToday(item)"
            >
              <span style="font-size:14px;">✓</span>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-width="2"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke-width="2"/></svg>
          <p>暂无代肝代办，点击"新增"开始</p>
        </div>
        <div class="empty" v-if="filteredRecords.length === 0 && records.length > 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke-width="2"/></svg>
          <p>没有匹配的记录</p>
        </div>
      </div>

      <!-- 详细信息弹窗 -->
      <div class="modal-mask" v-if="showDetail" @click.self="closeDetail">
        <div class="edit-popup">
          <h4>详细信息</h4>
          <div class="detail-grid">
            <p class="detail-section">基本信息</p>
            <div class="detail-field"><span class="dl">游戏</span>
              <SelectBox v-if="detailEditMode" style="flex:1" v-model="detailRecord.game" :options="gameOptions" />
              <span class="dv" v-else>{{ detailRecord.game || '终末地' }}</span>
            </div>
            <div class="detail-field"><span class="dl">服务项目</span>
              <input v-if="detailEditMode" v-model="detailRecord.service" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.service || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">类型</span>
              <SelectBox v-if="detailEditMode" style="flex:1" v-model="detailRecord.status" :options="typeOptions" />
              <span class="dv" v-else>{{ detailRecord.status === 2 ? '托管' : '单次' }}</span>
            </div>
            <div class="detail-field"><span class="dl">创建时间</span>
              <input v-if="detailEditMode" type="datetime-local" v-model="editCreatedAt" class="form-select" />
              <span class="dv" v-else>{{ formatTime(detailRecord.createdAt) }}</span>
            </div>
            <div class="detail-field"><span class="dl">账号</span>
              <template v-if="detailEditMode">
                <input v-model="detailRecord.account" class="form-select" :type="showAccount ? 'text' : 'password'" />
                <button class="pwd-toggle" @click="showAccount = !showAccount">{{ showAccount ? '隐藏' : '显示' }}</button>
              </template>
              <span class="dv" v-else :class="{ copyable: detailRecord.account }" @click="copyText(detailRecord.account)" :title="detailRecord.account ? '点击复制' : ''">{{ maskAccount(detailRecord.account) || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">密码</span>
              <template v-if="detailEditMode">
                <input v-model="detailRecord.password" class="form-select" :type="showPassword ? 'text' : 'password'" />
                <button class="pwd-toggle" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button>
              </template>
              <span class="dv" v-else :class="{ copyable: detailRecord.password }" @click="copyText(detailRecord.password)" :title="detailRecord.password ? '点击复制' : ''">{{ detailRecord.password ? '••••••' : '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">状态</span><span class="dv">{{ detailRecord.status === 0 ? '已完成' : detailRecord.status === 2 ? '托管中' : '未完成' }}</span></div>
            <div class="detail-field"><span class="dl">收费</span>
              <input v-if="detailEditMode" type="number" v-model="detailRecord.totalFee" class="form-select" placeholder="总收费" />
              <span class="dv" v-else>{{ detailRecord.actualFee || detailRecord.totalFee ? '¥' + (detailRecord.actualFee || detailRecord.totalFee) : '—' }}</span>
            </div>
            <template v-if="detailRecord.status === 2">
              <div class="detail-field"><span class="dl">剩余次数</span>
                <input v-if="detailEditMode" type="number" v-model="detailRecord.remainingDays" class="form-select" />
                <span class="dv" v-else>{{ detailRecord.remainingDays != null ? detailRecord.remainingDays : '—' }}</span>
              </div>
              <div class="detail-field" v-if="detailRecord.lastConfirmDate"><span class="dl">上次确认</span><span class="dv">{{ detailRecord.lastConfirmDate }}</span></div>
            </template>
            <p class="detail-section">平台名称</p>
            <div class="detail-field"><span class="dl">首选</span>
              <SelectBox v-if="detailEditMode" style="flex:1" v-model="detailRecord.preferredPlatform" :options="platformOptions" />
              <span class="dv" v-else>{{ detailRecord.preferredPlatform || 'wechat' }}</span>
            </div>
            <div class="detail-field"><span class="dl">微信</span>
              <input v-if="detailEditMode" v-model="detailRecord.wechatName" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.wechatName || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">QQ</span>
              <input v-if="detailEditMode" v-model="detailRecord.qqName" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.qqName || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">B站</span>
              <input v-if="detailEditMode" v-model="detailRecord.bilibiliName" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.bilibiliName || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">小红书</span>
              <input v-if="detailEditMode" v-model="detailRecord.xiaohongshuName" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.xiaohongshuName || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">抖音</span>
              <input v-if="detailEditMode" v-model="detailRecord.douyinName" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.douyinName || '—' }}</span>
            </div>
            <p class="detail-section">费用</p>
            <div class="detail-field"><span class="dl">总收费</span>
              <input v-if="detailEditMode" type="number" v-model="detailRecord.totalFee" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.totalFee ? '¥' + detailRecord.totalFee : '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">实际收费</span>
              <input v-if="detailEditMode" type="number" v-model="detailRecord.actualFee" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.actualFee ? '¥' + detailRecord.actualFee : '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">延后收费</span>
              <input v-if="detailEditMode" type="number" v-model="detailRecord.delayedFee" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.delayedFee ? '¥' + detailRecord.delayedFee : '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">备注</span>
              <input v-if="detailEditMode" v-model="detailRecord.note" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.note || '—' }}</span>
            </div>
          </div>
          <div class="edit-actions" style="margin-top:16px">
            <button v-if="!detailEditMode" class="save-btn" @click="detailEditMode = true">编辑</button>
            <button v-else class="save-btn" @click="saveDetail">保存</button>
            <button class="cancel-btn" @click="closeDetail">{{ detailEditMode ? '取消' : '关闭' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default { name: 'AccountPage' }
</script>
<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, inject } from 'vue'
import { useEditState } from '@/composables/useEditState'
import { useRowSelect } from '@/composables/useRowSelect'
import { maskAccount, getDisplayName } from '@/composables/useMask'
import { monthSpanDays } from '@/utils/date'
import { playOvercharge } from '@/utils/sound'
import SelectBox from '@/components/SelectBox.vue'

const navigateToAdd = inject('navigateToAdd')
const { startAdd } = useEditState()

// 下拉选项
const gameOptions = [{ value: '终末地', label: '终末地' }, { value: '明日方舟', label: '明日方舟' }]
const typeOptions = [{ value: 1, label: '单次' }, { value: 2, label: '托管' }]
const platformOptions = [
  { value: 'wechat', label: '微信' }, { value: 'qq', label: 'QQ' }, { value: 'bilibili', label: 'B站' },
  { value: 'xiaohongshu', label: '小红书' }, { value: 'douyin', label: '抖音' },
]

// ══════ 入场动画 ══════
const entered = ref(false)
onMounted(() => { requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true })) })
function staggerStyle(idx) {
  const base = 0.24; const interval = 0.023
  return { transitionDelay: (base + idx * interval) + 's' }
}

// ══════ 数据持久化 ══════
const STORAGE_KEY = 'tr-accounts'
const { isSelected, toggleSelect, selectLimit } = useRowSelect()
const records = ref([])
function loadRecords() {
  try { records.value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { records.value = [] }
}
function saveRecords() {
  const plain = JSON.parse(JSON.stringify(records.value))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plain))
  try { window.electron?.saveRecords?.(plain) } catch { /* ignore */ }
}
loadRecords()
onMounted(async () => {
  // 仅首次/无本地数据时从 Electron 加载
  if (!records.value.length) {
    try { const d = await window.electron?.loadRecords?.(); if (d?.length) { records.value = d; saveRecords() } } catch {}
  }
})

// 其它页面（每日汇报）确认完成后通知本页刷新
function onAccountsChanged() {
  loadRecords()
  records.value = [...records.value]
}
onMounted(() => window.addEventListener('tr-accounts-changed', onAccountsChanged))
onUnmounted(() => window.removeEventListener('tr-accounts-changed', onAccountsChanged))

// ══════ 工具函数（maskAccount / getDisplayName 见 @/composables/useMask）══════
function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// ══════ 确认完成（4段保护） ══════
const confirmClicks = ref(new Map())
const confirmTimers = new Map()
const CONFIRM_COLORS = { 1: '#ff4444', 2: '#ff8800', 3: '#aa44ff' }
function getConfirmStyle(id) {
  const n = confirmClicks.value.get(id) || 0
  if (n >= 1 && n <= 3) return { borderColor: CONFIRM_COLORS[n], color: CONFIRM_COLORS[n] }
  return {}
}
function confirmTitle(id) {
  const n = confirmClicks.value.get(id) || 0
  if (n === 1) return '再次点击确认（2/4）'
  if (n === 2) return '再次点击确认（3/4）'
  if (n === 3) return '最后一次点击执行（4/4）'
  return '确认完成'
}
function confirmButtonTitle(item) {
  if (isLocked(item)) return '上一托管未完成，暂不可确认'
  if (isConfirmedToday(item)) return '今日已确认，明日可再次确认'
  return confirmTitle(item.id)
}

function handleConfirm(item) {
  const id = item.id
  const cur = confirmClicks.value.get(id) || 0
  playOvercharge(cur)
  if (cur >= 3) {
    confirmClicks.value.delete(id)
    if (confirmTimers.has(id)) { clearTimeout(confirmTimers.get(id)); confirmTimers.delete(id) }
    confirmClicks.value = new Map(confirmClicks.value)
    executeConfirm(item)
  } else {
    confirmClicks.value.set(id, cur + 1)
    confirmClicks.value = new Map(confirmClicks.value)
    if (confirmTimers.has(id)) clearTimeout(confirmTimers.get(id))
    confirmTimers.set(id, setTimeout(() => {
      confirmClicks.value.delete(id)
      confirmClicks.value = new Map(confirmClicks.value)
      confirmTimers.delete(id)
    }, 3000))
  }
}

function addCompletion(record, wasHosting) {
  const list = JSON.parse(localStorage.getItem('tr-completions') || '[]')
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    taskId: record.id,
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 8),
    game: record.game,
    service: record.service || '',
    account: record.account,
    displayName: getDisplayName(record),
    wechatName: record.wechatName || '', qqName: record.qqName || '',
    bilibiliName: record.bilibiliName || '', xiaohongshuName: record.xiaohongshuName || '', douyinName: record.douyinName || '',
    preferredPlatform: record.preferredPlatform || 'wechat',
    fee: record.actualFee || record.totalFee || '',
    totalFee: record.totalFee || '', actualFee: record.actualFee || '', delayedFee: record.delayedFee || '',
    status: record.status || 1,
    wasHosting: !!wasHosting,
    note: record.note || '',
    password: record.password || '',
  })
  localStorage.setItem('tr-completions', JSON.stringify(list))
}

function executeConfirm(item) {
  const wasHosting = item.status === 2
  const fallback = wasHosting ? monthSpanDays(item.createdAt) : 1
  const cur = (item.remainingDays != null && item.remainingDays !== '') ? Number(item.remainingDays) : fallback
  item.remainingDays = cur - 1
  item.lastConfirmDate = todayStr.value
  if (item.remainingDays <= 0) {
    item.status = 0
    addCompletion(item, wasHosting)
    // 解锁续费项目：上一项目完成 → 直接后继可确认
    records.value.forEach(r => { if (r.locked && r.prevTaskId === item.id) r.locked = false })
  }
  saveRecords()
  // 替换数组引用，强制 filteredRecords / 排序重算（让灰显项立即沉底）
  records.value = [...records.value]
}

// ══════ 删除（4段保护） ══════
const deleteClicks = ref(new Map())
const deleteTimers = new Map()
function getDeleteStyle(id) {
  const n = deleteClicks.value.get(id) || 0
  if (n >= 1 && n <= 3) return { borderColor: CONFIRM_COLORS[n], color: CONFIRM_COLORS[n] }
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
  const id = item.id
  const cur = deleteClicks.value.get(id) || 0
  playOvercharge(cur)
  if (cur >= 3) {
    deleteClicks.value.delete(id)
    if (deleteTimers.has(id)) { clearTimeout(deleteTimers.get(id)); deleteTimers.delete(id) }
    deleteClicks.value = new Map(deleteClicks.value)
    records.value = records.value.filter(r => r.id !== id)
    saveRecords()
  } else {
    deleteClicks.value.set(id, cur + 1)
    deleteClicks.value = new Map(deleteClicks.value)
    if (deleteTimers.has(id)) clearTimeout(deleteTimers.get(id))
    deleteTimers.set(id, setTimeout(() => {
      deleteClicks.value.delete(id)
      deleteClicks.value = new Map(deleteClicks.value)
      deleteTimers.delete(id)
    }, 3000))
  }
}

// ══════ 锁定态（续费项目：上一托管未完成） ══════
function isLocked(item) {
  return !!item.locked
}

// ══════ 托管「每日只能确认一次」═════
// 用本地日期（避免 toISOString 的 UTC 跨时区偏移）
const todayStr = computed(() => {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
})
function isConfirmedToday(item) {
  return item.status === 2 && item.lastConfirmDate === todayStr.value
}
// 灰显（待激活 / 今日已确认）：一律沉底显示
function isGrayed(item) {
  return isLocked(item) || isConfirmedToday(item)
}

// ══════ 竖线颜色：上段类型色 + 下段价格色 ══════
function getTypeColor(item) {
  if (isGrayed(item)) return '#9E9E9E'    // 待激活 / 今日已确认：灰
  if (item.status === 2) return '#FF6D00' // 托管：亮橙
  return '#00B0FF'                        // 单次：亮蓝
}
function getFeeColor(item) {
  const fee = Number(item.totalFee) || 0
  if (fee >= 100) return '#FF1744'        // 高金额：亮红
  if (fee >= 50) return '#FFEA00'         // 中金额：亮黄
  if (fee > 0) return '#00E676'           // 低金额：亮绿
  return '#BDBDBD'                         // 无金额：灰
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
const searchQuery = ref('')
const gameFilter = ref('')
const sortMode = ref('hosting') // time | fee | hosting | game
const listKey = ref(0)
function setSortMode(mode) {
  if (sortMode.value === mode) return
  sortMode.value = mode
  listKey.value++
  // 重新触发列表入场动画
  entered.value = false
  requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true }))
}
const filteredRecords = computed(() => {
  let list = records.value.filter(r => r.status !== 0)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(r => (
      (getDisplayName(r) || '').toLowerCase().includes(q) ||
      (r.account || '').toLowerCase().includes(q) ||
      (r.game || '').toLowerCase().includes(q) ||
      String(r.service ?? '').includes(q) ||
      (r.note || '').toLowerCase().includes(q) ||
      (r.wechatName || '').toLowerCase().includes(q) ||
      (r.qqName || '').toLowerCase().includes(q)
    ))
  }
  if (gameFilter.value) list = list.filter(r => r.game === gameFilter.value)
  // 排序：灰显项（待激活 / 今日已确认）永远沉底，其余按所选排序方式
  list = [...list].sort((a, b) => {
    const da = isGrayed(a) ? 1 : 0
    const db = isGrayed(b) ? 1 : 0
    if (da !== db) return da - db
    if (sortMode.value === 'fee') return (Number(b.totalFee) || 0) - (Number(a.totalFee) || 0)
    if (sortMode.value === 'hosting') return (b.status === 2 ? 1 : 0) - (a.status === 2 ? 1 : 0)
    if (sortMode.value === 'game') return (a.game || '').localeCompare(b.game || '')
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  })
  return list
})

const gameChips = computed(() => {
  const map = new Map()
  activeRecords.value.forEach(r => { if (r.game) map.set(r.game, (map.get(r.game) || 0) + 1) })
  return [...map.entries()].map(([name, count]) => ({ name, count }))
})

// ══════ 统计 ══════
const activeRecords = computed(() => records.value.filter(r => r.status !== 0))
const pendingCount = computed(() => records.value.filter(r => r.status === 1).length)
const hostingCount = computed(() => records.value.filter(r => r.status === 2).length)
const totalFeeSum = computed(() => activeRecords.value.reduce((s, r) => s + (Number(r.totalFee) || 0), 0))

// ══════ 详细信息弹窗 ══════
const showDetail = ref(false)
const detailRecord = ref({})
const detailOriginal = ref(null)
const detailEditMode = ref(false)
const showPassword = ref(false)
const showAccount = ref(false)
const editCreatedAt = computed({
  get: () => toDatetimeLocal(detailRecord.value.createdAt),
  set: (val) => { if (val) detailRecord.value.createdAt = new Date(val).toISOString() }
})
function openDetailDialog(item) {
  detailOriginal.value = item
  detailRecord.value = { ...item }
  detailEditMode.value = false
  showPassword.value = false
  showAccount.value = false
  showDetail.value = true
}
function closeDetail() {
  showDetail.value = false
  detailEditMode.value = false
  showPassword.value = false
  showAccount.value = false
  detailOriginal.value = null
}
function saveDetail() {
  // 先退出编辑模式，确保无论后续是否出错都能退出
  detailEditMode.value = false
  showPassword.value = false
  showAccount.value = false
  try {
    if (detailOriginal.value) {
      Object.assign(detailOriginal.value, detailRecord.value)
    }
    saveRecords()
  } catch (e) {
    console.error('保存失败', e)
  }
}
function copyText(text) {
  if (text) navigator.clipboard?.writeText(text)
}

// ══════ 新增 ══════
function handleAdd() { startAdd('accounts'); navigateToAdd('accounts') }

// ══════ 键盘 ══════
function onKeydown(e) {
  if (e.key === 'Escape') { closeDetail() }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.col-time { opacity: 0.6; font-size: 11px; }
.col-note { opacity: 0.5; }
.song-info { flex: 1.4; }
.song-actions { margin-left: 4px; flex-shrink: 0; }
.fee-main { font-size: 13px; font-weight: 700; }
.fee-sub { opacity: 0.7; font-size: 11px; }
.fee-dim { opacity: 0.35; }
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
.song-item.dimmed { opacity: 0.3; pointer-events: none; }
.song-item.dimmed .song-actions { pointer-events: auto; }
/* dimmed 项目也参与入场动画（淡入 + 左滑） */
.local-music .song-item.dimmed {
  opacity: 0;
  transform: translateX(-20px);
  transition: opacity var(--motion-duration-fast) var(--motion-easing-standard),
              transform var(--motion-duration-fast) var(--motion-easing-standard);
}
.local-music.entered .song-item.dimmed {
  opacity: 0.3;
  transform: translateX(0);
}
.local-music.entered .song-item.hosting.dimmed {
  opacity: 0.5;
}
</style>

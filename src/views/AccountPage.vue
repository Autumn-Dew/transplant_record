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
        <span class="view-tabs view-switch">
          <span class="tl-entry-btn" :class="{ active: view === 'all' }" @click="view = 'all'">全部</span>
          <span class="tl-entry-btn" :class="{ active: view === 'todo' }" @click="view = 'todo'">代办</span>
          <!-- 已结束：已归档 / 已取消 / 已完成的记录在这里，便于查看并清理 -->
          <span class="tl-entry-btn" :class="{ active: view === 'closed' }" @click="view = 'closed'">已结束</span>
        </span>
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
      <div class="summary-strip" v-if="view === 'all' || view === 'todo'">
        <span class="summary-chip">总记录 <strong>{{ activeRecords.length }}</strong></span>
        <span class="summary-chip">未完成 <strong>{{ pendingCount }}</strong></span>
        <span class="summary-chip">托管中 <strong>{{ hostingCount }}</strong></span>
        <span class="summary-chip">总收费 <strong>¥{{ totalFeeSum }}</strong></span>
      </div>

      <!-- 游戏筛选 -->
      <div class="folder-strip" v-if="view === 'all' && gameChips.length > 1">
        <span class="folder-chip" :class="{ active: gameFilter === '' }" @click="gameFilter = ''">全部 <span class="folder-count">{{ activeRecords.length }}</span></span>
        <span v-for="chip in gameChips" :key="chip.name" class="folder-chip" :class="{ active: gameFilter === chip.name }" @click="gameFilter = chip.name">{{ chip.name }} <span class="folder-count">{{ chip.count }}</span></span>
      </div>

      <!-- 数据列表 -->
      <div class="song-list" :key="listKey" v-if="view === 'all' || view === 'todo' || view === 'closed'">
        <div
          v-for="(item, idx) in visibleRecords"
          :key="item.id"
          class="song-item"
          :class="{ dimmed: isGrayed(item), hosting: item.status === 2, selected: isSelected(item.id), done: isRecordDone(item) }"
          :style="rowStyle(item, idx)"
          @click="toggleSelect(item.id)"
        >
          <div class="song-info">
            <div class="song-name">{{ getDisplayName(item) || '未命名' }}</div>
            <div class="song-artist">{{ maskAccount(item.account) || '无账号' }}</div>
          </div>

          <div class="col-fixed">{{ item.gameName || item.game || '—' }}</div>

          <div class="col-fixed">
            <span v-if="item.service">{{ item.service }}</span>
            <span class="fee-dim" v-else>—</span>
          </div>

          <div class="col-fixed">
            <span v-if="isRecordDone(item)">已完成</span>
            <span v-else-if="isLocked(item)">待激活</span>
            <span v-else-if="isConfirmedToday(item)">今日已确认</span>
            <span v-else-if="item.state === 'paused'">暂停中</span>
            <span v-else-if="isHosting(item)">{{ hostProgress(item).completed }}/{{ hostProgress(item).planned }}次</span>
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
              :title="deleteTitle(item)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M10 11v6M14 11v6M5 6h14v14a2 2 0 012 2H7a2 2 0 01-2-2V6z"/></svg>
            </button>
            <button class="song-btn" @click.stop="todaySkip(item)" :style="getActionStyle('skip', item)" :title="actionTitle('skip', item)">
              <!-- 跳过今天：图像图标（三角 + 竖线），不再用符号 -->
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l10 7-10 7V5z" /><path d="M19 5v14" /></svg>
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

      <!-- 项目详情：与「代肝记录」同一套弹窗版式（实现见 components/ProjectDetail.vue） -->
      <ProjectDetail
        v-if="detail"
        :detail="detail"
        :game-options="gameOptions"
        @close="closeDetail"
        @save="onDetailSave"
        @archive="onDetailArchive"
        @restore="onDetailRestore"
        @add-period="onDetailAddPeriod"
        @remove="onDetailRemove"
        @force-remove="onDetailForceRemove"
      />
    </div>
  </div>
</template>

<script>
export default { name: 'AccountPage' }
</script>
<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { useEditState } from '@/composables/useEditState'
import { useRowSelect } from '@/composables/useRowSelect'
import { useConfirmClick } from '@/composables/useConfirmClick.js'
import { maskAccount, getDisplayName, PLATFORM_OPTIONS } from '@/domain/mask.js'
import { RESULT } from '@/domain/completion.js'
import { confirmExecution, todayTaskItems } from '@/services/projectService.js'
import ProjectDetail from '@/components/ProjectDetail.vue'
import { projectsRepo, gamesRepo } from '@/data/repos.js'
import { completeTaskById } from '@/utils/taskComplete.js'
import {
  updateProject, archiveProject, hardDeleteProject, forceDeleteProject, canHardDelete,
  restoreProject, addHostingPeriod,
} from '@/services/projectService.js'
import { buildProjectDetail } from '@/services/projectDetail.js'
import { gameOptions as buildGameOptions } from '@/domain/games.js'
import { isHosting, hostProgress, isClosed, isCompleted, isArchived, STATE_LABEL } from '@/domain/project.js'

const navigateToAdd = inject('navigateToAdd')
const { startAdd } = useEditState()

// 下拉选项：游戏来自「游戏管理」目录（新增游戏后自动出现）
const gameOptions = computed(() => buildGameOptions(gamesRepo.state.value))
const typeOptions = [{ value: 1, label: '单次' }, { value: 2, label: '托管' }]
const platformOptions = PLATFORM_OPTIONS

// ══════ 入场动画 ══════
const entered = ref(false)
onMounted(() => { requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true })) })
function staggerStyle(idx) {
  const base = 0.24; const interval = 0.023
  return { transitionDelay: (base + idx * interval) + 's' }
}

// ══════ 数据（统一经由 Repository，页面不再直接读写 localStorage）══════
const { isSelected, toggleSelect, selectLimit } = useRowSelect()
const records = projectsRepo.state
onMounted(() => { projectsRepo.hydrate() })

// ══════ 工具函数（maskAccount / getDisplayName 见 @/composables/useMask）══════
function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ══════ 确认完成（多次点击保护：连点 4 次生效，机制见 composables/useConfirmClick） ══════
const confirmCfm = useConfirmClick()
function getConfirmStyle(id) { return confirmCfm.styleOf(id) }
function confirmButtonTitle(item) {
  if (isLocked(item)) return '上一托管未完成，暂不可确认'
  if (isConfirmedToday(item)) return '今日已确认，明日可再次确认'
  return confirmCfm.titleOf(item.id, '确认完成')
}

function handleConfirm(item) {
  if (!confirmCfm.trigger(item.id)) return
  executeConfirm(item)
}

// 确认完成：统一走 service / repository
//   * 每次实际执行都会生成一条独立的执行记录（不再只在最后一天记录）
//   * 托管次数用尽自动完成，并解锁续费项目
function executeConfirm(item) {
  completeTaskById(item.id)
}

// ══════ 删除（多次点击保护） ══════
const deleteCfm = useConfirmClick()
function getDeleteStyle(id) { return deleteCfm.styleOf(id) }
// 有历史执行记录或被续费引用的项目一律「归档」，其余才物理删除
function deleteAction(item) {
  return canHardDelete(item.id).ok ? '删除' : '归档（保留历史记录）'
}
function deleteTitle(item) { return deleteCfm.titleOf(item.id, deleteAction(item)) }
function removeRecord(item) {
  if (canHardDelete(item.id).ok) hardDeleteProject(item.id)
  else archiveProject(item.id)
}
function handleDelete(item) {
  if (!deleteCfm.trigger(item.id)) return
  removeRecord(item)
}

// ══════ 锁定态（续费项目：上一托管未完成） ══════
function isLocked(item) {
  return !!item.locked
}

// ══════ 已完成（含归档 / 取消）：与「进行中」明确分层 ══════
// 列表里两者混排时，靠灰调 + 删除线 + 左缘灰条 + 「已完成」字样区分，
// 不再让一条结束的托管看起来和正在跑的一样。
function isRecordDone(item) {
  if (!item) return false
  return item.status === 0 || isCompleted(item) || isArchived(item) || isClosed(item)
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
const view = ref('all')       // all | todo | closed（closed = 已结束：已归档 / 已取消 / 已完成）

// 「代办」视图：与「全部」共用同一份列表与样式，只筛出今日未确定的托管与未确定的单项
const todoIds = computed(() => new Set(todayTaskItems(todayStr.value).map(t => String(t.id))))
const visibleRecords = computed(() => (
  view.value === 'todo'
    ? filteredRecords.value.filter(r => todoIds.value.has(String(r.id)))
    : filteredRecords.value
))
const sortMode = ref('hosting') // time | fee | hosting | game

function stateText(state) {
  return STATE_LABEL[state] || state || '—'
}
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
  // 「已结束」视图列出全部结束（status 0 / 已归档 / 已取消）的记录 ——
  // 这些记录在「全部 / 代办」里是看不到的，但数据仍然存在，需要能在这里找到并清理。
  const closedView = view.value === 'closed'
  let list = records.value.filter(r => (
    closedView ? (r.status === 0 || isClosed(r)) : (r.status !== 0 && !isClosed(r))
  ))
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

// ══════ 项目详情抽屉（数据组装见 services/projectDetail.js）══════
// 编辑只 patch 当前项目：历史周期、逐期收入与执行记录都不受影响。
const detail = ref(null)
function refreshDetail() {
  if (!detail.value) return
  const next = buildProjectDetail(String(detail.value.project.id))
  if (!next) { detail.value = null; return }   // 项目已不存在（物理删除后）
  detail.value = next
}
// ══════ 今日代办：直接从列表操作（原「今日」选项卡已移除）══════
// 与「确认 / 删除」走同一套多次点击机制（composables/useConfirmClick）
const actionCfm = useConfirmClick()
// 今日代办只保留「跳过今天」（不再提供「记录异常」与「延后到明天」）
const ACTION_LABEL = { skip: '跳过今天' }
function actionKey(kind, item) { return kind + ':' + String(item.id) }
function getActionStyle(kind, item) { return actionCfm.styleOf(actionKey(kind, item)) }
function actionTitle(kind, item) { return actionCfm.titleOf(actionKey(kind, item), ACTION_LABEL[kind]) }
function runAction(kind, item) {
  const key = actionKey(kind, item)
  if (!actionCfm.trigger(key)) return
  if (kind === 'skip') confirmExecution(String(item.id), { result: RESULT.SKIPPED, plannedDate: todayStr.value })
}
function todaySkip(item) { runAction('skip', item) }
function openDetailDialog(item) {
  detail.value = buildProjectDetail(String(item.id))
}
function closeDetail() { detail.value = null }
function onDetailSave(patch) {
  if (!detail.value) return
  updateProject(String(detail.value.project.id), patch || {})
  refreshDetail()
}
function onDetailArchive() { if (detail.value) { archiveProject(detail.value.project.id); refreshDetail() } }
function onDetailRestore() { if (detail.value) { restoreProject(detail.value.project.id); refreshDetail() } }
// ── 续费 = 在原项目上加天数 + 记一笔收费（不新建项目）──
function onDetailAddPeriod(payload) {
  if (!detail.value) return
  const id = detail.value.project.id
  addHostingPeriod(id, payload || {})
  refreshDetail()
}
function onDetailRemove() {
  if (!detail.value) return
  const r = hardDeleteProject(detail.value.project.id)
  if (r && r.ok) closeDetail()
  else refreshDetail()
}
// 强制删除：连执行记录一起删，并清理其它项目对它的引用（早期/后期数据冲突时用）
function onDetailForceRemove() {
  if (!detail.value) return
  const r = forceDeleteProject(detail.value.project.id)
  if (r && r.ok) closeDetail()
  else refreshDetail()
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
.today-wrap { padding: 0 12px 16px; }
.view-switch { margin-right: 4px; }

.col-time { opacity: 0.6; font-size: 11px; }
.col-note { opacity: 0.5; flex: 1.8; }        /* 备注占更宽 */
.song-info { flex: 0.9; }                      /* 名称 / 账号收窄，把空间让给备注 */
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

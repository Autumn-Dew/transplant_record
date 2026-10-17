<template>
  <div class="local-music" :class="{ entered: entered }">
    <div class="local-header">
      <div><h2>蓝图记录</h2><p class="desc">管理各阶段基建蓝图</p></div>
    </div>

    <div>
      <div class="local-toolbar">
        <button class="rc-global-btn" @click="handleAdd">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          <span>新增</span>
        </button>
        <span class="view-tabs">
          <span class="tl-entry-btn" :class="{ active: sortMode === 'group' }" @click="setSortMode('group')">分组</span>
          <span class="tl-entry-btn" :class="{ active: sortMode === 'color' }" @click="setSortMode('color')">颜色</span>
          <span class="tl-entry-btn" :class="{ active: sortMode === 'code' }" @click="setSortMode('code')">蓝图码</span>
          <span class="tl-entry-btn" :class="{ active: sortMode === 'name' }" @click="setSortMode('name')">名称</span>
        </span>
        <label class="select-limit-box" title="最多可同时选中的记录数">
          <span>选中</span>
          <input type="number" min="1" v-model.number="selectLimit" />
        </label>
        <div class="toolbar-spacer"></div>
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke-width="2"/></svg>
          <input v-model="searchQuery" type="text" placeholder="搜索蓝图…" class="search-input" />
          <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">×</button>
        </div>
      </div>

      <div class="song-list" :key="listKey">
        <div class="bp-header">
          <div class="bp-col name">名称</div>
          <div class="bp-col code">蓝图码</div>
          <div class="bp-col land">占地</div>
          <div class="bp-col products">产物</div>
          <div class="bp-col source">备注</div>
          <div class="bp-move-space" v-if="sortMode === 'group'"></div>
          <div class="bp-actions-space"></div>
        </div>

        <template v-for="(row, idx) in displayRows" :key="row.type === 'group' ? 'g-' + row.name : row.item.id">
          <div v-if="row.type === 'group'" class="bp-group-head" @click="toggleGroup(row.name)">
            <template v-if="renamingGroup === row.name">
              <input
                class="bp-rename-inp"
                v-model="renameValue"
                @click.stop
                @keydown.stop
                @keydown.enter.stop="commitRename(row.name)"
                @keydown.esc.stop="cancelRename"
              />
              <button class="bp-sort-btn" @click.stop="commitRename(row.name)">确定</button>
              <button class="bp-sort-btn" @click.stop="cancelRename">取消</button>
            </template>
            <template v-else>
              <span class="bp-caret" :title="isCollapsed(row.name) ? '展开该分组' : '收起该分组'">{{ isCollapsed(row.name) ? '▸' : '▾' }}</span>
              <span class="bp-group-name">{{ row.name }}</span>
              <span class="bp-group-count">{{ row.count }}</span>
              <span class="bp-collapsed-hint" v-if="isCollapsed(row.name)">已收起</span>
              <span class="bp-group-move" v-if="!row.ungrouped">
                <button class="bp-sort-btn" @click.stop="moveGroup(row.name, -1)" :disabled="groupIndex(row.name) === 0">↑</button>
                <button class="bp-sort-btn" @click.stop="moveGroup(row.name, 1)" :disabled="groupIndex(row.name) === groups.length - 1">↓</button>
                <button class="bp-sort-btn bp-rename-btn" @click.stop="startRename(row.name)" title="重命名该分组（批量修改组内所有蓝图）">✎</button>
              </span>
            </template>
          </div>

          <div
            v-else
            class="song-item"
            :class="{ selected: isSelected(row.item.id) }"
            :style="rowStyle(row.item, idx)"
            @click="toggleSelect(row.item.id)"
            @dblclick="copyCode(row.item)"
            :title="'单击选中 · 双击复制蓝图码: ' + (row.item.code || '—')"
          >
            <div class="bp-col name">{{ row.item.name || '未命名' }}</div>
            <div class="bp-col code">{{ row.item.code || '—' }}</div>
            <div class="bp-col land">{{ row.item.land || '—' }}</div>
            <div class="bp-col products">{{ row.item.products || '—' }}</div>
            <div class="bp-col source">{{ row.item.note || '—' }}</div>
            <span class="bp-move" v-if="sortMode === 'group'">
              <button class="bp-sort-btn" @click.stop="moveInGroup(row.groupName, row.item, -1)" :disabled="row.idxInGroup === 0">↑</button>
              <button class="bp-sort-btn" @click.stop="moveInGroup(row.groupName, row.item, 1)" :disabled="row.idxInGroup === row.groupTotal - 1">↓</button>
            </span>
            <div class="song-actions">
              <button class="song-btn" @click.stop="openDetailDialog(row.item)" title="详细信息/编辑">
                <span style="font-size:14px;">📄</span>
              </button>
              <button
                class="song-btn"
                data-sfx-overcharge
                @click.stop="handleDelete(row.item)"
                :style="getDeleteStyle(row.item.id)"
                :title="deleteTitle(row.item.id)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M10 11v6M14 11v6M5 6h14v14a2 2 0 012 2H7a2 2 0 01-2-2V6z"/></svg>
              </button>
            </div>
          </div>
        </template>

        <div class="empty" v-if="displayRows.length === 0 && records.length === 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-width="2"/><path d="M14 2v6h6" stroke-width="2"/></svg>
          <p>暂无蓝图，点击"新增"添加</p>
        </div>
        <div class="empty" v-if="displayRows.length === 0 && records.length > 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke-width="2"/></svg>
          <p>没有匹配的记录</p>
        </div>
      </div>

      <!-- 详情/编辑弹窗 -->
      <div class="modal-mask" v-if="showDetail" @click.self="closeDetail">
        <div class="edit-popup">
          <h4>蓝图详情</h4>
          <div class="detail-grid">
            <p class="detail-section">蓝图信息</p>
            <div class="detail-field"><span class="dl">分组</span>
              <input v-if="detailEditMode" v-model="detailRecord.group" class="form-select" placeholder="未分组" list="bp-groups" />
              <span class="dv" v-else>{{ detailRecord.group || '未分组' }}</span>
            </div>
            <div class="detail-field"><span class="dl">蓝图码</span>
              <input v-if="detailEditMode" v-model="detailRecord.code" class="form-select mono-input" />
              <span class="dv" v-else :class="{ copyable: detailRecord.code }" @click="copyCode(detailRecord)" :title="detailRecord.code ? '点击复制' : ''">{{ detailRecord.code || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">名称</span>
              <input v-if="detailEditMode" v-model="detailRecord.name" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.name || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">占地</span>
              <input v-if="detailEditMode" v-model="detailRecord.land" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.land || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">产物</span>
              <input v-if="detailEditMode" v-model="detailRecord.products" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.products || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">蓝图来源</span>
              <input v-if="detailEditMode" v-model="detailRecord.source" class="form-select" />
              <span class="dv" v-else>{{ detailRecord.source || '—' }}</span>
            </div>
            <div class="detail-field"><span class="dl">颜色</span>
              <div v-if="detailEditMode" class="color-swatches">
                <span v-for="c in presetColors" :key="c" class="color-swatch" :style="{ background: c }" :class="{ active: detailRecord.color === c }" @click="detailRecord.color = c"></span>
                <input type="color" v-model="detailRecord.color" class="color-input" title="自定义颜色" />
                <input
                  v-model="detailRecord.color"
                  class="bp-hex"
                  :class="{ invalid: !isValidHex(detailRecord.color) }"
                  placeholder="#RRGGBB"
                  title="可直接输入 HEX"
                  @change="detailRecord.color = normalizeHex(detailRecord.color)"
                />
                <button v-if="detailRecord.color" class="pwd-toggle" @click="detailRecord.color = ''">清除</button>
              </div>
              <span v-else class="dv">
                <span v-if="detailRecord.color" class="color-preview" :style="{ background: detailRecord.color }"></span>{{ detailRecord.color || '—' }}
              </span>
            </div>
            <div class="detail-field"><span class="dl">备注</span>
              <input v-if="detailEditMode" v-model="detailRecord.note" class="pd-inp" placeholder="备注（如：材料消耗 / 注意事项）" />
              <span v-else class="dv">{{ detailRecord.note || '—' }}</span>
            </div>
          </div>
          <datalist id="bp-groups">
            <option v-for="g in groups" :key="g" :value="g" />
          </datalist>
          <div class="edit-actions" style="margin-top:16px">
            <button v-if="!detailEditMode" class="save-btn" @click="detailEditMode = true">编辑</button>
            <button v-else class="save-btn" :style="cfm.styleOf('save-detail')" :title="cfm.titleOf('save-detail', '保存')" @click="saveDetail">保存</button>
            <button v-if="!detailEditMode" class="cancel-btn" :style="cfm.styleOf('duplicate')" :title="cfm.titleOf('duplicate', '以此为基础新建')" @click="duplicateDetail">以此为基础新建</button>
            <button class="cancel-btn" @click="closeDetail">{{ detailEditMode ? '取消' : '关闭' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue'
import { useEditState } from '@/composables/useEditState'
import { useRowSelect } from '@/composables/useRowSelect'
import { useConfirmClick } from '@/composables/useConfirmClick.js'
import { blueprintsRepo, blueprintGroupsRepo } from '@/data/repos.js'
import { isValidHex, normalizeHex, normalizeFontSize, duplicateBlueprint } from '@/domain/blueprints.js'

const navigateToAdd = inject('navigateToAdd')
const { startAdd } = useEditState()
// 多次点击确认（所有写操作统一走这套机制）
const cfm = useConfirmClick()

const entered = ref(false)
onMounted(() => { requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true })) })
function staggerStyle(idx) { return { transitionDelay: (0.24 + Math.max(0, idx) * 0.023) + 's' } }

const presetColors = ['#FF1744', '#FF6D00', '#FFEA00', '#00E676', '#00B0FF', '#2979FF', '#9C27B0', '#F50057']

// ══════ 数据（统一经由 Repository）══════
const records = blueprintsRepo.state
const groups = blueprintGroupsRepo.state
onMounted(() => { blueprintsRepo.hydrate() })

function saveRecords() { blueprintsRepo.persist() }
function saveGroups(list) { blueprintGroupsRepo.save(list ?? groups.value) }

// ══════ 分组重命名（批量修改该组下所有蓝图） ══════
const renamingGroup = ref('')
const renameValue = ref('')
function startRename(name) { renamingGroup.value = name; renameValue.value = name }
function cancelRename() { renamingGroup.value = ''; renameValue.value = '' }
function commitRename(oldName) {
  const v = String(renameValue.value || '').trim()
  if (!v || v === oldName) { cancelRename(); return }
  if (groups.value.includes(v)) { cancelRename(); return } // 防止与其它组重名合并
  blueprintsRepo.replaceAll(records.value.map(r =>
    String(r.group || '').trim() === oldName ? { ...r, group: v } : r))
  const i = groups.value.indexOf(oldName)
  if (i >= 0) { const arr = [...groups.value]; arr[i] = v; saveGroups(arr) }
  // 详情弹窗若正打开着该组内的记录 → 同步组名，避免稍后保存把旧组名写回（数据不同步）
  if (detailRecord.value && String(detailRecord.value.group || '').trim() === oldName) {
    const synced = blueprintsRepo.find(detailRecord.value.id)
    if (synced) { detailRecord.value = { ...synced }; detailOriginal.value = synced }
  }
  cancelRename()
}

// ══════ 单击选中（纯视觉，上限全局共享） ══════
const { isSelected, toggleSelect, selectLimit } = useRowSelect()

const searchQuery = ref('')
const sortMode = ref('group') // group | color | code | name
const listKey = ref(0)
function setSortMode(mode) {
  if (sortMode.value === mode) return
  sortMode.value = mode
  listKey.value++
  entered.value = false
  requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true }))
}

function matchQuery(r, q) {
  return (
    (r.code || '').toLowerCase().includes(q) ||
    (r.name || '').toLowerCase().includes(q) ||
    (r.land || '').toLowerCase().includes(q) ||
    (r.products || '').toLowerCase().includes(q) ||
    (r.source || '').toLowerCase().includes(q) ||
    (r.group || '').toLowerCase().includes(q)
  )
}
const filteredRecords = computed(() => {
  let list = records.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter(r => matchQuery(r, q))
  return [...list].sort((a, b) => {
    if (sortMode.value === 'code') return (a.code || '').localeCompare(b.code || '')
    if (sortMode.value === 'name') return (a.name || '').localeCompare(b.name || '')
    const ca = a.color || ''
    const cb = b.color || ''
    if (!ca && cb) return 1
    if (ca && !cb) return -1
    return ca.localeCompare(cb)
  })
})

// 分组视图：组顺序 = tr-blueprint-groups，组内顺序 = records 原始顺序
const groupedRecords = computed(() => {
  let list = records.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter(r => matchQuery(r, q))
  const map = new Map()
  const ungrouped = []
  list.forEach(r => {
    const g = String(r.group || '').trim()
    if (g) { if (!map.has(g)) map.set(g, []); map.get(g).push(r) }
    else ungrouped.push(r)
  })
  const out = []
  groups.value.forEach(g => { if (map.has(g)) { out.push({ name: g, items: map.get(g) }); map.delete(g) } })
  map.forEach((items, name) => out.push({ name, items }))
  if (ungrouped.length) out.push({ name: '未分组', items: ungrouped, ungrouped: true })
  return out
})

// 统一渲染行（分组模式下插入「组头」伪行）
const displayRows = computed(() => {
  if (sortMode.value !== 'group') {
    return filteredRecords.value.map(r => ({ type: 'item', item: r, groupName: '' }))
  }
  const rows = []
  groupedRecords.value.forEach(grp => {
    rows.push({ type: 'group', name: grp.name, count: grp.items.length, ungrouped: !!grp.ungrouped })
    // 分组折叠：收起时只留组头，条目全部隐藏（纯展示，不影响数据与排序）
    if (collapsed.value[grp.name]) return
    grp.items.forEach((item, i) => rows.push({
      type: 'item', item, idxInGroup: i, groupTotal: grp.items.length,
      groupName: grp.name, ungrouped: !!grp.ungrouped,
    }))
  })
  return rows
})

// ── 分组收纳（隐藏 / 显示组内条目）──
// 默认只展开第一个分组，其余收起。
// ⚠ 必须监听 groupedRecords（真正渲染出来的分组，来自蓝图自带的 group 字段），
//   而不是 groups（那是手动排序用的列表，没排过序时是空数组 —— 之前监听它就永远不生效）。
// 每次发现「新出现的组」补上默认值，已存在的不动，保留用户手动展开/收起。
const collapsed = ref({})
watch(groupedRecords, list => {
  const next = { ...collapsed.value }
  let changed = false
  ;(Array.isArray(list) ? list : []).forEach((grp, i) => {
    const name = grp && grp.name
    if (!name || name in next) return
    next[name] = i > 0          // 第一个组展开，其余收起
    changed = true
  })
  if (changed) collapsed.value = next
}, { immediate: true })
function isCollapsed(name) { return !!collapsed.value[name] }
function toggleGroup(name) {
  if (renamingGroup.value === name) return
  collapsed.value = { ...collapsed.value, [name]: !collapsed.value[name] }
}

function groupIndex(name) { return groups.value.indexOf(name) }
function moveGroup(name, dir) {
  const i = groups.value.indexOf(name)
  if (i < 0) return
  const t = i + dir
  if (t < 0 || t >= groups.value.length) return
  const arr = [...groups.value]
  const [x] = arr.splice(i, 1)
  arr.splice(t, 0, x)
  saveGroups(arr)
}
function moveInGroup(groupName, item, dir) {
  const isUng = groupName === '未分组'
  const inGroup = (r) => (isUng ? !String(r.group || '').trim() : String(r.group || '').trim() === groupName)
  const same = records.value.filter(inGroup)
  const gi = same.indexOf(item)
  const t = gi + dir
  if (gi < 0 || t < 0 || t >= same.length) return
  const other = same[t]
  const ai = records.value.indexOf(item)
  const bi = records.value.indexOf(other)
  const arr = [...records.value]
  arr[ai] = other
  arr[bi] = item
  blueprintsRepo.replaceAll(arr)
}

// ══════ 记录颜色竖线 ══════
function rowStyle(item, idx) {
  const base = staggerStyle(idx)
  if (item.color) {
    return { ...base, '--bar-top': item.color, '--bar-bottom': item.color }
  }
  return base
}

// ── 删除（多次点击保护，机制见 composables/useConfirmClick）──
const deleteCfm = useConfirmClick()
function getDeleteStyle(id) { return deleteCfm.styleOf(id) }
function deleteTitle(id) { return deleteCfm.titleOf(id, '删除') }
function handleDelete(item) {
  if (!deleteCfm.trigger(item.id)) return
  blueprintsRepo.remove(item.id)
  // 详情弹窗正打开着同一条 → 关闭，避免停留在一条已删除的记录上
  if (detailRecord.value && String(detailRecord.value.id) === String(item.id)) closeDetail()
}

function copyCode(item) {
  if (item.code) {
    navigator.clipboard.writeText(item.code).then(() => {}).catch(() => {})
  }
}

// ══════ 详情/编辑弹窗 ══════
const showDetail = ref(false)
const detailRecord = ref({})
const detailOriginal = ref(null)
const detailEditMode = ref(false)
function openDetailDialog(item) {
  detailOriginal.value = item
  detailRecord.value = { ...item }
  detailEditMode.value = false
  showDetail.value = true
}
function closeDetail() {
  showDetail.value = false
  detailEditMode.value = false
  detailOriginal.value = null
}
// 以当前详情记录为基础新建：深拷贝为**完全独立**的新蓝图，随后直接在弹窗里编辑副本。
// 副本与原记录互不影响（分组 / 字段 / 颜色 / 字号都各自独立）。
function duplicateDetail() {
  const rec = detailRecord.value
  if (!rec || !rec.id) return
  if (!cfm.trigger('duplicate')) return
  const copy = duplicateBlueprint(rec)
  blueprintsRepo.add(copy)
  rememberGroup(copy.group)
  const saved = blueprintsRepo.find(copy.id)
  if (saved) {
    detailOriginal.value = saved
    detailRecord.value = { ...saved }
    detailEditMode.value = true
  }
}
function rememberGroup(name) {
  const v = String(name || '').trim()
  if (!v || groups.value.includes(v)) return
  saveGroups([...groups.value, v])
}
function saveDetail() {
  if (!cfm.trigger('save-detail')) return
  detailEditMode.value = false
  try {
    const rec = detailRecord.value
    if (rec && rec.id) {
      const patch = { ...rec }
      delete patch.id
      // 字号 / 颜色落库前规范化：空值与越界值不会写进历史记录
      if ('fontSize' in patch) patch.fontSize = normalizeFontSize(patch.fontSize)
      if ('color' in patch) patch.color = normalizeHex(patch.color)
      blueprintsRepo.update(String(rec.id), patch)
      // 保存后刷新弹窗与列表，避免弹窗停留在旧副本上（数据不同步）
      const saved = blueprintsRepo.find(rec.id)
      if (saved) { detailRecord.value = { ...saved }; detailOriginal.value = saved }
    }
    rememberGroup(rec?.group)
  } catch (e) {
    console.error('保存失败', e)
  }
}

function handleAdd() { startAdd('blueprints'); navigateToAdd('blueprints') }

function onKeydown(e) { if (e.key === 'Escape') { closeDetail() } }
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.bp-col { flex: 1; min-width: 0; padding: 0 6px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bp-col.code { font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace !important; font-weight: 600; flex: 0.8; }
.bp-col.name { font-weight: 700; flex: 0.8; }
.bp-col.land { flex: 0.5; text-align: center; }
.bp-col.products { flex: 1.2; }
.bp-col.source { flex: 0.8; opacity: 0.6; }
.copyable { cursor: pointer; border-bottom: 1px dashed var(--border-color); }
.copyable:hover { opacity: 0.7; }
.bp-header {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 32px;
  border-bottom: 2px solid var(--border-color);
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg-secondary);
}
.bp-header .bp-col { font-size: 11px; }
.bp-actions-space { width: 80px; flex-shrink: 0; }
.bp-move-space { width: 44px; flex-shrink: 0; }

/* 分组头（仅下方一条分割线，避免多组相邻时线条叠粗） */
.bp-group-head {
  display: flex; align-items: center; gap: 8px;
  height: 30px; padding: 0 12px;
  cursor: pointer;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 12px; font-weight: 700; font-family: monospace;
  position: relative; z-index: 1;
}
.bp-group-name { letter-spacing: 1px; }
.bp-caret { width: 12px; flex-shrink: 0; font-size: 11px; opacity: 0.6; }
.bp-collapsed-hint { font-size: 10px; font-family: monospace; opacity: 0.45; }
.bp-group-count {
  font-size: 10px; opacity: 0.6; padding: 0 6px;
  border: 1px solid var(--border-color);
}
.bp-group-move { display: flex; gap: 1px; margin-left: auto; }
.bp-rename-btn { font-size: 12px; padding: 0 6px; }
.bp-rename-inp {
  height: 22px; padding: 0 6px; min-width: 160px;
  border: 2px solid var(--border-color); background: var(--bg-primary);
  color: var(--text-primary); font-size: 12px; font-family: inherit; outline: none;
}
.bp-rename-inp:focus { border-color: var(--btn-hover-bg); }

/* 行内 / 组头 排序按钮 */
.bp-move { width: 44px; flex-shrink: 0; display: flex; gap: 2px; justify-content: center; }
.bp-sort-btn {
  font-size: 10px; padding: 1px 5px; line-height: 1.3;
  border: 1px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); cursor: pointer; font-family: monospace;
  transition: background var(--motion-duration-normal), color var(--motion-duration-normal);
}
.bp-sort-btn:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.bp-sort-btn:disabled { opacity: 0.15; cursor: default; }
.bp-sort-btn:disabled:hover { background: var(--bg-secondary); color: var(--text-primary); }

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
.color-swatches { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.color-swatch {
  width: 22px; height: 22px;
  display: inline-block;
  cursor: pointer;
  border: 2px solid transparent;
  flex-shrink: 0;
}
.color-swatch.active { border-color: var(--text-primary); }
.color-input {
  width: 30px; height: 26px;
  padding: 0;
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  cursor: pointer;
}
.color-preview {
  display: inline-block;
  width: 14px; height: 14px;
  margin-right: 4px;
  vertical-align: middle;
}

/* ── 颜色：HEX 直填（非法值给出提示，不静默丢弃）── */
.bp-hex {
  width: 92px; height: 24px; padding: 0 6px;
  border: 1px solid var(--border-color); background: var(--bg-primary);
  color: var(--text-primary); font-family: monospace; font-size: 11px;
}
.bp-hex.invalid { border-color: #d00; color: #d00; }
</style>

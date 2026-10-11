<template>
  <div class="boosting-diary" :class="[themeClass, { entered }]">
    <!-- ══════ 标题栏 ══════ -->
    <div class="diary-header">
      <div class="header-row">
        <div>
          <h2>代肝日记</h2>
          <p class="desc">记录每一单，看清每一分钱</p>
        </div>
        <span class="header-actions">
          <button class="tl-entry-btn" @click="showCustomerPanel = !showCustomerPanel" title="客户列表">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>客户</span>
          </button>
          <button class="tl-entry-btn" @click="openAddModal" title="写日记">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>新日记</span>
          </button>
        </span>
      </div>
    </div>

    <!-- ══════ 统计概览 ══════ -->
    <div class="diary-stats-row">
      <div class="stat-chip">本月 <strong>{{ monthStats.orders }}</strong> 单</div>
      <div class="stat-chip">收入 <strong>¥{{ monthStats.income }}</strong></div>
      <div class="stat-chip">实收 <strong>¥{{ monthStats.actual }}</strong></div>
      <div class="stat-chip">抽成 <strong>¥{{ monthStats.fee }}</strong></div>
    </div>

    <!-- ══════ 工具栏 ══════ -->
    <div class="diary-toolbar">
      <button class="tl-entry-btn" @click="goMonth(-1)" :disabled="!hasPrevMonth">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="diary-month-label">{{ currentMonthLabel }}</span>
      <button class="tl-entry-btn" @click="goMonth(1)" :disabled="!hasNextMonth">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
      <select class="tl-filter" v-model="filterGame" @change="loadDiary">
        <option value="">全部游戏</option>
        <option v-for="g in allGames" :key="g" :value="g">{{ g }}</option>
      </select>
      <select class="tl-filter" v-model="filterCustomer" @change="loadDiary">
        <option value="">全部客户</option>
        <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <span class="diary-hint">← 滚轮滚动 →</span>
    </div>

    <!-- ══════ 主区域 ══════ -->
    <div class="diary-main">
      <!-- 左侧客户面板 -->
      <div class="customer-panel" :class="{ open: showCustomerPanel }">
        <div class="customer-panel-head">客户列表 ({{ customers.length }})</div>
        <div class="customer-list">
          <div
            v-for="c in customers" :key="c.id"
            class="customer-row"
            :class="{ active: filterCustomer === c.id }"
            @click="filterCustomer = filterCustomer === c.id ? '' : c.id; loadDiary()"
          >
            <span class="customer-name">{{ c.name }}</span>
            <span class="customer-game">{{ c.game }}</span>
            <span class="customer-price" v-if="c.price">¥{{ c.price }}</span>
          </div>
        </div>
      </div>

      <!-- 右侧日记卡片 -->
      <div class="diary-scroll" ref="scrollBox" @wheel.prevent="onWheel">
        <div class="diary-cards">
          <div v-for="(entry, idx) in filteredEntries" :key="entry.id" class="diary-card" :style="staggerStyle(idx)">
            <div class="diary-card-head">
              <div class="diary-card-date">{{ entry.dateLabel }}</div>
              <div class="diary-card-badge" :class="entry.status">{{ statusMap[entry.status] }}</div>
            </div>
            <div class="diary-card-body">
              <div class="diary-card-row">
                <span class="label">客户</span>
                <span class="value">{{ entry.customerName }}</span>
              </div>
              <div class="diary-card-row">
                <span class="label">游戏</span>
                <span class="value">{{ entry.game }}</span>
              </div>
              <div class="diary-card-row">
                <span class="label">项目</span>
                <span class="value">{{ entry.project }}</span>
              </div>
              <div class="diary-card-content" v-if="entry.content">{{ entry.content }}</div>
              <div class="diary-card-row price-row">
                <span class="label">收入</span>
                <span class="value price">¥{{ entry.income }}</span>
                <span class="label">实收</span>
                <span class="value price">¥{{ entry.actualIncome }}</span>
              </div>
            </div>
            <div class="diary-card-actions">
              <button class="tl-entry-btn small" @click="openEditModal(entry)" title="编辑">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="tl-entry-btn small danger" @click="deleteEntry(entry.id)" title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════ 空状态 ══════ -->
    <div class="diary-empty" v-if="!filteredEntries.length && !loading">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      <p>本月暂无记录</p>
      <p class="sub">点击「新日记」开始记录</p>
    </div>

    <!-- ══════ 弹窗：添加/编辑 ══════ -->
    <div class="diary-modal-overlay" v-if="showModal" @click.self="closeModal">
      <div class="diary-modal">
        <div class="modal-head">
          <span>{{ editingEntry ? '编辑日记' : '新日记' }}</span>
          <button class="tl-entry-btn small" @click="closeModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <label>日期</label>
          <input type="date" v-model="form.date" class="tl-input" />
          <label>客户</label>
          <select v-model="form.customerId" class="tl-input" @change="onCustomerChange">
            <option value="">选择客户</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }} · {{ c.game }}</option>
          </select>
          <label>游戏</label>
          <input type="text" v-model="form.game" class="tl-input" placeholder="异星工厂 / 明日方舟 ..." />
          <label>项目</label>
          <input type="text" v-model="form.project" class="tl-input" placeholder="全包干 / 打boss / 活动 ..." />
          <div class="modal-row-2">
            <div>
              <label>状态</label>
              <select v-model="form.status" class="tl-input">
                <option value="completed">已完成</option>
                <option value="in-progress">进行中</option>
                <option value="accepted">已接单</option>
              </select>
            </div>
            <div>
              <label>收入 (¥)</label>
              <input type="number" v-model.number="form.income" class="tl-input" min="0" />
            </div>
          </div>
          <div class="modal-row-2">
            <div>
              <label>实收 (¥)</label>
              <input type="number" v-model.number="form.actualIncome" class="tl-input" min="0" />
            </div>
            <div>
              <label>抽成 (¥)</label>
              <input type="number" v-model.number="form.platformFee" class="tl-input" min="0" />
            </div>
          </div>
          <label>日记内容</label>
          <textarea v-model="form.content" class="tl-input tl-textarea" rows="3" placeholder="今天做了什么..."></textarea>
        </div>
        <div class="modal-foot">
          <button class="tl-entry-btn" @click="closeModal">取消</button>
          <button class="tl-entry-btn primary" @click="saveEntry">{{ editingEntry ? '保存' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useGlobalTheme } from '@/composables/useGlobalTheme'
import { usePageEnter } from '@/composables/usePageEnter'
import { K_BOOSTING_DIARY, K_BOOSTING_CUSTOMERS } from '@/constants/storage-keys'

const { themeClass } = useGlobalTheme()
const { entered, staggerStyle } = usePageEnter()

// ══════ 状态 ══════
const scrollBox = ref(null)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const filterGame = ref('')
const filterCustomer = ref('')
const showCustomerPanel = ref(true)
const loading = ref(false)

const entries = ref([])
const showModal = ref(false)
const editingEntry = ref(null)
const form = ref(emptyForm())

const statusMap = { completed: '✓ 已完成', 'in-progress': '○ 进行中', accepted: '⊕ 已接单' }

// ══════ 预设客户数据（来自 Excel Sheet2） ══════
const DEFAULT_CUSTOMERS = [
  { id: 'cu33',     name: 'Cu_33',               game: '异星工厂', project: '全包干',   price: 100, note: '' },
  { id: 'manthyyy', name: 'manthyyy',             game: '异星工厂', project: '全包干',   price: 0,   note: '' },
  { id: 'connor',   name: 'connor',               game: '异星工厂', project: '全包干',   price: 50,  note: '' },
  { id: 'gfh',      name: '故风花',               game: '异星工厂', project: '全包干',   price: 15,  note: '' },
  { id: 'xty',      name: '小太阳',               game: '异星工厂', project: '打boss',   price: 0,   note: '无偿帮忙' },
  { id: 'ss',       name: '水色',                 game: '异星工厂', project: '全包干',   price: 0,   note: 'QQ联系' },
  { id: 'clks',     name: '从零开始建设收容所',     game: '异星工厂', project: '打boss',   price: 5,   note: '拾荒者与染缸' },
  { id: 'bsmy',     name: '碧山暮云',             game: '异星工厂', project: '全包干',   price: 0,   note: '小虎' },
  { id: 'am',       name: '阿蒙',                 game: '明日方舟', project: '肉鸽全角', price: 20,  note: '' },
  { id: 'qm',       name: '匿名老板',             game: '异星工厂', project: '全包干',   price: 255, note: '' },
  { id: 'qy',       name: '祁野',                 game: '明日方舟', project: '搓玉',     price: 135, note: '' },
  { id: 'mm',       name: '猫猫',                 game: '异星工厂', project: '打boss',   price: 0,   note: '无偿帮忙' },
  { id: 'fy',       name: '飞羽',                 game: '明日方舟', project: '活动',     price: 30,  note: '原30/实10/抽20' },
]

// ══════ 客户列表 ══════
const customers = ref([])
function loadCustomers() {
  try {
    const raw = localStorage.getItem(K_BOOSTING_CUSTOMERS)
    customers.value = raw ? JSON.parse(raw) : [...DEFAULT_CUSTOMERS]
  } catch { customers.value = [...DEFAULT_CUSTOMERS] }
}
function saveCustomers() {
  localStorage.setItem(K_BOOSTING_CUSTOMERS, JSON.stringify(customers.value))
}
loadCustomers()

// ══════ 游戏去重 ══════
const allGames = computed(() => [...new Set(customers.value.map(c => c.game))].sort())

// ══════ 月份导航 ══════
const currentMonthLabel = computed(() => `${currentYear.value} 年 ${currentMonth.value} 月`)
const hasPrevMonth = computed(() => {
  const d = new Date()
  return currentYear.value > 2024 || (currentYear.value === 2024 && currentMonth.value > 1)
})
const hasNextMonth = computed(() => {
  const d = new Date()
  return currentYear.value < d.getFullYear() || (currentYear.value === d.getFullYear() && currentMonth.value < d.getMonth() + 1)
})
function goMonth(delta) {
  let m = currentMonth.value + delta, y = currentYear.value
  if (m > 12) { m = 1; y++ }
  if (m < 1) { m = 12; y-- }
  currentYear.value = y; currentMonth.value = m
}

// ══════ 日记 CRUD ══════
function loadDiary() {
  try {
    const raw = localStorage.getItem(K_BOOSTING_DIARY)
    entries.value = raw ? JSON.parse(raw) : []
  } catch { entries.value = [] }
}

const filteredEntries = computed(() => {
  const ms = new Date(currentYear.value, currentMonth.value - 1, 1).getTime()
  const me = new Date(currentYear.value, currentMonth.value, 1).getTime()
  let list = entries.value.filter(e => {
    const t = new Date(e.date).getTime()
    return t >= ms && t < me
  })
  if (filterGame.value) list = list.filter(e => e.game === filterGame.value)
  if (filterCustomer.value) list = list.filter(e => e.customerId === filterCustomer.value)
  // 按日期排序，最新在前
  list.sort((a, b) => new Date(b.date) - new Date(a.date))
  // 附加 label
  const wd = ['日','一','二','三','四','五','六']
  return list.map(e => {
    const d = new Date(e.date)
    return {
      ...e,
      dateLabel: `${d.getMonth()+1}月${d.getDate()}日 · 周${wd[d.getDay()]}`
    }
  })
})

const monthStats = computed(() => {
  const list = filteredEntries.value
  const income = list.reduce((s, e) => s + (e.income || 0), 0)
  const actual = list.reduce((s, e) => s + (e.actualIncome || 0), 0)
  const fee = list.reduce((s, e) => s + (e.platformFee || 0), 0)
  return { orders: list.length, income, actual, fee }
})

function emptyForm() {
  const today = new Date()
  return {
    date: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`,
    customerId: '',
    customerName: '',
    game: '',
    project: '',
    status: 'completed',
    income: 0,
    actualIncome: 0,
    platformFee: 0,
    content: '',
  }
}

function openAddModal() {
  editingEntry.value = null
  form.value = emptyForm()
  showModal.value = true
}

function openEditModal(entry) {
  editingEntry.value = entry
  form.value = {
    date: entry.date,
    customerId: entry.customerId,
    customerName: entry.customerName,
    game: entry.game,
    project: entry.project,
    status: entry.status,
    income: entry.income,
    actualIncome: entry.actualIncome,
    platformFee: entry.platformFee,
    content: entry.content,
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingEntry.value = null
}

function onCustomerChange() {
  const c = customers.value.find(x => x.id === form.value.customerId)
  if (c) {
    form.value.customerName = c.name
    form.value.game = c.game
    form.value.project = c.project
    form.value.income = c.price || 0
  }
}

function saveEntry() {
  if (!form.value.date) return
  const now = Date.now()
  if (editingEntry.value) {
    const idx = entries.value.findIndex(e => e.id === editingEntry.value.id)
    if (idx >= 0) entries.value[idx] = { ...editingEntry.value, ...form.value, updatedAt: now }
  } else {
    entries.value.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2,8)}`,
      ...form.value,
      createdAt: now,
    })
  }
  localStorage.setItem(K_BOOSTING_DIARY, JSON.stringify(entries.value))
  closeModal()
}

function deleteEntry(id) {
  entries.value = entries.value.filter(e => e.id !== id)
  localStorage.setItem(K_BOOSTING_DIARY, JSON.stringify(entries.value))
}

// ══════ 滚轮横向滚动 ══════
function onWheel(e) {
  const b = scrollBox.value
  if (b) b.scrollLeft += e.deltaY
}

// ══════ 生命周期 ══════
watch([currentYear, currentMonth], loadDiary)
onMounted(() => { loadDiary(); loadCustomers() })
</script>

<style scoped>
/* ══════ 页面容器 ══════ */
.boosting-diary {
  flex: 1; min-height: 0; height: 100%;
  background: var(--bg-primary); color: var(--text-primary);
  display: flex; flex-direction: column; overflow: hidden;
}

/* ══════ Header ══════ */
.diary-header { padding: 16px; border-bottom: 2px solid transparent; position: relative; }
.diary-header::after {
  content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 2px;
  background: var(--border-color); transform: scaleX(0);
  transition: transform var(--motion-duration-slow) var(--motion-easing-enter);
}
.entered .diary-header::after { transform: scaleX(1); }
.header-row { display: flex; justify-content: space-between; align-items: flex-start; }
.diary-header h2 {
  font-size: 20px; margin: 0 0 4px; letter-spacing: 3px;
  opacity: 0; transform: translateY(-10px);
  transition: opacity var(--motion-duration-medium) var(--motion-easing-standard),
              transform var(--motion-duration-medium) var(--motion-easing-standard),
              letter-spacing var(--motion-duration-slow);
}
.entered .diary-header h2 { opacity: 1; transform: translateY(0); letter-spacing: 0; }
.desc {
  font-size: 12px;
  opacity: 0; transform: translateY(-6px);
  transition: opacity var(--motion-duration-fast) var(--motion-easing-ease) 0.04s,
              transform var(--motion-duration-fast) var(--motion-easing-ease) 0.04s;
}
.entered .desc { opacity: 0.7; transform: translateY(0); }
.header-actions { display: flex; gap: 6px; }

/* ══════ 统计概览 ══════ */
.diary-stats-row {
  display: flex; gap: 10px; padding: 0 16px 12px;
  opacity: 0; transform: translateY(-6px);
  transition: opacity var(--motion-duration-fast) var(--motion-easing-ease) 0.06s,
              transform var(--motion-duration-fast) var(--motion-easing-ease) 0.06s;
}
.entered .diary-stats-row { opacity: 1; transform: translateY(0); }
.stat-chip {
  font-size: 12px; font-family: monospace;
  padding: 4px 10px; border: 1px solid var(--border-color);
  opacity: 0.65;
}
.stat-chip strong { font-weight: 700; opacity: 1; }

/* ══════ 工具栏 ══════ */
.diary-toolbar {
  display: flex; gap: 8px; padding: 0 16px 12px; align-items: center;
  border-bottom: 2px solid transparent; position: relative;
}
.diary-toolbar::after {
  content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 2px;
  background: var(--border-color); transform: scaleX(0);
  transition: transform var(--motion-duration-slow) var(--motion-easing-enter);
}
.entered .diary-toolbar::after { transform: scaleX(1); }
.diary-month-label {
  font-size: 13px; font-family: monospace; min-width: 100px; text-align: center;
  opacity: 0; transform: translateY(-4px);
  transition: opacity var(--motion-duration-fast) var(--motion-easing-ease) 0.10s,
              transform var(--motion-duration-fast) var(--motion-easing-ease) 0.10s;
}
.entered .diary-month-label { opacity: 1; transform: translateY(0); }
.diary-hint {
  font-size: 11px; font-family: monospace; margin-left: auto;
  opacity: 0;
  transition: opacity var(--motion-duration-fast) var(--motion-easing-ease) 0.18s;
}
.entered .diary-hint { opacity: 0.35; }

.tl-filter {
  height: 32px; padding: 0 8px; font-size: 12px; font-family: monospace;
  border: 2px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); cursor: pointer; outline: none;
  opacity: 0; transform: scaleX(0);
  transition: opacity var(--motion-duration-micro) var(--motion-easing-ease),
              transform var(--motion-duration-btn-transform) var(--motion-easing-enter);
}
.tl-filter:nth-child(4) { transition-delay: 0.08s; }
.tl-filter:nth-child(5) { transition-delay: 0.12s; }
.entered .tl-filter { opacity: 1; transform: scaleX(1); }
.tl-filter option { background: var(--bg-primary); color: var(--text-primary); }

/* ══════ tl-entry-btn 通用 ══════ */
.tl-entry-btn {
  display: flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px;
  border: 2px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-size: 12px; font-family: monospace;
  cursor: pointer; transition: var(--motion-btn-hover); flex-shrink: 0;
}
.tl-entry-btn:hover:not(:disabled) { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.tl-entry-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.tl-entry-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; }
.tl-entry-btn.small { height: 28px; padding: 0 8px; }
.tl-entry-btn.small svg { width: 13px; height: 13px; }
.tl-entry-btn.primary { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.tl-entry-btn.primary:hover { opacity: 0.85; background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.tl-entry-btn.danger:hover { border-color: #ff6b6b; color: #ff6b6b; }

/* header 按钮入场 */
.header-actions .tl-entry-btn {
  opacity: 0; transform: scaleX(0);
  transition: opacity var(--motion-duration-micro) var(--motion-easing-ease),
              transform var(--motion-duration-btn-transform) var(--motion-easing-enter);
}
.header-actions .tl-entry-btn:nth-child(1) { transition-delay: 0.08s; }
.header-actions .tl-entry-btn:nth-child(2) { transition-delay: 0.13s; }
.entered .header-actions .tl-entry-btn { opacity: 1; transform: scaleX(1); }

/* toolbar 月份按钮入场 */
.diary-toolbar .tl-entry-btn {
  opacity: 0; transform: scaleX(0);
  transition: opacity var(--motion-duration-micro) var(--motion-easing-ease),
              transform var(--motion-duration-btn-transform) var(--motion-easing-enter);
}
.diary-toolbar .tl-entry-btn:nth-child(1) { transition-delay: 0.08s; }
.diary-toolbar .tl-entry-btn:nth-child(3) { transition-delay: 0.13s; }
.entered .diary-toolbar .tl-entry-btn { opacity: 1; transform: scaleX(1); }

/* ══════ 主区域：客户面板 + 日记卡片 ══════ */
.diary-main { flex: 1; min-height: 0; display: flex; }

/* 客户面板 */
.customer-panel {
  width: 0; overflow: hidden; flex-shrink: 0;
  border-right: 0px solid var(--border-color);
  display: flex; flex-direction: column;
  transition: width var(--motion-duration-slow) var(--motion-easing-standard),
              border-width var(--motion-duration-slow) var(--motion-easing-standard);
}
.customer-panel.open { width: 200px; border-right-width: 2px; }
.customer-panel-head {
  font-size: 12px; font-family: monospace;
  padding: 10px 12px; border-bottom: 1px solid var(--border-color);
  opacity: 0.5; white-space: nowrap;
}
.customer-list { flex: 1; overflow-y: auto; }
.customer-list::-webkit-scrollbar { display: none; }
.customer-row {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; cursor: pointer; white-space: nowrap;
  border-bottom: 1px solid transparent;
  position: relative; z-index: 0;
  font-size: 12px; font-family: monospace;
}
.customer-row::before {
  content: ''; position: absolute; inset: 0; z-index: -1;
  background: var(--btn-hover-bg);
  transform: scaleX(0); transform-origin: center;
  transition: transform var(--motion-duration-slow) var(--motion-easing-ease);
}
.customer-row:hover::before { transform: scaleX(1); }
.customer-row:hover { color: var(--btn-hover-text); }
.customer-row.active { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.customer-name { flex: 1; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.customer-game { opacity: 0.5; font-size: 10px; }
.customer-price { flex-shrink: 0; opacity: 0.6; }

/* 日记滚动区 */
.diary-scroll { flex: 1; min-width: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.diary-scroll::-webkit-scrollbar { display: none; }
.diary-cards { display: flex; gap: 16px; height: 100%; align-items: stretch; padding: 12px; }
.diary-cards::after { content: ''; min-width: 1px; }

/* 日记卡片 */
.diary-card {
  flex-shrink: 0; width: 320px;
  border: 2px solid var(--border-color);
  padding: 24px; display: flex; flex-direction: column;
  opacity: 0; transform: translateY(20px);
  transition: opacity var(--motion-duration-normal) var(--motion-easing-standard),
              transform var(--motion-duration-normal) var(--motion-easing-standard),
              border-color var(--motion-duration-normal),
              background var(--motion-duration-normal);
}
.entered .diary-card { opacity: 1; transform: translateY(0); }
.diary-card:hover { border-color: var(--text-primary); background: var(--bg-secondary); }

.diary-card-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; padding-bottom: 12px;
  border-bottom: 1px solid transparent; position: relative;
}
.diary-card-head::after {
  content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 1px;
  background: var(--border-color); transform: scaleX(0);
  transition: transform var(--motion-duration-slow) var(--motion-easing-enter);
}
.entered .diary-card-head::after { transform: scaleX(1); }
.diary-card-date {
  font-size: 20px; font-weight: 100; letter-spacing: 2px;
  opacity: 0; transform: translateX(-8px);
  transition: opacity var(--motion-duration-fast) var(--motion-easing-standard),
              transform var(--motion-duration-fast) var(--motion-easing-standard);
}
.entered .diary-card-date { opacity: 1; transform: translateX(0); }
.diary-card-badge {
  font-size: 11px; font-family: monospace;
  padding: 2px 8px; border: 1px solid var(--border-color);
  opacity: 0; transform: translateX(6px);
  transition: opacity var(--motion-duration-fast) var(--motion-easing-ease) 0.03s,
              transform var(--motion-duration-fast) var(--motion-easing-ease) 0.03s;
}
.entered .diary-card-badge { opacity: 0.7; transform: translateX(0); }
.diary-card-badge.completed { border-color: #4caf50; color: #4caf50; }
.diary-card-badge.in-progress { border-color: #ff9800; color: #ff9800; }
.diary-card-badge.accepted { border-color: #2196f3; color: #2196f3; }

.diary-card-body { flex: 1; }
.diary-card-row {
  display: flex; gap: 6px; align-items: baseline;
  margin-bottom: 4px;
  opacity: 0; transform: translateX(-6px);
  transition: opacity var(--motion-duration-fast) var(--motion-easing-ease),
              transform var(--motion-duration-micro) var(--motion-easing-ease);
}
.entered .diary-card-row { opacity: 1; transform: translateX(0); }
.diary-card-row .label { font-size: 11px; font-family: monospace; opacity: 0.4; min-width: 28px; }
.diary-card-row .value { font-size: 13px; }
.diary-card-row.price-row { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color); }
.diary-card-row .price { font-weight: 700; font-family: monospace; }
.diary-card-content {
  font-size: 12px; line-height: 1.6; opacity: 0.6;
  margin: 8px 0; padding: 8px;
  border-left: 2px solid var(--border-color);
  opacity: 0; transform: translateX(-4px);
  transition: opacity var(--motion-duration-fast) var(--motion-easing-ease) 0.02s,
              transform var(--motion-duration-micro) var(--motion-easing-ease) 0.02s;
}
.entered .diary-card-content { opacity: 1; transform: translateX(0); }

.diary-card-actions {
  display: flex; gap: 4px; margin-top: 12px; padding-top: 12px;
  border-top: 1px solid var(--border-color); justify-content: flex-end;
  opacity: 0; transition: opacity var(--motion-duration-fast) var(--motion-easing-ease) 0.06s;
}
.entered .diary-card-actions { opacity: 0; }
.diary-card:hover .diary-card-actions { opacity: 1; }

/* ══════ 空状态 ══════ */
.diary-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  opacity: 0; transform: translateY(12px);
  transition: opacity var(--motion-duration-normal) var(--motion-easing-standard) 0.2s,
              transform var(--motion-duration-normal) var(--motion-easing-standard) 0.2s;
}
.entered .diary-empty { opacity: 0.35; transform: translateY(0); }
.diary-empty svg { width: 52px; height: 52px; }
.diary-empty p { font-size: 14px; margin: 0; }
.diary-empty .sub { font-size: 12px; opacity: 0.6; }

/* ══════ 弹窗 ══════ */
.diary-modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  animation: mt-fade-in 0.2s var(--motion-easing-standard);
}
.diary-modal {
  width: 420px; max-height: 80vh; overflow-y: auto;
  border: 2px solid var(--border-color);
  background: var(--bg-primary); color: var(--text-primary);
  animation: mt-modal-in 0.25s var(--motion-easing-standard);
}
.diary-modal::-webkit-scrollbar { display: none; }
.modal-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; border-bottom: 2px solid var(--border-color);
  font-size: 14px; font-weight: 700;
}
.modal-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.modal-body label {
  font-size: 11px; font-family: monospace; opacity: 0.5;
  margin-bottom: -6px;
}
.modal-row-2 { display: flex; gap: 12px; }
.modal-row-2 > div { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.modal-row-2 > div > label { margin-bottom: -2px; }
.tl-input {
  width: 100%; height: 34px; padding: 0 8px; box-sizing: border-box;
  border: 2px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-size: 13px; font-family: monospace;
  outline: none; transition: border-color var(--motion-duration-fast);
}
.tl-input:focus { border-color: var(--text-primary); }
.tl-textarea { height: auto; padding: 8px; resize: vertical; min-height: 60px; }
.modal-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 16px; border-top: 2px solid var(--border-color);
}
</style>

<template>
  <div class="local-music" :class="{ entered: entered }">
    <div class="local-header">
      <div>
        <h2>{{ editingId ? '编辑记录' : '新增记录' }}</h2>
        <p class="desc">{{ editingId ? '修改已有记录信息' : '添加新的代肝相关记录' }}</p>
      </div>
    </div>

    <!-- 类型选项卡 -->
    <div class="local-toolbar" style="border-bottom:2px solid transparent">
      <span class="view-tabs">
        <span class="tl-entry-btn" :class="{ active: activeTab === 'tasks' }" @click="switchTab('tasks')">代肝代办</span>
        <span class="tl-entry-btn" :class="{ active: activeTab === 'blueprints' }" @click="switchTab('blueprints')">蓝图记录</span>
      </span>
    </div>

    <!-- 表单区域 -->
    <div class="inline-edit">
      <!-- ========== 代肝代办表单 ========== -->
      <div class="edit-form" v-if="activeTab === 'tasks'">
        <div class="form-section-title">老板信息</div>
        <div class="form-row" v-if="!editingId">
          <label>从已有选择</label>
          <SelectBox style="flex:1;min-width:0" v-model="selectedTemplate" :options="templateOptions" placeholder="— 手动填写 —" @change="applyTemplate" />
        </div>
        <div class="form-row"><label>账号</label><input :type="showAccountInput ? 'text' : 'password'" v-model="taskForm.account" placeholder="11位手机号格式" /><button class="pwd-toggle" @click="showAccountInput = !showAccountInput">{{ showAccountInput ? '隐藏' : '显示' }}</button></div>
        <div class="form-row"><label>游戏</label><SelectBox style="flex:1;min-width:0" v-model="taskForm.game" :options="gameOptions" /></div>
        <div class="form-row"><label>服务项目</label><input v-model="taskForm.service" placeholder="选择或输入" /><button ref="serviceBtnRef" class="pwd-toggle svc-drop-btn" @click="toggleServicePanel">▾</button></div>
        <div class="form-row"><label>状态</label><SelectBox style="flex:1;min-width:0" v-model="taskForm.status" :options="statusOptions" /></div>
        <div class="form-row"><label>剩余次数</label><input type="number" v-model.number="taskForm.remainingDays" :placeholder="taskForm.status === 2 ? '默认按周期天数' : '默认1'" /></div>
        <div class="form-row"><label>备注</label><input v-model="taskForm.note" /></div>
        <div class="form-row"><label>密码</label><input :type="showPasswordInput ? 'text' : 'password'" v-model="taskForm.password" placeholder="游戏密码" /><button class="pwd-toggle" @click="showPasswordInput = !showPasswordInput">{{ showPasswordInput ? '隐藏' : '显示' }}</button></div>

        <div class="form-section-title">平台名称</div>
        <div class="form-row"><label>微信</label><input v-model="taskForm.wechatName" placeholder="微信名" /></div>
        <div class="form-row"><label>QQ</label><input v-model="taskForm.qqName" placeholder="QQ昵称" /></div>
        <div class="form-row"><label>B站</label><input v-model="taskForm.bilibiliName" placeholder="B站用户名" /></div>
        <div class="form-row"><label>小红书</label><input v-model="taskForm.xiaohongshuName" placeholder="小红书用户名" /></div>
        <div class="form-row"><label>抖音</label><input v-model="taskForm.douyinName" placeholder="抖音用户名" /></div>
        <div class="form-row"><label>优先显示</label><SelectBox style="flex:1;min-width:0" v-model="taskForm.preferredPlatform" :options="platformOptions" /></div>

        <div class="form-section-title">费用信息</div>
        <div class="form-row"><label>总收费</label><input type="number" v-model.number="taskForm.totalFee" /></div>
        <div class="form-row"><label>实际收费</label><input type="number" v-model.number="taskForm.actualFee" /></div>
        <div class="form-row"><label>延后收费</label><input type="number" v-model.number="taskForm.delayedFee" /></div>

        <div class="edit-actions">
          <button class="cancel-btn" @click="cancelEdit">取消</button>
          <button class="save-btn" @click="saveTask">{{ editingId ? '保存' : '添加' }}</button>
        </div>
      </div>

      <!-- ========== 蓝图表单 ========== -->
      <div class="edit-form" v-if="activeTab === 'blueprints'">
        <div class="form-row"><label>分组</label><input v-model="blueprintForm.group" placeholder="未分组" list="add-bp-groups" />
          <datalist id="add-bp-groups"><option v-for="g in blueprintGroups" :key="g" :value="g" /></datalist>
        </div>
        <div class="form-row"><label>蓝图码</label><input v-model="blueprintForm.code" class="mono-input" /></div>
        <div class="form-row"><label>名称</label><input v-model="blueprintForm.name" /></div>
        <div class="form-row"><label>占地</label><input v-model="blueprintForm.land" /></div>
        <div class="form-row"><label>产物</label><input v-model="blueprintForm.products" /></div>
        <div class="form-row"><label>蓝图来源</label><input v-model="blueprintForm.source" /></div>
        <div class="form-row"><label>颜色</label>
          <div class="color-swatches">
            <span v-for="c in presetColors" :key="c" class="color-swatch" :style="{ background: c }" :class="{ active: blueprintForm.color === c }" @click="blueprintForm.color = c"></span>
            <input type="color" v-model="blueprintForm.color" class="color-input" title="自定义颜色" />
            <button v-if="blueprintForm.color" class="pwd-toggle" @click="blueprintForm.color = ''">清除</button>
          </div>
        </div>
        <div class="edit-actions">
          <button class="cancel-btn" @click="cancelEdit">取消</button>
          <button class="save-btn" @click="saveBlueprint">{{ editingId ? '保存' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="servicePanelOpen" class="sb-panel" :style="servicePanelStyle" @click.stop>
      <div v-if="!serviceOptions.length" class="sb-empty">无可选项</div>
      <div v-for="(s, i) in serviceOptions" :key="i" class="sb-option" @click="pickService(s)">{{ s }}</div>
    </div>
  </Teleport>
</template>

<script>
export default { name: 'AddPage' }
</script>
<script setup>
import { computed, ref, onMounted, nextTick, onUnmounted } from 'vue'
import { useEditState } from '@/composables/useEditState'
import { maskAccount, getDisplayName } from '@/composables/useMask'
import { monthSpanDays, addMonth, fmtDate } from '@/utils/date'
import SelectBox from '@/components/SelectBox.vue'

const { editType, editRecord, clearEdit } = useEditState()

const entered = ref(false)
onMounted(() => { requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true })) })

const activeTab = ref('tasks')
onMounted(() => {
  if (editType.value === 'blueprints') activeTab.value = 'blueprints'
  if (editType.value === 'accounts') activeTab.value = 'tasks'
})
function switchTab(tab) { activeTab.value = tab }

const editingId = computed(() => editRecord.value?.id || null)

const defaultTask = () => ({
  account: '', game: '终末地', service: '', status: 1,
  remainingDays: '', note: '', password: '',
  wechatName: '', qqName: '', bilibiliName: '', xiaohongshuName: '', douyinName: '',
  preferredPlatform: 'wechat',
  totalFee: '', actualFee: '', delayedFee: '',
})
const defaultBlueprint = () => ({
  code: '', name: '', land: '', products: '', source: '', color: '', group: ''
})
const presetColors = ['#FF1744', '#FF6D00', '#FFEA00', '#00E676', '#00B0FF', '#2979FF', '#9C27B0', '#F50057']

const taskForm = ref(defaultTask())
const blueprintForm = ref(defaultBlueprint())
const showAccountInput = ref(false)
const showPasswordInput = ref(false)

// ══════ 一键补全：选择已有记录 ══════
const existingTasks = computed(() => loadTasks().filter(r => r.status !== 0))
const existingCompletions = computed(() => {
  try { return JSON.parse(localStorage.getItem('tr-completions') || '[]') } catch { return [] }
})
const selectedTemplate = ref('')

// ══════ 服务项目历史（手动输入自动记忆 + 下拉可选） ══════
const SERVICE_KEY = 'tr-services'
const DEFAULT_SERVICES = ['基建', '打boss', '大地图探索', '谷地开荒', '武陵开荒', '托管']
const COMPLETIONS_KEY = 'tr-completions'
// 「代肝记录」中已完成记录出现过的服务项目
function loadCompletionServices() {
  try {
    const list = JSON.parse(localStorage.getItem(COMPLETIONS_KEY) || '[]')
    return list.map(c => String(c.service || '').trim()).filter(Boolean)
  } catch { return [] }
}
function loadServices() {
  let base
  try {
    const saved = JSON.parse(localStorage.getItem(SERVICE_KEY) || 'null')
    base = (Array.isArray(saved) && saved.length) ? saved : [...DEFAULT_SERVICES]
  } catch { base = [...DEFAULT_SERVICES] }
  // 合并「代肝记录」已完成的记录里的服务项目（去重、保持原顺序）
  const out = [...base]
  const seen = new Set(out)
  for (const s of loadCompletionServices()) {
    if (!seen.has(s)) { seen.add(s); out.push(s) }
  }
  return out
}
const serviceOptions = ref(loadServices())
function rememberService(name) {
  const v = String(name || '').trim()
  if (!v || serviceOptions.value.includes(v)) return
  serviceOptions.value = [v, ...serviceOptions.value].slice(0, 50)
  try { localStorage.setItem(SERVICE_KEY, JSON.stringify(serviceOptions.value)) } catch { /* ignore */ }
}

// 服务项目下拉面板（定位 + 开关）
const servicePanelOpen = ref(false)
const serviceBtnRef = ref(null)
const servicePanelStyle = ref({})
function updateServicePanelPos() {
  const el = serviceBtnRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const h = Math.min(240, serviceOptions.value.length * 28 + 8)
  let top = r.bottom + 2
  if (top + h > window.innerHeight) top = Math.max(4, r.top - h - 2)
  const w = Math.max(r.width, 140)
  let left = r.right - w
  if (left < 4) left = 4
  servicePanelStyle.value = { position: 'fixed', top: top + 'px', left: left + 'px', width: w + 'px', maxHeight: '240px' }
}
function toggleServicePanel() {
  servicePanelOpen.value = !servicePanelOpen.value
  if (servicePanelOpen.value) { updateServicePanelPos(); nextTick(updateServicePanelPos) }
}
function pickService(s) { taskForm.value.service = s; servicePanelOpen.value = false }
function onSvcDocClick(e) {
  if (!servicePanelOpen.value) return
  if (serviceBtnRef.value && serviceBtnRef.value.contains(e.target)) return
  servicePanelOpen.value = false
}

// 下拉选项
const gameOptions = [{ value: '终末地', label: '终末地' }, { value: '明日方舟', label: '明日方舟' }]
const statusOptions = [{ value: 1, label: '未完成（单次）' }, { value: 2, label: '托管' }]
const platformOptions = [
  { value: 'wechat', label: '微信' }, { value: 'qq', label: 'QQ' }, { value: 'bilibili', label: 'B站' },
  { value: 'xiaohongshu', label: '小红书' }, { value: 'douyin', label: '抖音' },
]
const templateOptions = computed(() => [
  ...existingTasks.value.map(t => ({ value: 'task:' + t.id, label: '[代办] ' + (getDisplayName(t) || '未命名') + ' | ' + maskAccount(t.account) })),
  ...existingCompletions.value.map(c => ({ value: 'completion:' + c.id, label: '[记录] ' + (c.displayName || getDisplayName(c) || '未命名') + ' | ' + maskAccount(c.account) })),
])
function applyTemplate() {
  if (!selectedTemplate.value) return
  const [type, id] = selectedTemplate.value.split(':')
  let t = null
  if (type === 'completion') t = existingCompletions.value.find(r => r.id === id)
  else t = existingTasks.value.find(r => r.id === id)
  if (t) {
    const { id: _id, createdAt, lastConfirmDate, date, time, taskId, wasHosting, status, locked, prevTaskId, ...rest } = t
    // 完成记录按 wasHosting 判定；代办项目保留原状态（托管→托管，单次→单次）
    const finalStatus = type === 'completion'
      ? (wasHosting ? 2 : 1)
      : (status === 2 ? 2 : 1)
    taskForm.value = { ...defaultTask(), ...rest, status: finalStatus }
  }
}

onMounted(() => {
  if (editRecord.value && editType.value === 'accounts') {
    taskForm.value = { ...editRecord.value }
  } else if (editRecord.value && editType.value === 'blueprints') {
    blueprintForm.value = { ...editRecord.value }
  }
})

function loadTasks() {
  try { return JSON.parse(localStorage.getItem('tr-accounts') || '[]') } catch { return [] }
}
function saveTasks(data) {
  localStorage.setItem('tr-accounts', JSON.stringify(data))
  window.electron?.saveRecords?.(data)
}
function loadBlueprints() {
  try { return JSON.parse(localStorage.getItem('tr-blueprints') || '[]') } catch { return [] }
}
function saveBlueprintsData(data) {
  localStorage.setItem('tr-blueprints', JSON.stringify(data))
  window.electron?.saveBlueprints?.(data)
}

// ══════ 蓝图分组（供蓝图表单选择） ══════
const BP_GROUP_KEY = 'tr-blueprint-groups'
const blueprintGroups = ref([])
function loadBlueprintGroups() {
  try { const g = JSON.parse(localStorage.getItem(BP_GROUP_KEY) || 'null'); if (Array.isArray(g)) blueprintGroups.value = g } catch { /* ignore */ }
}
loadBlueprintGroups()
function rememberBlueprintGroup(name) {
  const v = String(name || '').trim()
  if (!v || blueprintGroups.value.includes(v)) return
  blueprintGroups.value = [...blueprintGroups.value, v]
  try { localStorage.setItem(BP_GROUP_KEY, JSON.stringify(blueprintGroups.value)) } catch { /* ignore */ }
}
function addCompletion(record) {
  const list = JSON.parse(localStorage.getItem('tr-completions') || '[]')
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    taskId: record.id,
    date: new Date().toISOString().slice(0, 10),
    game: record.game,
    service: String(record.service || ''),
    account: record.account,
    fee: record.actualFee || record.totalFee || '',
    isHosting: record.isHosting || false,
  })
  localStorage.setItem('tr-completions', JSON.stringify(list))
}

function saveTask() {
  const data = { ...taskForm.value }
  const list = loadTasks()
  if (editingId.value) {
    const idx = list.findIndex(r => r.id === editingId.value)
    if (idx >= 0) list[idx] = { ...list[idx], ...data }
  } else {
    data.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    data.createdAt = new Date().toISOString()
    // 续费：同账号 status===2 中 createdAt 最晚者作为「前一个托管」（支持多次续费链）
    // 新项目创建日 = 前项目到期日（前项目创建日 + 1 个月），并锁定待激活
    if (data.status === 2 && data.account) {
      const siblings = list
        .filter(r => r.status === 2 && r.account === data.account && r.createdAt)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      const prev = siblings[0]
      if (prev) {
        const startDate = addMonth(fmtDate(new Date(prev.createdAt)))
        data.createdAt = new Date(startDate + 'T00:00:00').toISOString()
        data.locked = true
        data.prevTaskId = prev.id
      }
    }
    // 次数：托管兜底按周期天数（创建日 + 1 个月），单次兜底 1
    if (!data.remainingDays && data.remainingDays !== 0) {
      data.remainingDays = data.status === 2 ? monthSpanDays(data.createdAt) : 1
    }
    list.unshift(data)
  }
  rememberService(data.service)
  saveTasks(list)
  clearEdit()
  taskForm.value = defaultTask()
}

function saveBlueprint() {
  const data = { ...blueprintForm.value }
  const list = loadBlueprints()
  if (editingId.value) {
    const idx = list.findIndex(r => r.id === editingId.value)
    if (idx >= 0) list[idx] = { ...list[idx], ...data }
  } else {
    data.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    list.unshift(data)
  }
  rememberBlueprintGroup(data.group)
  saveBlueprintsData(list)
  clearEdit()
  blueprintForm.value = defaultBlueprint()
}

function cancelEdit() { clearEdit() }
function onKeydown(e) { if (e.key === 'Escape') cancelEdit() }
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
onMounted(() => document.addEventListener('click', onSvcDocClick))
onUnmounted(() => document.removeEventListener('click', onSvcDocClick))
</script>

<style scoped>
.svc-drop-btn { padding: 0 16px; font-size: 16px; }
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
</style>

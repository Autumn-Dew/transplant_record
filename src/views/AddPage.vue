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
        <div class="form-row" v-if="Number(taskForm.status) === 2"><label>托管天数</label><input type="number" min="1" v-model.number="taskForm.hostDays" placeholder="如 20（留空按 1 天）" /><span class="form-hint" style="opacity:.55;font-size:11px;margin-left:6px">结束日 = 开始日 + 天数 − 1</span></div>
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
          <button class="save-btn" :style="cfm.styleOf('save-task')" :title="cfm.titleOf('save-task', editingId ? '保存' : '添加')" @click="saveTask">{{ editingId ? '保存' : '添加' }}</button>
        </div>
      </div>

      <!-- ========== 蓝图表单 ========== -->
      <div class="edit-form" v-if="activeTab === 'blueprints'">
        <div class="form-row" v-if="!editingId">
          <label>从已有选择</label>
          <SelectBox style="flex:1;min-width:0" v-model="selectedBlueprint" :options="blueprintTemplateOptions" placeholder="— 手动填写 —" @change="applyBlueprintTemplate" />
        </div>
        <div class="form-row"><label>分组</label><input v-model="blueprintForm.group" placeholder="未分组" list="add-bp-groups" />
          <datalist id="add-bp-groups"><option v-for="g in blueprintGroups" :key="g" :value="g" /></datalist>
        </div>
        <div class="form-row"><label>蓝图码</label><input v-model="blueprintForm.code" class="mono-input" /></div>
        <div class="form-row"><label>名称</label><input v-model="blueprintForm.name" /></div>
        <div class="form-row"><label>占地</label><input v-model="blueprintForm.land" /></div>
        <div class="form-row"><label>产物</label><input v-model="blueprintForm.products" /></div>
        <div class="form-row"><label>蓝图来源</label><input v-model="blueprintForm.source" /></div>
        <div class="form-row"><label>备注</label><input v-model="blueprintForm.note" placeholder="备注（如：材料消耗 / 注意事项）" /></div>
        <div class="form-row"><label>颜色</label>
          <div class="color-swatches">
            <span v-for="c in presetColors" :key="c" class="color-swatch" :style="{ background: c }" :class="{ active: blueprintForm.color === c }" @click="blueprintForm.color = c"></span>
            <input type="color" v-model="blueprintForm.color" class="color-input" title="自定义颜色" />
            <input
              v-model="blueprintForm.color"
              class="bp-hex-input"
              :class="{ invalid: !isValidHex(blueprintForm.color) }"
              placeholder="#RRGGBB"
              title="可直接输入 HEX"
              @change="blueprintForm.color = normalizeHex(blueprintForm.color)"
            />
            <button v-if="blueprintForm.color" class="pwd-toggle" @click="blueprintForm.color = ''">清除</button>
          </div>
        </div>
        <div class="edit-actions">
          <button class="cancel-btn" @click="cancelEdit">取消</button>
          <button class="save-btn" :style="cfm.styleOf('save-blueprint')" :title="cfm.titleOf('save-blueprint', editingId ? '保存' : '添加')" @click="saveBlueprint">{{ editingId ? '保存' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="renewal" class="modal-mask" @click.self="cancelRenewal">
      <div class="edit-popup pd-popup">
        <h4>续费确认</h4>

        <!-- 与「详细信息」窗口同一套版式：名称行 + detail-grid 分组 -->
        <div class="pd-head">
          <div class="pd-head-main renew-head-line">
            <span class="pd-name">{{ renewal.candidate.gameName || renewal.candidate.game || '未命名' }}</span>
            <span class="renew-sep">|</span>
            <span class="pd-sub">{{ renewal.candidate.service || '—' }} · 托管续期</span>
            <span class="renew-sep">|</span>
            <span class="pd-state pd-state-active">续费</span>
          </div>
        </div>

        <div class="detail-grid">
          <p class="detail-section">原项目</p>
          <div class="detail-field"><span class="dl">账号</span>
            <span class="dv">{{ renewal.candidate.account || '—' }}</span>
          </div>
          <div class="detail-field"><span class="dl">游戏</span>
            <span class="dv">{{ renewal.candidate.gameName || renewal.candidate.game || '—' }}</span>
          </div>
          <div class="detail-field"><span class="dl">原周期</span>
            <span class="dv">{{ renewal.prevStart }} → {{ renewal.prevEnd }}</span>
          </div>
          <div class="detail-field"><span class="dl">原收费</span>
            <span class="dv mono">¥{{ renewal.candidate.totalFee || 0 }}</span>
          </div>

          <p class="detail-section">本次续费</p>
          <div class="detail-field"><span class="dl">加天数</span>
            <input type="number" min="1" v-model.number="renewalDays" class="pd-inp" />
          </div>
          <div class="detail-field"><span class="dl">收费金额</span>
            <input type="number" min="0" v-model.number="renewalAmount" class="pd-inp" />
          </div>
          <div class="detail-field"><span class="dl">收费日期</span>
            <input type="date" v-model="renewalPaidAt" class="pd-inp" />
          </div>
          <div class="detail-field"><span class="dl">新结束日</span><span class="dv mono">{{ renewalEnd }}</span></div>

          <p class="detail-section">说明</p>
          <div class="detail-field"><span class="dl">处理方式</span>
            <span class="dv">在原项目上加天数并记一笔收费，不新建项目</span>
          </div>
        </div>

        <div class="edit-actions" style="margin-top:16px">
          <button class="save-btn" :style="cfm.styleOf('confirm-renewal')" :title="cfm.titleOf('confirm-renewal', '确认加天数')" @click="confirmRenewal">确认加天数</button>
          <button class="cancel-btn" @click="cancelRenewal">取消</button>
        </div>
      </div>
    </div>
  </Teleport>

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
import { computed, ref, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { useEditState } from '@/composables/useEditState'
import { maskAccount, getDisplayName, PLATFORM_OPTIONS } from '@/domain/mask.js'
import { gameOptions as buildGameOptions, serviceNames, findGame, gameKeyOf, LEGACY_DEFAULT_SERVICES } from '@/domain/games.js'
import { isClosed } from '@/domain/project.js'
import { createProject, updateProject, findRenewalCandidate, addHostingPeriod } from '@/services/projectService.js'
import { projectsRepo, completionsRepo, gamesRepo, blueprintsRepo, blueprintGroupsRepo } from '@/data/repos.js'
import { blueprintCopy, isValidHex, normalizeHex } from '@/domain/blueprints.js'
import { readJSON, writeJSON, KEYS } from '@/data/storage.js'
import { newId } from '@/domain/completion.js'
import { addMonth, addDays, fmtDate, isYmd, diffDays, todayLocal } from '@/utils/date'
import { useConfirmClick } from '@/composables/useConfirmClick.js'
import SelectBox from '@/components/SelectBox.vue'

const { editType, editRecord, clearEdit } = useEditState()
// 多次点击确认（所有写操作统一走这套机制）
const cfm = useConfirmClick()

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
  account: '', game: '', service: '', status: 1,
  remainingDays: '', hostDays: '', note: '', password: '',
  wechatName: '', qqName: '', bilibiliName: '', xiaohongshuName: '', douyinName: '',
  preferredPlatform: 'wechat',
  totalFee: '', actualFee: '', delayedFee: '',
})
const defaultBlueprint = () => ({
  code: '', name: '', land: '', products: '', source: '', note: '', color: '', group: ''
})
const presetColors = ['#FF1744', '#FF6D00', '#FFEA00', '#00E676', '#00B0FF', '#2979FF', '#9C27B0', '#F50057']

const taskForm = ref(defaultTask())
const blueprintForm = ref(defaultBlueprint())
const showAccountInput = ref(false)
const showPasswordInput = ref(false)

// ══════ 一键补全：选择已有记录 ══════
const existingTasks = computed(() => projectsRepo.state.value.filter(r => r.status !== 0 && !isClosed(r)))
const existingCompletions = computed(() => completionsRepo.state.value)
const selectedTemplate = ref('')

// ══════ 服务项目（游戏目录 + 手动输入记忆 + 历史记录，合并去重）══════
const rememberedServices = ref(loadRememberedServices())
function loadRememberedServices() {
  const saved = readJSON(KEYS.SERVICES, null)
  if (Array.isArray(saved) && saved.length) return saved.map(s => String(s).trim()).filter(Boolean)
  return [...LEGACY_DEFAULT_SERVICES]
}
const serviceOptions = computed(() => {
  const game = findGame(gamesRepo.state.value, taskForm.value.game)
  const out = []
  const seen = new Set()
  const push = (s) => {
    const v = String(s || '').trim()
    if (v && !seen.has(v)) { seen.add(v); out.push(v) }
  }
  // 1. 当前游戏维护的服务项目  2. 手动记忆过的服务  3. 历史执行记录里的服务
  serviceNames(game).forEach(push)
  rememberedServices.value.forEach(push)
  completionsRepo.state.value.forEach(c => push(c.service))
  return out
})
function rememberService(name) {
  const v = String(name || '').trim()
  if (!v || rememberedServices.value.includes(v)) return
  rememberedServices.value = [v, ...rememberedServices.value].slice(0, 50)
  writeJSON(KEYS.SERVICES, rememberedServices.value)
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

// 下拉选项：游戏来自「游戏管理」目录（新增游戏后自动出现）
const gameOptions = computed(() => buildGameOptions(gamesRepo.state.value))
const statusOptions = [{ value: 1, label: '未完成（单次）' }, { value: 2, label: '托管' }]
const platformOptions = PLATFORM_OPTIONS
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

// 编辑态填充：把记录里的托管周期映射成表单的扁平字段（「托管天数」），
// 否则编辑时「托管天数」是空的 —— 用户就改不了天数。
// 游戏字段统一成游戏 id（老数据可能存的是游戏名），下拉才能正确选中。
function fillTaskForm(rec) {
  const host = rec.host || {}
  const days = Number(host.cycleDays) || 0
  taskForm.value = {
    ...rec,
    game: gameKeyOf(gamesRepo.state.value, rec.game),
    hostDays: days > 0 ? days : '',
  }
}

onMounted(() => {
  projectsRepo.hydrate()
  if (editRecord.value && editType.value === 'accounts') {
    fillTaskForm(editRecord.value)
  }
  if (!taskForm.value.game) taskForm.value.game = gameOptions.value[0]?.value || ''
})

// 编辑目标变化时同步表单：避免编辑另一条记录时表单残留上一条的数据
watch([editRecord, editType], ([rec, type]) => {
  if (!rec) return
  if (type === 'blueprints') blueprintForm.value = { ...defaultBlueprint(), ...rec }
  if (type === 'accounts') fillTaskForm(rec)
}, { immediate: true })

// ══════ 蓝图记录（统一经由 Repository） ══════
const blueprintGroups = blueprintGroupsRepo.state
function rememberBlueprintGroup(name) {
  const v = String(name || '').trim()
  if (!v || blueprintGroups.value.includes(v)) return
  blueprintGroupsRepo.save([...blueprintGroups.value, v])
}

// ══════ 以已有蓝图为基础（仅新增时可选）══════
// 深拷贝为独立草稿：对草稿的任何修改都不会写回原蓝图。
const selectedBlueprint = ref('')
const blueprintTemplateOptions = computed(() => blueprintsRepo.state.value.map(b => ({
  value: 'bp:' + b.id,
  label: (b.group ? '[' + b.group + '] ' : '') + (b.name || b.code || '未命名'),
})))
function applyBlueprintTemplate() {
  if (!selectedBlueprint.value) return
  const src = blueprintsRepo.find(selectedBlueprint.value.replace(/^bp:/, ''))
  if (!src) return
  blueprintForm.value = { ...defaultBlueprint(), ...blueprintCopy(src) }
}
// ══════ 续费 = 在已有项目上加天数 + 记一笔收费（不新建项目）══════
const renewal = ref(null)
const renewalDays = ref(30)
const renewalAmount = ref(0)
const renewalPaidAt = ref('')
const renewalEnd = computed(() => {
  const r = renewal.value
  if (!r) return ''
  const n = Math.max(1, Math.round(Number(renewalDays.value) || 0))
  return addDays(r.prevEnd, n)
})
function openRenewalPrompt(candidate, form) {
  const host = candidate.host || {}
  const prevStart = isYmd(host.startDate) ? host.startDate : fmtDate(candidate.createdAt)
  const prevEnd = isYmd(host.endDate) ? host.endDate : addMonth(prevStart)
  renewal.value = { candidate, form, prevStart, prevEnd }
  // 天数：优先用本次表单填的「托管天数」，留空则沿用原周期天数
  const formDays = Number(form && form.hostDays)
  renewalDays.value = Number.isFinite(formDays) && formDays > 0
    ? Math.round(formDays)
    : Math.max(1, (isYmd(host.startDate) && isYmd(host.endDate)) ? diffDays(host.startDate, host.endDate) : 30)
  const fee = form && form.actualFee !== '' && form.actualFee != null ? form.actualFee : (form && form.totalFee)
  renewalAmount.value = Number(fee) || 0
  renewalPaidAt.value = todayLocal()
}
function confirmRenewal() {
  const r = renewal.value
  if (!r) return
  if (!cfm.trigger('confirm-renewal')) return
  const n = Math.max(1, Math.round(Number(renewalDays.value) || 0))
  addHostingPeriod(r.candidate.id, {
    days: n,
    amount: Number(renewalAmount.value) || 0,
    paidAt: renewalPaidAt.value,
  })
  rememberService(r.form.service)
  renewal.value = null
  clearEdit()
  taskForm.value = defaultTask()
}
function cancelRenewal() { renewal.value = null }

function saveTask() {
  const data = { ...taskForm.value }
  if (editingId.value) {
    if (!cfm.trigger('save-task')) return
    updateProject(String(editingId.value), data)
    rememberService(data.service)
    clearEdit()
    taskForm.value = defaultTask()
    return
  }
  // 新增托管且同账号已有生效托管 → 询问是否作为「续费」，不静默沿用日期
  if (Number(data.status) === 2 && data.account) {
    const candidate = findRenewalCandidate({ account: data.account, game: data.game })
    if (candidate) { openRenewalPrompt(candidate, data); return }
  }
  if (!cfm.trigger('save-task')) return
  createProject(data)
  rememberService(data.service)
  clearEdit()
  taskForm.value = defaultTask()
}

function saveBlueprint() {
  if (!cfm.trigger('save-blueprint')) return
  const data = { ...blueprintForm.value }
  // 颜色落库前规范化：空值与非法值不会写进记录（字号已下线，不再写入该字段）
  data.color = normalizeHex(data.color)
  if (editingId.value) {
    const patch = { ...data }
    delete patch.id
    blueprintsRepo.update(String(editingId.value), patch)
  } else {
    blueprintsRepo.add({ ...data, id: newId('bp') })
  }
  rememberBlueprintGroup(data.group)
  clearEdit()
  blueprintForm.value = defaultBlueprint()
  selectedBlueprint.value = ''
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

/* ── 颜色：HEX 直填（非法值给出提示，不静默丢弃）── */
.bp-hex-input {
  width: 96px; height: 26px; padding: 0 6px;
  border: 2px solid var(--border-color); background: var(--bg-primary);
  color: var(--text-primary); font-family: monospace; font-size: 12px;
}
.bp-hex-input.invalid { border-color: #d00; color: #d00; }
</style>

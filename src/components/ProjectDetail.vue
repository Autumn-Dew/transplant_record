<template>
  <!-- 项目详情：分区展示 + 操作入口。纯展示与派发，不拼装业务规则、不写存储。
       打开 / 关闭 / 分区切换都带轻量动效（本阶段不展开完整动效系统）。 -->
  <div class="pd-mask" :class="{ open: entered, closing }" @click.self="requestClose">
    <aside class="pd-drawer" role="dialog" aria-label="项目详情">
      <header class="pd-head">
        <div class="pd-head-main">
          <div class="pd-name">{{ detail.displayName || '未命名' }}</div>
          <div class="pd-sub">
            {{ gameText }} · {{ detail.project.service || '—' }} · {{ typeText }}
          </div>
        </div>
        <span class="pd-state" :class="stateClass">{{ stateText }}</span>
        <button class="pd-x" title="关闭" @click="requestClose">×</button>
      </header>

      <nav class="pd-tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="pd-tab"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >
          {{ t.label }}<span v-if="t.count != null" class="pd-tab-count">{{ t.count }}</span>
        </button>
      </nav>

      <div class="pd-body">
        <!-- key 变化即重新挂载，只需一条进入动画（避免离开动画被打断导致的阻塞） -->
        <section :key="tab" class="pd-panel pd-panel-in">
          <!-- ══════ 概览 ══════ -->
          <template v-if="tab === 'overview'">
            <div class="pd-locked" v-if="detail.locked">
              上一期托管尚未完成 → 本期待开始，暂不可确认执行
            </div>
            <p class="pd-section">基本信息</p>
            <div class="pd-grid">
              <div class="pd-field"><span class="dl">游戏</span>
                <SelectBox v-if="editing" style="flex:1" v-model="draft.game" :options="gameOptions" />
                <span class="dv" v-else>{{ gameText }}</span>
              </div>
              <div class="pd-field"><span class="dl">服务项目</span>
                <input v-if="editing" v-model="draft.service" class="pd-inp" />
                <span class="dv" v-else>{{ detail.project.service || '—' }}</span>
              </div>
              <div class="pd-field"><span class="dl">类型</span>
                <SelectBox v-if="editing" style="flex:1" v-model="draft.status" :options="typeOptions" />
                <span class="dv" v-else>{{ typeText }}</span>
              </div>
              <div class="pd-field"><span class="dl">创建时间</span>
                <input v-if="editing" type="datetime-local" v-model="editCreatedAt" class="pd-inp" />
                <span class="dv" v-else>{{ formatTime(detail.project.createdAt) }}</span>
              </div>
              <div class="pd-field"><span class="dl">账号</span>
                <template v-if="editing">
                  <input v-model="draft.account" class="pd-inp" :type="showAccount ? 'text' : 'password'" />
                  <button class="pd-toggle" @click="showAccount = !showAccount">{{ showAccount ? '隐藏' : '显示' }}</button>
                </template>
                <span v-else class="dv copyable" @click="copyText(detail.project.account)" title="点击复制">{{ maskAccount(detail.project.account) || '—' }}</span>
              </div>
              <div class="pd-field"><span class="dl">密码</span>
                <template v-if="editing">
                  <input v-model="draft.password" class="pd-inp" :type="showPassword ? 'text' : 'password'" />
                  <button class="pd-toggle" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button>
                </template>
                <span v-else class="dv copyable" @click="copyText(detail.project.password)" title="点击复制">{{ detail.project.password ? '••••••' : '—' }}</span>
              </div>
              <div class="pd-field"><span class="dl">状态</span><span class="dv">{{ stateText }}</span></div>
              <div class="pd-field"><span class="dl">收费</span>
                <input v-if="editing" type="number" v-model="draft.totalFee" class="pd-inp" placeholder="总收费" />
                <span class="dv" v-else>{{ yuan(detail.finance.actualFee || detail.finance.totalFee) }}</span>
              </div>
            </div>

            <template v-if="detail.hosting">
              <p class="pd-section">本期托管</p>
              <div class="pd-grid">
                <div class="pd-field"><span class="dl">周期</span><span class="dv mono">{{ detail.host.startDate }} → {{ detail.host.endDate }}</span></div>
                <div class="pd-field"><span class="dl">总天数</span><span class="dv mono">{{ detail.host.totalDays }} 天</span></div>
                <div class="pd-field"><span class="dl">计划次数</span>
                  <input v-if="editing" type="number" min="1" v-model.number="draft.host.plannedTimes" class="pd-inp" />
                  <span class="dv mono" v-else>{{ detail.host.planned }}</span>
                </div>
                <div class="pd-field"><span class="dl">执行进度</span><span class="dv mono">已完成 {{ detail.host.completed }} · 剩余 {{ detail.host.remaining }} 次</span></div>
                <div class="pd-field" v-if="detail.project.lastConfirmDate"><span class="dl">上次确认</span><span class="dv mono">{{ detail.project.lastConfirmDate }}</span></div>
                <div class="pd-field" v-if="detail.project.pauseReason"><span class="dl">暂停原因</span><span class="dv">{{ detail.project.pauseReason }}</span></div>
              </div>
            </template>

            <template v-else>
              <p class="pd-section">任务信息</p>
              <div class="pd-grid">
                <div class="pd-field"><span class="dl">计划日期</span><span class="dv mono">{{ detail.project.plannedDate || '—' }}</span></div>
                <div class="pd-field"><span class="dl">计划次数</span><span class="dv mono">{{ detail.project.plannedTimes ?? '—' }}</span></div>
              </div>
            </template>

            <template v-if="detail.chain">
              <p class="pd-section">连续托管</p>
              <div class="pd-grid">
                <div class="pd-field"><span class="dl">第几期</span><span class="dv mono">{{ currentPeriodIndex }} / {{ detail.chain.periodCount }}</span></div>
                <div class="pd-field"><span class="dl">连续区间</span><span class="dv mono">{{ detail.chain.chainStart }} → {{ detail.chain.chainEnd }}</span></div>
                <div class="pd-field"><span class="dl">连续剩余</span><span class="dv mono">{{ detail.chain.remainingDays }} 天</span></div>
                <div class="pd-field"><span class="dl">连续性</span>
                  <span class="dv">{{ detail.chain.continuous ? '连续无空档' : '含空档（按当前段计算）' }}</span>
                </div>
              </div>
            </template>
          </template>

          <!-- ══════ 托管周期：连续托管链，各期可展开 ══════ -->
          <template v-else-if="tab === 'host'">
            <p class="pd-section">连续托管链</p>
            <div class="pd-grid" v-if="detail.chain">
              <div class="pd-field"><span class="dl">连续区间</span><span class="dv mono">{{ detail.chain.chainStart }} → {{ detail.chain.chainEnd }}</span></div>
              <div class="pd-field"><span class="dl">期数</span><span class="dv mono">{{ detail.chain.periodCount }} 期</span></div>
              <div class="pd-field"><span class="dl">累计收费</span><span class="dv mono">{{ yuan(detail.chain.totalIncome) }}</span></div>
              <div class="pd-field"><span class="dl">剩余</span><span class="dv mono">{{ detail.chain.remainingDays }} 天</span></div>
            </div>
            <p class="pd-note">每期项目、收入与执行记录始终独立保存：聚合只用于展示，不会合并数据。</p>

            <div class="pd-periods">
              <div
                v-for="(pp, i) in detail.chain.periods"
                :key="pp.projectId"
                class="pd-period"
                :class="{ current: pp.projectId === String(detail.project.id) }"
              >
                <div class="pd-period-head" @click="togglePeriod(pp.projectId)">
                  <span class="pd-caret">{{ openPeriod[pp.projectId] ? '▾' : '▸' }}</span>
                  <span class="pd-period-no">第 {{ i + 1 }} 期</span>
                  <span class="pd-period-range mono">{{ pp.startDate }} → {{ pp.endDate }}</span>
                  <span class="pd-period-times mono">{{ pp.completedTimes }}/{{ pp.plannedTimes }}</span>
                  <span class="pd-period-fee mono">{{ yuan(pp.fee) }}</span>
                  <span class="pd-period-paid mono" :title="'收费归属日'">{{ pp.paidAt }}</span>
                  <span class="pd-period-state">{{ periodStateText(pp) }}</span>
                  <span class="pd-badge" v-if="pp.projectId === String(detail.project.id)">本期</span>
                </div>
                <div class="pd-period-body" v-if="openPeriod[pp.projectId]">
                  <div class="pd-period-meta">
                    账号 {{ maskAccount(pp.account) || '—' }} · {{ pp.game || '—' }} · {{ pp.service || '—' }}
                    · 执行记录 {{ (detail.executionsByPeriod[pp.projectId] || []).length }} 条
                  </div>
                  <div class="pd-exec-row" v-for="c in detail.executionsByPeriod[pp.projectId] || []" :key="c.id">
                    <span class="pd-exec-date mono">{{ c.completedDate || c.date || '—' }}</span>
                    <span class="pd-exec-result" :class="resultClass(c.result)">{{ resultText(c.result) }}</span>
                    <span class="pd-exec-content">{{ c.content || '—' }}</span>
                    <span class="pd-exec-note">{{ c.note || '' }}</span>
                  </div>
                  <p class="pd-empty-sm" v-if="!(detail.executionsByPeriod[pp.projectId] || []).length">该期暂无执行记录</p>
                </div>
              </div>
            </div>
            <p class="pd-empty" v-if="!detail.chain">该项目不是托管项目</p>
          </template>

          <!-- ══════ 执行记录 ══════ -->
          <template v-else-if="tab === 'executions'">
            <p class="pd-section">本项目执行记录（{{ detail.executions.length }} 条）</p>
            <div class="pd-exec-stats">
              <span class="pd-chip">已完成 {{ countResult('done') }}</span>
              <span class="pd-chip">已跳过 {{ countResult('skipped') }}</span>
              <span class="pd-chip">异常 {{ countResult('abnormal') }}</span>
              <span class="pd-chip" v-if="detail.chain">整链共 {{ detail.chainExecutionCount }} 条</span>
            </div>
            <div class="pd-exec-row head">
              <span class="pd-exec-date">完成日期</span>
              <span class="pd-exec-result">结果</span>
              <span class="pd-exec-content">实际执行内容</span>
              <span class="pd-exec-note">备注</span>
            </div>
            <div class="pd-exec-row" v-for="c in detail.executions" :key="c.id">
              <span class="pd-exec-date mono">{{ c.completedDate || c.date || '—' }}<em v-if="c.plannedDate && c.plannedDate !== (c.completedDate || c.date)" class="pd-planned" :title="'计划日期 ' + c.plannedDate"> 计划{{ c.plannedDate }}</em></span>
              <span class="pd-exec-result" :class="resultClass(c.result)">{{ resultText(c.result) }}</span>
              <span class="pd-exec-content">{{ c.content || '—' }}</span>
              <span class="pd-exec-note">{{ c.note || '' }}</span>
            </div>
            <p class="pd-empty" v-if="!detail.executions.length">
              还没有执行记录 —— 完成今日代办后会自动生成独立记录，项目改名 / 改价 / 归档都不会改写它
            </p>
          </template>

          <!-- ══════ 财务 ══════ -->
          <template v-else-if="tab === 'finance'">
            <p class="pd-section">本期收费</p>
            <div class="pd-grid">
              <div class="pd-field"><span class="dl">总收费</span>
                <input v-if="editing" type="number" v-model="draft.totalFee" class="pd-inp" />
                <span class="dv mono" v-else>{{ yuan(detail.finance.totalFee) }}</span>
              </div>
              <div class="pd-field"><span class="dl">实际收费</span>
                <input v-if="editing" type="number" v-model="draft.actualFee" class="pd-inp" />
                <span class="dv mono" v-else>{{ yuan(detail.finance.actualFee) }}</span>
              </div>
              <div class="pd-field"><span class="dl">延后收费</span>
                <input v-if="editing" type="number" v-model="draft.delayedFee" class="pd-inp" />
                <span class="dv mono" v-else>{{ yuan(detail.finance.delayedFee) }}</span>
              </div>
              <div class="pd-field"><span class="dl">收费归属日</span>
                <input v-if="editing" type="date" v-model="draft.paidAt" class="pd-inp" />
                <span class="dv mono" v-else>{{ detail.finance.paidAt || '—' }}</span>
              </div>
            </div>
            <p class="pd-note">收入按「收费归属日」逐期统计，不使用项目结束日期。</p>

            <template v-if="detail.chain && detail.chain.periodCount > 1">
              <p class="pd-section">连续托管累计</p>
              <div class="pd-grid">
                <div class="pd-field"><span class="dl">累计收费</span><span class="dv mono">{{ yuan(detail.finance.chainTotal) }}</span></div>
                <div class="pd-field"><span class="dl">期数</span><span class="dv mono">{{ detail.finance.chainPeriodCount }} 期</span></div>
              </div>
              <div class="pd-exec-row head">
                <span class="pd-exec-date">期</span>
                <span class="pd-exec-result">收费</span>
                <span class="pd-exec-content">周期</span>
                <span class="pd-exec-note">收费归属日</span>
              </div>
              <div class="pd-exec-row" v-for="inc in detail.chain.incomeByPeriod" :key="inc.projectId">
                <span class="pd-exec-date mono">第 {{ inc.index }} 期</span>
                <span class="pd-exec-result mono">{{ yuan(inc.fee) }}</span>
                <span class="pd-exec-content mono">{{ inc.startDate }} → {{ inc.endDate }}</span>
                <span class="pd-exec-note mono">{{ inc.paidAt }}</span>
              </div>
            </template>
          </template>

          <!-- ══════ 其他 ══════ -->
          <template v-else>
            <p class="pd-section">平台名称</p>
            <div class="pd-grid">
              <div class="pd-field"><span class="dl">首选</span>
                <SelectBox v-if="editing" style="flex:1" v-model="draft.preferredPlatform" :options="platformOptions" />
                <span class="dv" v-else>{{ detail.project.preferredPlatform || 'wechat' }}</span>
              </div>
              <div class="pd-field" v-for="f in nameFields" :key="f.key"><span class="dl">{{ f.label }}</span>
                <input v-if="editing" v-model="draft[f.key]" class="pd-inp" />
                <span class="dv" v-else>{{ detail.project[f.key] || '—' }}</span>
              </div>
            </div>

            <p class="pd-section">备注</p>
            <div class="pd-field"><span class="dl">备注</span>
              <input v-if="editing" v-model="draft.note" class="pd-inp" />
              <span class="dv" v-else>{{ detail.project.note || '—' }}</span>
            </div>

            <p class="pd-section">档案标识</p>
            <div class="pd-grid">
              <div class="pd-field"><span class="dl">项目 ID</span><span class="dv mono">{{ detail.project.id }}</span></div>
              <div class="pd-field"><span class="dl">上一期</span><span class="dv mono">{{ detail.project.prevTaskId || '—' }}</span></div>
              <div class="pd-field"><span class="dl">托管链</span><span class="dv mono">{{ detail.chainId || '—' }}</span></div>
              <div class="pd-field"><span class="dl">归档时间</span><span class="dv mono">{{ detail.project.archivedAt || '—' }}</span></div>
            </div>
          </template>
        </section>
      </div>

      <footer class="pd-foot">
        <!-- 编辑（原版操作，保留） -->
        <div class="pd-foot-group">
          <button v-if="!editing" class="pd-btn" @click="startEdit">编辑</button>
          <button v-else class="pd-btn primary" @click="submitEdit">保存</button>
          <button v-if="editing" class="pd-btn" @click="cancelEdit">取消编辑</button>
        </div>

        <!-- 业务操作（按状态给出，不删除原版任何操作） -->
        <div class="pd-foot-group">
          <template v-if="detail.actions.pause">
            <button class="pd-btn" @click="$emit('pause')">暂停托管</button>
          </template>
          <template v-if="detail.actions.resume">
            <button class="pd-btn" @click="$emit('resume')">恢复托管</button>
          </template>
          <template v-if="detail.actions.extend">
            <input v-model.number="extendDays" type="number" min="1" class="pd-days" title="延期天数" />
            <button class="pd-btn" @click="doExtend">延期</button>
          </template>
          <template v-if="detail.actions.renew">
            <button class="pd-btn" :class="{ primary: renewOpen }" @click="toggleRenew">续费</button>
          </template>
          <template v-if="detail.actions.cancel">
            <button class="pd-btn" :class="{ danger: confirmKey === 'cancel' }" @click="confirmThen('cancel', 'cancel')">
              {{ confirmKey === 'cancel' ? '确认提前结束？' : '提前结束' }}
            </button>
          </template>
          <template v-if="detail.actions.archive">
            <button class="pd-btn" :class="{ danger: confirmKey === 'archive' }" @click="confirmThen('archive', 'archive')">
              {{ confirmKey === 'archive' ? '确认归档？' : '归档' }}
            </button>
          </template>
          <template v-if="detail.actions.restore">
            <button class="pd-btn" @click="$emit('restore')">取消归档</button>
          </template>
          <template v-if="detail.actions.remove">
            <button class="pd-btn" :class="{ danger: confirmKey === 'remove' }" @click="confirmThen('remove', 'remove')">
              {{ confirmKey === 'remove' ? '确认删除？' : '删除' }}
            </button>
          </template>
        </div>
      </footer>

      <!-- 续费确认区（起始日默认取原周期结束日次日，可修改；不静默覆盖） -->
      <div class="pd-renew" v-if="renewOpen && detail.renewPlan">
        <div class="pd-renew-title">续费为新的独立项目</div>
        <div class="pd-renew-row">
          <span class="dl">新开始日</span>
          <input type="date" v-model="renewStart" class="pd-inp" />
          <span class="pd-renew-hint mono">原周期结束 {{ detail.renewPlan.prevEndDate || '—' }} → 建议次日</span>
        </div>
        <div class="pd-renew-row">
          <span class="pd-renew-hint">
            新项目拥有独立 ID、独立收费与执行记录，不继承本期进度与历史；
            游戏 / 账号 / 服务沿用，可稍后修改。
          </span>
        </div>
        <div class="pd-renew-actions">
          <button class="pd-btn primary" @click="doRenew">确认续费</button>
          <button class="pd-btn" @click="renewOpen = false">取消</button>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup>
// 项目详情：只做「渲染 + 派发」，业务规则全在 services/projectDetail.js 与 projectService.js
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import SelectBox from '@/components/SelectBox.vue'
import { maskAccount } from '@/composables/useMask'

const props = defineProps({
  detail: { type: Object, required: true },
  gameOptions: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'save', 'pause', 'resume', 'extend', 'cancel', 'archive', 'restore', 'renew', 'remove'])

// ── 打开 / 关闭动效（关闭先播动画再卸载，不依赖 transitionend）──
const entered = ref(false)
const closing = ref(false)
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true })))
function requestClose() {
  if (closing.value) return
  closing.value = true
  setTimeout(() => emit('close'), 160)
}
function onKeydown(e) { if (e.key === 'Escape') requestClose() }
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ── 分区 ──
const tab = ref('overview')
const tabs = computed(() => {
  const list = [{ key: 'overview', label: '概览' }]
  if (props.detail.hosting) list.push({ key: 'host', label: '托管周期', count: props.detail.chain ? props.detail.chain.periodCount : null })
  list.push({ key: 'executions', label: '执行记录', count: props.detail.executions.length })
  list.push({ key: 'finance', label: '财务' })
  list.push({ key: 'other', label: '其他' })
  return list
})

// ── 各期展开 ──
const openPeriod = ref({})
function togglePeriod(id) { openPeriod.value = { ...openPeriod.value, [id]: !openPeriod.value[id] } }

// ── 编辑态（只作用于当前项目，历史周期不受影响）──
const editing = ref(false)
const draft = ref({})
const showAccount = ref(false)
const showPassword = ref(false)
const editCreatedAt = computed({
  get: () => toDatetimeLocal(draft.value.createdAt),
  set: v => { if (v) draft.value.createdAt = new Date(v).toISOString() },
})
function startEdit() {
  draft.value = JSON.parse(JSON.stringify(props.detail.project))
  if (!draft.value.host) draft.value.host = {}
  editing.value = true
  showAccount.value = false
  showPassword.value = false
}
function cancelEdit() { editing.value = false; draft.value = {} }
function submitEdit() {
  const patch = { ...draft.value }
  delete patch.id
  emit('save', patch)
  editing.value = false
}

// ── 危险操作两段确认 ──
const confirmKey = ref('')
function confirmThen(key, event) {
  if (confirmKey.value === key) { confirmKey.value = ''; emit(event) }
  else confirmKey.value = key
}

// ── 延期 ──
const extendDays = ref(30)
function doExtend() {
  const n = Number(extendDays.value)
  if (!Number.isFinite(n) || n <= 0) return
  emit('extend', n)
}

// ── 续费（起始日默认取原周期结束日次日，可修改；不静默覆盖）──
const renewOpen = ref(false)
const renewStart = ref('')
function toggleRenew() {
  if (renewOpen.value) { renewOpen.value = false; return }
  renewStart.value = (props.detail.renewPlan && props.detail.renewPlan.startDate) || ''
  renewOpen.value = true
}
function doRenew() {
  if (!renewStart.value) return
  renewOpen.value = false
  emit('renew', { startDate: renewStart.value })
}

// ── 展示辅助 ──
const typeOptions = [{ value: 1, label: '单次' }, { value: 2, label: '托管' }]
const platformOptions = [
  { value: 'wechat', label: '微信' },
  { value: 'qq', label: 'QQ' },
  { value: 'bilibili', label: 'B站' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
]
const nameFields = [
  { key: 'wechatName', label: '微信' },
  { key: 'qqName', label: 'QQ' },
  { key: 'bilibiliName', label: 'B站' },
  { key: 'xiaohongshuName', label: '小红书' },
  { key: 'douyinName', label: '抖音' },
]

const STATE_TEXT = {
  active: '托管中', paused: '暂停中', scheduled: '待开始', expired: '已到期',
  completed: '已完成', cancelled: '已取消', archived: '已归档', pending: '待执行',
}
const stateText = computed(() => {
  const t = STATE_TEXT[props.detail.state] || '—'
  return props.detail.archived && props.detail.state !== 'archived' ? t + ' · 已归档' : t
})
const stateClass = computed(() => 'st-' + (props.detail.archived ? 'archived' : props.detail.state || ''))
const gameText = computed(() => props.detail.project.gameName || props.detail.project.game || '—')
const typeText = computed(() => (props.detail.project.status === 2 ? '托管' : '单次'))
const currentPeriodIndex = computed(() => {
  const list = props.detail.chain ? props.detail.chain.periods : []
  const i = list.findIndex(p => p.projectId === String(props.detail.project.id))
  return i < 0 ? '—' : i + 1
})
function periodStateText(pp) {
  if (pp.cancelled) return '已取消'
  if (pp.archived) return '已归档'
  return STATE_TEXT[pp.state] || '—'
}
const RESULT_TEXT = { done: '已完成', skipped: '已跳过', abnormal: '异常', cancelled: '已取消' }
function resultText(r) { return RESULT_TEXT[r] || '已完成' }
function resultClass(r) { return 'rs-' + (r || 'done') }
function countResult(r) { return props.detail.executions.filter(c => (c.result || 'done') === r).length }
function yuan(v) { return Number(v) ? '¥' + v : '—' }
function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return String(iso).slice(0, 16).replace('T', ' ')
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function copyText(t) { if (t) navigator.clipboard?.writeText(t) }
</script>

<style scoped>
/* ── 遮罩与抽屉：打开滑入 / 关闭滑出（轻量，不做完整动效系统） ── */
.pd-mask {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(0, 0, 0, 0);
  transition: background 200ms ease;
  display: flex; justify-content: flex-end;
}
.pd-mask.open { background: rgba(0, 0, 0, 0.35); }
.pd-mask.closing { background: rgba(0, 0, 0, 0); }
.pd-drawer {
  width: min(760px, 92vw); height: 100%;
  display: flex; flex-direction: column;
  background: var(--bg-primary); color: var(--text-primary);
  border-left: 2px solid var(--border-color);
  transform: translateX(102%);
  transition: transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
.pd-mask.open .pd-drawer { transform: translateX(0); }
.pd-mask.closing .pd-drawer { transform: translateX(102%); }

/* ── 头部 ── */
.pd-head {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-bottom: 2px solid var(--border-color);
  background: var(--bg-secondary); flex-shrink: 0;
}
.pd-head-main { flex: 1; min-width: 0; }
.pd-name { font-size: 15px; font-weight: 800; }
.pd-sub { font-size: 11px; font-family: monospace; opacity: 0.6; margin-top: 2px; }
.pd-state {
  font-size: 10px; font-family: monospace; padding: 2px 8px;
  border: 1px solid currentColor; opacity: 0.85; white-space: nowrap;
}
.pd-state.st-active { color: var(--accent); }
.pd-state.st-paused, .pd-state.st-archived { color: #9E9E9E; }
.pd-state.st-completed { color: #00B0FF; }
.pd-state.st-scheduled { color: var(--warn, #D87938); }
.pd-x {
  width: 26px; height: 26px; border: 1px solid var(--border-color);
  background: var(--bg-primary); color: var(--text-primary);
  cursor: pointer; font-size: 15px; line-height: 1;
}
.pd-x:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }

/* ── 分区 tab ── */
.pd-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
.pd-tab {
  flex: 1; padding: 7px 4px; border: none; border-right: 1px solid var(--border-color);
  background: var(--bg-primary); color: var(--text-primary);
  font-family: inherit; font-size: 12px; cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}
.pd-tab:last-child { border-right: none; }
.pd-tab:hover { background: var(--bg-secondary); }
.pd-tab.active { background: var(--btn-hover-bg); color: var(--btn-hover-text); font-weight: 700; }
.pd-tab-count {
  font-family: monospace; font-size: 10px; opacity: 0.7; margin-left: 4px;
}

/* ── 主体 ── */
.pd-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px; }
.pd-panel-in { animation: pd-panel-in 200ms cubic-bezier(0.22, 0.61, 0.36, 1) both; }
@keyframes pd-panel-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.pd-section {
  font-size: 10px; font-family: monospace; letter-spacing: 2px; opacity: 0.55;
  margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 1px solid var(--border-color);
}
.pd-section:first-child { margin-top: 0; }
.pd-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 16px; }
.pd-field { display: flex; align-items: center; gap: 8px; font-size: 12px; min-width: 0; }
.pd-field > .dl { width: 72px; flex-shrink: 0; opacity: 0.55; font-family: monospace; font-size: 11px; }
.pd-field > .dv { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mono { font-family: monospace; }
.copyable { cursor: pointer; border-bottom: 1px dashed var(--border-color); }
.pd-inp {
  flex: 1; min-width: 0; height: 26px; padding: 0 6px;
  border: 1px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-family: inherit; font-size: 12px;
}
.pd-inp:focus { outline: none; border-color: var(--btn-hover-bg); }
.pd-toggle {
  font-size: 10px; padding: 2px 6px; border: 1px solid var(--border-color);
  background: var(--bg-primary); color: var(--text-primary); cursor: pointer; font-family: monospace;
}
.pd-note { font-size: 11px; opacity: 0.55; line-height: 1.6; margin: 6px 0 0; }
.pd-locked {
  font-size: 11px; font-family: monospace; padding: 6px 8px; margin-bottom: 8px;
  border-left: 3px solid var(--warn, #D87938); background: var(--bg-secondary);
}

/* ── 连续托管链 / 各期 ── */
.pd-periods { margin-top: 10px; border: 1px solid var(--border-color); }
.pd-period { border-bottom: 1px solid var(--border-color); }
.pd-period:last-child { border-bottom: none; }
.pd-period.current { background: var(--bg-secondary); }
.pd-period-head {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  font-size: 11px; cursor: pointer;
}
.pd-period-head:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.pd-caret { width: 10px; opacity: 0.6; }
.pd-period-no { width: 52px; font-weight: 700; flex-shrink: 0; }
.pd-period-range { flex: 1.4; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-period-times { width: 52px; text-align: right; flex-shrink: 0; }
.pd-period-fee { width: 64px; text-align: right; flex-shrink: 0; }
.pd-period-paid { width: 84px; opacity: 0.6; flex-shrink: 0; }
.pd-period-state { width: 56px; text-align: right; flex-shrink: 0; opacity: 0.8; }
.pd-badge {
  font-size: 9px; padding: 0 5px; border: 1px solid var(--accent); color: var(--accent); flex-shrink: 0;
}
.pd-period-body { padding: 6px 8px 8px 26px; background: var(--bg-primary); }
.pd-period-meta { font-size: 10px; font-family: monospace; opacity: 0.6; margin-bottom: 4px; }

/* ── 执行记录 ── */
.pd-exec-stats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.pd-chip {
  font-size: 10px; font-family: monospace; padding: 2px 7px;
  border: 1px solid var(--border-color); opacity: 0.8;
}
.pd-exec-row {
  display: flex; align-items: baseline; gap: 8px; padding: 4px 0;
  font-size: 11px; border-bottom: 1px solid var(--border-color);
}
.pd-exec-row.head { opacity: 0.45; font-family: monospace; font-size: 10px; }
.pd-exec-date { width: 148px; flex-shrink: 0; }
.pd-planned { font-style: normal; opacity: 0.5; font-size: 9px; }
.pd-exec-result { width: 52px; flex-shrink: 0; }
.pd-exec-result.rs-done { color: var(--accent); }
.pd-exec-result.rs-skipped { opacity: 0.6; }
.pd-exec-result.rs-abnormal { color: var(--warn, #D87938); }
.pd-exec-content { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-exec-note { width: 130px; flex-shrink: 0; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-empty, .pd-empty-sm { font-size: 11px; opacity: 0.5; line-height: 1.7; padding: 8px 0; }
.pd-empty-sm { padding: 2px 0; }

/* ── 底部操作 ── */
.pd-foot {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 8px 14px; border-top: 2px solid var(--border-color);
  background: var(--bg-secondary); flex-shrink: 0;
}
.pd-foot-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pd-foot-group:last-child { margin-left: auto; }
.pd-btn {
  height: 26px; padding: 0 10px; border: 1px solid var(--border-color);
  background: var(--bg-primary); color: var(--text-primary);
  font-family: inherit; font-size: 12px; cursor: pointer;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}
.pd-btn:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.pd-btn.primary { background: var(--btn-hover-bg); color: var(--btn-hover-text); font-weight: 700; }
.pd-btn.danger { border-color: #d00; color: #d00; }
.pd-btn.danger:hover { background: #d00; color: #fff; }
.pd-days {
  width: 52px; height: 26px; padding: 0 6px; border: 1px solid var(--border-color);
  background: var(--bg-primary); color: var(--text-primary); font-family: monospace; font-size: 12px;
}

/* ── 续费确认区 ── */
.pd-renew {
  border-top: 2px solid var(--accent); background: var(--bg-primary);
  padding: 10px 14px; flex-shrink: 0;
}
.pd-renew-title { font-size: 12px; font-weight: 800; margin-bottom: 6px; }
.pd-renew-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; }
.pd-renew-row .dl { width: 72px; flex-shrink: 0; opacity: 0.55; font-family: monospace; font-size: 11px; }
.pd-renew-row .pd-inp { max-width: 160px; }
.pd-renew-hint { font-size: 10px; opacity: 0.6; line-height: 1.6; }
.pd-renew-actions { display: flex; gap: 6px; }

/* ── 减少动态效果 ── */
@media (prefers-reduced-motion: reduce) {
  .pd-mask, .pd-drawer, .pd-tab, .pd-btn { transition: none; }
  .pd-panel-in { animation: none; }
}
</style>

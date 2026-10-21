<template>
  <!-- 项目详情：与「代肝记录」的详细信息弹窗完全同一套版式（侧边抽屉 + detail-grid）。
       只做「渲染 + 派发」，业务规则全在 services/projectDetail.js 与 projectService.js。 -->
  <div class="modal-mask" v-if="detail" @click.self="requestClose">
    <div class="edit-popup pd-popup">
      <h4>详细信息</h4>

      <div class="pd-head">
        <div class="pd-head-main">
          <div class="pd-name">{{ detail.displayName || '未命名' }}</div>
          <div class="pd-sub">{{ gameText }} · {{ detail.project.service || '—' }} · {{ typeText }}</div>
        </div>
        <span class="pd-state" :class="stateClass">{{ stateText }}</span>
      </div>
      <p class="pd-locked" v-if="detail.locked">上一期托管尚未完成 → 本期待开始，暂不可确认执行</p>
      <!-- 早期 / 后期数据冲突提示：同客户同服务还有别的托管记录 -->
      <p class="pd-dup" v-if="detail.duplicates && detail.duplicates.length">
        同一客户还有 {{ detail.duplicates.length }} 条相同的托管记录（
        <template v-for="(d, i) in detail.duplicates" :key="d.id">
          <template v-if="i">，</template>{{ d.days ? d.days + ' 天' : '无周期' }}<template v-if="d.locked">·待激活</template><template v-else-if="d.archived">·已归档</template>
        </template>
        ）。若是早期数据残留，打开对应记录用「强制删除」清理。
      </p>

      <div class="detail-grid">
        <p class="detail-section">基本信息</p>
        <div class="detail-field"><span class="dl">游戏</span>
          <SelectBox v-if="editing" class="pd-flex" v-model="draft.game" :options="gameOptions" />
          <span class="dv" v-else>{{ gameText }}</span>
        </div>
        <div class="detail-field"><span class="dl">服务项目</span>
          <input v-if="editing" v-model="draft.service" class="pd-inp" />
          <span class="dv" v-else>{{ detail.project.service || '—' }}</span>
        </div>
        <div class="detail-field"><span class="dl">类型</span>
          <SelectBox v-if="editing" class="pd-flex" v-model="draft.status" :options="typeOptions" />
          <span class="dv" v-else>{{ typeText }}</span>
        </div>
        <div class="detail-field"><span class="dl">状态</span><span class="dv">{{ stateText }}</span></div>
        <div class="detail-field"><span class="dl">创建时间</span>
          <input v-if="editing" type="datetime-local" v-model="editCreatedAt" class="pd-inp" />
          <span class="dv" v-else>{{ formatTime(detail.project.createdAt) }}</span>
        </div>
        <div class="detail-field"><span class="dl">账号</span>
          <template v-if="editing">
            <input v-model="draft.account" class="pd-inp" :type="showAccount ? 'text' : 'password'" />
            <button class="pd-mini" type="button" @click="showAccount = !showAccount">{{ showAccount ? '隐藏' : '显示' }}</button>
          </template>
          <span class="dv" v-else>{{ maskAccount(detail.project.account) || '—' }}</span>
        </div>
        <div class="detail-field"><span class="dl">密码</span>
          <template v-if="editing">
            <input v-model="draft.password" class="pd-inp" :type="showPassword ? 'text' : 'password'" />
            <button class="pd-mini" type="button" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button>
          </template>
          <span class="dv" v-else>{{ detail.project.password ? '••••••' : '—' }}</span>
        </div>

        <template v-if="detail.hosting">
          <p class="detail-section">托管周期</p>
          <div class="detail-field"><span class="dl">开始日</span>
            <input v-if="editing" type="date" v-model="hostStart" class="pd-inp" @change="syncFromDays" />
            <span class="dv mono" v-else>{{ detail.host.startDate }}</span>
          </div>
          <div class="detail-field"><span class="dl">结束日</span>
            <input v-if="editing" type="date" v-model="hostEnd" class="pd-inp" @change="syncFromEnd" />
            <span class="dv mono" v-else>{{ detail.host.endDate }}</span>
          </div>
          <div class="detail-field"><span class="dl">托管天数</span>
            <input v-if="editing" type="number" min="1" v-model.number="hostDays" class="pd-inp" @change="syncFromDays" />
            <span class="dv mono" v-else>{{ detail.host.totalDays }} 天</span>
          </div>
          <div class="detail-field"><span class="dl">第几天</span><span class="dv mono">第 {{ detail.host.dayIndex }} 天</span></div>
          <div class="detail-field"><span class="dl">执行进度</span><span class="dv mono">{{ detail.host.completed }} / {{ detail.host.planned }} 次</span></div>
          <div class="detail-field"><span class="dl">剩余次数</span><span class="dv mono">{{ detail.host.remaining }} 次</span></div>
          <div class="detail-field"><span class="dl">上次确认</span><span class="dv mono">{{ detail.project.lastConfirmDate || '—' }}</span></div>
        </template>
        <template v-else>
          <p class="detail-section">任务信息</p>
          <div class="detail-field"><span class="dl">计划日期</span><span class="dv mono">{{ detail.project.plannedDate || '—' }}</span></div>
          <div class="detail-field"><span class="dl">计划次数</span><span class="dv mono">{{ detail.project.plannedTimes ?? '—' }}</span></div>
        </template>

        <p class="detail-section">平台名称</p>
        <div class="detail-field"><span class="dl">首选</span>
          <SelectBox v-if="editing" class="pd-flex" v-model="draft.preferredPlatform" :options="platformOptions" />
          <span class="dv" v-else>{{ platformText }}</span>
        </div>
        <div class="detail-field" v-for="f in nameFields" :key="f.key"><span class="dl">{{ f.label }}</span>
          <input v-if="editing" v-model="draft[f.key]" class="pd-inp" />
          <span class="dv" v-else>{{ detail.project[f.key] || '—' }}</span>
        </div>

        <p class="detail-section">费用</p>
        <div class="detail-field"><span class="dl">总收费</span>
          <input v-if="editing" type="number" v-model="draft.totalFee" class="pd-inp" />
          <span class="dv mono" v-else>{{ yuan(detail.finance.totalFee) }}</span>
        </div>
        <div class="detail-field"><span class="dl">实际收费</span>
          <input v-if="editing" type="number" v-model="draft.actualFee" class="pd-inp" />
          <span class="dv mono" v-else>{{ yuan(detail.finance.actualFee) }}</span>
        </div>
        <div class="detail-field"><span class="dl">延后收费</span>
          <input v-if="editing" type="number" v-model="draft.delayedFee" class="pd-inp" />
          <span class="dv mono" v-else>{{ yuan(detail.finance.delayedFee) }}</span>
        </div>
        <div class="detail-field"><span class="dl">收费归属日</span>
          <input v-if="editing" type="date" v-model="draft.paidAt" class="pd-inp" />
          <span class="dv mono" v-else>{{ detail.finance.paidAt || '—' }}</span>
        </div>
        <div class="detail-field"><span class="dl">累计收费</span>
          <span class="dv mono">{{ yuan(detail.finance.paidTotal) }}<template v-if="detail.finance.paymentCount > 1"> · {{ detail.finance.paymentCount }} 笔</template></span>
        </div>
        <div class="detail-field"><span class="dl">备注</span>
          <input v-if="editing" v-model="draft.note" class="pd-inp" />
          <span class="dv" v-else>{{ detail.project.note || '—' }}</span>
        </div>
      </div>

      <div class="edit-actions pd-actions">
        <button v-if="!editing" class="pd-btn" @click="startEdit">编辑</button>
        <template v-else>
          <button class="pd-btn primary" :style="cfm.styleOf('save')" :title="cfm.titleOf('save', '保存')" @click="onSave">保存</button>
          <button class="pd-btn" @click="cancelEdit">取消编辑</button>
        </template>

        <button v-if="detail.actions.renew" class="pd-btn" :class="{ primary: addOpen }" @click="toggleAdd">续费</button>
        <button
          v-if="detail.actions.archive"
          class="pd-btn"
          :style="cfm.styleOf('archive')"
          :title="cfm.titleOf('archive', '归档（消耗全部天数并完成托管）')"
          @click="onArchive"
        >归档</button>
        <button v-if="detail.actions.restore" class="pd-btn" @click="$emit('restore')">取消归档</button>
        <button
          v-if="detail.actions.remove"
          class="pd-btn"
          :style="cfm.styleOf('remove')"
          :title="cfm.titleOf('remove', '删除')"
          @click="onRemove"
        >删除</button>
        <!-- 有执行记录 / 被后继引用时普通删除会退化成归档，这里给一条明确的强制通路 -->
        <button
          v-if="detail.actions.forceRemove"
          class="pd-btn danger"
          :style="cfm.styleOf('force-remove')"
          :title="cfm.titleOf('force-remove', '强制删除：连执行记录一起删，不可恢复')"
          @click="onForceRemove"
        >强制删除</button>
        <button class="pd-btn" @click="requestClose">关闭</button>
      </div>

      <!-- 续费 = 在原项目上加天数 + 记一笔收费（不新建项目） -->
      <div class="pd-renew" v-if="addOpen">
        <div class="pd-renew-title">续费：在原项目上加天数 + 记一笔收费</div>
        <div class="pd-renew-row">
          <span class="dl">加天数</span>
          <input type="number" min="1" v-model.number="addDays" class="pd-inp" />
          <span class="pd-renew-hint mono">当前周期 {{ detail.host.startDate }} → {{ detail.host.endDate }}</span>
        </div>
        <div class="pd-renew-row">
          <span class="dl">收费金额</span>
          <input type="number" min="0" v-model.number="addAmount" class="pd-inp" />
          <span class="dl">收费日期</span>
          <input type="date" v-model="addPaidAt" class="pd-inp" />
        </div>
        <div class="pd-renew-row">
          <span class="pd-renew-hint">
            结束日顺延 {{ addDays || 0 }} 天，本次收费单独记为一条订单（收入按收费日期归月）；
            <strong>不新建项目</strong>，项目资料、执行记录与已有订单都不变。
          </span>
        </div>
        <div class="pd-renew-actions">
          <button class="pd-btn primary" :style="cfm.styleOf('add-period')" :title="cfm.titleOf('add-period', '确认续费')" @click="doAdd">确认续费</button>
          <button class="pd-btn" @click="addOpen = false">取消续费</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 项目详情：只做「渲染 + 派发」，业务规则全在 services/projectDetail.js 与 projectService.js
import { ref, computed, onMounted, onUnmounted } from 'vue'
import SelectBox from '@/components/SelectBox.vue'
import { maskAccount } from '@/composables/useMask'
import { useConfirmClick } from '@/composables/useConfirmClick.js'
import { todayLocal, isYmd, daysBetween, diffDays, endDateFromDays } from '@/utils/date.js'

const props = defineProps({
  detail: { type: Object, required: true },
  gameOptions: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'save', 'archive', 'restore', 'add-period', 'remove', 'force-remove'])

function requestClose() { emit('close') }
function onKeydown(e) { if (e.key === 'Escape') requestClose() }
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ── 编辑态（只作用于当前项目）──
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
  // 下拉的 value 是游戏 id，而记录里 game 存的是游戏名 → 转成 id 才能正确选中
  draft.value.game = gameOptionId(draft.value.game)
  const h = props.detail.host
  if (h) {
    hostStart.value = h.startDate
    hostEnd.value = h.endDate
    hostDays.value = h.totalDays
  }
  editing.value = true
  showAccount.value = false
  showPassword.value = false
}
function cancelEdit() { editing.value = false; draft.value = {} }
function submitEdit() {
  const patch = { ...draft.value }
  delete patch.id
  // 托管周期：可直接改（以编辑态的开始日 + 天数推结束日，含首尾）
  if (props.detail.hosting && isYmd(hostStart.value)) {
    const n = Math.max(1, Math.round(Number(hostDays.value) || 1))
    patch.host = {
      ...(draft.value.host || {}),
      startDate: hostStart.value,
      endDate: endDateFromDays(hostStart.value, n),
      cycleDays: n,
    }
  }
  emit('save', patch)
  editing.value = false
}

// ── 托管周期联动（开始日 / 结束日 / 天数，含首尾）──
const hostStart = ref('')
const hostEnd = ref('')
const hostDays = ref(1)
function hostDayCount() {
  const n = Math.round(Number(hostDays.value) || 0)
  return n > 0 ? n : 1
}
// 开始日或天数变化 → 结束日 = 开始日 + 天数 − 1
function syncFromDays() {
  if (isYmd(hostStart.value)) hostEnd.value = endDateFromDays(hostStart.value, hostDayCount())
}
// 直接改结束日 → 天数跟着变
function syncFromEnd() {
  if (isYmd(hostStart.value) && isYmd(hostEnd.value)) {
    const d = daysBetween(hostStart.value, hostEnd.value)
    if (d > 0) hostDays.value = d
  }
}

// ── 多次点击确认（与全站一致：连点 4 次生效，停手 3 秒自动复位）──
const cfm = useConfirmClick()
function onSave() { if (!cfm.trigger('save')) return; submitEdit() }
function onArchive() { if (cfm.trigger('archive')) emit('archive') }
function onRemove() { if (cfm.trigger('remove')) emit('remove') }

// ── 续费：加天数 + 记一笔收费（默认沿用当前周期天数与最近一次收费金额）──
const addOpen = ref(false)
const addDays = ref(30)
const addAmount = ref(0)
const addPaidAt = ref('')
function toggleAdd() {
  if (addOpen.value) { addOpen.value = false; return }
  // 默认加天数 = 原周期的日历跨度（结束日 − 开始日），不能用 totalDays（含首尾，会多 1 天）
  const h = props.detail.host
  addDays.value = (h && isYmd(h.startDate) && isYmd(h.endDate))
    ? Math.max(1, diffDays(h.startDate, h.endDate))
    : 30
  addAmount.value = Number(props.detail.finance.periodFee) || 0
  addPaidAt.value = todayLocal()
  addOpen.value = true
}
function doAdd() {
  const n = Math.max(1, Math.round(Number(addDays.value) || 0))
  if (!n) return
  if (!cfm.trigger('add-period')) return
  addOpen.value = false
  emit('add-period', { days: n, amount: Number(addAmount.value) || 0, paidAt: addPaidAt.value })
}

// ── 展示辅助 ──
// 游戏名 / 游戏 id 互相兼容：下拉选项的 value 是 id，记录里存的是名字
function gameOptionId(v) {
  const hit = (props.gameOptions || []).find(o => o.value === v || o.label === v)
  return hit ? hit.value : v
}
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
const platformText = computed(() => {
  const v = props.detail.project.preferredPlatform || 'wechat'
  const hit = platformOptions.find(o => o.value === v)
  return hit ? hit.label : v
})
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
</script>

<style scoped>
.pd-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.pd-head-main { flex: 1; min-width: 0; }
.pd-name { font-size: 15px; font-weight: 800; }
.pd-sub { font-size: 11px; font-family: var(--font-mono); opacity: 0.6; margin-top: 2px; }
.pd-state {
  font-size: 10px; font-family: var(--font-mono); padding: 2px 8px;
  border: 1px solid currentColor; opacity: 0.85; white-space: nowrap;
}
.pd-state.st-active { color: var(--accent); }
.pd-state.st-paused, .pd-state.st-archived { color: #9E9E9E; }
.pd-state.st-completed { color: #00B0FF; }
.pd-state.st-scheduled { color: var(--warn, #D87938); }
.pd-locked {
  font-size: 11px; font-family: var(--font-mono); padding: 6px 8px; margin: 0 0 8px;
  border-left: 3px solid var(--warn, #D87938); background: var(--bg-secondary);
}

.mono { font-family: var(--font-mono); }
.pd-flex { flex: 1; min-width: 0; }
.pd-inp {
  flex: 1; min-width: 0; height: 24px; padding: 0 6px;
  border: 1px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-family: inherit; font-size: 12px;
}
.pd-inp:focus { outline: none; border-color: var(--btn-hover-bg); }
.pd-mini {
  font-size: 10px; padding: 1px 6px; border: 1px solid var(--border-color);
  background: var(--bg-primary); color: var(--text-primary); cursor: pointer; font-family: var(--font-mono);
}

.pd-actions { flex-wrap: wrap; align-items: center; }
.pd-btn {
  height: 26px; padding: 0 10px; border: 1px solid var(--border-color);
  background: var(--bg-primary); color: var(--text-primary);
  font-family: inherit; font-size: 12px; cursor: pointer;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}
.pd-btn:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.pd-btn.primary { background: var(--btn-hover-bg); color: var(--btn-hover-text); font-weight: 700; }
/* 删除专用红：告警一律用强调色与墨线，只有「删掉东西」才配红 */
.pd-btn.danger { border-color: var(--warn); color: var(--warn); }
.pd-btn.danger:hover { background: var(--warn); border-color: var(--warn); color: #FFFFFF; }
/* 同客户同服务的其它托管：早期 / 后期数据冲突的提示 */
.pd-dup {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.6;
  opacity: 0.72;
  border-left: 2px solid var(--warn);
  padding-left: 8px;
}

/* ── 续费（加天数 + 收费）── */
.pd-renew { border-top: 2px solid var(--accent); margin-top: 12px; padding-top: 10px; }
.pd-renew-title { font-size: 12px; font-weight: 800; margin-bottom: 6px; }
.pd-renew-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; flex-wrap: wrap; }
.pd-renew-row .dl { width: 64px; flex-shrink: 0; opacity: 0.55; font-family: var(--font-mono); font-size: 11px; }
.pd-renew-row .pd-inp { max-width: 150px; }
.pd-renew-hint { font-size: 10px; opacity: 0.6; line-height: 1.6; }
.pd-renew-actions { display: flex; gap: 6px; }

@media (prefers-reduced-motion: reduce) {
  .pd-popup { animation: none; }
  .pd-btn { transition: none; }
}
</style>

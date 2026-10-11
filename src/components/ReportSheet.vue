<template>
  <div class="rp-sheet" @paste="onPaste">
    <div class="local-toolbar">
      <button class="rc-global-btn" @click="exportImage(false)">导出图片</button>
      <button class="rc-global-btn" @click="exportImage(true)">复制到剪切板</button>
      <button
        class="rc-global-btn rp-confirm-btn"
        data-sfx-overcharge
        :disabled="!selectedTask || selectedConfirmedToday"
        :style="getConfirmStyle()"
        :title="confirmBtnTitle"
        @click="handleConfirm"
      >{{ confirmBtnText }}</button>
      <button class="rc-global-btn" @click="shareImage">分享</button>
      <button class="rc-global-btn" @click="resetAll">重置</button>
      <label class="rc-global-btn" style="cursor:pointer">
        <span>+ 图片</span>
        <input type="file" accept="image/*" multiple hidden @change="onImgFiles" />
      </label>
      <div class="toolbar-spacer"></div>
      <span class="rp-hint">Ctrl+V 粘贴截图</span>
    </div>

    <div class="rp-body">
      <div class="rp-wrap" ref="wrapRef">
        <!-- Title -->
        <div class="rp-title-row">
          <div class="rp-title" contenteditable @input="dirty = true" ref="titleRef">秋の露的每日汇报</div>
          <div class="rp-no-export rp-author-box">
            <span class="rp-author-label">汇报人</span>
            <button class="rp-author-btn" :class="{ active: activeAuthor === '秋の露' }" @click="setAuthor('秋の露')">秋の露</button>
            <button class="rp-author-btn" :class="{ active: activeAuthor === '小野' }" @click="setAuthor('小野')">小野</button>
          </div>
          <div class="rp-game-tabs">
            <button :class="{ active: reportGame === 'ak', 'rp-no-export': reportGame !== 'ak' }" @click="switchGame('ak')">明日方舟</button>
            <button :class="{ active: reportGame === 'endfield', 'rp-no-export': reportGame !== 'endfield' }" @click="switchGame('endfield')">终末地</button>
            <button :class="{ active: reportGame === 'nte', 'rp-no-export': reportGame !== 'nte' }" @click="switchGame('nte')">异环</button>
          </div>
        </div>

        <!-- Hosting period -->
        <div class="rp-meta">
          <span class="rp-no-export" v-if="hostingOptions.length">
            <SelectBox v-model="selectedTaskId" :options="hostingOptions" placeholder="选择托管项目" width="300px" @change="applyTask" />
          </span>
          <span>托管：第</span><input type="number" v-model.number="curDay" class="rp-inp rp-num" min="1" />
          <span>/</span><input type="number" v-model.number="totalDays" class="rp-inp rp-num" min="1" />
          <span>天（</span><input type="date" v-model="dateFrom" class="rp-inp rp-date-sm" />
          <span>—</span><input type="date" v-model="dateTo" class="rp-inp rp-date-sm" />
          <span>）</span>
        </div>

        <!-- AK -->
        <div class="rp-cards-row" v-if="reportGame === 'ak'">
          <div class="rp-card rp-half">
            <div class="rp-card-head">日常</div>
            <div class="rp-card-body">
              <div class="rp-tasks">
                <div v-for="t in dailyTasks" :key="t.label" class="rp-task-row rp-task-grid">
                  <span class="rp-task-label">{{ t.label }}</span>
                  <label class="rp-radio"><input type="radio" :name="uid + '_' + t.label" v-model="t.done" :value="true" /><span class="rp-radio-box"></span>完成</label>
                  <label class="rp-radio"><input type="radio" :name="uid + '_' + t.label" v-model="t.done" :value="false" /><span class="rp-radio-box"></span>未完成</label>
                  <input v-if="t.extra !== undefined" v-model="t.extra" class="rp-inp rp-extra" placeholder="备注" />
                </div>
                <div class="rp-task-row rp-task-grid">
                  <span class="rp-task-label">理智剩余</span>
                  <input type="number" v-model.number="sanityLeft" class="rp-inp" min="0" style="width:60px" />
                  <span></span><span></span>
                </div>
                <div class="rp-task-row rp-task-grid">
                  <span class="rp-task-label">线索传递</span>
                  <label class="rp-radio"><input type="radio" :name="uid + '_clue_extra'" v-model="clueExtra" value="好友位已送完" /><span class="rp-radio-box"></span>好友位已送完</label>
                  <label class="rp-radio"><input type="radio" :name="uid + '_clue_extra'" v-model="clueExtra" value="" /><span class="rp-radio-box"></span>无</label>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
          <div class="rp-card rp-half">
            <div class="rp-card-head">周常</div>
            <div class="rp-card-body">
              <div class="rp-tasks">
                <div v-for="t in weeklyTasks" :key="t.label" class="rp-task-row rp-task-grid">
                  <span class="rp-task-label">{{ t.label }}</span>
                  <label class="rp-radio"><input type="radio" :name="uid + '_' + t.label" v-model="t.done" :value="true" /><span class="rp-radio-box"></span>完成</label>
                  <label class="rp-radio"><input type="radio" :name="uid + '_' + t.label" v-model="t.done" :value="false" /><span class="rp-radio-box"></span>未完成</label>
                  <input v-if="t.extra !== undefined" v-model="t.extra" class="rp-inp rp-extra" placeholder="备注" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Endfield -->
        <div class="rp-cards-row" v-if="reportGame === 'endfield'">
          <div class="rp-card rp-half">
            <div class="rp-card-head">日常</div>
            <div class="rp-card-body">
              <div class="rp-tasks">
                <div v-for="t in efDailyTasks" :key="t.label" class="rp-task-row rp-task-grid">
                  <span class="rp-task-label">{{ t.label }}</span>
                  <label class="rp-radio"><input type="radio" :name="uid + '_ef_' + t.label" v-model="t.done" :value="true" /><span class="rp-radio-box"></span>完成</label>
                  <label class="rp-radio"><input type="radio" :name="uid + '_ef_' + t.label" v-model="t.done" :value="false" /><span class="rp-radio-box"></span>未完成</label>
                  <input v-if="t.extra !== undefined" v-model="t.extra" class="rp-inp rp-extra" placeholder="备注" />
                </div>
                <div class="rp-task-row rp-task-grid">
                  <span class="rp-task-label">理智剩余</span>
                  <input type="number" v-model.number="efSanityLeft" class="rp-inp" min="0" style="width:60px" />
                  <span></span><span></span>
                </div>
                <div class="rp-task-row rp-task-grid">
                  <span class="rp-task-label">线索传递</span>
                  <label class="rp-radio"><input type="radio" :name="uid + '_ef_clue'" v-model="efClueExtra" value="好友位已送完" /><span class="rp-radio-box"></span>好友位已送完</label>
                  <label class="rp-radio"><input type="radio" :name="uid + '_ef_clue'" v-model="efClueExtra" value="" /><span class="rp-radio-box"></span>无</label>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
          <div class="rp-card rp-half">
            <div class="rp-card-head">周常</div>
            <div class="rp-card-body">
              <div class="rp-tasks">
                <div v-for="t in efWeeklyTasks" :key="t.label" class="rp-task-row rp-task-grid">
                  <span class="rp-task-label">{{ t.label }}</span>
                  <label class="rp-radio"><input type="radio" :name="uid + '_efw_' + t.label" v-model="t.done" :value="true" /><span class="rp-radio-box"></span>完成</label>
                  <label class="rp-radio"><input type="radio" :name="uid + '_efw_' + t.label" v-model="t.done" :value="false" /><span class="rp-radio-box"></span>未完成</label>
                  <input v-if="t.extra !== undefined" v-model="t.extra" class="rp-inp rp-extra" placeholder="备注" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- NTE -->
        <div v-if="reportGame === 'nte'">
          <div class="rp-cards-row">
            <div class="rp-card rp-half">
              <div class="rp-card-head">日常</div>
              <div class="rp-card-body">
                <div class="rp-tasks">
                  <div v-for="t in nteDailyA" :key="t.label" class="rp-task-row rp-task-grid">
                    <span class="rp-task-label">{{ t.label }}</span>
                    <label class="rp-radio"><input type="radio" :name="uid + '_nte_' + t.label" v-model="t.done" :value="true" /><span class="rp-radio-box"></span>完成</label>
                    <label class="rp-radio"><input type="radio" :name="uid + '_nte_' + t.label" v-model="t.done" :value="false" /><span class="rp-radio-box"></span>未完成</label>
                    <input v-if="t.extra !== undefined" v-model="t.extra" class="rp-inp rp-extra" placeholder="备注" />
                  </div>
                  <div v-for="t in nteDailyB" :key="t.label" class="rp-task-row rp-task-grid">
                    <span class="rp-task-label">{{ t.label }}</span>
                    <label class="rp-radio"><input type="radio" :name="uid + '_nte_' + t.label" v-model="t.done" :value="true" /><span class="rp-radio-box"></span>完成</label>
                    <label class="rp-radio"><input type="radio" :name="uid + '_nte_' + t.label" v-model="t.done" :value="false" /><span class="rp-radio-box"></span>未完成</label>
                    <input v-model="t.extra" class="rp-inp rp-extra" placeholder="备注" />
                  </div>
                  <div class="rp-task-row rp-task-grid">
                    <span class="rp-task-label">本性像素剩余</span>
                    <input type="number" v-model.number="ntePixelLeft" class="rp-inp" min="0" style="width:60px" />
                    <span></span><span></span>
                  </div>
                </div>
              </div>
            </div>
            <div class="rp-card rp-half">
              <div class="rp-card-head">周常</div>
              <div class="rp-card-body">
                <div class="rp-tasks">
                  <div v-for="t in nteWeeklyTasks" :key="t.label" class="rp-task-row rp-task-grid">
                    <span class="rp-task-label">{{ t.label }}</span>
                    <label class="rp-radio"><input type="radio" :name="uid + '_ntew_' + t.label" v-model="t.done" :value="true" /><span class="rp-radio-box"></span>完成</label>
                    <label class="rp-radio"><input type="radio" :name="uid + '_ntew_' + t.label" v-model="t.done" :value="false" /><span class="rp-radio-box"></span>未完成</label>
                    <input v-if="t.extra !== undefined" v-model="t.extra" class="rp-inp rp-extra" placeholder="备注" />
                  </div>
                  <div class="rp-task-row rp-task-grid">
                    <span class="rp-task-label">送礼</span>
                    <label class="rp-radio"><input type="radio" :name="uid + '_nte_gift'" v-model="nteGiftDone" :value="true" /><span class="rp-radio-box"></span>完成</label>
                    <label class="rp-radio"><input type="radio" :name="uid + '_nte_gift'" v-model="nteGiftDone" :value="false" /><span class="rp-radio-box"></span>未完成</label>
                    <input v-model="nteGiftNote" class="rp-inp rp-extra" placeholder="备注" />
                  </div>
                  <div class="rp-task-row rp-task-grid">
                    <span class="rp-task-label">都市体力剩余</span>
                    <input type="number" v-model.number="nteStaminaLeft" class="rp-inp" min="0" style="width:60px" />
                    <span></span><span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 今日获取资源 -->
        <div class="rp-card">
          <div class="rp-card-head">今日获取资源</div>
          <div class="rp-card-body">
            <!-- 已停用预选项：今日获取资源 -->
            <template v-if="false">
            <div class="rp-no-export rp-quick-bar" v-if="reportGame === 'nte'">
              <span class="rp-quick-label">快捷添加：</span>
              <button v-for="m in nteQuickMats" :key="m" class="rp-quick-btn" @click="appendMatRes(m)">{{ m }}</button>
              <span class="rp-quick-label rp-quick-group-label">培养素材：</span>
              <button v-for="m in nteEvoMats" :key="m" class="rp-quick-btn" style="background:rgba(183,131,255,0.15)" @click="appendMatRes(m)">{{ m }}</button>
            </div>
            <div class="rp-no-export rp-quick-bar" v-else>
              <template v-if="reportGame === 'ak'">
                <template v-for="g in quickMats" :key="g.name">
                  <span class="rp-quick-label rp-quick-group-label">{{ g.name }}：</span>
                  <button v-for="m in g.items" :key="m" class="rp-quick-btn" :style="{ background: g.tier === 1 ? 'rgba(159,159,159,0.15)' : g.tier === 2 ? 'rgba(227,227,36,0.15)' : g.tier === 3 ? 'rgba(0,179,252,0.15)' : 'rgba(208,191,208,0.2)' }" @click="appendMatRes(m)">{{ m }}</button>
                </template>
              </template>
              <template v-else>
                <template v-for="g in efQuickMats" :key="g.name">
                  <span class="rp-quick-label rp-quick-group-label">{{ g.name }}：</span>
                  <button v-for="m in g.items" :key="m.name" class="rp-quick-btn" :style="{ background: m.tier === 1 ? 'rgba(182,182,182,0.15)' : m.tier === 2 ? 'rgba(182,219,70,0.15)' : m.tier === 3 ? 'rgba(52,197,255,0.15)' : m.tier === 4 ? 'rgba(183,131,255,0.15)' : m.tier === 5 ? 'rgba(255,207,0,0.18)' : 'rgba(255,115,0,0.15)' }" @click="appendMatRes(m.name)">{{ m.name }}</button>
                </template>
              </template>
            </div>
            </template>
            <div class="rp-tasks">
              <div v-for="(r, i) in resources" :key="i" class="rp-task-row">
                <input v-model="r.label" class="rp-inp rp-label-inp" placeholder="资源名" />
                <input v-model="r.before" class="rp-inp rp-res-inp" placeholder="变更前" />
                <span class="rp-arrow">→</span>
                <input v-model="r.after" class="rp-inp rp-res-inp" placeholder="变更后" />
                <input v-model="r.note" class="rp-inp rp-extra" placeholder="备注" />
                <button class="rp-row-del rp-no-export" @click="resources.splice(i, 1)" v-if="resources.length > 1">×</button>
              </div>
              <button class="rp-add-row rp-no-export" @click="resources.push({ label: '', before: '', after: '', note: '' })">+ 添加资源</button>
            </div>
          </div>
        </div>

        <!-- 明日计划 -->
        <div class="rp-card">
          <div class="rp-card-head">明日计划</div>
          <div class="rp-card-body">
            <!-- 已停用预选项：明日计划 -->
            <template v-if="false">
            <div class="rp-no-export rp-quick-bar" v-if="reportGame === 'nte'">
              <span class="rp-quick-label">快捷：</span>
              <button v-for="q in nteQuickPlans" :key="q" class="rp-quick-btn" @click="appendPlan(q)">{{ q }}</button>
              <span class="rp-quick-label rp-quick-group-label">培养素材：</span>
              <button v-for="m in nteEvoMats" :key="m" class="rp-quick-btn" style="background:rgba(183,131,255,0.15)" @click="appendPlan('刷取' + m)">{{ m }}</button>
            </div>
            <div class="rp-no-export rp-quick-bar" v-else-if="reportGame === 'endfield'">
              <template v-for="g in efQuickMats" :key="g.name">
                <span class="rp-quick-label rp-quick-group-label">{{ g.name }}：</span>
                <button v-for="m in g.items" :key="m.name" class="rp-quick-btn" :style="{ background: m.tier === 1 ? 'rgba(182,182,182,0.15)' : m.tier === 2 ? 'rgba(182,219,70,0.15)' : m.tier === 3 ? 'rgba(52,197,255,0.15)' : m.tier === 4 ? 'rgba(183,131,255,0.15)' : m.tier === 5 ? 'rgba(255,207,0,0.18)' : 'rgba(255,115,0,0.15)' }" @click="appendPlan('刷取' + m.name)">{{ m.name }}</button>
              </template>
            </div>
            <div class="rp-no-export rp-quick-bar" v-else>
              <span class="rp-quick-label">日常：</span><button v-for="q in quickPlans" :key="q" class="rp-quick-btn" @click="appendPlan(q)">{{ q }}</button>
              <span class="rp-quick-label">材料：</span>
              <template v-for="g in quickMats" :key="g.name">
                <span class="rp-quick-label rp-quick-group-label">{{ g.name }}：</span>
                <button v-for="m in g.items" :key="m" class="rp-quick-btn" :style="{ background: g.tier === 1 ? 'rgba(159,159,159,0.15)' : g.tier === 2 ? 'rgba(227,227,36,0.15)' : g.tier === 3 ? 'rgba(0,179,252,0.15)' : 'rgba(208,191,208,0.2)' }" @click="appendPlan('刷取' + m)">{{ m }}</button>
              </template>
            </div>
            </template>
            <div class="rp-lines" contenteditable @input="dirty = true" @keydown.enter="onPlanEnter" ref="planRef">
              <div></div>
            </div>
          </div>
        </div>

        <!-- 备注 -->
        <div class="rp-card">
          <div class="rp-card-head">备注</div>
          <div class="rp-card-body">
            <!-- 已停用预选项：备注 -->
            <template v-if="false">
            <div class="rp-no-export rp-quick-bar" v-if="reportGame === 'nte'">
              <span class="rp-quick-label">快捷：</span>
              <button v-for="n in nteQuickNotes" :key="n" class="rp-quick-btn" @click="appendNote(n)">{{ n }}</button>
            </div>
            <div class="rp-no-export rp-quick-bar" v-else>
              <span class="rp-quick-label">快捷：</span>
              <button v-for="n in quickNotes" :key="n" class="rp-quick-btn" @click="appendNote(n)">{{ n }}</button>
            </div>
            </template>
            <div class="rp-lines" contenteditable @input="dirty = true" ref="noteRef">
              <div></div>
            </div>
          </div>
        </div>

        <!-- 截图 -->
        <div class="rp-card" v-if="images.length">
          <div class="rp-card-head">截图</div>
          <div class="rp-card-body">
            <div class="rp-images">
              <div v-for="(img, i) in images" :key="i" class="rp-img-wrap">
                <img :src="img" class="rp-img" />
                <button class="rp-img-del rp-no-export" @click="images.splice(i, 1)">×</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import html2canvas from 'html2canvas'
import SelectBox from '@/components/SelectBox.vue'
import { maskAccount, getDisplayName } from '@/composables/useMask'
import { fmtDate as toDateStr, addMonth } from '@/utils/date'
import { completeTaskById, localToday } from '@/utils/taskComplete'
import { playOvercharge } from '@/utils/sound'

const emit = defineEmits(['update:label'])

// 本页唯一标识：隔离各页 radio 的 name（避免多页同名互斥）
const uid = 'rs' + Math.random().toString(36).slice(2, 9)

const entered = ref(false)
onMounted(() => { requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true })) })

const wrapRef = ref(null)
const titleRef = ref(null)
const planRef = ref(null)
const noteRef = ref(null)
const images = ref([])
const reportGame = ref('ak')
const activeAuthor = ref('秋の露')
const dirty = ref(false)

const today = new Date()
function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const todayStr = fmtDate(today)
const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
const nextMonthStr = fmtDate(nextMonth)

const curDay = ref(1)
const totalDays = ref(30)
const dateFrom = ref(todayStr)
const dateTo = ref(nextMonthStr)
const sanityLeft = ref('')
const clueExtra = ref('好友位已送完')
const efSanityLeft = ref('')
const efClueExtra = ref('好友位已送完')
const ntePixelLeft = ref('')
const nteStaminaLeft = ref('')
const nteGiftDone = ref(true)
const nteGiftNote = ref('未刷新')

function calcDays() {
  const [fy, fm, fd] = dateFrom.value.split('-').map(Number)
  const [ty, tm, td] = dateTo.value.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd)
  const to = new Date(ty, tm - 1, td)
  totalDays.value = Math.round((to - from) / (1000 * 60 * 60 * 24))
  const now = new Date()
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((todayDate - from) / (1000 * 60 * 60 * 24)) + 1
  curDay.value = Math.max(1, Math.min(diff, totalDays.value))
}

watch(dateFrom, (val) => {
  if (programmaticDate) return
  if (!val) return
  const [fy, fm, fd] = val.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd)
  const to = new Date(from)
  to.setMonth(to.getMonth() + 1)
  if (to.getDate() !== fd) to.setDate(0)
  const ty = to.getFullYear()
  const tm = String(to.getMonth() + 1).padStart(2, '0')
  const td = String(to.getDate()).padStart(2, '0')
  dateTo.value = `${ty}-${tm}-${td}`
  calcDays()
})
watch(dateTo, () => { calcDays() }, { immediate: true })

// ── 托管项目选择（SelectBox + 脱敏）──
const hostingTasks = ref(loadHostingTasks())
const selectedTaskId = ref('')
function loadHostingTasks() {
  try {
    // 仅列出「当前生效」的托管：排除提前续费(locked)与「今日已确认」的项目
    const today = localToday()
    return JSON.parse(localStorage.getItem('tr-accounts') || '[]')
      .filter(r => r.status === 2 && !r.locked && r.lastConfirmDate !== today)
  } catch { return [] }
}
// 项目选择按游戏排序（终末地优先）
const GAME_ORDER = ['终末地', '明日方舟', '异环']
const hostingOptions = computed(() => {
  const rank = (g) => { const i = GAME_ORDER.indexOf(g || '终末地'); return i < 0 ? 999 : i }
  return [...hostingTasks.value]
    .sort((a, b) => rank(a.game) - rank(b.game))
    .map(t => {
      const name = getDisplayName(t) || maskAccount(t.account) || '未命名'
      const acct = maskAccount(t.account) || '—'
      const game = t.game || '终末地'
      const days = (t.remainingDays != null && t.remainingDays !== '') ? t.remainingDays : '—'
      return { value: t.id, label: `${game} | ${name} | ${acct} | 剩余${days}天` }
    })
})

// 向父级（ReportPage）上报当前选中项目名，用于页选项卡标签
watch(selectedTaskId, (id) => {
  const t = hostingTasks.value.find(r => String(r.id) === String(id))
  emit('update:label', t ? (getDisplayName(t) || maskAccount(t.account) || '') : '')
})

// ── 确认完成（同代肝代办）──
const selectedTask = computed(() => hostingTasks.value.find(t => String(t.id) === String(selectedTaskId.value)) || null)
const selectedConfirmedToday = computed(() => {
  const t = selectedTask.value
  return !!(t && t.status === 2 && t.lastConfirmDate === localToday())
})
const confirmBtnTitle = computed(() => {
  if (!selectedTask.value) return '请先选择托管项目'
  if (selectedConfirmedToday.value) return '该项目今日已确认，明日可再次确认'
  return '确认完成当前页选中的托管项目（同代肝代办）'
})
// ── 确认完成（同代肝代办：四次确认 + 逐层音效）──
const confirmClicks = ref(new Map())
const confirmTimers = new Map()
const CONFIRM_COLORS = { 1: '#ff4444', 2: '#ff8800', 3: '#aa44ff' }
const confirmStage = computed(() => {
  const id = selectedTaskId.value
  return id ? (confirmClicks.value.get(id) || 0) : 0
})
const confirmBtnText = computed(() => {
  const n = confirmStage.value
  if (n === 1) return '再次点击确认（2/4）'
  if (n === 2) return '再次点击确认（3/4）'
  if (n === 3) return '最后一次点击执行（4/4）'
  return '确认完成'
})
function getConfirmStyle() {
  const n = confirmStage.value
  if (n >= 1 && n <= 3) return { borderColor: CONFIRM_COLORS[n], color: CONFIRM_COLORS[n] }
  return {}
}
function handleConfirm() {
  const id = selectedTaskId.value
  if (!id || !selectedTask.value) return
  const cur = confirmClicks.value.get(id) || 0
  playOvercharge(cur)
  if (cur >= 3) {
    confirmClicks.value.delete(id)
    if (confirmTimers.has(id)) { clearTimeout(confirmTimers.get(id)); confirmTimers.delete(id) }
    confirmClicks.value = new Map(confirmClicks.value)
    confirmTaskDone()
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

function confirmTaskDone() {
  if (!selectedTask.value) return
  const r = completeTaskById(selectedTaskId.value)
  if (!r.ok) return
  refreshHosting()
  selectedTaskId.value = ''
  emit('update:label', '')
}

// ── 回填：保存「变更后」，下次填入「变更前」──
const ROLL_KEY = 'tr-report-roll'
function loadRoll() {
  try { return JSON.parse(localStorage.getItem(ROLL_KEY) || '{}') } catch { return {} }
}
function saveRoll(s) {
  try { localStorage.setItem(ROLL_KEY, JSON.stringify(s)) } catch {}
}

function applyTask() {
  if (!selectedTaskId.value) return
  const t = hostingTasks.value.find(r => String(r.id) === String(selectedTaskId.value))
  if (!t) return
  // 自动切换到该项目对应的游戏页
  const GAME_MAP = { '终末地': 'endfield', '明日方舟': 'ak', '异环': 'nte' }
  const g = GAME_MAP[t.game]
  if (g && g !== reportGame.value) switchGame(g)
  // 日期：创建日 ~ 创建日 + 1 个月
  const startStr = t.createdAt ? toDateStr(t.createdAt) : toDateStr(new Date())
  programmaticDate = true
  dateFrom.value = startStr
  dateTo.value = addMonth(startStr)
  calcDays()
  // 回填：按 label 把上次保存的「变更后」填入「变更前」
  // 放到 nextTick：等 watch(reportGame) 先把 resources 重置为新游戏的默认项后再回填
  nextTick(() => {
    programmaticDate = false
    const roll = loadRoll()[selectedTaskId.value]
    if (!roll) return
    resources.forEach(r => {
      if (r.label && roll[r.label] !== undefined) r.before = roll[r.label]
    })
  })
}
let programmaticDate = false

const dailyTasks = reactive([
  { label: '每日任务', done: true, extra: '' },
  { label: '基建收菜', done: true, extra: '' },
  { label: '信用商店', done: true, extra: '' },
  { label: '公开招募', done: true, extra: '无高资' },
])
const weeklyTasks = reactive([
  { label: '每周任务', done: true, extra: '' },
  { label: '剿灭作战', done: true, extra: '' },
])
const efDailyTasks = reactive([
  { label: '每日任务', done: true, extra: '' },
  { label: '基建收菜', done: true, extra: '' },
  { label: '物资调度', done: true, extra: '' },
  { label: '信用商店', done: true, extra: '' },
  { label: '送货', done: true, extra: '' },
])
const efWeeklyTasks = reactive([{ label: '周常任务', done: true, extra: '' }])
const nteDailyA = reactive([
  { label: '每日活跃', done: true, extra: '' },
  { label: '环期任务', done: true, extra: '' },
  { label: '咖啡店', done: true, extra: '' },
  { label: '许愿树', done: true, extra: '' },
  { label: '喷泉池', done: true, extra: '' },
  { label: '占卜', done: true, extra: '' },
])
const nteDailyB = reactive([
  { label: '送礼', done: true, extra: '未刷新' },
  { label: '棉花', done: true, extra: '未刷新' },
])
const nteWeeklyTasks = reactive([{ label: '周常', done: true, extra: '' }])

const nteQuickPlans = ['打突破材料', '打养成材料', '打经验书', '打甲硬币', '打弧盘材料', '刷空幕', '大世界锄地', '打周本', '打爪爪大案', '打轨外之境']
const nteQuickMats = ['方斯', '环石', '甲硬币']
const nteEvoMats = ['苹果核', '螺旋乐', '液态梦', '冷甜点', '戏剧芯', '小心鸽子', '扑克茶会', '惊喜派对', '印章', '裙袂', '时钟', '水月色拨片', '上膛骑士火花塞', '倾诉花种', '黑之书', '海之泪', '护巢残片', '斑斓的票根']
const nteQuickNotes = ['更新', '今天打晚了', '刷材料', '锄大地', '等体力恢复', '等都市活力刷新', '等快递刷新', '等玛门刷新', '等棉花刷新', '剩下的明天打']

const resources = reactive([
  { label: '龙门币', before: '', after: '', note: '' },
  { label: '合成玉', before: '', after: '', note: '' },
])

// 保存「变更后」→ 下次回填到「变更前」。仅在点击「导出图片 / 复制到剪切板」时触发（不再实时保存）
function commitRoll() {
  if (!selectedTaskId.value) return
  const roll = loadRoll()
  const entry = roll[selectedTaskId.value] || {}
  // 仅当「变更后」非空才更新，空值保留上次数据
  resources.forEach(r => { if (r.label && r.after !== '' && r.after != null) entry[r.label] = r.after })
  roll[selectedTaskId.value] = entry
  saveRoll(roll)
}

watch(reportGame, (game) => {
  resources.splice(0, resources.length)
  if (game === 'endfield') {
    resources.push({ label: '嵌晶玉', before: '', after: '', note: '' }, { label: '武库配额', before: '', after: '', note: '' })
  } else if (game === 'nte') {
    resources.push({ label: '方斯', before: '', after: '', note: '' }, { label: '环石', before: '', after: '', note: '' })
  } else {
    resources.push({ label: '龙门币', before: '', after: '', note: '' }, { label: '合成玉', before: '', after: '', note: '' })
  }
})

const quickPlans = ['刷1-7搓玉', '刷红票本', '刷芯片本', '刷技能书本', '刷龙门币本', '打活动EX关', '打剿灭作战', '推主线']
const quickMats = [
  { name: '基础材料', tier: 1, items: ['固源岩', '装置', '异铁', '酮凝集', '糖'] },
  { name: '中级材料', tier: 2, items: ['固源岩组', '全新装置', '异铁组', '酮凝集组', '糖组', '聚酸酯', '聚酸酯组'] },
  { name: '高级材料', tier: 3, items: ['研磨石', 'RMA70-12', '轻锰矿', '扭转醇', '凝胶', '炽合金', '晶体元件', '切削液', '半自然溶剂', '化合切削液', '转质盐组', '环烃聚质'] },
  { name: '稀有材料', tier: 4, items: ['白马醇', '三水锰矿', '改量装置', '酮阵列', '聚酸酯块', '异铁块', '糖聚块', 'RMA70-24'] },
]
const efQuickMats = [
  { name: '珍贵材料', items: [
    { tier: 5, name: '协议纹石' }, { tier: 5, name: '红矛叶' }, { tier: 5, name: '塔罗斯菌' }, { tier: 5, name: '血菌' },
    { tier: 5, name: '受蚀玉化叶' }, { tier: 5, name: '岩天使叶' }, { tier: 5, name: '星门菌' }, { tier: 5, name: '武陵石' }, { tier: 5, name: '燎石' },
    { tier: 4, name: '至晶多齿叶' }, { tier: 4, name: '中红柱状菌' }, { tier: 4, name: '重黯石' }, { tier: 4, name: '纯晶多齿叶' },
    { tier: 4, name: '重红柱状菌' }, { tier: 4, name: '中黯石' }, { tier: 4, name: '轻黯石' }, { tier: 4, name: '晶化多齿叶' }, { tier: 4, name: '轻红柱状菌' },
  ] },
  { name: '培养素材', items: [
    { tier: 5, name: '红矛叶根茎' }, { tier: 5, name: '塔罗斯菌块' }, { tier: 5, name: '协议纹石子簇' }, { tier: 5, name: '武陵精锻助剂' },
    { tier: 5, name: '血菌块' }, { tier: 5, name: '星门菌块' }, { tier: 5, name: '受蚀玉化叶根茎' }, { tier: 5, name: '岩天使叶根茎' },
    { tier: 5, name: '燎石子簇' }, { tier: 5, name: '武陵石子簇' }, { tier: 5, name: '冷却脂' },
    { tier: 5, name: '超距辉映管' }, { tier: 5, name: 'D96钢样品四' }, { tier: 5, name: '快子遴捡晶格' },
    { tier: 5, name: '象限拟合液' }, { tier: 5, name: '三相纳米片' }, { tier: 5, name: '存续的痕迹' }, { tier: 5, name: '高级认知载体' },
    { tier: 4, name: '重红柱状菌块' }, { tier: 4, name: '至晶多齿叶根茎' }, { tier: 4, name: '重黯石子簇' },
    { tier: 4, name: '轻红柱状菌块' }, { tier: 4, name: '中红柱状菌块' }, { tier: 4, name: '晶化多齿叶根茎' }, { tier: 4, name: '纯晶多齿叶根茎' },
    { tier: 4, name: '轻黯石子簇' }, { tier: 4, name: '中黯石子簇' }, { tier: 4, name: '重型强固模具' }, { tier: 4, name: '武器检查套组' },
    { tier: 4, name: '协议棱柱组' }, { tier: 4, name: '协议圆盘组' }, { tier: 4, name: '初级认知载体' },
    { tier: 3, name: '强固模具' }, { tier: 3, name: '武器检查装置' }, { tier: 3, name: '协议棱柱' }, { tier: 3, name: '协议圆盘' },
    { tier: 3, name: '高级作战记录' },
    { tier: 2, name: '武器检查单元' }, { tier: 2, name: '中级作战记录' },
    { tier: 1, name: '初级作战记录' },
  ] },
  { name: '功能道具', items: [
    { tier: 5, name: '武陵调度券' }, { tier: 5, name: '谷地调度券' }, { tier: 4, name: '高级航天建材' }, { tier: 3, name: '基础航天建材' },
  ] },
  { name: '珍贵物品', items: [
    { tier: 6, name: '武库配额' }, { tier: 6, name: '嵌晶玉' }, { tier: 6, name: '衍质源石' }, { tier: 6, name: '折金票' },
  ] },
]
const quickNotes = ['今日打晚了', '刷材料', '搓玉中', '活动期间', '推主线进度', '练度不足需提练度', '等理智恢复', '模拟悖论没打过']

function appendMatRes(mat) {
  resources.push({ label: mat, before: '', after: '', note: '' })
}
function appendPlan(text) {
  const el = planRef.value
  if (!el) return
  const last = el.lastElementChild
  if (last && !last.textContent.trim()) last.textContent = text
  else { const div = document.createElement('div'); div.textContent = text; el.appendChild(div) }
  dirty.value = true
}
function appendNote(text) {
  const el = noteRef.value
  if (!el) return
  const last = el.lastElementChild
  if (last && !last.textContent.trim()) last.textContent = text
  else { const div = document.createElement('div'); div.textContent = text; el.appendChild(div) }
  dirty.value = true
}
function setAuthor(name) {
  activeAuthor.value = name
  setTitle(name + '的每日汇报')
}
function switchGame(game) {
  reportGame.value = game
  if (game === 'nte') setAuthor('小野')
}
function setTitle(text) {
  if (titleRef.value) titleRef.value.textContent = text
  dirty.value = true
}
function resetPlan() {
  if (planRef.value) planRef.value.innerHTML = '<div></div>'
}
function onPlanEnter(e) {
  e.preventDefault()
  document.execCommand('insertLineBreak')
}

function resetAll() {
  dateFrom.value = todayStr
  dateTo.value = nextMonthStr
  calcDays()
  sanityLeft.value = ''
  clueExtra.value = '好友位已送完'
  efSanityLeft.value = ''
  efClueExtra.value = '好友位已送完'
  ntePixelLeft.value = ''
  nteStaminaLeft.value = ''
  nteGiftDone.value = true
  nteGiftNote.value = '未刷新'
  nteDailyA.forEach(t => { t.done = true; t.extra = '' })
  nteDailyB.forEach(t => { t.done = true; t.extra = '未刷新' })
  nteWeeklyTasks.forEach(t => { t.done = true; t.extra = '' })
  dailyTasks.forEach(t => { t.done = true; t.extra = t.label === '公开招募' ? '无高资' : '' })
  weeklyTasks.forEach(t => { t.done = true; t.extra = '' })
  efDailyTasks.forEach(t => { t.done = true; t.extra = '' })
  efWeeklyTasks.forEach(t => { t.done = true; t.extra = '' })
  resources.splice(0, resources.length)
  if (reportGame.value === 'endfield') {
    resources.push({ label: '嵌晶玉', before: '', after: '', note: '' }, { label: '武库配额', before: '', after: '', note: '' })
  } else if (reportGame.value === 'nte') {
    resources.push({ label: '方斯', before: '', after: '', note: '' }, { label: '环石', before: '', after: '', note: '' })
  } else {
    resources.push({ label: '龙门币', before: '', after: '', note: '' }, { label: '合成玉', before: '', after: '', note: '' })
  }
  resetPlan()
  if (noteRef.value) noteRef.value.innerHTML = '<div></div>'
  images.value.forEach(u => URL.revokeObjectURL(u))
  images.value = []
  dirty.value = false
}

function onPaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile()
      if (blob) { images.value.push(URL.createObjectURL(blob)); e.preventDefault() }
    }
  }
}
function onImgFiles(e) {
  const files = e.target.files
  if (!files) return
  for (const file of files) images.value.push(URL.createObjectURL(file))
  e.target.value = ''
}

function fillEmpty() {
  for (const r of resources) {
    if (!r.label) r.label = '—'
    if (!r.before) r.before = '无'
    if (!r.after) r.after = '无'
  }
}
// 「日常」是否全部为「未完成/无」（用于导出时隐藏周常与托管信息）
const dailyAllUndone = computed(() => {
  if (reportGame.value === 'ak') return dailyTasks.every(t => !t.done) && !clueExtra.value
  if (reportGame.value === 'endfield') return efDailyTasks.every(t => !t.done) && !efClueExtra.value
  return [...nteDailyA, ...nteDailyB].every(t => !t.done)
})

function restoreEmpty() {
  for (const r of resources) {
    if (r.label === '—') r.label = ''
    if (r.before === '无') r.before = ''
    if (r.after === '无') r.after = ''
  }
  const planEl = planRef.value
  if (planEl && planEl.textContent.trim() === '无') planEl.innerHTML = '<div></div>'
}

function prepareExport() {
  fillEmpty()
  const swaps = []
  // 「日常」全部未完成/无 → 导出时不显示「周常」卡片与「托管」信息
  if (dailyAllUndone.value) {
    for (const h of wrapRef.value.querySelectorAll('.rp-card-head')) {
      const txt = h.textContent.replace(/\s+/g, '')
      if (txt.startsWith('日常') || txt.startsWith('周常')) {
        const card = h.closest('.rp-card')
        if (card) { card.style.display = 'none'; swaps.push({ parent: card.parentNode, old: card, current: card, wasHidden: true }) }
      }
    }
    const meta = wrapRef.value.querySelector('.rp-meta')
    if (meta) { meta.style.display = 'none'; swaps.push({ parent: meta.parentNode, old: meta, current: meta, wasHidden: true }) }
  }
  const hiddens = wrapRef.value.querySelectorAll('.rp-no-export')
  hiddens.forEach(el => { el.style.display = 'none' })
  if (noteRef.value && !noteRef.value.textContent.trim()) {
    const card = noteRef.value.closest('.rp-card')
    if (card) { card.style.display = 'none'; swaps.push({ parent: card.parentNode, old: card, current: card, wasHidden: true }) }
  }
  if (planRef.value && !planRef.value.textContent.trim()) {
    const card = planRef.value.closest('.rp-card')
    if (card) { card.style.display = 'none'; swaps.push({ parent: card.parentNode, old: card, current: card, wasHidden: true }) }
  }
  wrapRef.value.querySelectorAll('select').forEach(sel => {
    const span = document.createElement('span')
    span.textContent = sel.options[sel.selectedIndex]?.text || ''
    span.style.cssText = 'display:inline-block;font-size:12px;font-family:inherit;padding:2px 6px;border:1px solid rgba(0,0,0,0.12);background:#fff;'
    sel.parentNode.replaceChild(span, sel)
    swaps.push({ parent: span.parentNode, old: sel, current: span })
  })
  wrapRef.value.querySelectorAll('input:not([type="radio"]):not([type="checkbox"])').forEach(inp => {
    if (!inp.value) { inp.style.display = 'none'; swaps.push({ parent: inp.parentNode, old: inp, current: inp, wasHidden: true }); return }
    const span = document.createElement('span')
    span.textContent = inp.value
    let extra = 'min-width:40px;'
    if (inp.classList.contains('rp-num')) extra += 'width:52px;text-align:center;'
    if (inp.classList.contains('rp-res-inp')) extra += 'width:100px;'
    if (inp.classList.contains('rp-extra')) extra += 'width:70px;'
    if (inp.classList.contains('rp-date-sm')) extra += 'width:115px;'
    if (inp.classList.contains('rp-label-inp')) extra += 'width:90px;'
    span.style.cssText = `display:inline-block;font-size:12px;font-family:inherit;padding:2px 6px;border:1px solid rgba(0,0,0,0.12);line-height:1.4;vertical-align:middle;background:#fff;${extra}`
    inp.parentNode.replaceChild(span, inp)
    swaps.push({ parent: span.parentNode, old: inp, current: span })
  })
  return () => {
    swaps.forEach(s => { if (s.wasHidden) s.old.style.display = ''; else s.parent.replaceChild(s.old, s.current) })
    hiddens.forEach(el => { el.style.display = '' })
    restoreEmpty()
  }
}

async function renderImage() {
  return html2canvas(wrapRef.value, { backgroundColor: '#ffffff', scale: 3 })
}

async function exportImage(toClipboard) {
  if (!wrapRef.value) return
  const undo = prepareExport()
  const now = new Date()
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  let ok = false
  try {
    const canvas = await renderImage()
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    if (!blob) return
    if (toClipboard) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]) } catch (e) { console.error(e) }
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `每日汇报_${ts}.png`; a.click()
      URL.revokeObjectURL(url)
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]) } catch {}
    }
    ok = true
  } catch (e) { console.error(e) } finally {
    // 先还原导出时的临时填充（fillEmpty 产生「无」等），再保存「变更后」
    undo()
    if (ok) commitRoll()
  }
}

async function shareImage() {
  if (!wrapRef.value) return
  const undo = prepareExport()
  try {
    const canvas = await renderImage()
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    if (!blob) return
    const file = new File([blob], '每日汇报.png', { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] })
    else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = '每日汇报.png'; a.click()
      URL.revokeObjectURL(url)
    }
  } catch (e) { console.error(e) } finally { undo() }
}

onMounted(() => {
  hostingTasks.value = loadHostingTasks()
})

// 本页常驻（v-show），需要时可被父级触发重新拉取当前生效的托管项目
function refreshHosting() { hostingTasks.value = loadHostingTasks() }
defineExpose({ refreshHosting })
</script>

<style scoped>
.rp-sheet { display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden; background: var(--bg-primary); color: var(--text-primary); }
.rp-sheet .rp-body { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: none; }
.rp-sheet .rp-body::-webkit-scrollbar { display: none; }
.rp-hint { font-size: 11px; opacity: 0.4; font-family: monospace; }
.rp-body { padding: 12px 0; }
.rp-wrap { max-width: 920px; margin: 0 auto; padding: 24px; background: #fff; color: #0d0d0d; }
.rp-title { font-size: 18px; font-weight: 800; letter-spacing: 2px; margin-bottom: 14px; outline: none; }
.rp-title-row { display: flex; align-items: center; margin-bottom: 14px; }
.rp-title-row .rp-title { margin-bottom: 0; flex: 1; }
.rp-game-tabs { display: flex; gap: 0; margin-left: 48px; }
.rp-game-tabs button { font-size: 12px; padding: 4px 14px; border: 1px solid rgba(0,0,0,0.15); background: none; cursor: pointer; font-family: inherit; margin-left: -1px; color: #0d0d0d; }
.rp-game-tabs button:first-child { margin-left: 0; }
.rp-game-tabs button.active { background: #0d0d0d; color: #fff; border-color: #0d0d0d; }
.rp-author-box { display: flex; align-items: center; gap: 0; margin-left: 16px; }
.rp-author-label { font-size: 10px; opacity: 0.35; font-family: monospace; margin-right: 6px; }
.rp-author-btn { font-size: 12px; padding: 4px 14px; border: 1px solid rgba(0,0,0,0.15); background: none; cursor: pointer; font-family: inherit; margin-left: -1px; color: #0d0d0d; }
.rp-author-btn:first-child { margin-left: 0; }
.rp-author-btn:hover { background: #0d0d0d; color: #fff; }
.rp-author-btn.active { background: #0d0d0d; color: #fff; border-color: #0d0d0d; }
.rp-card { border: 1px solid rgba(0,0,0,0.1); margin-bottom: 10px; }
.rp-cards-row { display: flex; gap: 10px; margin-bottom: 10px; }
.rp-cards-row .rp-card { margin-bottom: 0; }
.rp-half { flex: 1; min-width: 0; }
.rp-card-head { padding: 8px 14px; background: #f5f5f5; border-bottom: 1px solid rgba(0,0,0,0.06); font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.rp-reset-sm { font-size: 10px; padding: 1px 8px; border: 1px solid rgba(0,0,0,0.15); background: none; cursor: pointer; font-family: monospace; font-weight: 400; margin-left: auto; color: #0d0d0d; }
.rp-reset-sm:hover { background: #0d0d0d; color: #fff; }
.rp-card-body { padding: 0; }
.rp-meta { font-size: 13px; padding: 10px 14px; border: 1px solid rgba(0,0,0,0.1); margin-bottom: 12px; background: #fafafa; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.rp-inp { border: 1px solid rgba(0,0,0,0.12); padding: 3px 6px; font-size: 12px; font-family: inherit; background: #fff; line-height: 1.2; vertical-align: baseline; color: #0d0d0d; }
.rp-inp:focus { border-color: #0d0d0d; outline: none; }
.rp-date-sm { width: 115px; }
.rp-num { width: 52px; text-align: center; }
.rp-extra { flex: 1; min-width: 0; }
.rp-res-inp { width: 100px; }
.rp-label-inp { width: 90px; }
.rp-arrow { opacity: 0.25; padding: 0 2px; }
.rp-task-row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 7px 14px; }
.rp-task-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; align-items: center; }
.rp-task-grid .rp-inp { width: auto; }
.rp-task-label { flex: 1; min-width: 0; line-height: 1.5; }
.rp-radio { font-size: 11px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; opacity: 0.5; vertical-align: middle; flex: 1; }
.rp-radio input { display: none; }
.rp-radio-box { width: 12px; height: 12px; border: 2px solid #0d0d0d; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; align-self: center; }
.rp-radio input:checked + .rp-radio-box { background: #fff; border-color: #0d0d0d; }
.rp-radio input:checked + .rp-radio-box::after { content: ''; width: 6px; height: 6px; background: #0d0d0d; }
.rp-radio:has(input:checked) { opacity: 1; font-weight: 600; }
.rp-quick-bar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 8px 14px; border-bottom: 1px solid rgba(0,0,0,0.06); }
.rp-quick-label { font-size: 10px; opacity: 0.4; font-family: monospace; margin-right: 2px; }
.rp-quick-group-label { display: block; width: 100%; margin-top: 4px; }
.rp-quick-btn { font-size: 11px; padding: 2px 8px; border: 1px solid rgba(0,0,0,0.15); cursor: pointer; font-family: monospace; margin: 1px 2px; color: #0d0d0d; background: none; }
.rp-quick-btn:hover { background: #0d0d0d; color: #fff; }
.rp-lines { outline: none; font-size: 13px; line-height: 1.8; min-height: 24px; padding: 10px 14px; }
.rp-add-row { font-size: 11px; padding: 3px 8px; margin: 6px 14px; border: 1px dashed rgba(0,0,0,0.2); background: none; cursor: pointer; font-family: monospace; width: calc(100% - 28px); color: #0d0d0d; }
.rp-add-row:hover { border-color: #0d0d0d; background: #fafafa; }
.rp-row-del { font-size: 14px; padding: 0 6px; border: 1px solid rgba(0,0,0,0.15); background: none; cursor: pointer; opacity: 0.4; font-family: monospace; line-height: 1; color: #0d0d0d; }
.rp-row-del:hover { opacity: 1; background: #d00; color: #fff; border-color: #d00; }
.rp-images { padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.rp-img-wrap { position: relative; width: 100%; }
.rp-img { width: 100%; border: 1px solid rgba(0,0,0,0.1); display: block; }
.rp-img-del { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border: none; background: rgba(0,0,0,0.5); color: #fff; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.rp-img-del:hover { background: rgba(200,0,0,0.8); }
</style>

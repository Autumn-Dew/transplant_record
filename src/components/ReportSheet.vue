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
      <!-- 汇报外观：点击后从右侧滑出侧边弹窗（版式与「项目详情」窗口一致），
           主题与背景两个选择互相独立，也都与应用主题无关 -->
      <span class="rp-look-btn">
        <button
          class="rc-global-btn"
          title="每日汇报的主题与背景（与当前应用主题无关，可自由组合）"
          @click="stylePanelOpen = true"
        >外观 · {{ reportTheme.label }} / {{ reportBg.label }}</button>
      </span>
      <div class="toolbar-spacer"></div>
      <!-- 当前选中托管项目的备注（显示在控件右侧，过长省略、悬停看全文） -->
      <span class="rp-note" v-if="selectedTask && selectedTask.note" :title="selectedTask.note">
        备注：{{ selectedTask.note }}
      </span>
      <span class="rp-hint">Ctrl+V 粘贴截图</span>
    </div>

    <div class="rp-body">
      <div class="rp-wrap" ref="wrapRef" :class="`rp-theme-${reportTheme.id}`" :style="{ background: reportBg.bg }">
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

    <!-- 汇报外观 · 侧边弹窗
         版式与「项目详情」窗口一致：右侧抽屉 + pd-head + detail-grid。
         不设底部按钮区，内容一屏放下（无滚动条），点遮罩即可关闭。
         主题与背景分两段，各自独立选择；弹窗只改外观，不碰画布布局与内容。 -->
    <div class="modal-mask" v-if="stylePanelOpen" @click.self="stylePanelOpen = false">
      <div class="edit-popup pd-popup rp-look">
        <h4>汇报外观</h4>

        <div class="pd-head">
          <div class="pd-head-main">
            <div class="pd-name">{{ reportTheme.label }}</div>
            <div class="pd-sub">{{ reportTheme.hint }}</div>
          </div>
          <span class="pd-state">背景 · {{ reportBg.label }}</span>
        </div>

        <div class="detail-grid">
          <p class="detail-section">内容主题 · 决定标题行 / 卡片 / 信息栏的样式</p>
          <div class="rp-look-wrap">
            <div v-for="g in REPORT_THEME_GROUPS" :key="g.id" class="rp-look-group">
              <div class="rp-look-group-label">{{ g.label }}</div>
              <div class="rp-look-row">
                <button
                  v-for="t in g.items"
                  :key="t.id"
                  class="rp-theme-card"
                  :class="{ active: reportThemeId === t.id }"
                  :title="`${t.label} · ${t.hint}`"
                  @click="setReportTheme(t.id)"
                >
                  <!-- 缩略图用与画布同一套主题变量渲染，能看出标题 / 信息栏 / 卡片头的实际外观 -->
                  <span class="rp-theme-thumb" :class="`rp-theme-${t.id}`">
                    <span class="rtt-title"></span>
                    <span class="rtt-meta"></span>
                    <span class="rtt-card">
                      <span class="rtt-head"></span>
                      <span class="rtt-body"></span>
                    </span>
                  </span>
                  <span class="rp-opt-name">{{ t.label }}</span>
                  <span class="rp-opt-hint">{{ t.hint }}</span>
                </button>
              </div>
            </div>
          </div>

          <p class="detail-section">画布背景 · 只决定底层，不改内容样式</p>
          <div class="rp-look-wrap">
            <div v-for="g in REPORT_BG_GROUPS" :key="g.id" class="rp-look-group">
              <div class="rp-look-group-label">{{ g.label }}</div>
              <div class="rp-look-row">
                <button
                  v-for="b in g.items"
                  :key="b.id"
                  class="rp-bg-card"
                  :class="{ active: reportBgId === b.id }"
                  :title="`${b.label} · ${b.hint}`"
                  @click="setReportBg(b.id)"
                >
                  <span class="rp-bg-thumb" :style="{ background: b.bg }"></span>
                  <span class="rp-opt-name">{{ b.label }}</span>
                </button>
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
import { fmtDate as toDateStr, addMonth, isYmd } from '@/utils/date'
import { completeTaskById, localToday } from '@/utils/taskComplete'
import { hostProgress, isHosting } from '@/domain/project.js'
import { projectsRepo } from '@/data/repos.js'
import { KEYS, readJSON, writeJSON } from '@/data/storage.js'
import { REPORT_BG_GROUPS, readReportBg, writeReportBg, findReportBg } from '@/data/report-backgrounds.js'
import { REPORT_THEME_GROUPS, readReportTheme, writeReportTheme, findReportTheme } from '@/data/report-themes.js'
import { useConfirmClick } from '@/composables/useConfirmClick.js'

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

// ── 汇报外观：主题（内容皮肤）与背景（画布底层）各自独立持久化，互不改写 ──
const reportBgId = ref(readReportBg())
const reportBg = computed(() => findReportBg(reportBgId.value))
const reportThemeId = ref(readReportTheme())
const reportTheme = computed(() => findReportTheme(reportThemeId.value))
const stylePanelOpen = ref(false)
function setReportBg(id) {
  reportBgId.value = writeReportBg(id)
}
function setReportTheme(id) {
  reportThemeId.value = writeReportTheme(id)
}

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
  // 天数含首尾（08-01 → 08-30 = 30 天），与托管天数口径统一
  totalDays.value = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1
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
  // 仅列出「当前生效」的托管：排除提前续费(locked)与「今日已确认」的项目
  // 统一经 Repository 读取（不再直接读 localStorage）
  const today = localToday()
  return projectsRepo.state.value.filter(r => isHosting(r) && !r.locked && r.lastConfirmDate !== today)
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
      // 剩余天数跟随托管进度（含首尾、暂停顺延），旧 remainingDays 仅作兜底
  const hp = (t.status === 2 || t.hosting) ? hostProgress(t) : null
  const days = hp
    ? Math.max(0, hp.totalDays - hp.dayIndex + 1)
    : ((t.remainingDays != null && t.remainingDays !== '') ? t.remainingDays : '—')
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
// ── 确认完成（同代肝代办：多次点击机制见 composables/useConfirmClick + 逐层音效）──
const confirmCfm = useConfirmClick()
const confirmStage = computed(() => (selectedTaskId.value ? confirmCfm.countOf(selectedTaskId.value) : 0))
const confirmBtnText = computed(() => confirmCfm.titleOf(selectedTaskId.value || 'unselected', '确认完成'))
function getConfirmStyle() { return confirmCfm.styleOf(selectedTaskId.value || 'unselected') }
function handleConfirm() {
  const id = selectedTaskId.value
  if (!id || !selectedTask.value) return
  if (!confirmCfm.trigger(id)) return
  confirmTaskDone()
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
function loadRoll() {
  return readJSON(KEYS.REPORT_ROLL, {}) || {}
}
function saveRoll(s) {
  writeJSON(KEYS.REPORT_ROLL, s)
}

function applyTask() {
  if (!selectedTaskId.value) return
  const t = hostingTasks.value.find(r => String(r.id) === String(selectedTaskId.value))
  if (!t) return
  // 自动切换到该项目对应的游戏页
  const GAME_MAP = { '终末地': 'endfield', '明日方舟': 'ak', '异环': 'nte' }
  const g = GAME_MAP[t.game]
  if (g && g !== reportGame.value) switchGame(g)
  // 日期：同步为托管项目的**真实起止**（含首尾天数）。
  // 托管超过一个月时不再截到一个月的近似值 —— 天数与日期区间都按项目实际情况同步，
  // 第几天由 calcDays 按「今天 − 开始日 + 1」算出。
  const host = t.host || {}
  const startStr = isYmd(host.startDate) ? host.startDate : (t.createdAt ? toDateStr(t.createdAt) : toDateStr(new Date()))
  const endStr = isYmd(host.endDate) ? host.endDate : addMonth(startStr)
  programmaticDate = true
  dateFrom.value = startStr
  dateTo.value = endStr
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
  // 背景由画布自身 CSS 承担；backgroundColor 只作为边缘兜底，取当前背景的底色
  return html2canvas(wrapRef.value, { backgroundColor: reportBg.value.base, scale: 3 })
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

/* ── 汇报外观：工具栏按钮 + 侧边弹窗（版式与项目详情窗口一致） ── */
.rp-look-btn { display: inline-flex; flex-shrink: 0; }
/* 弹窗：高度随内容、不出现滚动条，也不放关闭按钮 —— 点遮罩即可关闭 */
.modal-mask .edit-popup.rp-look {
  height: auto;
  max-height: 100vh;
  overflow: hidden;
  padding-bottom: 16px;
}
/* detail-grid 是两列展布，外观区要整行铺开 */
.rp-look-wrap { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px; }
/* 分组横排：组名在左、卡片在右，省纵向空间（一屏放得下四组主题 + 四组背景） */
.rp-look-group { display: flex; align-items: flex-start; gap: 10px; }
.rp-look-group-label {
  width: 52px; flex-shrink: 0; padding-top: 8px;
  font-size: 10px; font-family: monospace; letter-spacing: 1.2px; opacity: 0.55;
}
.rp-look-row { flex: 1; min-width: 0; display: flex; gap: 8px; flex-wrap: wrap; }
/* 一行三张，单张只占 1/3 宽（「经典」组只有一张时不会拉满整行） */
.rp-look-row > .rp-theme-card,
.rp-look-row > .rp-bg-card { flex: 0 0 calc((100% - 16px) / 3); min-width: 0; }
/* 弹窗里的分区标题收紧一点，保证整屏可见 */
.rp-look .detail-section { padding: 10px 0 3px; }
/* ── 主题卡：缩略图由主题变量渲染，能看出标题带 / 信息栏 / 卡片头的实际外观 ── */
.rp-theme-card {
  display: flex; flex-direction: column; gap: 3px;
  padding: 4px;
  border: 2px solid transparent; background: none; cursor: pointer;
  transition: border-color var(--motion-duration-fast, 120ms) ease;
  text-align: left;
}
.rp-theme-card:hover { border-color: var(--border-color); }
.rp-theme-card.active { border-color: var(--accent); }
.rp-theme-thumb {
  display: flex; flex-direction: column; gap: 2px;
  width: 100%; height: 58px; padding: 3px;
  border: 1px solid var(--border-color);
  background: #ffffff;                 /* 所有汇报主题都是浅色画布 */
  overflow: hidden;
}
.rp-theme-card.active .rp-theme-thumb { box-shadow: 0 0 0 1px var(--accent); }
.rtt-title { height: 10px; background: var(--rt-title-bg); box-shadow: inset 0 -1px 0 var(--rt-head-rule); }
.rtt-meta  { height: 7px; background: var(--rt-meta-bg); border: 1px solid var(--rt-meta-edge); box-shadow: inset 2px 0 0 var(--rt-meta-bar); }
.rtt-card  { flex: 1; min-height: 0; display: flex; flex-direction: column; border: 1px solid var(--rt-card-edge); background: var(--rt-card-bg); }
.rtt-head  { height: 8px; background: var(--rt-head-bg); box-shadow: inset 0 -1px 0 var(--rt-head-rule); }
.rtt-body  { flex: 1; background: var(--rt-inp-bg); }
/* ── 背景卡：缩略图直接用与画布相同的 background 值 ── */
.rp-bg-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 4px;
  border: 2px solid transparent; background: none; cursor: pointer;
  transition: border-color var(--motion-duration-fast, 120ms) ease;
}
.rp-bg-card:hover { border-color: var(--border-color); }
.rp-bg-card.active { border-color: var(--accent); }
.rp-bg-thumb {
  display: block; width: 100%; height: 52px;
  border: 1px solid var(--border-color);
}
.rp-bg-card.active .rp-bg-thumb { box-shadow: 0 0 0 1px var(--accent); }
.rp-opt-name {
  font-size: 10px; font-family: monospace; text-align: left;
  color: var(--text-primary); opacity: 0.85; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.rp-opt-hint {
  font-size: 9px; font-family: monospace; text-align: left;
  color: var(--text-primary); opacity: 0.45; line-height: 1.3;
}
.rp-theme-card.active .rp-opt-name { opacity: 1; font-weight: 700; }
.rp-bg-card .rp-opt-name { text-align: center; }
.rp-bg-card.active .rp-opt-name { opacity: 1; font-weight: 700; }
/* 控件右侧的项目备注 */
.rp-note {
  max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 11px; font-family: monospace; opacity: 0.75;
  padding: 2px 8px; border: 1px solid var(--border-color); flex-shrink: 1;
}
.rp-body { padding: 12px 0; }
/* ── 主题变量：默认值 = 经典简报 ──
   同时挂在画布（.rp-wrap）和主题缩略图（.rp-theme-thumb）上，
   这样缩略图能直接用同一套变量渲染，做到「所见即所得」。
   各 .rp-theme-<id> 只覆盖这些变量，再按需要加不占布局的装饰。 */
.rp-wrap,
.rp-theme-thumb {
  --rt-ink: #0d0d0d;
  --rt-ink-dim: rgba(13, 13, 13, 0.42);
  --rt-title-fg: #0d0d0d;
  --rt-title-bg: transparent;
  --rt-tab-edge: rgba(0, 0, 0, 0.15);
  --rt-tab-fg: #0d0d0d;
  --rt-tab-on-bg: #0d0d0d;
  --rt-tab-on-fg: #ffffff;
  --rt-card-bg: transparent;
  --rt-card-edge: rgba(0, 0, 0, 0.1);
  --rt-head-bg: #f5f5f5;
  --rt-head-fg: #0d0d0d;
  --rt-head-rule: rgba(0, 0, 0, 0.06);
  --rt-meta-bg: #fafafa;
  --rt-meta-fg: #0d0d0d;
  --rt-meta-edge: rgba(0, 0, 0, 0.1);
  --rt-meta-bar: transparent;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #0d0d0d;
  --rt-inp-edge: rgba(0, 0, 0, 0.12);
  --rt-radio: #0d0d0d;
  --rt-radio-checked: #0d0d0d;
  --rt-accent: #0d0d0d;
  --rt-row-rule: transparent;
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(0, 0, 0, 0.1);
  --rt-btn-edge: rgba(0, 0, 0, 0.15);
  --rt-btn-on-bg: #0d0d0d;
  --rt-btn-on-fg: #ffffff;
}
/* 画布：布局完全固定（宽度 / 内边距 / 结构都不随主题变化） */
.rp-wrap {
  max-width: 920px; margin: 0 auto; padding: 24px; background: #fff;
  color: var(--rt-ink);
}
.rp-title { font-size: 18px; font-weight: 800; letter-spacing: 2px; margin-bottom: 14px; outline: none; color: var(--rt-title-fg); }
.rp-title-row { display: flex; align-items: center; margin-bottom: 14px; position: relative; background: var(--rt-title-bg); }
.rp-title-row .rp-title { margin-bottom: 0; flex: 1; }
.rp-game-tabs { display: flex; gap: 0; margin-left: 48px; }
.rp-game-tabs button { font-size: 12px; padding: 4px 14px; border: 1px solid var(--rt-tab-edge); background: none; cursor: pointer; font-family: inherit; margin-left: -1px; color: var(--rt-tab-fg); }
.rp-game-tabs button:first-child { margin-left: 0; }
.rp-game-tabs button.active { background: var(--rt-tab-on-bg); color: var(--rt-tab-on-fg); border-color: var(--rt-tab-on-bg); }
.rp-author-box { display: flex; align-items: center; gap: 0; margin-left: 16px; }
.rp-author-label { font-size: 10px; color: var(--rt-ink-dim); font-family: monospace; margin-right: 6px; }
.rp-author-btn { font-size: 12px; padding: 4px 14px; border: 1px solid var(--rt-tab-edge); background: none; cursor: pointer; font-family: inherit; margin-left: -1px; color: var(--rt-tab-fg); }
.rp-author-btn:first-child { margin-left: 0; }
.rp-author-btn:hover { background: var(--rt-tab-on-bg); color: var(--rt-tab-on-fg); }
.rp-author-btn.active { background: var(--rt-tab-on-bg); color: var(--rt-tab-on-fg); border-color: var(--rt-tab-on-bg); }
.rp-card { border: 1px solid var(--rt-card-edge); background: var(--rt-card-bg); margin-bottom: 10px; }
.rp-cards-row { display: flex; gap: 10px; margin-bottom: 10px; }
.rp-cards-row .rp-card { margin-bottom: 0; }
.rp-half { flex: 1; min-width: 0; }
.rp-card-head { padding: 8px 14px; background: var(--rt-head-bg); color: var(--rt-head-fg); border-bottom: 1px solid var(--rt-head-rule); font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.rp-reset-sm { font-size: 10px; padding: 1px 8px; border: 1px solid var(--rt-btn-edge); background: none; cursor: pointer; font-family: monospace; font-weight: 400; margin-left: auto; color: var(--rt-head-fg); }
.rp-reset-sm:hover { background: var(--rt-btn-on-bg); color: var(--rt-btn-on-fg); }
.rp-card-body { padding: 0; }
.rp-meta { font-size: 13px; padding: 10px 14px; border: 1px solid var(--rt-meta-edge); margin-bottom: 12px; background: var(--rt-meta-bg); color: var(--rt-meta-fg); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; box-shadow: inset 5px 0 0 var(--rt-meta-bar); }
.rp-inp { border: 1px solid var(--rt-inp-edge); padding: 3px 6px; font-size: 12px; font-family: inherit; background: var(--rt-inp-bg); line-height: 1.2; vertical-align: baseline; color: var(--rt-inp-fg); }
.rp-inp:focus { border-color: var(--rt-accent); outline: none; }
.rp-date-sm { width: 115px; }
.rp-num { width: 52px; text-align: center; }
.rp-extra { flex: 1; min-width: 0; }
.rp-res-inp { width: 100px; }
.rp-label-inp { width: 90px; }
.rp-arrow { opacity: 0.25; padding: 0 2px; }
.rp-task-row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 7px 14px; background: var(--rt-row-alt); box-shadow: inset 0 -1px 0 var(--rt-row-rule); }
.rp-task-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; align-items: center; }
.rp-task-grid .rp-inp { width: auto; }
.rp-task-label { flex: 1; min-width: 0; line-height: 1.5; }
.rp-radio { font-size: 11px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; opacity: 0.5; vertical-align: middle; flex: 1; }
.rp-radio input { display: none; }
.rp-radio-box { width: 12px; height: 12px; border: 2px solid var(--rt-radio); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; align-self: center; }
.rp-radio input:checked + .rp-radio-box { background: var(--rt-inp-bg); border-color: var(--rt-radio); }
.rp-radio input:checked + .rp-radio-box::after { content: ''; width: 6px; height: 6px; background: var(--rt-radio); }
.rp-radio:has(input:checked) { opacity: 1; font-weight: 600; color: var(--rt-radio-checked); }
.rp-quick-bar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--rt-row-rule); }
.rp-quick-label { font-size: 10px; color: var(--rt-ink-dim); font-family: monospace; margin-right: 2px; }
.rp-quick-group-label { display: block; width: 100%; margin-top: 4px; }
.rp-quick-btn { font-size: 11px; padding: 2px 8px; border: 1px solid var(--rt-btn-edge); cursor: pointer; font-family: monospace; margin: 1px 2px; color: var(--rt-ink); background: none; }
.rp-quick-btn:hover { background: var(--rt-btn-on-bg); color: var(--rt-btn-on-fg); }
.rp-lines { outline: none; font-size: 13px; line-height: 1.8; min-height: 24px; padding: 10px 14px; }
.rp-add-row { font-size: 11px; padding: 3px 8px; margin: 6px 14px; border: 1px dashed var(--rt-btn-edge); background: none; cursor: pointer; font-family: monospace; width: calc(100% - 28px); color: var(--rt-ink); }
.rp-add-row:hover { border-color: var(--rt-accent); background: var(--rt-row-alt); }
.rp-row-del { font-size: 14px; padding: 0 6px; border: 1px solid var(--rt-btn-edge); background: none; cursor: pointer; opacity: 0.4; font-family: monospace; line-height: 1; color: var(--rt-ink); }
.rp-row-del:hover { opacity: 1; background: #d00; color: #fff; border-color: #d00; }
.rp-images { padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.rp-img-wrap { position: relative; width: 100%; }
.rp-img { width: 100%; border: 1px solid var(--rt-img-edge); display: block; }
.rp-img-del { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border: none; background: rgba(0,0,0,0.5); color: #fff; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.rp-img-del:hover { background: rgba(200,0,0,0.8); }

/* ══════════════════════════════════════════════════════════════════
   汇报主题（内容皮肤）· 与背景彻底解耦

   画布类名 rp-theme-<id> 只决定「已有元素」的视觉表现：
     标题行 / 托管信息栏 / 卡片标题 / 任务行 / 单选 / 输入框 / 图片边框。
   画布底层（底色与图案）由背景配置单独负责、单独持久化 ——
   所以任意主题 × 任意背景都成立，换一个不会改动另一个。

   硬约束：不改布局。
     本段只用 color / background / border-color / box-shadow / 字重 /
     小字距 / 绝对定位伪元素，没有 padding / margin / 宽高 / font-size /
     display / flex / grid；不会换行、不会溢出、导出尺寸不变。
   导出走 html2canvas：只用渐变与边框，不用 clip-path / filter。
   ══════════════════════════════════════════════════════════════════ */

/* ── A. 经典简报：.rp-wrap 上的变量默认值就是这套外观，这里只做显式声明 ── */
.rp-theme-classic { color: var(--rt-ink); }

/* ── B1. 孤星 · 科研档案 ─────────────────────────────────────────────
   暖白纸面 + 深蓝档头铭牌 + 工业橙装订 —— 一份可查阅的正式任务档案。 */
.rp-theme-ls-archive {
  position: relative;
  color: #141b22;
  --rt-ink: #141b22;
  --rt-ink-dim: rgba(20, 27, 34, 0.5);
  --rt-title-fg: #101923;
  --rt-tab-edge: rgba(20, 27, 34, 0.32);
  --rt-tab-fg: #141b22;
  --rt-tab-on-bg: #101923;
  --rt-tab-on-fg: #e8e2d3;
  --rt-card-bg: rgba(255, 255, 255, 0.7);
  --rt-card-edge: rgba(20, 27, 34, 0.4);
  --rt-head-bg: #101923;
  --rt-head-fg: #e8e2d3;
  --rt-head-rule: #d87938;
  --rt-meta-bg: #101923;
  --rt-meta-fg: #e8e2d3;
  --rt-meta-edge: #101923;
  --rt-meta-bar: #d87938;
  --rt-inp-bg: #f6f1e7;
  --rt-inp-fg: #141b22;
  --rt-inp-edge: rgba(20, 27, 34, 0.22);
  --rt-radio: #101923;
  --rt-radio-checked: #101923;
  --rt-accent: #d87938;
  --rt-row-rule: rgba(20, 27, 34, 0.1);
  --rt-img-edge: rgba(20, 27, 34, 0.4);
  --rt-btn-edge: rgba(20, 27, 34, 0.3);
  --rt-btn-on-bg: #101923;
  --rt-btn-on-fg: #e8e2d3;
}
/* 装订脊：绝对定位在画布内边距里（24px），不占布局、不压文字。
   限定 .rp-wrap，避免主题缩略图也长出这条脊。 */
.rp-wrap.rp-theme-ls-archive::before {
  content: '';
  position: absolute;
  left: 13px; top: 20px; bottom: 20px;
  width: 5px;
  background: linear-gradient(180deg,
    #d87938 0 118px,
    rgba(20, 27, 34, 0.18) 118px 100%);
  pointer-events: none;
}
/* 档头：标题行下一条深墨线（inset shadow，不增加高度） */
.rp-theme-ls-archive .rp-title-row { box-shadow: inset 0 -2px 0 #101923; }
/* 档案编号：绝对定位在标题行上方，不占布局 */
.rp-theme-ls-archive .rp-title-row::before {
  content: 'FILE TR-DAILY / OPERATION REPORT';
  position: absolute;
  left: 0; top: -10px;
  font-family: monospace;
  font-size: 8px;
  line-height: 1;
  letter-spacing: 2.4px;
  color: #71818a;
  pointer-events: none;
}
.rp-theme-ls-archive .rp-title { letter-spacing: 1.2px; }
.rp-theme-ls-archive .rp-meta { font-family: monospace; letter-spacing: 0.6px; }
.rp-theme-ls-archive .rp-meta .rp-inp { font-weight: 700; }
.rp-theme-ls-archive .rp-card-head { letter-spacing: 2.2px; }
.rp-theme-ls-archive .rp-card-head .rp-reset-sm { border-color: rgba(232, 226, 211, 0.45); }
.rp-theme-ls-archive .rp-task-label { font-weight: 600; letter-spacing: 0.3px; }

/* ── B2. 孤星 · 航天制图 ─────────────────────────────────────────────
   冷白图纸 + 工程线 + 坐标标记 —— 比科研档案更轻、更冷、更像制图稿。
   刻意不使用厚重实色大标题块。 */
.rp-theme-ls-drafting {
  position: relative;
  color: #16222c;
  --rt-ink: #16222c;
  --rt-ink-dim: rgba(22, 34, 44, 0.45);
  --rt-title-fg: #16222c;
  --rt-tab-edge: rgba(22, 34, 44, 0.28);
  --rt-tab-fg: #16222c;
  --rt-tab-on-bg: #2b6cb0;
  --rt-tab-on-fg: #ffffff;
  --rt-card-bg: rgba(255, 255, 255, 0.86);
  --rt-card-edge: rgba(22, 34, 44, 0.26);
  --rt-head-bg: #eef3f8;
  --rt-head-fg: #16222c;
  --rt-head-rule: rgba(22, 34, 44, 0.22);
  --rt-meta-bg: #f5f9fc;
  --rt-meta-fg: #16222c;
  --rt-meta-edge: rgba(22, 34, 44, 0.26);
  --rt-meta-bar: #2b6cb0;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #16222c;
  --rt-inp-edge: rgba(22, 34, 44, 0.2);
  --rt-radio: #2b6cb0;
  --rt-radio-checked: #1b4f86;
  --rt-accent: #2b6cb0;
  --rt-row-rule: rgba(22, 34, 44, 0.08);
  --rt-img-edge: rgba(22, 34, 44, 0.28);
  --rt-btn-edge: rgba(22, 34, 44, 0.26);
  --rt-btn-on-bg: #2b6cb0;
  --rt-btn-on-fg: #ffffff;
}
/* 标题行：一条主线 + 一条偏移的淡蓝基准线（inset，不改高度） */
.rp-theme-ls-drafting .rp-title-row {
  box-shadow: inset 0 -1px 0 rgba(22, 34, 44, 0.42),
              inset 0 -4px 0 rgba(43, 108, 176, 0.14);
}
/* 制图编号：绝对定位在标题行上方 */
.rp-theme-ls-drafting .rp-title-row::before {
  content: 'DWG · TR-DAILY / REV.A';
  position: absolute;
  left: 0; top: -10px;
  font-family: monospace;
  font-size: 8px;
  line-height: 1;
  letter-spacing: 2.2px;
  color: #71818a;
  pointer-events: none;
}
.rp-theme-ls-drafting .rp-title { letter-spacing: 1.6px; }
/* 卡片：右上角坐标标记（绝对定位在卡片边框内侧，不占布局） */
.rp-theme-ls-drafting .rp-card { position: relative; }
.rp-theme-ls-drafting .rp-card::after {
  content: '';
  position: absolute;
  right: 5px; top: 5px;
  width: 9px; height: 9px;
  border-top: 1px solid rgba(43, 108, 176, 0.5);
  border-right: 1px solid rgba(43, 108, 176, 0.5);
  pointer-events: none;
}
.rp-theme-ls-drafting .rp-card-head { letter-spacing: 1.6px; }
.rp-theme-ls-drafting .rp-meta { letter-spacing: 0.5px; }
.rp-theme-ls-drafting .rp-task-label { letter-spacing: 0.2px; }

/* ── B3. 孤星 · 工业仪器 ─────────────────────────────────────────────
   浅灰白 + 实体面板 + 粗细分明的边缘 —— 更像一台设备的面板与状态区。 */
.rp-theme-ls-gauge {
  color: #101820;
  --rt-ink: #101820;
  --rt-ink-dim: rgba(16, 24, 32, 0.5);
  --rt-title-fg: #0c141a;
  --rt-tab-edge: rgba(16, 24, 32, 0.3);
  --rt-tab-fg: #101820;
  --rt-tab-on-bg: #18222c;
  --rt-tab-on-fg: #f2f4f2;
  --rt-card-bg: #fdfdfc;
  --rt-card-edge: rgba(16, 24, 32, 0.5);
  --rt-head-bg: #18222c;
  --rt-head-fg: #f2f4f2;
  --rt-head-rule: #d87938;
  --rt-meta-bg: #18222c;
  --rt-meta-fg: #f2f4f2;
  --rt-meta-edge: #18222c;
  --rt-meta-bar: #d87938;
  --rt-inp-bg: #f7f8f7;
  --rt-inp-fg: #101820;
  --rt-inp-edge: rgba(16, 24, 32, 0.3);
  --rt-radio: #101820;
  --rt-radio-checked: #101820;
  --rt-accent: #d87938;
  --rt-row-rule: rgba(16, 24, 32, 0.16);
  --rt-row-alt: rgba(16, 24, 32, 0.035);
  --rt-img-edge: rgba(16, 24, 32, 0.45);
  --rt-btn-edge: rgba(16, 24, 32, 0.3);
  --rt-btn-on-bg: #18222c;
  --rt-btn-on-fg: #f2f4f2;
}
/* 标题行：底部一条粗橙线，像面板的状态条 */
.rp-theme-ls-gauge .rp-title-row { box-shadow: inset 0 -3px 0 #d87938; }
.rp-theme-ls-gauge .rp-title { letter-spacing: 1px; }
/* 卡片标题：左侧状态块（在 14px 内边距里，不压字）+ 底部橙线 */
.rp-theme-ls-gauge .rp-card-head {
  box-shadow: inset 4px 0 0 #d87938,
              inset 0 -3px 0 #d87938;
}
.rp-theme-ls-gauge .rp-card-head .rp-reset-sm { border-color: rgba(242, 244, 242, 0.45); }
/* 信息栏：右端状态块 */
.rp-theme-ls-gauge .rp-meta { box-shadow: inset 5px 0 0 var(--rt-meta-bar), inset -5px 0 0 rgba(216, 121, 56, 0.55); }
.rp-theme-ls-gauge .rp-meta .rp-inp { font-weight: 800; font-variant-numeric: tabular-nums; }
.rp-theme-ls-gauge .rp-task-label { font-weight: 600; }

/* ── C1. P3R · 斜切海报 ─────────────────────────────────────────────
   整宽斜切色带 + 明黄收口 + 高对比 —— 最直接的平面海报冲击。
   明黄只做收口与选中，不铺成大面积底色。 */
.rp-theme-p3r-poster {
  color: #0a1f42;
  --rt-ink: #0a1f42;
  --rt-ink-dim: rgba(10, 31, 66, 0.5);
  --rt-title-bg: linear-gradient(102deg,
    #071b3a 0 66%,
    #1264c8 66% 88%,
    #28b8f2 88% 100%);
  --rt-title-fg: #f4f6fa;
  --rt-tab-edge: rgba(244, 246, 250, 0.45);
  --rt-tab-fg: #f4f6fa;
  --rt-tab-on-bg: #f5d83d;
  --rt-tab-on-fg: #071b3a;
  --rt-card-bg: rgba(255, 255, 255, 0.92);
  --rt-card-edge: transparent;
  --rt-head-bg: #1264c8;
  --rt-head-fg: #ffffff;
  --rt-head-rule: #f5d83d;
  --rt-meta-bg: #071b3a;
  --rt-meta-fg: #f4f6fa;
  --rt-meta-edge: #071b3a;
  --rt-meta-bar: #f5d83d;
  --rt-inp-bg: #f4f6fa;
  --rt-inp-fg: #071b3a;
  --rt-inp-edge: #28b8f2;
  --rt-radio: #1264c8;
  --rt-radio-checked: #1264c8;
  --rt-accent: #f5d83d;
  --rt-row-rule: rgba(10, 31, 66, 0.1);
  --rt-row-alt: rgba(40, 184, 242, 0.07);
  --rt-img-edge: rgba(18, 100, 200, 0.4);
  --rt-btn-edge: rgba(10, 31, 66, 0.22);
  --rt-btn-on-bg: #071b3a;
  --rt-btn-on-fg: #f4f6fa;
}
/* 明黄收口线（inset，不增加高度） */
.rp-theme-p3r-poster .rp-title-row { box-shadow: inset 0 -5px 0 #f5d83d; }
.rp-theme-p3r-poster .rp-title { font-weight: 900; letter-spacing: -0.4px; }
/* 深色标题带上的「汇报人」标签要用浅色，否则读不出来 */
.rp-theme-p3r-poster .rp-title-row .rp-author-label { color: rgba(244, 246, 250, 0.66); }
.rp-theme-p3r-poster .rp-meta { letter-spacing: 0.4px; }
.rp-theme-p3r-poster .rp-meta .rp-inp { font-weight: 900; font-variant-numeric: tabular-nums; }
/* 卡片：白承载面 + 1px 轮廓代替边框 + 蓝色标题块与明黄底边 */
.rp-theme-p3r-poster .rp-card { box-shadow: 0 0 0 1px rgba(10, 31, 66, 0.12); }
.rp-theme-p3r-poster .rp-card-head {
  font-weight: 900;
  letter-spacing: 1.4px;
  box-shadow: inset 0 -4px 0 #f5d83d;
}
.rp-theme-p3r-poster .rp-card-head .rp-reset-sm { border-color: rgba(255, 255, 255, 0.5); }
.rp-theme-p3r-poster .rp-task-label { font-weight: 700; }

/* ── C2. P3R · 月相编辑 ─────────────────────────────────────────────
   冷白留白 + 月相轨迹 + 细线 —— 克制、精致的编辑设计，
   与斜切海报的区别是「没有大面积实色块」，而不是「少一点黄色」。 */
.rp-theme-p3r-lunar {
  position: relative;
  color: #10233f;
  --rt-ink: #10233f;
  --rt-ink-dim: rgba(16, 35, 63, 0.45);
  --rt-title-fg: #0a1f42;
  --rt-tab-edge: rgba(16, 35, 63, 0.22);
  --rt-tab-fg: #10233f;
  --rt-tab-on-bg: #0a1f42;
  --rt-tab-on-fg: #ffffff;
  --rt-card-bg: rgba(255, 255, 255, 0.94);
  --rt-card-edge: rgba(16, 35, 63, 0.16);
  --rt-head-bg: #f1f7fd;
  --rt-head-fg: #10233f;
  --rt-head-rule: rgba(40, 184, 242, 0.55);
  --rt-meta-bg: #eff6fd;
  --rt-meta-fg: #10233f;
  --rt-meta-edge: rgba(16, 35, 63, 0.16);
  --rt-meta-bar: #28b8f2;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #10233f;
  --rt-inp-edge: rgba(16, 35, 63, 0.18);
  --rt-radio: #1264c8;
  --rt-radio-checked: #1264c8;
  --rt-accent: #28b8f2;
  --rt-row-rule: rgba(16, 35, 63, 0.07);
  --rt-img-edge: rgba(16, 35, 63, 0.2);
  --rt-btn-edge: rgba(16, 35, 63, 0.2);
  --rt-btn-on-bg: #0a1f42;
  --rt-btn-on-fg: #ffffff;
}
/* 标题行：一条青色细线；月相藏在标题行上方，做减法而不是铺色块 */
.rp-theme-p3r-lunar .rp-title-row { box-shadow: inset 0 -1px 0 rgba(40, 184, 242, 0.7); }
.rp-theme-p3r-lunar .rp-title { letter-spacing: 1.4px; }
.rp-theme-p3r-lunar .rp-title-row::after {
  content: '';
  position: absolute;
  right: 0; top: -12px;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle at 70% 50%,
    transparent 0 42%,
    rgba(40, 184, 242, 0.75) 43% 100%);
  pointer-events: none;
}
/* 卡片：左侧青色细条（在 14px 内边距里，不压字）+ 极轻轮廓 */
.rp-theme-p3r-lunar .rp-card { box-shadow: 0 0 0 1px rgba(16, 35, 63, 0.06); }
.rp-theme-p3r-lunar .rp-card-head { box-shadow: inset 3px 0 0 #28b8f2; letter-spacing: 1.2px; }
.rp-theme-p3r-lunar .rp-meta { letter-spacing: 0.4px; }
.rp-theme-p3r-lunar .rp-task-label { font-weight: 500; }

/* ── C3. P3R · 都市拼贴 ─────────────────────────────────────────────
   错位矩形 + 模块拼贴 + 局部反色 —— 用直线分区做都市平面设计，
   刻意不用圆形轨迹，也避免和斜切海报一样整条蓝色标题块。 */
.rp-theme-p3r-tiles {
  color: #0a1f42;
  --rt-ink: #0a1f42;
  --rt-ink-dim: rgba(10, 31, 66, 0.5);
  --rt-title-bg: linear-gradient(90deg,
    #071b3a 0 62%,
    #1264c8 62% 100%);
  --rt-title-fg: #f4f6fa;
  --rt-tab-edge: rgba(244, 246, 250, 0.45);
  --rt-tab-fg: #f4f6fa;
  --rt-tab-on-bg: #f5d83d;
  --rt-tab-on-fg: #071b3a;
  --rt-card-bg: #ffffff;
  --rt-card-edge: rgba(10, 31, 66, 0.16);
  --rt-head-bg: #0a1f42;
  --rt-head-fg: #f4f6fa;
  --rt-head-rule: #28b8f2;
  --rt-meta-bg: #1264c8;
  --rt-meta-fg: #f4f6fa;
  --rt-meta-edge: transparent;
  --rt-meta-bar: #f5d83d;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #0a1f42;
  --rt-inp-edge: #28b8f2;
  --rt-radio: #1264c8;
  --rt-radio-checked: #1264c8;
  --rt-accent: #1264c8;
  --rt-row-rule: rgba(10, 31, 66, 0.12);
  --rt-row-alt: rgba(40, 184, 242, 0.06);
  --rt-img-edge: rgba(10, 31, 66, 0.3);
  --rt-btn-edge: rgba(10, 31, 66, 0.22);
  --rt-btn-on-bg: #0a1f42;
  --rt-btn-on-fg: #f4f6fa;
}
/* 标题行：底部青线收口；深色带上的「汇报人」转浅色 */
.rp-theme-p3r-tiles .rp-title-row { box-shadow: inset 0 -3px 0 #28b8f2; }
.rp-theme-p3r-tiles .rp-title { font-weight: 900; letter-spacing: 0.6px; }
.rp-theme-p3r-tiles .rp-title-row .rp-author-label { color: rgba(244, 246, 250, 0.66); }
.rp-theme-p3r-tiles .rp-meta .rp-inp { font-weight: 800; }
/* 卡片：右上角明黄角块 + 左侧青条，像拼贴上去的一块标记 */
.rp-theme-p3r-tiles .rp-card { position: relative; }
.rp-theme-p3r-tiles .rp-card::after {
  content: '';
  position: absolute;
  right: 0; top: 0;
  width: 14px; height: 14px;
  background: #f5d83d;
  pointer-events: none;
}
.rp-theme-p3r-tiles .rp-card-head {
  box-shadow: inset 3px 0 0 #28b8f2;
  letter-spacing: 1.6px;
}
.rp-theme-p3r-tiles .rp-card-head .rp-reset-sm { border-color: rgba(244, 246, 250, 0.45); }
.rp-theme-p3r-tiles .rp-task-label { font-weight: 600; }

</style>

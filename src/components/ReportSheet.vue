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
        <div class="rp-card rp-res-card">
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
                <button class="rp-row-del rp-no-export" @click="resources.splice(i, 1)" title="删除这一项（可以删到一项都不剩，导出时整块隐藏）">×</button>
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
          <p class="rp-look-tip">「浅」= 深色字配浅底；「暗」= 浅墨字，建议配深色画布背景。</p>
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
                  <span class="rp-opt-row">
                    <span class="rp-opt-name">{{ t.label }}</span>
                    <span class="rp-opt-tone" :class="`tone-${t.tone}`" :title="t.tone === 'dark' ? '暗色主题：浅墨文字，建议配深色背景' : '浅色主题：深色字配浅底'">{{ t.tone === 'dark' ? '暗' : '浅' }}</span>
                  </span>
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
                  <span class="rp-opt-row">
                    <span class="rp-opt-name">{{ b.label }}</span>
                    <span class="rp-opt-tone" :class="`tone-${bgTone(b)}`" :title="bgTone(b) === 'dark' ? '深色画布：配「暗」主题不会出现浅墨字压在浅底上' : '浅色画布'">{{ bgTone(b) === 'dark' ? '深' : '浅' }}</span>
                  </span>
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
import { hostProgress, isHosting, isClosed } from '@/domain/project.js'
import { projectsRepo } from '@/data/repos.js'
import { KEYS, readJSON, writeJSON } from '@/data/storage.js'
import { REPORT_BG_GROUPS, readReportBg, writeReportBg, findReportBg, bgTone } from '@/data/report-backgrounds.js'
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
// 托管项目列表直接跟着仓库走（computed，而不是 setup 时的一次性快照）：
// 在「代肝代办」删掉的项目必须立刻从这里消失，否则会留下一条谁都删不掉的幽灵托管。
// todayRef 只负责「跨天」这件事：切回本页时刷新一次，昨天已确认的项目今天会重新出现。
const todayRef = ref(localToday())
const hostingTasks = computed(() => loadHostingTasks(todayRef.value))
const selectedTaskId = ref('')
function loadHostingTasks(today = localToday()) {
  // 只列「当前生效、且能操作」的托管：与「代肝代办」口径一致 ——
  // 已结束（status 0）/ 已归档 / 已取消 / 提前续费(locked) / 今日已确认 的一律不出现，
  // 否则日报下拉里会留下一条在代办页根本看不到、也点不动的记录。
  return projectsRepo.state.value.filter(r => (
    isHosting(r) &&
    r.status !== 0 &&
    !isClosed(r) &&
    !r.locked &&
    r.lastConfirmDate !== today
  ))
}
// 游戏映射：库里的 game 既可能存名字（终末地），也可能存 id（endfield）——
// 两种都要认，否则真实数据里「选中项目后游戏页不切换 → 任务与资源不跟着变」。
const GAME_NAME_TO_KEY = { '终末地': 'endfield', '明日方舟': 'ak', '异环': 'nte' }
const GAME_KEY_TO_NAME = { endfield: '终末地', ak: '明日方舟', nte: '异环' }
const GAME_ORDER = ['endfield', 'ak', 'nte']
function gameKeyOfRecord(t) {
  const g = String((t && t.game) || '').trim()
  if (GAME_NAME_TO_KEY[g]) return GAME_NAME_TO_KEY[g]
  if (GAME_KEY_TO_NAME[g]) return g
  return 'endfield'
}
function gameNameOfRecord(t) {
  return GAME_KEY_TO_NAME[gameKeyOfRecord(t)] || String((t && t.game) || '终末地')
}

const hostingOptions = computed(() => {
  const rank = (t) => { const i = GAME_ORDER.indexOf(gameKeyOfRecord(t)); return i < 0 ? 999 : i }
  return [...hostingTasks.value]
    .sort((a, b) => rank(a) - rank(b))
    .map(t => {
      const name = getDisplayName(t) || maskAccount(t.account) || '未命名'
      const acct = maskAccount(t.account) || '—'
      const game = gameNameOfRecord(t)
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

// 选中的托管被删除（或不再生效）时清空选择：
// 否则工具栏会停在一条已经不存在的项目上，按钮怎么点都没反应。
watch(hostingOptions, (opts) => {
  if (!selectedTaskId.value) return
  if (opts.some(o => String(o.value) === String(selectedTaskId.value))) return
  selectedTaskId.value = ''
  emit('update:label', '')
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
  // 自动切换到该项目对应的游戏页（game 可能存 id 也可能存名字，统一成 key 再比）
  const g = gameKeyOfRecord(t)
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
  // 资源：按**该项目所属游戏**重建资源项，并回填该项目上次记录的「变更后」数值。
  // 不做这一步的话：同游戏换项目时 reportGame 没变化 → watch 不触发 → 资源还停在上一个项目。
  const roll = loadRoll()[selectedTaskId.value] || {}
  resetResourcesForGame(g, roll)
  nextTick(() => {
    programmaticDate = false
    // switchGame 会触发 watch(reportGame) 在本轮 flush 里重建一次资源项，
    // 这里按同一份 roll 再建一次，保证「选中项目 → 资源数据填入」不会被覆盖掉。
    resetResourcesForGame(g, roll)
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

// ── 今日获取资源：默认项按游戏重建，并回填该项目上次记录的「变更后」 ──
function defaultResourceLabels(game) {
  if (game === 'endfield') return ['嵌晶玉', '武库配额']
  if (game === 'nte') return ['方斯', '环石']
  return ['龙门币', '合成玉']
}
function resetResourcesForGame(game, roll = {}) {
  resources.splice(0, resources.length)
  defaultResourceLabels(game).forEach(label => {
    resources.push({ label, before: roll[label] !== undefined ? roll[label] : '', after: '', note: '' })
  })
  // 上次用过的自定义资源也补回来（换项目 / 换游戏后自己加的那几行不该消失）
  Object.keys(roll || {}).forEach(label => {
    if (!label) return
    if (resources.some(r => r.label === label)) return
    resources.push({ label, before: roll[label] !== undefined ? roll[label] : '', after: '', note: '' })
  })
}

// 切换游戏页时按该游戏重建资源项；若当前已选中项目，顺带回填它上次记的数值
watch(reportGame, (game) => {
  const roll = selectedTaskId.value ? (loadRoll()[selectedTaskId.value] || {}) : {}
  resetResourcesForGame(game, roll)
})

// ── 资源数值即时记忆（300ms 防抖）──
// 以前只有「导出图片 / 复制到剪贴板」成功后才写 tr-report-roll：
// 用「分享」导出、或者忘了导出，下次选中同一项目就没有数据可回填。
// 现在填完就记，「变更后」优先、没有变更后就记住「变更前」，选中项目即可自动带出。
let rollTimer = null
watch(resources, () => {
  if (!selectedTaskId.value) return
  if (rollTimer) clearTimeout(rollTimer)
  rollTimer = setTimeout(() => {
    rollTimer = null
    const id = selectedTaskId.value
    if (!id) return
    const roll = loadRoll()
    const entry = roll[id] || {}
    resources.forEach(r => {
      const v = (r.after !== '' && r.after != null) ? r.after : r.before
      if (r.label && v !== '' && v != null) entry[r.label] = v
    })
    roll[id] = entry
    saveRoll(roll)
  }, 300)
}, { deep: true })

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

// 导出时原生控件会被替换成 span —— html2canvas 不会按浏览器的方式绘制控件文字。
// ⚠ 替代元素必须沿用原控件的**计算样式**（文字色 / 底色 / 边框色 / 字体）。
//   如果写死「白底 + 继承父级颜色」，深色信息栏主题（科研档案 / 工业仪器 /
//   斜切海报 / 都市拼贴）里输入框本是「浅底深字」，导出后会变成白底 + 父级的
//   浅色文字，托管天数 / 日期几乎与底色同色，导出图里读不出来。
function fieldStyle(el, extra) {
  const cs = getComputedStyle(el)
  const bg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
    ? cs.backgroundColor
    : 'transparent'
  return [
    'display:inline-block',
    'vertical-align:middle',
    `font-family:${cs.fontFamily}`,
    `font-size:${cs.fontSize}`,
    `font-weight:${cs.fontWeight}`,
    `font-style:${cs.fontStyle}`,
    'line-height:1.4',
    `color:${cs.color}`,
    `background:${bg}`,
    `border:1px solid ${cs.borderTopColor}`,
    'padding:2px 6px',
  ].join(';') + ';' + extra
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
  // 「今日获取资源」一项都不剩时，整块（连标题）不导出
  if (!resources.length) {
    const card = wrapRef.value.querySelector('.rp-res-card')
    if (card) { card.style.display = 'none'; swaps.push({ parent: card.parentNode, old: card, current: card, wasHidden: true }) }
  }
  wrapRef.value.querySelectorAll('select').forEach(sel => {
    const span = document.createElement('span')
    span.textContent = sel.options[sel.selectedIndex]?.text || ''
    span.style.cssText = fieldStyle(sel, '')
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
    span.style.cssText = fieldStyle(inp, extra)
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
  let ok = false
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
    ok = true
  } catch (e) { console.error(e) } finally {
    undo()
    // 分享导出也要落一次资源记录（以前只有「导出图片 / 复制到剪贴板」会写）
    if (ok) commitRoll()
  }
}

// 托管项目列表是 computed，删掉项目后这里会自动更新；refreshHosting 只刷新「今天」，
// 让跨天后昨天已确认的项目重新回到列表里（ReportPage 切回本页时会调用）。
function refreshHosting() { todayRef.value = localToday() }
defineExpose({ refreshHosting })
</script>

<style scoped>
.rp-sheet { display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden; background: var(--bg-primary); color: var(--text-primary); }
.rp-sheet .rp-body { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: none; }
.rp-sheet .rp-body::-webkit-scrollbar { display: none; }
.rp-hint { font-size: 11px; opacity: 0.4; font-family: var(--font-mono); }

/* ── 汇报外观：工具栏按钮 + 侧边弹窗（版式与项目详情窗口一致） ── */
.rp-look-btn { display: inline-flex; flex-shrink: 0; }
/* 弹窗：高度随内容，内容超出时可滑动，但不显示滚动条 —— 点遮罩即可关闭 */
.modal-mask .edit-popup.rp-look {
  height: auto;
  max-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  /* 滚动条一律隐藏（Chromium 那条 !important 来自 page-common 的通用弹窗规则） */
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 16px;
}
.modal-mask .edit-popup.rp-look::-webkit-scrollbar { display: none !important; width: 0 !important; }
/* detail-grid 是两列展布，外观区要整行铺开 */
.rp-look-wrap { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 0; }
/* 分组横排：组名在左、卡片在右；组与组之间一条细线，读起来是「分组清单」 */
.rp-look-group {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 2px 0 4px;
  border-bottom: 1px solid var(--rule-soft, rgba(0, 0, 0, 0.12));
}
.rp-look-group:last-child { border-bottom: none; padding-bottom: 0; }
.rp-look-group-label {
  width: 44px; flex-shrink: 0; padding-top: 6px;
  font-size: 10px; font-family: var(--font-mono); letter-spacing: 1.2px; opacity: 0.55;
}
.rp-look-row { flex: 1; min-width: 0; display: flex; gap: 6px; flex-wrap: wrap; }
/* 一行四张：十二套主题 / 十三套背景都能在两屏内看完（说明文字在 title 提示里） */
.rp-look-row > .rp-theme-card,
.rp-look-row > .rp-bg-card { flex: 0 0 calc((100% - 18px) / 4); min-width: 0; }
/* 弹窗里的分区标题收紧一点，保证整屏可见 */
.rp-look .detail-section { padding: 8px 0 3px; }
/* ── 主题卡：缩略图由主题变量渲染，能看出标题带 / 信息栏 / 卡片头的实际外观 ── */
.rp-theme-card {
  display: flex; flex-direction: column; gap: 2px;
  padding: 3px;
  border: 2px solid transparent; background: none; cursor: pointer;
  transition: border-color var(--motion-duration-fast, 120ms) ease;
  text-align: left;
}
.rp-theme-card:hover { border-color: var(--border-color); }
.rp-theme-card.active { border-color: var(--accent); }
.rp-theme-thumb {
  display: flex; flex-direction: column; gap: 2px;
  width: 100%; height: 42px; padding: 3px;
  border: 1px solid var(--border-color);
  /* 缩略图的底色跟随主题的明暗倾向（暗色主题是深底，一眼就能分辨） */
  background: var(--rt-canvas, #ffffff);
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
  display: flex; flex-direction: column; gap: 2px;
  padding: 3px;
  border: 2px solid transparent; background: none; cursor: pointer;
  transition: border-color var(--motion-duration-fast, 120ms) ease;
}
.rp-bg-card:hover { border-color: var(--border-color); }
.rp-bg-card.active { border-color: var(--accent); }
.rp-bg-thumb {
  display: block; width: 100%; height: 34px;
  border: 1px solid var(--border-color);
}
.rp-bg-card.active .rp-bg-thumb { box-shadow: 0 0 0 1px var(--accent); }
.rp-opt-name {
  font-size: 10px; font-family: var(--font-mono); text-align: left;
  color: var(--text-primary); opacity: 0.85; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
/* 名称 + 明暗标签同一行 */
.rp-opt-row { display: flex; align-items: center; gap: 4px; min-width: 0; }
.rp-opt-row .rp-opt-name { flex: 1; min-width: 0; }
/* 明暗标签：浅 = 中性描边，暗 = 强调色描边（暗色主题要配深色背景，需要被看见） */
.rp-opt-tone {
  flex-shrink: 0;
  font-size: 9px;
  font-family: var(--font-mono);
  line-height: 1.5;
  padding: 0 3px;
  border: 1px solid currentColor;
  color: var(--text-primary);
  opacity: 0.45;
}
.rp-opt-tone.tone-dark {
  color: var(--accent);
  border-color: var(--accent);
  opacity: 0.95;
}
/* 分区下面的一句说明 */
.rp-look-tip {
  grid-column: 1 / -1;
  margin: 0 0 2px;
  font-size: 10px;
  font-family: var(--font-mono);
  line-height: 1.5;
  opacity: 0.5;
}
.rp-theme-card.active .rp-opt-name { opacity: 1; font-weight: 700; }
.rp-bg-card.active .rp-opt-name { opacity: 1; font-weight: 700; }
/* 控件右侧的项目备注 */
.rp-note {
  max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 11px; font-family: var(--font-mono); opacity: 0.75;
  padding: 2px 8px; border: 1px solid var(--border-color); flex-shrink: 1;
}
.rp-body { padding: 12px 0; }
/* ── 主题变量：默认值 = 经典简报 ──
   同时挂在画布（.rp-wrap）和主题缩略图（.rp-theme-thumb）上，
   这样缩略图能直接用同一套变量渲染，做到「所见即所得」。
   各 .rp-theme-<id> 只覆盖这些变量，再按需要加不占布局的装饰。 */
.rp-wrap,
.rp-theme-thumb {
  /* 画布底色倾向：浅色主题白底、暗色主题深底（只给缩略图当底，不影响导出） */
  --rt-canvas: #ffffff;
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
.rp-author-label { font-size: 10px; color: var(--rt-ink-dim); font-family: var(--font-mono); margin-right: 6px; }
.rp-author-btn { font-size: 12px; padding: 4px 14px; border: 1px solid var(--rt-tab-edge); background: none; cursor: pointer; font-family: inherit; margin-left: -1px; color: var(--rt-tab-fg); }
.rp-author-btn:first-child { margin-left: 0; }
.rp-author-btn:hover { background: var(--rt-tab-on-bg); color: var(--rt-tab-on-fg); }
.rp-author-btn.active { background: var(--rt-tab-on-bg); color: var(--rt-tab-on-fg); border-color: var(--rt-tab-on-bg); }
.rp-card { border: 1px solid var(--rt-card-edge); background: var(--rt-card-bg); margin-bottom: 10px; }
.rp-cards-row { display: flex; gap: 10px; margin-bottom: 10px; }
.rp-cards-row .rp-card { margin-bottom: 0; }
.rp-half { flex: 1; min-width: 0; }
.rp-card-head { padding: 8px 14px; background: var(--rt-head-bg); color: var(--rt-head-fg); border-bottom: 1px solid var(--rt-head-rule); font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.rp-reset-sm { font-size: 10px; padding: 1px 8px; border: 1px solid var(--rt-btn-edge); background: none; cursor: pointer; font-family: var(--font-mono); font-weight: 400; margin-left: auto; color: var(--rt-head-fg); }
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
.rp-quick-label { font-size: 10px; color: var(--rt-ink-dim); font-family: var(--font-mono); margin-right: 2px; }
.rp-quick-group-label { display: block; width: 100%; margin-top: 4px; }
.rp-quick-btn { font-size: 11px; padding: 2px 8px; border: 1px solid var(--rt-btn-edge); cursor: pointer; font-family: var(--font-mono); margin: 1px 2px; color: var(--rt-ink); background: none; }
.rp-quick-btn:hover { background: var(--rt-btn-on-bg); color: var(--rt-btn-on-fg); }
.rp-lines { outline: none; font-size: 13px; line-height: 1.8; min-height: 24px; padding: 10px 14px; }
.rp-add-row { font-size: 11px; padding: 3px 8px; margin: 6px 14px; border: 1px dashed var(--rt-btn-edge); background: none; cursor: pointer; font-family: var(--font-mono); width: calc(100% - 28px); color: var(--rt-ink); }
.rp-add-row:hover { border-color: var(--rt-accent); background: var(--rt-row-alt); }
.rp-row-del { font-size: 14px; padding: 0 6px; border: 1px solid var(--rt-btn-edge); background: none; cursor: pointer; opacity: 0.4; font-family: var(--font-mono); line-height: 1; color: var(--rt-ink); }
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
  font-family: var(--font-mono);
  font-size: 8px;
  line-height: 1;
  letter-spacing: 2.4px;
  color: #71818a;
  pointer-events: none;
}
.rp-theme-ls-archive .rp-title { letter-spacing: 1.2px; }
.rp-theme-ls-archive .rp-meta { font-family: var(--font-mono); letter-spacing: 0.6px; }
.rp-theme-ls-archive .rp-meta .rp-inp { font-weight: 900; }
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
  font-family: var(--font-mono);
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
.rp-theme-ls-gauge .rp-meta .rp-inp { font-weight: 900; font-variant-numeric: tabular-nums; }
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
.rp-theme-p3r-tiles .rp-meta .rp-inp { font-weight: 900; }
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

/* ── D1. 终末地 · 台账 ─────────────────────────────────────────────
   工业工作台：纸白承载面 + 墨色信息栏 + 唯一强调色 lime。
   lime 只做「标记」（左边缘状态条 / 卡片标题左侧条），不做文字色；
   编号与数字用等宽数字排。切角在这里用不了（导出可靠性），
   改用伪元素三色条与细线表达「这是一份记录」。 */
.rp-theme-ef-ledger {
  position: relative;
  color: #161616;
  --rt-ink: #161616;
  --rt-ink-dim: rgba(22, 22, 22, 0.55);
  --rt-title-fg: #161616;
  --rt-tab-edge: rgba(22, 22, 22, 0.32);
  --rt-tab-fg: #161616;
  --rt-tab-on-bg: #161616;
  --rt-tab-on-fg: #F4F4F2;
  --rt-card-bg: #FFFFFF;
  --rt-card-edge: #D9D9D6;
  --rt-head-bg: #161616;
  --rt-head-fg: #EDEDED;
  --rt-head-rule: #B8FF3D;
  --rt-meta-bg: #161616;
  --rt-meta-fg: #EDEDED;
  --rt-meta-edge: #161616;
  --rt-meta-bar: #B8FF3D;
  --rt-inp-bg: #FFFFFF;
  --rt-inp-fg: #161616;
  --rt-inp-edge: #D9D9D6;
  --rt-radio: #161616;
  --rt-radio-checked: #161616;
  --rt-accent: #161616;
  --rt-row-rule: #E4E4E0;
  --rt-row-alt: transparent;
  --rt-img-edge: #D9D9D6;
  --rt-btn-edge: #161616;
  --rt-btn-on-bg: #161616;
  --rt-btn-on-fg: #F4F4F2;
}
/* 屏幕开始的三色条：绝对定位在画布内边距里，不占布局 */
.rp-wrap.rp-theme-ef-ledger::before {
  content: '';
  position: absolute;
  left: 24px; right: 24px; top: 6px;
  height: 3px;
  background: linear-gradient(90deg,
    #FF00F0 0 33.33%,
    #B8FF3D 33.33% 66.66%,
    #00FFA2 66.66% 100%);
  pointer-events: none;
}
/* 眉标：`//` + 宽体大写字距（8px 小字，落在标题行上方） */
.rp-theme-ef-ledger .rp-title-row::before,
.rp-theme-ef-nightshift .rp-title-row::before {
  content: '// DAILY RECORD';
  position: absolute;
  left: 0; top: -11px;
  font-family: var(--font-mono);
  font-size: 8px;
  line-height: 1;
  letter-spacing: 2.4px;
  pointer-events: none;
}
.rp-theme-ef-ledger .rp-title-row::before { color: #5C5C5C; }
.rp-theme-ef-nightshift .rp-title-row::before { color: #A3A3A3; }
.rp-theme-ef-ledger .rp-title { font-weight: 800; letter-spacing: 0.4px; }
/* 信息栏：深色命令栏 + 等宽数字（数字是真实数据，用等宽排） */
.rp-theme-ef-ledger .rp-meta { font-family: var(--font-mono); letter-spacing: 0.06em; }
.rp-theme-ef-ledger .rp-meta .rp-inp {
  font-family: var(--font-mono);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
/* 卡片标题：左侧一条 lime 状态条（在 14px 内边距里，不压字） */
.rp-theme-ef-ledger .rp-card-head {
  letter-spacing: 1.6px;
  box-shadow: inset 4px 0 0 #B8FF3D;
}
.rp-theme-ef-ledger .rp-card-head .rp-reset-sm { border-color: rgba(237, 237, 237, 0.45); }
.rp-theme-ef-ledger .rp-task-label { font-weight: 600; letter-spacing: 0.02em; }
.rp-theme-ef-ledger .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }

/* ── D2. 终末地 · 夜班 ─────────────────────────────────────────────
   同一套语法换成石墨黑：承载面是 #222 的板，文字浅墨，lime 仍是
   唯一强调色（深色里它可以当线）。信息栏与卡片头比板更深一档。 */
.rp-theme-ef-nightshift {
  position: relative;
  color: #EDEDED;
  /* 暗色主题：缩略图用石墨底，一眼看出它要配深色画布 */
  --rt-canvas: #191919;
  --rt-ink: #EDEDED;
  --rt-ink-dim: rgba(237, 237, 237, 0.55);
  --rt-title-bg: #191919;
  --rt-title-fg: #EDEDED;
  --rt-tab-edge: rgba(237, 237, 237, 0.28);
  --rt-tab-fg: #EDEDED;
  --rt-tab-on-bg: #B8FF3D;
  --rt-tab-on-fg: #161616;
  --rt-card-bg: #222222;
  --rt-card-edge: #353535;
  --rt-head-bg: #0F0F0F;
  --rt-head-fg: #EDEDED;
  --rt-head-rule: #B8FF3D;
  --rt-meta-bg: #0F0F0F;
  --rt-meta-fg: #EDEDED;
  --rt-meta-edge: #353535;
  --rt-meta-bar: #B8FF3D;
  --rt-inp-bg: #2E2E2E;
  --rt-inp-fg: #EDEDED;
  --rt-inp-edge: #4A4A4A;
  --rt-radio: #B8FF3D;
  --rt-radio-checked: #B8FF3D;
  --rt-accent: #B8FF3D;
  --rt-row-rule: #2E2E2E;
  --rt-row-alt: transparent;
  --rt-img-edge: #3A3A3A;
  --rt-btn-edge: #4A4A4A;
  --rt-btn-on-bg: #B8FF3D;
  --rt-btn-on-fg: #161616;
}
.rp-wrap.rp-theme-ef-nightshift::before {
  content: '';
  position: absolute;
  left: 24px; right: 24px; top: 6px;
  height: 3px;
  background: linear-gradient(90deg,
    #FF00F0 0 33.33%,
    #B8FF3D 33.33% 66.66%,
    #00FFA2 66.66% 100%);
  pointer-events: none;
}
.rp-theme-ef-nightshift .rp-title { font-weight: 800; letter-spacing: 0.4px; }
.rp-theme-ef-nightshift .rp-meta { font-family: var(--font-mono); letter-spacing: 0.06em; }
.rp-theme-ef-nightshift .rp-meta .rp-inp {
  font-family: var(--font-mono);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
.rp-theme-ef-nightshift .rp-card-head {
  letter-spacing: 1.6px;
  box-shadow: inset 4px 0 0 #B8FF3D;
}
.rp-theme-ef-nightshift .rp-card-head .rp-reset-sm { border-color: rgba(237, 237, 237, 0.45); }
.rp-theme-ef-nightshift .rp-task-label { font-weight: 600; letter-spacing: 0.02em; }
.rp-theme-ef-nightshift .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }

/* ── D3. 终末地 · 工单 ─────────────────────────────────────────────
   白纸表格：与「台账」的区别不是深浅，而是结构 —— 卡片与行都是 1px
   墨色实线（表格感），信息栏反过来改成浅底墨字；lime 仍只做标记。 */
.rp-theme-ef-workorder {
  position: relative;
  color: #161616;
  --rt-ink: #161616;
  --rt-ink-dim: rgba(22, 22, 22, 0.5);
  --rt-title-fg: #161616;
  --rt-tab-edge: #161616;
  --rt-tab-fg: #161616;
  --rt-tab-on-bg: #161616;
  --rt-tab-on-fg: #F4F4F2;
  --rt-card-bg: #FFFFFF;
  --rt-card-edge: #161616;
  --rt-head-bg: #161616;
  --rt-head-fg: #F4F4F2;
  --rt-head-rule: #B8FF3D;
  --rt-meta-bg: #F4F4F2;
  --rt-meta-fg: #161616;
  --rt-meta-edge: #161616;
  --rt-meta-bar: #161616;
  --rt-inp-bg: #FFFFFF;
  --rt-inp-fg: #161616;
  --rt-inp-edge: #161616;
  --rt-radio: #161616;
  --rt-radio-checked: #161616;
  --rt-accent: #161616;
  --rt-row-rule: #161616;
  --rt-row-alt: transparent;
  --rt-img-edge: #161616;
  --rt-btn-edge: #161616;
  --rt-btn-on-bg: #161616;
  --rt-btn-on-fg: #F4F4F2;
}
.rp-wrap.rp-theme-ef-workorder::before {
  content: '';
  position: absolute;
  left: 24px; right: 24px; top: 6px;
  height: 3px;
  background: linear-gradient(90deg,
    #FF00F0 0 33.33%,
    #B8FF3D 33.33% 66.66%,
    #00FFA2 66.66% 100%);
  pointer-events: none;
}
/* 眉标：工单 / 编号栏 */
.rp-theme-ef-workorder .rp-title-row::before {
  content: '// WORK ORDER / NO.';
  position: absolute;
  left: 0; top: -11px;
  font-family: var(--font-mono);
  font-size: 8px;
  line-height: 1;
  letter-spacing: 2.2px;
  color: #5C5C5C;
  pointer-events: none;
}
.rp-theme-ef-workorder .rp-title { font-weight: 800; letter-spacing: 1.2px; }
.rp-theme-ef-workorder .rp-meta { font-family: var(--font-mono); letter-spacing: 0.08em; }
.rp-theme-ef-workorder .rp-meta .rp-inp {
  font-family: var(--font-mono);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
.rp-theme-ef-workorder .rp-card-head {
  letter-spacing: 1.4px;
  box-shadow: inset 4px 0 0 #B8FF3D;
}
.rp-theme-ef-workorder .rp-card-head .rp-reset-sm { border-color: rgba(244, 244, 242, 0.5); }
.rp-theme-ef-workorder .rp-task-label { font-weight: 700; letter-spacing: 0.02em; }
/* 任务行：实线分隔 + 左缘一条编号刻度（绝对定位，不占布局） */
.rp-theme-ef-workorder .rp-task-row {
  position: relative;
  box-shadow: inset 0 -1px 0 var(--rt-row-rule);
}
.rp-theme-ef-workorder .rp-task-row::before {
  content: '';
  position: absolute;
  left: 0; top: 6px; bottom: 6px;
  width: 2px;  background: rgba(22, 22, 22, 0.18);
  pointer-events: none;
}

/* ══════════════════════════════════════════════════════════════════
   孤星 / P3R：形状化装饰（保持原版风格，只加「形」不加尺寸）

   全部是绝对定位伪元素 —— 不占布局、不改导出尺寸，也不使用
   clip-path / filter（html2canvas 不可靠）。
   ══════════════════════════════════════════════════════════════════ */

/* 科研档案：卡片右上角的档案编号 */
.rp-theme-ls-archive .rp-card { position: relative; }
.rp-theme-ls-archive .rp-card::after {
  content: 'FILE';
  position: absolute;
  right: 7px; top: 5px;
  font-family: var(--font-mono);
  font-size: 8px;
  line-height: 1;
  letter-spacing: 2.4px;
  color: rgba(20, 27, 34, 0.3);
  pointer-events: none;
}

/* 航天制图：标题行下方的制图基准刻度 */
.rp-theme-ls-drafting .rp-title-row::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: -5px;
  height: 2px;
  background: repeating-linear-gradient(90deg,
    rgba(43, 108, 176, 0.55) 0 1px,
    transparent 1px 8px);
  pointer-events: none;
}

/* 工业仪器：卡片标题右端的刻度块 */
.rp-theme-ls-gauge .rp-card-head { position: relative; }
.rp-theme-ls-gauge .rp-card-head::after {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 20px;
  background: repeating-linear-gradient(90deg,
    rgba(242, 244, 242, 0.45) 0 1px,
    transparent 1px 4px);
  pointer-events: none;
}

/* 斜切海报：卡片右上角的明黄斜线角标 */
.rp-theme-p3r-poster .rp-card { position: relative; }
.rp-theme-p3r-poster .rp-card::after {
  content: '';
  position: absolute;
  right: 0; top: 0;
  width: 20px; height: 20px;
  background: linear-gradient(225deg,
    transparent 0 44%,
    #F5D83D 44% 56%,
    transparent 56%);
  pointer-events: none;
}

/* 月相编辑：标题行右端的细刻度（月相轨迹的收尾） */
.rp-theme-p3r-lunar .rp-title-row::before {
  content: '';
  position: absolute;
  right: 0; bottom: -6px;
  width: 64px; height: 2px;
  background: repeating-linear-gradient(90deg,
    rgba(16, 35, 63, 0.35) 0 1px,
    transparent 1px 5px);
  pointer-events: none;
}

/* 都市拼贴：任务行右端的错位小色块 */
.rp-theme-p3r-tiles .rp-task-row { position: relative; }
.rp-theme-p3r-tiles .rp-task-row::after {
  content: '';
  position: absolute;
  right: 6px; bottom: 4px;
  width: 10px; height: 3px;
  background: rgba(18, 100, 200, 0.55);
  pointer-events: none;
}

/* ══════════════════════════════════════════════════════════════════
   各风格扩充套（每族 8 套）：变量块 + 结构语言
   变量只决定颜色；结构差异靠 border-style / inset 阴影 / 不占布局的伪元素表达。
   瑞士族用 .rp-wrap. 前缀，把字重压回 400 / 700（压过下面的字体基线）。
   ══════════════════════════════════════════════════════════════════ */
/* ── 孤星 · 规格卡：双层细框 + 右上编号块 ── */
.rp-theme-ls-spec {
  position: relative;
  color: #141b22;
  --rt-canvas: #f7f4ec;
  --rt-ink: #141b22;
  --rt-ink-dim: rgba(20,27,34,0.5);
  --rt-title-bg: transparent;
  --rt-title-fg: #141b22;
  --rt-tab-edge: rgba(20,27,34,0.55);
  --rt-tab-fg: #141b22;
  --rt-tab-on-bg: #141b22;
  --rt-tab-on-fg: #f7f4ec;
  --rt-card-bg: rgba(255,255,255,0.72);
  --rt-card-edge: rgba(20,27,34,0.55);
  --rt-head-bg: #f1ece0;
  --rt-head-fg: #141b22;
  --rt-head-rule: #141b22;
  --rt-meta-bg: #f7f4ec;
  --rt-meta-fg: #141b22;
  --rt-meta-edge: #141b22;
  --rt-meta-bar: #d87938;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #141b22;
  --rt-inp-edge: rgba(20,27,34,0.35);
  --rt-radio: #141b22;
  --rt-radio-checked: #d87938;
  --rt-accent: #d87938;
  --rt-row-rule: rgba(20,27,34,0.18);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(20,27,34,0.35);
  --rt-btn-edge: #141b22;
  --rt-btn-on-bg: #141b22;
  --rt-btn-on-fg: #f7f4ec;
}
.rp-theme-ls-spec .rp-card { box-shadow: inset 0 0 0 1px rgba(20,27,34,0.55), inset 0 0 0 4px rgba(255,255,255,0.9), inset 0 0 0 5px rgba(20,27,34,0.22); }
.rp-theme-ls-spec .rp-card-head { position: relative; }
.rp-theme-ls-spec .rp-card-head::after {
  content: ''; position: absolute; right: 10px; top: 5px;
  width: 16px; height: 16px; background: #141b22;
  box-shadow: inset 0 0 0 3px rgba(247,244,236,0.9); pointer-events: none;
}
.rp-theme-ls-spec .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }

/* ── 孤星 · 值班日志：整宽深色条 + 逐行实线 ── */
.rp-theme-ls-log {
  position: relative;
  color: #141b22;
  --rt-canvas: #f6f2e8;
  --rt-ink: #141b22;
  --rt-ink-dim: rgba(20,27,34,0.5);
  --rt-title-bg: transparent;
  --rt-title-fg: #141b22;
  --rt-tab-edge: rgba(20,27,34,0.5);
  --rt-tab-fg: #141b22;
  --rt-tab-on-bg: #101923;
  --rt-tab-on-fg: #e8e2d3;
  --rt-card-bg: #fbf8f0;
  --rt-card-edge: rgba(20,27,34,0.18);
  --rt-head-bg: #101923;
  --rt-head-fg: #e8e2d3;
  --rt-head-rule: #101923;
  --rt-meta-bg: #efe9dc;
  --rt-meta-fg: #141b22;
  --rt-meta-edge: rgba(20,27,34,0.4);
  --rt-meta-bar: #d87938;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #141b22;
  --rt-inp-edge: rgba(20,27,34,0.3);
  --rt-radio: #141b22;
  --rt-radio-checked: #d87938;
  --rt-accent: #d87938;
  --rt-row-rule: rgba(20,27,34,0.14);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(20,27,34,0.3);
  --rt-btn-edge: #141b22;
  --rt-btn-on-bg: #101923;
  --rt-btn-on-fg: #e8e2d3;
}
.rp-theme-ls-log .rp-card-head { letter-spacing: 2.4px; }
.rp-theme-ls-log .rp-card-head .rp-reset-sm { border-color: rgba(232,226,211,0.5); }
.rp-theme-ls-log .rp-task-row { border-bottom: 1px solid var(--rt-row-rule); box-shadow: inset 3px 0 0 rgba(20,27,34,0.1); }
.rp-theme-ls-log .rp-task-row:last-child { border-bottom: none; }

/* ── 孤星 · 电路图：虚线边框 + 节点圆点 ── */
.rp-theme-ls-schematic {
  position: relative;
  color: #122029;
  --rt-canvas: #f5f8f8;
  --rt-ink: #122029;
  --rt-ink-dim: rgba(18,32,41,0.5);
  --rt-title-bg: transparent;
  --rt-title-fg: #122029;
  --rt-tab-edge: rgba(18,32,41,0.5);
  --rt-tab-fg: #122029;
  --rt-tab-on-bg: #122029;
  --rt-tab-on-fg: #f5f8f8;
  --rt-card-bg: transparent;
  --rt-card-edge: rgba(18,32,41,0.5);
  --rt-head-bg: transparent;
  --rt-head-fg: #122029;
  --rt-head-rule: #122029;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #122029;
  --rt-meta-edge: rgba(18,32,41,0.5);
  --rt-meta-bar: transparent;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #122029;
  --rt-inp-edge: rgba(18,32,41,0.3);
  --rt-radio: #122029;
  --rt-radio-checked: #d87938;
  --rt-accent: #d87938;
  --rt-row-rule: rgba(18,32,41,0.14);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(18,32,41,0.3);
  --rt-btn-edge: #122029;
  --rt-btn-on-bg: #122029;
  --rt-btn-on-fg: #f5f8f8;
}
.rp-theme-ls-schematic .rp-card { border-style: dashed; }
.rp-theme-ls-schematic .rp-card-head { border-bottom-style: dashed; }
.rp-theme-ls-schematic .rp-task-row { position: relative; }
.rp-theme-ls-schematic .rp-task-row::after {
  content: ''; position: absolute; left: -5px; top: calc(50% - 2px);
  width: 4px; height: 4px; border-radius: 50%;
  background: #d87938; pointer-events: none;
}

/* ── 孤星 · 货运单：表格式横线 + 单号斜纹块 ── */
.rp-theme-ls-manifest {
  position: relative;
  color: #161b1f;
  --rt-canvas: #f7f6f1;
  --rt-ink: #161b1f;
  --rt-ink-dim: rgba(22,27,31,0.5);
  --rt-title-bg: transparent;
  --rt-title-fg: #161b1f;
  --rt-tab-edge: rgba(22,27,31,0.5);
  --rt-tab-fg: #161b1f;
  --rt-tab-on-bg: #161b1f;
  --rt-tab-on-fg: #f7f6f1;
  --rt-card-bg: #ffffff;
  --rt-card-edge: rgba(22,27,31,0.45);
  --rt-head-bg: #eeeee8;
  --rt-head-fg: #161b1f;
  --rt-head-rule: #161b1f;
  --rt-meta-bg: #f2f1ea;
  --rt-meta-fg: #161b1f;
  --rt-meta-edge: rgba(22,27,31,0.45);
  --rt-meta-bar: #71818a;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #161b1f;
  --rt-inp-edge: rgba(22,27,31,0.3);
  --rt-radio: #161b1f;
  --rt-radio-checked: #161b1f;
  --rt-accent: #d87938;
  --rt-row-rule: rgba(22,27,31,0.14);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(22,27,31,0.3);
  --rt-btn-edge: #161b1f;
  --rt-btn-on-bg: #161b1f;
  --rt-btn-on-fg: #f7f6f1;
}
.rp-theme-ls-manifest .rp-card { box-shadow: inset 0 0 0 1px rgba(22,27,31,0.45), inset 0 2px 0 #161b1f; }
.rp-theme-ls-manifest .rp-task-row { border-bottom: 1px solid var(--rt-row-rule); }
.rp-theme-ls-manifest .rp-card-head { position: relative; }
.rp-theme-ls-manifest .rp-card-head::after {
  content: ''; position: absolute; right: 12px; top: 6px;
  width: 44px; height: 8px;
  background: repeating-linear-gradient(90deg, rgba(22,27,31,0.45) 0 1px, transparent 1px 4px);
  pointer-events: none;
}

/* ── 孤星 · 终端（暗）：深蓝底 + 冷白字 + 扫描线 ── */
.rp-theme-ls-terminal {
  position: relative;
  color: #e8e2d3;
  --rt-canvas: #101923;
  --rt-ink: #e8e2d3;
  --rt-ink-dim: rgba(232,226,211,0.55);
  --rt-title-bg: #0b121a;
  --rt-title-fg: #e8e2d3;
  --rt-tab-edge: rgba(232,226,211,0.35);
  --rt-tab-fg: #e8e2d3;
  --rt-tab-on-bg: #d87938;
  --rt-tab-on-fg: #101923;
  --rt-card-bg: #16212d;
  --rt-card-edge: #25323f;
  --rt-head-bg: #0b121a;
  --rt-head-fg: #e8e2d3;
  --rt-head-rule: rgba(232,226,211,0.22);
  --rt-meta-bg: #0b121a;
  --rt-meta-fg: #e8e2d3;
  --rt-meta-edge: rgba(232,226,211,0.3);
  --rt-meta-bar: #d87938;
  --rt-inp-bg: #1d2a38;
  --rt-inp-fg: #e8e2d3;
  --rt-inp-edge: rgba(232,226,211,0.28);
  --rt-radio: #e8e2d3;
  --rt-radio-checked: #d87938;
  --rt-accent: #d87938;
  --rt-row-rule: rgba(232,226,211,0.12);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(232,226,211,0.2);
  --rt-btn-edge: rgba(232,226,211,0.35);
  --rt-btn-on-bg: #d87938;
  --rt-btn-on-fg: #101923;
}
.rp-theme-ls-terminal .rp-card-head { letter-spacing: 2px; }
.rp-theme-ls-terminal .rp-card-head .rp-reset-sm { border-color: rgba(232,226,211,0.4); }
.rp-theme-ls-terminal .rp-title-row { position: relative; }
.rp-theme-ls-terminal .rp-title-row::before {
  content: '// TERMINAL'; position: absolute; left: 0; top: -10px;
  font-size: 8px; line-height: 1; letter-spacing: 2.2px; color: #d87938;
  pointer-events: none;
}
.rp-theme-ls-terminal .rp-task-row {
  background-image: repeating-linear-gradient(180deg, rgba(232,226,211,0.03) 0 1px, transparent 1px 3px);
}

/* ── P3R · 斜切分割：上下两色 + 明黄细线 ── */
.rp-theme-p3r-cut {
  position: relative;
  color: #0a1f42;
  --rt-canvas: #f2f6fd;
  --rt-ink: #0a1f42;
  --rt-ink-dim: rgba(10,31,66,0.55);
  --rt-title-bg: linear-gradient(90deg, rgba(18,100,200,0.16) 0 50%, transparent 50%);
  --rt-title-fg: #0a1f42;
  --rt-tab-edge: rgba(10,31,66,0.4);
  --rt-tab-fg: #0a1f42;
  --rt-tab-on-bg: #071b3a;
  --rt-tab-on-fg: #f4f6fa;
  --rt-card-bg: #ffffff;
  --rt-card-edge: rgba(10,31,66,0.16);
  --rt-head-bg: #071b3a;
  --rt-head-fg: #f4f6fa;
  --rt-head-rule: rgba(255,255,255,0.24);
  --rt-meta-bg: #e9f0fa;
  --rt-meta-fg: #0a1f42;
  --rt-meta-edge: rgba(10,31,66,0.2);
  --rt-meta-bar: #f5d83d;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #0a1f42;
  --rt-inp-edge: rgba(10,31,66,0.22);
  --rt-radio: #0a1f42;
  --rt-radio-checked: #1264c8;
  --rt-accent: #1264c8;
  --rt-row-rule: rgba(10,31,66,0.12);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(10,31,66,0.2);
  --rt-btn-edge: rgba(10,31,66,0.3);
  --rt-btn-on-bg: #1264c8;
  --rt-btn-on-fg: #ffffff;
}
.rp-theme-p3r-cut .rp-card { box-shadow: inset 0 -3px 0 #f5d83d; }
.rp-theme-p3r-cut .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }
.rp-theme-p3r-cut .rp-card-head { letter-spacing: 1.6px; }

/* ── P3R · 夜间霓虹（暗）：深蓝底 + 霓虹边线 ── */
.rp-theme-p3r-night {
  position: relative;
  color: #f4f6fa;
  --rt-canvas: #071b3a;
  --rt-ink: #f4f6fa;
  --rt-ink-dim: rgba(244,246,250,0.62);
  --rt-title-bg: #04122a;
  --rt-title-fg: #f4f6fa;
  --rt-tab-edge: rgba(40,184,242,0.45);
  --rt-tab-fg: #f4f6fa;
  --rt-tab-on-bg: #28b8f2;
  --rt-tab-on-fg: #04122a;
  --rt-card-bg: #0c2450;
  --rt-card-edge: rgba(40,184,242,0.5);
  --rt-head-bg: #04122a;
  --rt-head-fg: #28b8f2;
  --rt-head-rule: rgba(40,184,242,0.35);
  --rt-meta-bg: #04122a;
  --rt-meta-fg: #f4f6fa;
  --rt-meta-edge: rgba(40,184,242,0.4);
  --rt-meta-bar: #f5d83d;
  --rt-inp-bg: #10294f;
  --rt-inp-fg: #f4f6fa;
  --rt-inp-edge: rgba(40,184,242,0.35);
  --rt-radio: #f4f6fa;
  --rt-radio-checked: #28b8f2;
  --rt-accent: #f5d83d;
  --rt-row-rule: rgba(40,184,242,0.22);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(40,184,242,0.3);
  --rt-btn-edge: rgba(40,184,242,0.45);
  --rt-btn-on-bg: #f5d83d;
  --rt-btn-on-fg: #071b3a;
}
.rp-theme-p3r-night .rp-card { box-shadow: inset 0 0 0 1px rgba(40,184,242,0.5), inset 0 -2px 0 rgba(245,216,61,0.45); }
.rp-theme-p3r-night .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }
.rp-theme-p3r-night .rp-title-row { position: relative; }
.rp-theme-p3r-night .rp-title-row::before {
  content: 'NIGHT'; position: absolute; right: 0; top: -10px;
  font-size: 8px; line-height: 1; letter-spacing: 2.6px; color: #f5d83d;
  pointer-events: none;
}

/* ── P3R · 索引页：右侧索引条 + 编号列 ── */
.rp-theme-p3r-index {
  position: relative;
  color: #0a1f42;
  --rt-canvas: #f4f7fc;
  --rt-ink: #0a1f42;
  --rt-ink-dim: rgba(10,31,66,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #0a1f42;
  --rt-tab-edge: rgba(10,31,66,0.35);
  --rt-tab-fg: #0a1f42;
  --rt-tab-on-bg: #1264c8;
  --rt-tab-on-fg: #ffffff;
  --rt-card-bg: #ffffff;
  --rt-card-edge: rgba(10,31,66,0.14);
  --rt-head-bg: #eef4fc;
  --rt-head-fg: #0a1f42;
  --rt-head-rule: rgba(10,31,66,0.16);
  --rt-meta-bg: #ffffff;
  --rt-meta-fg: #0a1f42;
  --rt-meta-edge: rgba(10,31,66,0.18);
  --rt-meta-bar: #1264c8;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #0a1f42;
  --rt-inp-edge: rgba(10,31,66,0.2);
  --rt-radio: #0a1f42;
  --rt-radio-checked: #1264c8;
  --rt-accent: #1264c8;
  --rt-row-rule: rgba(10,31,66,0.1);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(10,31,66,0.18);
  --rt-btn-edge: rgba(10,31,66,0.28);
  --rt-btn-on-bg: #1264c8;
  --rt-btn-on-fg: #ffffff;
}
.rp-theme-p3r-index .rp-card { box-shadow: inset -18px 0 0 rgba(18,100,200,0.12), inset 0 0 0 1px rgba(10,31,66,0.14); }
.rp-theme-p3r-index .rp-card-head { letter-spacing: 1.8px; }
.rp-theme-p3r-index .rp-task-label { box-shadow: inset 2px 0 0 rgba(18,100,200,0.55); }
.rp-theme-p3r-index .rp-task-row { border-bottom: 1px solid var(--rt-row-rule); }

/* ── P3R · 传单：明黄大标题 + 深蓝卡片头 ── */
.rp-theme-p3r-flyer {
  position: relative;
  color: #0a1f42;
  --rt-canvas: #f7f9fd;
  --rt-ink: #0a1f42;
  --rt-ink-dim: rgba(10,31,66,0.55);
  --rt-title-bg: #f5d83d;
  --rt-title-fg: #071b3a;
  --rt-tab-edge: rgba(10,31,66,0.35);
  --rt-tab-fg: #0a1f42;
  --rt-tab-on-bg: #071b3a;
  --rt-tab-on-fg: #f4f6fa;
  --rt-card-bg: #ffffff;
  --rt-card-edge: rgba(10,31,66,0.18);
  --rt-head-bg: #071b3a;
  --rt-head-fg: #f5d83d;
  --rt-head-rule: #f5d83d;
  --rt-meta-bg: #ffffff;
  --rt-meta-fg: #0a1f42;
  --rt-meta-edge: rgba(10,31,66,0.2);
  --rt-meta-bar: #f5d83d;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #0a1f42;
  --rt-inp-edge: rgba(10,31,66,0.22);
  --rt-radio: #0a1f42;
  --rt-radio-checked: #1264c8;
  --rt-accent: #1264c8;
  --rt-row-rule: rgba(10,31,66,0.12);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(10,31,66,0.2);
  --rt-btn-edge: rgba(10,31,66,0.3);
  --rt-btn-on-bg: #071b3a;
  --rt-btn-on-fg: #f5d83d;
}
.rp-theme-p3r-flyer .rp-card-head { letter-spacing: 2.2px; }
.rp-theme-p3r-flyer .rp-card { box-shadow: inset 0 0 0 1px rgba(10,31,66,0.18), inset 0 -4px 0 rgba(245,216,61,0.7); }
.rp-theme-p3r-flyer .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }

/* ── P3R · 档案袋：牛皮纸底 + 标签条 + 装订孔 ── */
.rp-theme-p3r-archive {
  position: relative;
  color: #2a2118;
  --rt-canvas: #efe6d6;
  --rt-ink: #2a2118;
  --rt-ink-dim: rgba(42,33,24,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #2a2118;
  --rt-tab-edge: rgba(42,33,24,0.4);
  --rt-tab-fg: #2a2118;
  --rt-tab-on-bg: #2a2118;
  --rt-tab-on-fg: #efe6d6;
  --rt-card-bg: #f7f0e3;
  --rt-card-edge: rgba(42,33,24,0.35);
  --rt-head-bg: #e6d9c2;
  --rt-head-fg: #2a2118;
  --rt-head-rule: rgba(42,33,24,0.35);
  --rt-meta-bg: #f7f0e3;
  --rt-meta-fg: #2a2118;
  --rt-meta-edge: rgba(42,33,24,0.35);
  --rt-meta-bar: #1264c8;
  --rt-inp-bg: #fffaf0;
  --rt-inp-fg: #2a2118;
  --rt-inp-edge: rgba(42,33,24,0.28);
  --rt-radio: #2a2118;
  --rt-radio-checked: #1264c8;
  --rt-accent: #1264c8;
  --rt-row-rule: rgba(42,33,24,0.14);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(42,33,24,0.28);
  --rt-btn-edge: rgba(42,33,24,0.38);
  --rt-btn-on-bg: #2a2118;
  --rt-btn-on-fg: #efe6d6;
}
.rp-theme-p3r-archive .rp-card { box-shadow: inset 0 0 0 1px rgba(42,33,24,0.35), inset 0 6px 0 rgba(18,100,200,0.18); }
.rp-theme-p3r-archive .rp-card-head { position: relative; letter-spacing: 1.4px; }
.rp-theme-p3r-archive .rp-card-head::before {
  content: ''; position: absolute; left: 8px; top: calc(50% - 3px);
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(42,33,24,0.45); pointer-events: none;
}
.rp-theme-p3r-archive .rp-task-row { border-bottom: 1px dashed var(--rt-row-rule); }

/* ── 终末地 · 舱单：表头铭牌 + 三色短线 ── */
.rp-theme-ef-manifest {
  position: relative;
  color: #161616;
  --rt-canvas: #f4f4f2;
  --rt-ink: #161616;
  --rt-ink-dim: rgba(22,22,22,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #161616;
  --rt-tab-edge: #161616;
  --rt-tab-fg: #161616;
  --rt-tab-on-bg: #161616;
  --rt-tab-on-fg: #f4f4f2;
  --rt-card-bg: #ffffff;
  --rt-card-edge: #161616;
  --rt-head-bg: #161616;
  --rt-head-fg: #EDEDED;
  --rt-head-rule: #B8FF3D;
  --rt-meta-bg: #e4e4e0;
  --rt-meta-fg: #161616;
  --rt-meta-edge: #161616;
  --rt-meta-bar: #B8FF3D;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #161616;
  --rt-inp-edge: #C9C9C4;
  --rt-radio: #161616;
  --rt-radio-checked: #161616;
  --rt-accent: #B8FF3D;
  --rt-row-rule: #E4E4E0;
  --rt-row-alt: transparent;
  --rt-img-edge: #C9C9C4;
  --rt-btn-edge: #161616;
  --rt-btn-on-bg: #161616;
  --rt-btn-on-fg: #EDEDED;
}
.rp-theme-ef-manifest .rp-card-head { position: relative; }
.rp-theme-ef-manifest .rp-card-head::before {
  content: ''; position: absolute; left: 6px; top: calc(50% - 5px);
  width: 3px; height: 10px;
  background: linear-gradient(180deg, #FF00F0 0 33%, #B8FF3D 33% 66%, #00FFA2 66% 100%);
  pointer-events: none;
}
.rp-theme-ef-manifest .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }

/* ── 终末地 · 终端（暗）：墨底 + lime 边框 + 光标 ── */
.rp-theme-ef-terminal {
  position: relative;
  color: #EDEDED;
  --rt-canvas: #111111;
  --rt-ink: #EDEDED;
  --rt-ink-dim: rgba(237,237,237,0.55);
  --rt-title-bg: #0B0B0B;
  --rt-title-fg: #EDEDED;
  --rt-tab-edge: rgba(184,255,61,0.5);
  --rt-tab-fg: #EDEDED;
  --rt-tab-on-bg: #B8FF3D;
  --rt-tab-on-fg: #111111;
  --rt-card-bg: #1A1A1A;
  --rt-card-edge: rgba(184,255,61,0.45);
  --rt-head-bg: #0B0B0B;
  --rt-head-fg: #B8FF3D;
  --rt-head-rule: rgba(184,255,61,0.35);
  --rt-meta-bg: #0B0B0B;
  --rt-meta-fg: #EDEDED;
  --rt-meta-edge: rgba(184,255,61,0.4);
  --rt-meta-bar: #B8FF3D;
  --rt-inp-bg: #232323;
  --rt-inp-fg: #EDEDED;
  --rt-inp-edge: rgba(184,255,61,0.3);
  --rt-radio: #EDEDED;
  --rt-radio-checked: #B8FF3D;
  --rt-accent: #B8FF3D;
  --rt-row-rule: rgba(237,237,237,0.12);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(237,237,237,0.2);
  --rt-btn-edge: rgba(184,255,61,0.5);
  --rt-btn-on-bg: #B8FF3D;
  --rt-btn-on-fg: #111111;
}
.rp-theme-ef-terminal .rp-card { box-shadow: inset 0 0 0 1px rgba(184,255,61,0.45); }
.rp-theme-ef-terminal .rp-title-row { position: relative; }
.rp-theme-ef-terminal .rp-title-row::before {
  content: '>'; position: absolute; left: 0; top: 0;
  color: #B8FF3D; font-size: 12px; line-height: 1; pointer-events: none;
}
.rp-theme-ef-terminal .rp-title-row::after {
  content: ''; position: absolute; right: 0; top: 2px;
  width: 7px; height: 12px; background: rgba(184,255,61,0.75);
  pointer-events: none;
}
.rp-theme-ef-terminal .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }

/* ── 终末地 · 检查表：行首方框 + 细分隔线 ── */
.rp-theme-ef-checklist {
  position: relative;
  color: #161616;
  --rt-canvas: #f4f4f2;
  --rt-ink: #161616;
  --rt-ink-dim: rgba(22,22,22,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #161616;
  --rt-tab-edge: #161616;
  --rt-tab-fg: #161616;
  --rt-tab-on-bg: #161616;
  --rt-tab-on-fg: #f4f4f2;
  --rt-card-bg: transparent;
  --rt-card-edge: #D9D9D6;
  --rt-head-bg: transparent;
  --rt-head-fg: #161616;
  --rt-head-rule: #161616;
  --rt-meta-bg: #ffffff;
  --rt-meta-fg: #161616;
  --rt-meta-edge: #D9D9D6;
  --rt-meta-bar: transparent;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #161616;
  --rt-inp-edge: #D9D9D6;
  --rt-radio: #161616;
  --rt-radio-checked: #161616;
  --rt-accent: #B8FF3D;
  --rt-row-rule: #E4E4E0;
  --rt-row-alt: transparent;
  --rt-img-edge: #C9C9C4;
  --rt-btn-edge: #161616;
  --rt-btn-on-bg: #161616;
  --rt-btn-on-fg: #EDEDED;
}
.rp-theme-ef-checklist .rp-card { border-style: solid; }
.rp-theme-ef-checklist .rp-task-row { position: relative; border-bottom: 1px solid var(--rt-row-rule); box-shadow: inset 3px 0 0 rgba(22,22,22,0.28); }
.rp-theme-ef-checklist .rp-task-row::before {
  content: ''; position: absolute; left: 0; top: calc(50% - 4px);
  width: 8px; height: 8px;
  border: 1px solid #161616; background: #ffffff; pointer-events: none;
}
.rp-theme-ef-checklist .rp-task-row:last-child { border-bottom: none; }

/* ── 终末地 · 批次卡：大号批次块 + 状态条 ── */
.rp-theme-ef-batch {
  position: relative;
  color: #161616;
  --rt-canvas: #f4f4f2;
  --rt-ink: #161616;
  --rt-ink-dim: rgba(22,22,22,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #161616;
  --rt-tab-edge: #161616;
  --rt-tab-fg: #161616;
  --rt-tab-on-bg: #161616;
  --rt-tab-on-fg: #f4f4f2;
  --rt-card-bg: #ffffff;
  --rt-card-edge: #161616;
  --rt-head-bg: #f4f4f2;
  --rt-head-fg: #161616;
  --rt-head-rule: #161616;
  --rt-meta-bg: #161616;
  --rt-meta-fg: #EDEDED;
  --rt-meta-edge: #161616;
  --rt-meta-bar: #B8FF3D;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #161616;
  --rt-inp-edge: #C9C9C4;
  --rt-radio: #161616;
  --rt-radio-checked: #161616;
  --rt-accent: #B8FF3D;
  --rt-row-rule: #E4E4E0;
  --rt-row-alt: transparent;
  --rt-img-edge: #C9C9C4;
  --rt-btn-edge: #161616;
  --rt-btn-on-bg: #161616;
  --rt-btn-on-fg: #EDEDED;
}
.rp-theme-ef-batch .rp-card { box-shadow: inset 0 0 0 1px #161616, inset 0 -4px 0 #B8FF3D; }
.rp-theme-ef-batch .rp-card-head { position: relative; }
.rp-theme-ef-batch .rp-card-head::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 26px; background: #161616;
  box-shadow: inset 0 0 0 6px #f4f4f2; pointer-events: none;
}
.rp-theme-ef-batch .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }

/* ── 终末地 · 结算单：双线收口 + 金额右对齐 ── */
.rp-theme-ef-invoice {
  position: relative;
  color: #161616;
  --rt-canvas: #f5f5f3;
  --rt-ink: #161616;
  --rt-ink-dim: rgba(22,22,22,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #161616;
  --rt-tab-edge: #161616;
  --rt-tab-fg: #161616;
  --rt-tab-on-bg: #161616;
  --rt-tab-on-fg: #f5f5f3;
  --rt-card-bg: #ffffff;
  --rt-card-edge: #161616;
  --rt-head-bg: #161616;
  --rt-head-fg: #EDEDED;
  --rt-head-rule: #EDEDED;
  --rt-meta-bg: #ffffff;
  --rt-meta-fg: #161616;
  --rt-meta-edge: #161616;
  --rt-meta-bar: transparent;
  --rt-inp-bg: #ffffff;
  --rt-inp-fg: #161616;
  --rt-inp-edge: #C9C9C4;
  --rt-radio: #161616;
  --rt-radio-checked: #161616;
  --rt-accent: #B8FF3D;
  --rt-row-rule: #E4E4E0;
  --rt-row-alt: transparent;
  --rt-img-edge: #C9C9C4;
  --rt-btn-edge: #161616;
  --rt-btn-on-bg: #161616;
  --rt-btn-on-fg: #EDEDED;
}
.rp-theme-ef-invoice .rp-card { box-shadow: inset 0 0 0 1px #161616, inset 0 -3px 0 #161616, inset 0 -5px 0 #ffffff; }
.rp-theme-ef-invoice .rp-card-head { letter-spacing: 2px; }
.rp-theme-ef-invoice .rp-task-row { border-bottom: 1px dotted var(--rt-row-rule); }
.rp-theme-ef-invoice .rp-task-row:last-child { border-bottom: 3px double #161616; }

/* ── 瑞士 · 田字格：四象限细线 ── */
.rp-theme-swiss-field {
  position: relative;
  color: #111111;
  --rt-canvas: #f2efe9;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #111111;
  --rt-tab-on-fg: #F2EFE9;
  --rt-card-bg: transparent;
  --rt-card-edge: #111111;
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: transparent;
  --rt-inp-fg: #111111;
  --rt-inp-edge: #111111;
  --rt-radio: #111111;
  --rt-radio-checked: #DA291C;
  --rt-accent: #DA291C;
  --rt-row-rule: rgba(17,17,17,0.16);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.35);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #111111;
  --rt-btn-on-fg: #F2EFE9;
}
.rp-wrap.rp-theme-swiss-field .rp-title { font-weight: 700; letter-spacing: -0.02em; }
.rp-theme-swiss-field .rp-card { position: relative; }
.rp-theme-swiss-field .rp-card::before {
  content: ''; position: absolute; left: 0; right: 0; top: 50%;
  height: 1px; background: rgba(17,17,17,0.35); pointer-events: none;
}
.rp-theme-swiss-field .rp-card::after {
  content: ''; position: absolute; top: 0; bottom: 0; left: 50%;
  width: 1px; background: rgba(17,17,17,0.35); pointer-events: none;
}
.rp-wrap.rp-theme-swiss-field .rp-card-head { font-weight: 700; letter-spacing: 0.06em; }
.rp-wrap.rp-theme-swiss-field .rp-task-label { font-weight: 400; }

/* ── 瑞士 · 分栏：顶部墨线 + 栏间细线 ── */
.rp-theme-swiss-column {
  position: relative;
  color: #111111;
  --rt-canvas: #f2efe9;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #111111;
  --rt-tab-on-fg: #F2EFE9;
  --rt-card-bg: transparent;
  --rt-card-edge: rgba(17,17,17,0.35);
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: transparent;
  --rt-inp-fg: #111111;
  --rt-inp-edge: #111111;
  --rt-radio: #111111;
  --rt-radio-checked: #DA291C;
  --rt-accent: #DA291C;
  --rt-row-rule: rgba(17,17,17,0.16);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.35);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #111111;
  --rt-btn-on-fg: #F2EFE9;
}
.rp-wrap.rp-theme-swiss-column .rp-title { font-weight: 700; letter-spacing: -0.02em; }
.rp-theme-swiss-column .rp-cards-row { position: relative; }
.rp-theme-swiss-column .rp-card { box-shadow: inset 0 0 0 1px rgba(17,17,17,0.35); }
.rp-wrap.rp-theme-swiss-column .rp-card-head { font-weight: 700; letter-spacing: 0.08em; box-shadow: inset 0 -1px 0 #111111; }
.rp-wrap.rp-theme-swiss-column .rp-task-label { font-weight: 400; }
.rp-theme-swiss-column .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }

/* ── 瑞士 · 海报：红色标题块 + 大留白 ── */
.rp-theme-swiss-poster {
  position: relative;
  color: #111111;
  --rt-canvas: #f2efe9;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: #DA291C;
  --rt-title-fg: #F2EFE9;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #111111;
  --rt-tab-on-fg: #F2EFE9;
  --rt-card-bg: transparent;
  --rt-card-edge: rgba(17,17,17,0.35);
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: transparent;
  --rt-inp-fg: #111111;
  --rt-inp-edge: #111111;
  --rt-radio: #111111;
  --rt-radio-checked: #DA291C;
  --rt-accent: #DA291C;
  --rt-row-rule: rgba(17,17,17,0.16);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.35);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #111111;
  --rt-btn-on-fg: #F2EFE9;
}
.rp-wrap.rp-theme-swiss-poster .rp-title { font-weight: 700; letter-spacing: -0.02em; }
.rp-wrap.rp-theme-swiss-poster .rp-card-head { font-weight: 700; letter-spacing: 0.1em; }
.rp-wrap.rp-theme-swiss-poster .rp-task-label { font-weight: 400; }
.rp-theme-swiss-poster .rp-card { box-shadow: inset 0 0 0 1px rgba(17,17,17,0.35); }

/* ── 瑞士 · 表格：横线分行、无竖线 ── */
.rp-theme-swiss-table {
  position: relative;
  color: #111111;
  --rt-canvas: #f2efe9;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #111111;
  --rt-tab-on-fg: #F2EFE9;
  --rt-card-bg: transparent;
  --rt-card-edge: transparent;
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: transparent;
  --rt-inp-fg: #111111;
  --rt-inp-edge: #111111;
  --rt-radio: #111111;
  --rt-radio-checked: #DA291C;
  --rt-accent: #DA291C;
  --rt-row-rule: rgba(17,17,17,0.22);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.35);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #111111;
  --rt-btn-on-fg: #F2EFE9;
}
.rp-wrap.rp-theme-swiss-table .rp-title { font-weight: 700; letter-spacing: -0.02em; }
.rp-theme-swiss-table .rp-card { border: none; box-shadow: inset 0 1px 0 #111111; }
.rp-theme-swiss-table .rp-card-head { border-bottom: 1px solid #111111; }
.rp-wrap.rp-theme-swiss-table .rp-card-head { font-weight: 700; letter-spacing: 0.06em; }
.rp-wrap.rp-theme-swiss-table .rp-task-label { font-weight: 400; }
.rp-theme-swiss-table .rp-task-row { border-bottom: 1px solid var(--rt-row-rule); }

/* ── 瑞士 · 黑白摄影：灰块 + 图注小字 ── */
.rp-theme-swiss-mono {
  position: relative;
  color: #111111;
  --rt-canvas: #efece5;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #111111;
  --rt-tab-on-fg: #EFECE5;
  --rt-card-bg: transparent;
  --rt-card-edge: rgba(17,17,17,0.3);
  --rt-head-bg: rgba(17,17,17,0.06);
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: transparent;
  --rt-inp-fg: #111111;
  --rt-inp-edge: #111111;
  --rt-radio: #111111;
  --rt-radio-checked: #DA291C;
  --rt-accent: #DA291C;
  --rt-row-rule: rgba(17,17,17,0.14);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.35);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #111111;
  --rt-btn-on-fg: #EFECE5;
}
.rp-wrap.rp-theme-swiss-mono .rp-title { font-weight: 700; letter-spacing: -0.01em; }
.rp-theme-swiss-mono .rp-card { box-shadow: inset 0 0 0 1px rgba(17,17,17,0.3), inset 0 28px 0 rgba(17,17,17,0.05); }
.rp-wrap.rp-theme-swiss-mono .rp-card-head { font-weight: 700; letter-spacing: 0.04em; }
.rp-wrap.rp-theme-swiss-mono .rp-task-label { font-weight: 400; }
.rp-theme-swiss-mono .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }

/* ── 瑞士 · 反白（暗）：墨底米白 + 红细线 ── */
.rp-theme-swiss-inverse {
  position: relative;
  color: #F2EFE9;
  --rt-canvas: #111111;
  --rt-ink: #F2EFE9;
  --rt-ink-dim: rgba(242,239,233,0.6);
  --rt-title-bg: transparent;
  --rt-title-fg: #F2EFE9;
  --rt-tab-edge: #F2EFE9;
  --rt-tab-fg: #F2EFE9;
  --rt-tab-on-bg: #F2EFE9;
  --rt-tab-on-fg: #111111;
  --rt-card-bg: transparent;
  --rt-card-edge: rgba(242,239,233,0.4);
  --rt-head-bg: transparent;
  --rt-head-fg: #F2EFE9;
  --rt-head-rule: rgba(242,239,233,0.7);
  --rt-meta-bg: transparent;
  --rt-meta-fg: #F2EFE9;
  --rt-meta-edge: rgba(242,239,233,0.55);
  --rt-meta-bar: transparent;
  --rt-inp-bg: transparent;
  --rt-inp-fg: #F2EFE9;
  --rt-inp-edge: rgba(242,239,233,0.55);
  --rt-radio: #F2EFE9;
  --rt-radio-checked: #DA291C;
  --rt-accent: #DA291C;
  --rt-row-rule: rgba(242,239,233,0.2);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(242,239,233,0.4);
  --rt-btn-edge: #F2EFE9;
  --rt-btn-on-bg: #F2EFE9;
  --rt-btn-on-fg: #111111;
}
.rp-wrap.rp-theme-swiss-inverse .rp-title { font-weight: 700; letter-spacing: -0.02em; }
.rp-theme-swiss-inverse .rp-title-row { position: relative; }
.rp-theme-swiss-inverse .rp-title-row::after {
  content: ''; position: absolute; left: 0; bottom: -4px;
  width: 40px; height: 3px; background: #DA291C; pointer-events: none;
}
.rp-theme-swiss-inverse .rp-card { box-shadow: inset 0 0 0 1px rgba(242,239,233,0.4); }
.rp-wrap.rp-theme-swiss-inverse .rp-card-head { font-weight: 700; letter-spacing: 0.08em; }
.rp-wrap.rp-theme-swiss-inverse .rp-task-label { font-weight: 400; }
.rp-theme-swiss-inverse .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }

/* ══════════════════════════════════════════════════════════════════
   风格派套（De Stijl / 新造型主义）
     粗黑线只能水平 / 垂直，把卡片切成大小不一的矩形；
     只用红 #D0302A / 黄 #EBC226 / 蓝 #1D3F8C + 黑 + 米白 #f4f1ea + 浅灰。
     全部平涂：没有渐变、没有阴影、没有纹理、没有圆角。
     字重只有 400 / 700（用 .rp-wrap. 前缀压过下面的字体基线）。
     不改布局：粗线与色块都走 inset 阴影或绝对定位伪元素。
   ══════════════════════════════════════════════════════════════════ */
/* ── 风格派 · 粗格：四边粗黑框 + 右上红块 + 卡片头粗线 ── */
.rp-theme-st-grid {
  position: relative;
  color: #111111;
  --rt-canvas: #f4f1ea;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #D0302A;
  --rt-tab-on-fg: #f4f1ea;
  --rt-card-bg: transparent;
  --rt-card-edge: #111111;
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: #f4f1ea;
  --rt-inp-fg: #111111;
  --rt-inp-edge: rgba(17,17,17,0.45);
  --rt-radio: #111111;
  --rt-radio-checked: #D0302A;
  --rt-accent: #D0302A;
  --rt-row-rule: #D8D4CB;
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.45);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #D0302A;
  --rt-btn-on-fg: #f4f1ea;
}
/* 字重只有 400 / 700（压过下面的字体基线） */
.rp-wrap.rp-theme-st-grid .rp-title { font-weight: 700; letter-spacing: -0.01em; }
.rp-wrap.rp-theme-st-grid .rp-card-head { font-weight: 700; letter-spacing: 0.04em; }
.rp-wrap.rp-theme-st-grid .rp-task-label { font-weight: 400; }
.rp-theme-st-grid .rp-card { box-shadow: inset 0 0 0 3px #111111; }
.rp-theme-st-grid .rp-card-head { box-shadow: inset 0 -4px 0 #111111; }
.rp-theme-st-grid .rp-card { position: relative; }
.rp-theme-st-grid .rp-card::after {
  content: ''; position: absolute; right: 0; top: 0;
  width: 14px; height: 14px; background: #D0302A; pointer-events: none;
}
.rp-theme-st-grid .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }


/* ── 风格派 · 色块：卡片头左侧黄块 + 右下红块，不套外框 ── */
.rp-theme-st-block {
  position: relative;
  color: #111111;
  --rt-canvas: #f4f1ea;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #D0302A;
  --rt-tab-on-fg: #f4f1ea;
  --rt-card-bg: transparent;
  --rt-card-edge: #111111;
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: #f4f1ea;
  --rt-inp-fg: #111111;
  --rt-inp-edge: rgba(17,17,17,0.45);
  --rt-radio: #111111;
  --rt-radio-checked: #D0302A;
  --rt-accent: #D0302A;
  --rt-row-rule: #D8D4CB;
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.45);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #D0302A;
  --rt-btn-on-fg: #f4f1ea;
}
/* 字重只有 400 / 700（压过下面的字体基线） */
.rp-wrap.rp-theme-st-block .rp-title { font-weight: 700; letter-spacing: -0.01em; }
.rp-wrap.rp-theme-st-block .rp-card-head { font-weight: 700; letter-spacing: 0.04em; }
.rp-wrap.rp-theme-st-block .rp-task-label { font-weight: 400; }
.rp-theme-st-block .rp-card { position: relative; box-shadow: inset 0 -3px 0 #111111; }
.rp-theme-st-block .rp-card-head { position: relative; }
.rp-theme-st-block .rp-card-head::before {
  content: ''; position: absolute; left: 0; top: calc(50% - 6px);
  width: 10px; height: 12px; background: #EBC226; pointer-events: none;
}
.rp-theme-st-block .rp-card::after {
  content: ''; position: absolute; right: 0; bottom: 0;
  width: 18px; height: 18px; background: #D0302A; pointer-events: none;
}
.rp-theme-st-block .rp-task-row { border-bottom: 1px solid var(--rt-row-rule); }


/* ── 风格派 · 粗线：上下两条粗黑线 + 左缘蓝条 ── */
.rp-theme-st-rule {
  position: relative;
  color: #111111;
  --rt-canvas: #f4f1ea;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #D0302A;
  --rt-tab-on-fg: #f4f1ea;
  --rt-card-bg: transparent;
  --rt-card-edge: #111111;
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: #f4f1ea;
  --rt-inp-fg: #111111;
  --rt-inp-edge: rgba(17,17,17,0.45);
  --rt-radio: #111111;
  --rt-radio-checked: #D0302A;
  --rt-accent: #D0302A;
  --rt-row-rule: #D8D4CB;
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.45);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #D0302A;
  --rt-btn-on-fg: #f4f1ea;
}
/* 字重只有 400 / 700（压过下面的字体基线） */
.rp-wrap.rp-theme-st-rule .rp-title { font-weight: 700; letter-spacing: -0.01em; }
.rp-wrap.rp-theme-st-rule .rp-card-head { font-weight: 700; letter-spacing: 0.04em; }
.rp-wrap.rp-theme-st-rule .rp-task-label { font-weight: 400; }
.rp-theme-st-rule .rp-card { box-shadow: inset 0 3px 0 #111111, inset 0 -3px 0 #111111; }
.rp-theme-st-rule .rp-card-head { box-shadow: inset 5px 0 0 #1D3F8C; }
.rp-theme-st-rule .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }


/* ── 风格派 · 角块：左上红角 + 右下黄角 + 细黑框 ── */
.rp-theme-st-corner {
  position: relative;
  color: #111111;
  --rt-canvas: #f4f1ea;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #D0302A;
  --rt-tab-on-fg: #f4f1ea;
  --rt-card-bg: transparent;
  --rt-card-edge: #111111;
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: #f4f1ea;
  --rt-inp-fg: #111111;
  --rt-inp-edge: rgba(17,17,17,0.45);
  --rt-radio: #111111;
  --rt-radio-checked: #D0302A;
  --rt-accent: #D0302A;
  --rt-row-rule: #D8D4CB;
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.45);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #D0302A;
  --rt-btn-on-fg: #f4f1ea;
}
/* 字重只有 400 / 700（压过下面的字体基线） */
.rp-wrap.rp-theme-st-corner .rp-title { font-weight: 700; letter-spacing: -0.01em; }
.rp-wrap.rp-theme-st-corner .rp-card-head { font-weight: 700; letter-spacing: 0.04em; }
.rp-wrap.rp-theme-st-corner .rp-task-label { font-weight: 400; }
.rp-theme-st-corner .rp-card { position: relative; box-shadow: inset 0 0 0 1px #111111; }
.rp-theme-st-corner .rp-card::before {
  content: ''; position: absolute; left: 0; top: 0;
  width: 10px; height: 10px; background: #D0302A; pointer-events: none;
}
.rp-theme-st-corner .rp-card::after {
  content: ''; position: absolute; right: 0; bottom: 0;
  width: 10px; height: 10px; background: #EBC226; pointer-events: none;
}
.rp-theme-st-corner .rp-task-row { border-bottom: 1px solid var(--rt-row-rule); }


/* ── 风格派 · 横带：卡片头整宽黄带 + 红短线收口 ── */
.rp-theme-st-band {
  position: relative;
  color: #111111;
  --rt-canvas: #f4f1ea;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #D0302A;
  --rt-tab-on-fg: #f4f1ea;
  --rt-card-bg: transparent;
  --rt-card-edge: #111111;
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: #f4f1ea;
  --rt-inp-fg: #111111;
  --rt-inp-edge: rgba(17,17,17,0.45);
  --rt-radio: #111111;
  --rt-radio-checked: #D0302A;
  --rt-accent: #D0302A;
  --rt-row-rule: #D8D4CB;
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.45);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #D0302A;
  --rt-btn-on-fg: #f4f1ea;
}
/* 字重只有 400 / 700（压过下面的字体基线） */
.rp-wrap.rp-theme-st-band .rp-title { font-weight: 700; letter-spacing: -0.01em; }
.rp-wrap.rp-theme-st-band .rp-card-head { font-weight: 700; letter-spacing: 0.04em; }
.rp-wrap.rp-theme-st-band .rp-task-label { font-weight: 400; }
.rp-theme-st-band .rp-card-head { background: #EBC226; color: #111111; box-shadow: inset 0 -3px 0 #111111; }
.rp-theme-st-band .rp-card { position: relative; }
.rp-theme-st-band .rp-card::before {
  content: ''; position: absolute; left: 0; bottom: 0;
  width: 34px; height: 3px; background: #D0302A; pointer-events: none;
}
.rp-theme-st-band .rp-task-row { border-bottom: 1px solid var(--rt-row-rule); }


/* ── 风格派 · 竖栏：右侧蓝栏 + 竖粗线 ── */
.rp-theme-st-column {
  position: relative;
  color: #111111;
  --rt-canvas: #f4f1ea;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #D0302A;
  --rt-tab-on-fg: #f4f1ea;
  --rt-card-bg: transparent;
  --rt-card-edge: #111111;
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: #f4f1ea;
  --rt-inp-fg: #111111;
  --rt-inp-edge: rgba(17,17,17,0.45);
  --rt-radio: #111111;
  --rt-radio-checked: #D0302A;
  --rt-accent: #D0302A;
  --rt-row-rule: #D8D4CB;
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.45);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #D0302A;
  --rt-btn-on-fg: #f4f1ea;
}
/* 字重只有 400 / 700（压过下面的字体基线） */
.rp-wrap.rp-theme-st-column .rp-title { font-weight: 700; letter-spacing: -0.01em; }
.rp-wrap.rp-theme-st-column .rp-card-head { font-weight: 700; letter-spacing: 0.04em; }
.rp-wrap.rp-theme-st-column .rp-task-label { font-weight: 400; }
.rp-theme-st-column .rp-card { box-shadow: inset -16px 0 0 #1D3F8C, inset -18px 0 0 #111111; }
.rp-theme-st-column .rp-card-head { box-shadow: inset 0 -2px 0 #111111; }
.rp-theme-st-column .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }


/* ── 风格派 · 方块字母：标题前三色小方块 + 标题下粗线 ── */
.rp-theme-st-letter {
  position: relative;
  color: #111111;
  --rt-canvas: #f4f1ea;
  --rt-ink: #111111;
  --rt-ink-dim: rgba(17,17,17,0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #111111;
  --rt-tab-edge: #111111;
  --rt-tab-fg: #111111;
  --rt-tab-on-bg: #D0302A;
  --rt-tab-on-fg: #f4f1ea;
  --rt-card-bg: transparent;
  --rt-card-edge: #111111;
  --rt-head-bg: transparent;
  --rt-head-fg: #111111;
  --rt-head-rule: #111111;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #111111;
  --rt-meta-edge: #111111;
  --rt-meta-bar: transparent;
  --rt-inp-bg: #f4f1ea;
  --rt-inp-fg: #111111;
  --rt-inp-edge: rgba(17,17,17,0.45);
  --rt-radio: #111111;
  --rt-radio-checked: #D0302A;
  --rt-accent: #D0302A;
  --rt-row-rule: #D8D4CB;
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(17,17,17,0.45);
  --rt-btn-edge: #111111;
  --rt-btn-on-bg: #D0302A;
  --rt-btn-on-fg: #f4f1ea;
}
/* 字重只有 400 / 700（压过下面的字体基线） */
.rp-wrap.rp-theme-st-letter .rp-title { font-weight: 700; letter-spacing: -0.01em; }
.rp-wrap.rp-theme-st-letter .rp-card-head { font-weight: 700; letter-spacing: 0.04em; }
.rp-wrap.rp-theme-st-letter .rp-task-label { font-weight: 400; }
.rp-theme-st-letter .rp-title-row { position: relative; }
.rp-theme-st-letter .rp-title-row::after {
  content: ''; position: absolute; left: 0; bottom: -4px;
  width: 100%; height: 4px; background: #111111; pointer-events: none;
}
.rp-theme-st-letter .rp-title { position: relative; }
.rp-theme-st-letter .rp-title::before {
  content: ''; position: absolute; right: 0; top: 0.18em;
  width: 8px; height: 8px; background: #1D3F8C;
  box-shadow: -9px 0 0 #EBC226, -18px 0 0 #D0302A;
}
.rp-theme-st-letter .rp-card { box-shadow: inset 0 0 0 1px #111111; }
.rp-theme-st-letter .rp-task-row { border-bottom: 1px solid var(--rt-row-rule); }


/* ── 风格派 · 反白（暗）：黑底米白粗线 + 三色条 ── */
.rp-theme-st-inverse {
  position: relative;
  color: #f4f1ea;
  --rt-canvas: #111111;
  --rt-ink: #f4f1ea;
  --rt-ink-dim: rgba(244,241,234,0.6);
  --rt-title-bg: transparent;
  --rt-title-fg: #f4f1ea;
  --rt-tab-edge: rgba(244,241,234,0.65);
  --rt-tab-fg: #f4f1ea;
  --rt-tab-on-bg: #D0302A;
  --rt-tab-on-fg: #f4f1ea;
  --rt-card-bg: #191919;
  --rt-card-edge: rgba(244,241,234,0.65);
  --rt-head-bg: #0b0b0b;
  --rt-head-fg: #f4f1ea;
  --rt-head-rule: rgba(244,241,234,0.65);
  --rt-meta-bg: #191919;
  --rt-meta-fg: #f4f1ea;
  --rt-meta-edge: rgba(244,241,234,0.65);
  --rt-meta-bar: transparent;
  --rt-inp-bg: #232323;
  --rt-inp-fg: #f4f1ea;
  --rt-inp-edge: rgba(244,241,234,0.35);
  --rt-radio: #f4f1ea;
  --rt-radio-checked: #D0302A;
  --rt-accent: #D0302A;
  --rt-row-rule: rgba(244,241,234,0.18);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(244,241,234,0.35);
  --rt-btn-edge: rgba(244,241,234,0.65);
  --rt-btn-on-bg: #D0302A;
  --rt-btn-on-fg: #f4f1ea;
}
/* 字重只有 400 / 700（压过下面的字体基线） */
.rp-wrap.rp-theme-st-inverse .rp-title { font-weight: 700; letter-spacing: -0.01em; }
.rp-wrap.rp-theme-st-inverse .rp-card-head { font-weight: 700; letter-spacing: 0.04em; }
.rp-wrap.rp-theme-st-inverse .rp-task-label { font-weight: 400; }
.rp-theme-st-inverse .rp-card { box-shadow: inset 0 0 0 3px #f4f1ea; }
.rp-theme-st-inverse .rp-card-head { box-shadow: inset 0 -4px 0 #f4f1ea; }
.rp-theme-st-inverse .rp-card { position: relative; }
.rp-theme-st-inverse .rp-card::after {
  content: ''; position: absolute; right: 0; top: 0;
  width: 12px; height: 12px; background: #D0302A;
  box-shadow: -12px 0 0 #EBC226, -12px 12px 0 #1D3F8C; pointer-events: none;
}
.rp-theme-st-inverse .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }


/* ══════════════════════════════════════════════════════════════════
   汇报字体基线：全部主题沿用 P3R 那套排印
     重标题（900 + 负字距）、重卡片头、任务名加粗、数字等宽。
   只改字重 / 字距 / 数字排法，不动字号与行高（导出尺寸不变）。
   ══════════════════════════════════════════════════════════════════ */
.rp-wrap .rp-title { font-weight: 900; }
.rp-wrap .rp-card-head { font-weight: 900; }
.rp-wrap .rp-task-label { font-weight: 700; }
.rp-wrap .rp-inp { font-weight: 800; font-variant-numeric: tabular-nums; }
/* 信息栏里的输入框（托管天数 / 日期）统一到 P3R 的 900 —— classic 没有自己的主题规则，
   这里兜住；各 .rp-theme-* 的同名规则也都已经是 900。 */
.rp-wrap .rp-meta .rp-inp { font-weight: 900; }
.rp-wrap .rp-meta,
.rp-wrap .rp-lines,
.rp-wrap .rp-quick-btn { font-variant-numeric: tabular-nums; }

/* ══════════════════════════════════════════════════════════════════
   瑞士风格 · 国际主义平面设计（Swiss Style）
     只有三种颜色：墨 #161616 / 米白 #F2EFE9 / 强调红 #DA291C；全部平涂。
     字重**只用 400 与 700 两档**（这套风格不做 900）——
     所以下面的规则都带 `.rp-wrap.` 前缀，特异性高过上面的字体基线。
     分区只用 1px 细线；红色只做编号与强调。
     不改布局：没有 padding / margin / 宽高 / 字号，只动颜色、边框、
     字重、小字距与不占布局的伪元素。
   ══════════════════════════════════════════════════════════════════ */

/* ── 瑞士 · 网格版式（米白纸面 + 12 栏细线）── */
.rp-theme-swiss-rule {
  position: relative;
  color: #161616;
  --rt-ink: #161616;
  --rt-ink-dim: rgba(22, 22, 22, 0.55);
  --rt-title-bg: transparent;
  --rt-title-fg: #161616;
  --rt-tab-edge: #161616;
  --rt-tab-fg: #161616;
  --rt-tab-on-bg: #161616;
  --rt-tab-on-fg: #F2EFE9;
  --rt-card-bg: transparent;
  --rt-card-edge: rgba(22, 22, 22, 0.35);
  --rt-head-bg: transparent;
  --rt-head-fg: #161616;
  --rt-head-rule: #161616;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #161616;
  --rt-meta-edge: #161616;
  --rt-meta-bar: transparent;
  --rt-inp-bg: transparent;
  --rt-inp-fg: #161616;
  --rt-inp-edge: #161616;
  --rt-radio: #161616;
  --rt-radio-checked: #DA291C;
  --rt-accent: #DA291C;
  --rt-row-rule: rgba(22, 22, 22, 0.16);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(22, 22, 22, 0.35);
  --rt-btn-edge: #161616;
  --rt-btn-on-bg: #161616;
  --rt-btn-on-fg: #F2EFE9;
}
/* 标题：粗体 + 紧字距（不改字号）；红色编号 01 绝对定位在标题上方 */
.rp-wrap.rp-theme-swiss-rule .rp-title { font-weight: 700; letter-spacing: -0.02em; }
.rp-theme-swiss-rule .rp-title-row { position: relative; }
.rp-theme-swiss-rule .rp-title-row::before {
  content: '01';
  position: absolute;
  left: 0; top: -9px;
  font-size: 8px;
  line-height: 1;
  letter-spacing: 0.1em;
  color: #DA291C;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
/* 信息栏：只留一条细线（上下各 1px），不是色块 */
.rp-theme-swiss-rule .rp-meta {
  font-weight: 400;
  letter-spacing: 0.02em;
  box-shadow: inset 0 -1px 0 #161616;
}
.rp-wrap.rp-theme-swiss-rule .rp-meta .rp-inp { font-weight: 700; }
/* 卡片头：粗体 + 极细线收口 + 红色编号 */
.rp-wrap.rp-theme-swiss-rule .rp-card-head {
  font-weight: 700;
  letter-spacing: 0.08em;
  box-shadow: inset 0 -1px 0 #161616;
}
.rp-theme-swiss-rule .rp-card { box-shadow: inset 0 0 0 1px rgba(22, 22, 22, 0.35); }
.rp-wrap.rp-theme-swiss-rule .rp-task-label { font-weight: 400; letter-spacing: 0.01em; }
.rp-theme-swiss-rule .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }
.rp-theme-swiss-rule .rp-single-on,
.rp-theme-swiss-rule .rp-radio-box { border-radius: 0; }
.rp-theme-swiss-rule .rp-inp { border-radius: 0; }

/* ── 瑞士 · 索引版式（墨底米白，红色仍是唯一强调）── */
.rp-theme-swiss-index {
  position: relative;
  color: #F2EFE9;
  --rt-ink: #F2EFE9;
  --rt-ink-dim: rgba(242, 239, 233, 0.6);
  /* 暗色主题：缩略图用墨底，一眼看出它要配深色画布 */
  --rt-canvas: #111111;
  --rt-title-bg: transparent;
  --rt-title-fg: #F2EFE9;
  --rt-tab-edge: #F2EFE9;
  --rt-tab-fg: #F2EFE9;
  --rt-tab-on-bg: #F2EFE9;
  --rt-tab-on-fg: #111111;
  --rt-card-bg: transparent;
  --rt-card-edge: rgba(242, 239, 233, 0.4);
  --rt-head-bg: transparent;
  --rt-head-fg: #F2EFE9;
  --rt-head-rule: #F2EFE9;
  --rt-meta-bg: transparent;
  --rt-meta-fg: #F2EFE9;
  --rt-meta-edge: rgba(242, 239, 233, 0.55);
  --rt-meta-bar: transparent;
  --rt-inp-bg: transparent;
  --rt-inp-fg: #F2EFE9;
  --rt-inp-edge: rgba(242, 239, 233, 0.55);
  --rt-radio: #F2EFE9;
  --rt-radio-checked: #DA291C;
  --rt-accent: #DA291C;
  --rt-row-rule: rgba(242, 239, 233, 0.2);
  --rt-row-alt: transparent;
  --rt-img-edge: rgba(242, 239, 233, 0.4);
  --rt-btn-edge: #F2EFE9;
  --rt-btn-on-bg: #F2EFE9;
  --rt-btn-on-fg: #111111;
}
.rp-wrap.rp-theme-swiss-index .rp-title { font-weight: 700; letter-spacing: -0.02em; }
.rp-theme-swiss-index .rp-title-row { position: relative; }
.rp-theme-swiss-index .rp-title-row::before {
  content: '01';
  position: absolute;
  left: 0; top: -9px;
  font-size: 8px;
  line-height: 1;
  letter-spacing: 0.1em;
  color: #DA291C;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
.rp-theme-swiss-index .rp-meta {
  font-weight: 400;
  letter-spacing: 0.02em;
  box-shadow: inset 0 -1px 0 rgba(242, 239, 233, 0.6);
}
.rp-wrap.rp-theme-swiss-index .rp-meta .rp-inp { font-weight: 700; }
.rp-wrap.rp-theme-swiss-index .rp-card-head {
  font-weight: 700;
  letter-spacing: 0.08em;
  box-shadow: inset 0 -1px 0 #F2EFE9;
}
.rp-theme-swiss-index .rp-card { box-shadow: inset 0 0 0 1px rgba(242, 239, 233, 0.4); }
.rp-wrap.rp-theme-swiss-index .rp-task-label { font-weight: 400; letter-spacing: 0.01em; }
.rp-theme-swiss-index .rp-task-row { box-shadow: inset 0 -1px 0 var(--rt-row-rule); }
.rp-theme-swiss-index .rp-single-on,
.rp-theme-swiss-index .rp-radio-box { border-radius: 0; }
.rp-theme-swiss-index .rp-inp { border-radius: 0; }

</style>
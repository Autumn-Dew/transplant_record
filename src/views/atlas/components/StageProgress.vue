<script setup>
/**
 * 一次性资源进度：章节卡片
 *
 * 每个章节一张卡，卡片网格排布（一行 5~7 张）。
 * 卡片收起时只看「名称 + 已打/总数 + 百分比 + 进度条」，
 * 点卡片就地展开成整行的关卡格子 —— 不用弹层，也不占地方。
 */
import { ref, computed } from 'vue';

const props = defineProps({
  chapters: { type: Array, default: () => [] },   // [{ id, name, color, note, stages: [{ id, name, stones }] }]
  cleared: { type: Object, default: () => ({}) }, // { stageId: true }
  unit: { type: String, default: '颗' },
});
const emit = defineEmits(['toggle', 'chapter']);

const detailId = ref('')   // 侧栏里正在看的章节
const rangeAnchor = ref('')   // 右键选范围时的起点卡片 id
const rangeMode = ref('select')   // select = 范围内全选 / clear = 范围内全不选

const doneCount = chapter => chapter.stages.filter(s => props.cleared[s.id]).length;
const totalStones = chapter => chapter.stages.reduce((n, s) => n + s.stones, 0);
const doneStones = chapter => chapter.stages.filter(s => props.cleared[s.id]).reduce((n, s) => n + s.stones, 0);
const pctOf = (done, all) => (all > 0 ? Math.round((done / all) * 100) : 0);
const isAllDone = chapter => doneCount(chapter) === chapter.stages.length;

const visible = computed(() => props.chapters);

/** 左键：本章全选 ⇄ 全不选 */
function toggleAll(chapter) {
  const ids = chapter.stages.map(stage => stage.id);
  const allDone = ids.every(id => props.cleared[id]);
  emit('chapter', ids, !allDone);
}

/**
 * 右键：第一次标记起点，第二次对两张卡之间的所有卡片批量操作。
 * 起点卡片已经全选 → 这次为「范围全不选」；否则为「范围全选」。
 */
function pickRange(chapter) {
  if (!rangeAnchor.value) {
    rangeAnchor.value = chapter.id;
    rangeMode.value = isAllDone(chapter) ? 'clear' : 'select';
    return;
  }
  if (rangeAnchor.value === chapter.id) { rangeAnchor.value = ''; return }
  const list = visible.value;
  const from = list.findIndex(ch => ch.id === rangeAnchor.value);
  const to = list.findIndex(ch => ch.id === chapter.id);
  if (from < 0 || to < 0) { rangeAnchor.value = ''; return }
  const [start, end] = from <= to ? [from, to] : [to, from];
  const ids = list.slice(start, end + 1).flatMap(ch => ch.stages.map(stage => stage.id));
  emit('chapter', ids, rangeMode.value === 'select');
  rangeAnchor.value = '';
}

function openDetail(id) {
  detailId.value = detailId.value === id ? '' : id;
}

const detailChapter = computed(() => props.chapters.find(ch => ch.id === detailId.value) || null);
</script>

<template>
  <div class="stage-wrap">
    <div v-if="rangeAnchor" class="stage-note" :class="{ clearing: rangeMode === 'clear' }">
      {{ rangeMode === 'select' ? '已选起点（全选），右键另一张卡片的「全」完成范围全选' : '已选起点（全不选），右键另一张卡片的「全」清空范围' }}
    </div>

    <div class="stage-grid">
      <article
        v-for="ch in visible"
        :key="ch.id"
        class="stage-card"
        :class="{ 'all-done': isAllDone(ch) }"
        @contextmenu.prevent="pickRange(ch)"
      >
        <!-- 右上角「全」：左键全选/全不选，右键选范围 -->
        <button
          type="button"
          class="sc-all"
          :class="{ active: isAllDone(ch), armed: rangeAnchor === ch.id }"
          :title="rangeAnchor === ch.id ? '已选起点，右键另一张卡片完成范围' : '左键：全选 / 全不选　右键：选范围起点'"
          @click.stop="toggleAll(ch)"
          @contextmenu.prevent.stop="pickRange(ch)"
        >全</button>

        <!-- 卡片面：点一下展开 / 收起 -->
        <button class="sc-face" :aria-expanded="detailId === ch.id" @click="openDetail(ch.id)">
          <span class="sc-top">
            <b class="sc-name" :title="ch.name">{{ ch.name }}</b>
          </span>
          <span class="sc-mid">
            <span class="sc-count">{{ doneCount(ch) }}<em>/{{ ch.stages.length }}</em></span>
            <span class="sc-pct">{{ pctOf(doneStones(ch), totalStones(ch)) }}%</span>
          </span>
          <span class="sc-bar" aria-hidden="true">
            <i :style="{ width: pctOf(doneStones(ch), totalStones(ch)) + '%' }"></i>
          </span>
        </button>

      </article>
    <!-- 章节详情侧栏 -->
    <div v-if="detailChapter" class="ed-mask" @click.self="detailId = ''">
      <aside class="ed-drawer" role="dialog" aria-modal="true">
        <header class="ed-head">
          <div>
            <p class="eyebrow">// CHAPTER
            </p>
            <h3>{{ detailChapter.name }}</h3>
          </div>
          <button type="button" class="ed-close" title="关闭" @click="detailId = ''">✕</button>
        </header>
        <div class="ed-body">
          <div class="dc-stat">
            <strong>{{ doneCount(detailChapter) }}</strong>
            <span class="dc-of">/ {{ detailChapter.stages.length }} 关</span>
            <em>{{ pctOf(doneStones(detailChapter), totalStones(detailChapter)) }}%</em>
          </div>
          <div class="dc-bar" aria-hidden="true">
            <i :style="{ width: pctOf(doneStones(detailChapter), totalStones(detailChapter)) + '%' }"></i>
          </div>
          <div class="dc-ops">
            <button type="button" class="dc-btn" :disabled="isAllDone(detailChapter)" @click="emit('chapter', detailChapter.stages.map(x => x.id), true)">全选本章</button>
            <button type="button" class="dc-btn" :disabled="!doneCount(detailChapter)" @click="emit('chapter', detailChapter.stages.map(x => x.id), false)">全清本章</button>
            <span class="dc-hint">点格子切换已打 / 未打</span>
          </div>
          <div class="st-grid">
            <button
              v-for="stage in detailChapter.stages"
              :key="stage.id"
              class="st-cell st-cell-gain"
              :class="{ cleared: !!cleared[stage.id] }"
              :title="`${stage.name} · ${stage.gains || '无产出'}${cleared[stage.id] ? ' · 已打' : ' · 未打'}（点击切换）`"
              @click="emit('toggle', stage.id)"
            >
              <b class="st-name">{{ stage.name }}</b>
              <span class="st-gain">{{ stage.gains || '—' }}</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
    </div>
  </div>
</template>

<style scoped>
.stage-wrap { padding: 8px 12px 12px; }

.stage-note {
  font-family: var(--font-mono); font-size: 9px; opacity: .45;
  padding: 0 0 6px;
}

/* 卡片网格：一行 5~7 张 */
.stage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 4px;
  align-items: start;
}

.stage-card {
  border: 1px solid var(--rule);
  background: var(--panel);
  min-width: 0;
  transition: border-color .14s;
}
.stage-card:hover { border-color: var(--accent); }
/* 全选：卡片底色 / 边框 / 百分比都不动，只有进度条换色 */
.stage-card.all-done .sc-bar > i { background-color: var(--state-done); }
.stage-card.open { grid-column: 1 / -1; border-color: var(--accent); }

/* 卡片面 */
.sc-face {
  display: grid; gap: 2px;
  width: 100%; padding: 4px 6px 5px;
  border: 0; background: none; color: inherit;
  text-align: left; cursor: pointer;
  font-family: var(--font-mono);
}
/* 右上角「全」：绝对定位，不参与卡片排版 */
.sc-all {
  position: absolute; top: 2px; right: 2px; z-index: 2;
  width: 17px; height: 17px; padding: 0;
  display: grid; place-items: center;
  border: 1px solid color-mix(in srgb, var(--text-primary) 32%, transparent);
  background-color: transparent;
  color: var(--muted);
  font-family: var(--font-mono); font-size: 9px; font-weight: 600; line-height: 1;
  cursor: pointer; opacity: .5;
}
.stage-card:hover .sc-all { opacity: .9; }
.sc-all:hover {
  opacity: 1; border-color: var(--accent); color: var(--accent);
  background-color: var(--hover-bg);
}
/* 已全选：实心强调色 + 外发光 */
.sc-all.active {
  background-color: var(--accent); border-color: var(--accent);
  color: var(--accent-ink); font-weight: 800; opacity: 1;
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--accent) 45%, transparent);
}
.sc-all.active:hover { filter: brightness(1.12); }
/* 范围起点：绿环 */
.sc-all.armed {
  border-color: var(--state-done); color: var(--state-done); opacity: 1;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--state-done) 45%, transparent);
}
.sc-all.armed.active {
  background-color: var(--state-done); border-color: var(--state-done); color: var(--accent-ink);
}

.sc-top { display: flex; align-items: center; gap: 5px; min-width: 0; }
.sc-name {
  font-size: 10px; font-weight: 700; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.sc-mid { display: flex; align-items: baseline; gap: 5px; }
.sc-count { font-size: 14px; font-weight: 800; line-height: 1.1; color: var(--text-primary); }
.sc-count > em { font-size: 9px; font-weight: 600; font-style: normal; opacity: .5; }
.sc-pct { margin-left: auto; font-size: 9px; font-weight: 700; opacity: .75; }

.sc-bar { display: block; height: 2px; background: var(--bg-primary); overflow: hidden; }
.sc-bar > i { display: block; height: 100%; background: var(--accent); transition: width .18s; }


/* 展开区 */
.sc-stages { padding: 0 8px 8px; border-top: 1px solid var(--rule); }
.sc-stages-head {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 0 4px;
  font-family: var(--font-mono); font-size: 9px;
}
.sc-hint { opacity: .45; }
.sc-actions { display: flex; gap: 4px; margin-left: auto; }
.sc-btn {
  height: 17px; padding: 0 6px; cursor: pointer;
  border: 1px solid var(--rule); background: var(--panel);
  color: var(--text-primary); font-family: var(--font-mono); font-size: 9px;
}
.sc-btn:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: var(--accent-ink, #fff); }
.sc-btn:disabled { opacity: .3; cursor: default; }

/* 关卡格子 */
.st-grid { display: flex; flex-wrap: wrap; gap: 3px; }
.st-cell {
  min-width: 40px; height: 20px; padding: 0 5px; cursor: pointer;
  border: 1px solid var(--rule); background: var(--bg-primary);
  color: var(--text-primary); opacity: .5;
  font-family: var(--font-mono); font-size: 10px; line-height: 1;
  transition: background .12s, opacity .12s, border-color .12s;
}
.st-cell:hover { border-color: var(--accent); opacity: .95; }
.st-cell.cleared {
  background: var(--accent); border-color: var(--accent);
  color: var(--accent-ink, #fff); opacity: 1; font-weight: 700;
}


/* 侧栏关卡格子：两行写清收益 */
.st-cell-gain {
  display: grid; gap: 1px; align-content: center;
  min-width: 78px; height: 34px; padding: 2px 6px;
  text-align: left; line-height: 1.15;
}
.st-cell-gain .st-name { font-size: 11px; font-weight: 700; }
.st-cell-gain .st-gain {
  font-size: 9px; opacity: .6; font-weight: 400;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.st-cell-gain.cleared .st-gain { opacity: .85; }

</style>

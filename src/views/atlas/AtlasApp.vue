<script setup>
/**
 * 资源账簿 —— 一次性资源清单
 *
 * 玩家视角的口径：
 *   · 只统计「一次性」资源（主线 / 活动 / 剿灭 / 磨难 / 险地……）
 *   · 可重复刷取的产出（CE-6、LS-6、基建）不统计
 *   · 进度按关卡标记：每关一个格子，点一下切换已打 / 未打
 *   · 统计 = 只累加「已打」关卡的产出，且只算「显示中」的章节
 *
 * 游戏目录与主应用「数据管理 → 游戏与服务」共用同一个数据源（gamesRepo），
 * 所以主应用里新增/归档游戏，这里会跟着变。
 */
import './styles/tokens.css'
import './styles/app.css'
import { ref, computed, onMounted } from 'vue'
import { buildEmptySnapshot, DEMO_DEFAULT_HIDDEN } from './data/demo.js'
import GameTabs from './components/GameTabs.vue'
import StageProgress from './components/StageProgress.vue'
import SourceEditor from './components/SourceEditor.vue'
import { migrateSnapshot } from './core/migrate.js'
import { formatNumber, fullNumber } from './core/ledger.js'
import { gamesRepo } from '@/data/repos.js'

const STORAGE_KEY = 'atlas.snapshot'
const HIDDEN_KEY = 'atlas.hidden'
const CLEARED_KEY = 'atlas.cleared'

const emit = defineEmits(['version'])

const snapshot = ref(null)
const loading = ref(true)
const introDone = ref(false)   // 入场动画结束后置 true，撤掉 animation 兜底
const section = ref('overview')
const gameId = ref('')
const cleared = ref({})
const hiddenTypes = ref({})
const importRef = ref(null)
const storageError = ref('')
const toastMessage = ref('')
const detailResource = ref(null)
let toastTimer

const TOP_RESOURCE_NAMES = ['源石', '龙门币', '合成玉', '采购凭证']

// ── 数据读写 ──
/**
 * 换了一份账簿之后重新定位当前游戏：
 * 优先挑「账簿里有数据、主应用里也存在」的那个（gameId 存的是主应用 id）。
 */
function pickGameAfterLoad(nextSnapshot) {
  const books = nextSnapshot?.games || [];
  const appList = (gamesRepo.state.value || []).filter(g => !g.archived);
  const withBook = appList.find(g => books.some(b => b.name === g.name || b.id === g.id));
  return (withBook || appList[0] || {}).id || books[0]?.id || '';
}
function loadSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrateSnapshot(JSON.parse(raw)).snapshot
  } catch (e) {
    storageError.value = '本地数据损坏，已回退到示例数据：' + e.message
  }
  return migrateSnapshot(buildEmptySnapshot()).snapshot
}

function loadHidden() {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* 读坏了就走默认 */ }
  const initial = {}
  const game0 = snapshot.value?.games?.[0]
  if (game0) {
    for (const type of game0.sourceTypes) {
      if (DEMO_DEFAULT_HIDDEN.includes(type.name)) initial[type.id] = true
    }
  }
  return initial
}

function loadCleared() {
  try {
    const raw = localStorage.getItem(CLEARED_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot.value))
    emit('version', snapshot.value.version || '')
    storageError.value = ''
  } catch (e) {
    storageError.value = '保存失败：' + e.message
  }
}

function persistCleared(next) {
  try { localStorage.setItem(CLEARED_KEY, JSON.stringify(next)) } catch (e) {
    toast('标记保存失败：' + e.message)
  }
}

onMounted(() => {
  snapshot.value = loadSnapshot()
  cleared.value = loadCleared()
  hiddenTypes.value = loadHidden()
  emit('version', snapshot.value.version || '')

  gameId.value = pickGameAfterLoad(snapshot.value);

  loading.value = false
  // 入场动画总时长约 0.5s + stagger；到点后撤掉 animation，避免环境暂停导致卡帧
  setTimeout(() => { introDone.value = true }, 900)
})

// ── 派生的游戏与章节 ──
const appGames = computed(() => (gamesRepo.state.value || [])
  .filter(g => !g.archived)
  .map(g => ({
    id: g.id,
    name: g.name,
    hasData: !!(snapshot.value?.games || []).some(sg => sg.name === g.name || sg.id === g.id),
  })))

const game = computed(() => {
  const list = snapshot.value?.games || [];
  if (!gameId.value) return list[0] || null;
  // gameId 是主应用「游戏与服务」里的 id（如 ak），账簿里存的可能是 name（明日方舟），
  // 两边都要试；找不到就代表这本账簿没有这个游戏，不能回退到 list[0]。
  const appGame = (gamesRepo.state.value || []).find(g => g.id === gameId.value);
  const keys = [gameId.value, appGame?.name].filter(Boolean);
  return list.find(g => keys.includes(g.id) || keys.includes(g.name)) || null;
});

const chapters = computed(() => {
  const g = game.value
  if (!g) return []
  return g.sourceTypes
    .map(t => {
      const stages = g.sources
        .filter(src => src.typeId === t.id)
        .map(src => ({
          id: src.id,
          name: src.name,
          stones: src.grants.reduce((n, gr) => n + (gr.amount || 0), 0),
          gains: src.grants
            .map(gr => {
              const res = g.resources.find(r => r.id === gr.resourceId)
              return (res ? res.name : gr.resourceId) + ' ' + formatNumber(gr.amount)
            })
            .join(' · '),
        }))
      return { id: t.id, name: t.name, color: t.color, note: t.note, stages }
    })
    .filter(c => c.stages.length && !hiddenTypes.value[c.id])
})

const allStageIds = computed(() => chapters.value.flatMap(c => c.stages.map(s => s.id)))

const stoneStats = computed(() => {
  const g = game.value
  if (!g) return []
  const visibleTypes = new Set(chapters.value.map(ch => ch.id))
  return g.resources
    .map(r => {
      let total = 0
      let got = 0
      for (const src of g.sources) {
        if (!visibleTypes.has(src.typeId)) continue
        const amount = src.grants
          .filter(gr => gr.resourceId === r.id)
          .reduce((n, gr) => n + (gr.amount || 0), 0)
        total += amount
        if (cleared.value[src.id]) got += amount
      }
      return {
        id: r.id, name: r.name, unit: r.unit || '', color: r.color,
        total, got, pct: total > 0 ? Math.round((got / total) * 100) : 0,
      }
    })
    .filter(st => st.total > 0)
    .sort((a, b) => {
      if (a.id === 'r-op') return -1
      if (b.id === 'r-op') return 1
      return b.total - a.total
    })
})

const topStats = computed(() => stoneStats.value.filter(st => TOP_RESOURCE_NAMES.includes(st.name)))

const sourceById = computed(() => new Map((game.value?.sources || []).map(src => [src.id, src])))

const detailChapters = computed(() => {
  const res = detailResource.value
  if (!res) return []
  const byId = sourceById.value
  return chapters.value
    .map(ch => {
      let total = 0
      let got = 0
      for (const stage of ch.stages) {
        const src = byId.get(stage.id)
        if (!src) continue
        const amount = src.grants
          .filter(grant => grant.resourceId === res.id)
          .reduce((n, grant) => n + (grant.amount || 0), 0)
        total += amount
        if (cleared.value[stage.id]) got += amount
      }
      return { id: ch.id, name: ch.name, color: ch.color, total, got, pct: total > 0 ? Math.round((got / total) * 100) : 0 }
    })
    .filter(ch => ch.total > 0)
})

// ── 交互 ──
/**
 * 切换一个关卡。
 * 剿灭章节的里程碑是累积式的：400 歼灭本身就包含 100~375 的全部奖励，
 * 所以勾某一档要把它前面的档一起勾上；取消某一档则它之后的档也一并取消。
 */
function toggleStage(stageId) {
  const chapter = chapters.value.find(ch => ch.stages.some(stage => stage.id === stageId))
  const next = { ...cleared.value }

  if (chapter && chapter.id.startsWith('t-an')) {
    const index = chapter.stages.findIndex(stage => stage.id === stageId)
    if (index >= 0) {
      if (next[stageId]) {
        for (let i = index; i < chapter.stages.length; i++) delete next[chapter.stages[i].id]
      } else {
        for (let i = 0; i <= index; i++) next[chapter.stages[i].id] = true
      }
      cleared.value = next
      persistCleared(next)
      return
    }
  }

  if (next[stageId]) delete next[stageId]
  else next[stageId] = true
  cleared.value = next
  persistCleared(next)
}

function setChapter(stageIds, on) {
  const next = { ...cleared.value }
  for (const id of stageIds) {
    if (on) next[id] = true
    else delete next[id]
  }
  cleared.value = next
  persistCleared(next)
}

function toggleHidden(typeId) {
  const next = { ...hiddenTypes.value }
  if (next[typeId]) delete next[typeId]
  else next[typeId] = true
  hiddenTypes.value = next
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)) } catch (err) {
    toast('隐藏状态保存失败：' + err.message)
  }
}

function selectGame(id) {
  gameId.value = id
}

/**
 * 新建一本账簿。空账簿第一次打开时唯一的入口 ——
 * 「游戏管理」卡片已移除，所以这里必须能建游戏，否则用户无处开始。
 */
function createGame() {
  const name = (prompt('新账簿的游戏名（例如：明日方舟）', '') || '').trim();
  if (!name) return;
  const base = JSON.parse(JSON.stringify(snapshot.value || { schemaVersion: 3, version: 'empty', games: [] }));
  base.games = base.games || [];
  if (base.games.some(g => g.name === name)) { toast('已经有叫「' + name + '」的账簿了'); return }
  const gid = 'g-' + Date.now().toString(36);
  const resourceId = 'r-' + Date.now().toString(36) + '-1';
  base.games.push({
    id: gid,
    name,
    subtitle: '',
    startedAt: '',
    resources: [{ id: resourceId, name: '源石', unit: '颗', color: '#E4574C' }],
    sourceTypes: [],
    sources: [],
  });
  base.version = base.version && base.version !== 'empty' ? base.version : name;
  snapshot.value = base;
  gameId.value = gid;
  section.value = 'data';
  save();
  toast('已新建账簿「' + name + '」，去下面的「资源定义 / 来源类型」里加内容');
}

function toast(text) {
  toastMessage.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 4000)
}

// ── 导入导出 ──
function pickImport() {
  importRef.value?.click()
}

/**
 * 导入一份账簿。游戏之间互相独立：
 * 只替换「同名 / 同 id」的那本，其余游戏原样保留。
 */
async function importJSON(event) {
  const file = event?.target?.files?.[0];
  if (event?.target) event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error('文件超过 8 MB，请选择更小的账簿');
    const raw = JSON.parse(await file.text());
    const snap = raw?.snapshot?.games ? raw.snapshot : raw;
    if (!snap || !Array.isArray(snap.games) || !snap.games.length) {
      throw new Error('不是资源账簿的 JSON（缺少 games 数组）');
    }
    const migrated = migrateSnapshot(snap).snapshot;
    const incoming = migrated.games || [];

    // 合并进当前快照：同名或同 id 的替换，新游戏追加
    const base = snapshot.value ? JSON.parse(JSON.stringify(snapshot.value)) : { schemaVersion: 3, version: '', games: [] };
    let replaced = 0, appended = 0;
    for (const book of incoming) {
      const at = base.games.findIndex(g => g.id === book.id || g.name === book.name);
      if (at >= 0) { base.games.splice(at, 1, book); replaced++; }
      else { base.games.push(book); appended++; }
    }
    snapshot.value = base;

    // 进度标记只覆盖这本账簿的关卡
    const ids = new Set(incoming.flatMap(b => (b.sources || []).map(src => src.id)));
    if (raw?.cleared && typeof raw.cleared === 'object') {
      const merged = { ...cleared.value };
      for (const id of ids) delete merged[id];
      for (const [id, on] of Object.entries(raw.cleared)) if (ids.has(id) && on) merged[id] = true;
      cleared.value = merged;
      persistCleared(merged);
    }

    gameId.value = pickGameAfterLoad(snapshot.value);
    save();
    const parts = [];
    if (replaced) parts.push('更新 ' + replaced + ' 本');
    if (appended) parts.push('新增 ' + appended + ' 本');
    toast('已导入「' + incoming.map(b => b.name).join('、') + '」，' + (parts.join('、') || '无变化'));
  } catch (e) {
    toast('导入失败：' + e.message);
  }
}

/** 文件名里不能出现 / \ : * ? " < > |，先清一遍 */
function safeFileName(text) {
  return String(text || '账簿').replace(/[\\/:*?"<>|]/g, '_').trim() || '账簿';
}

/**
 * 导出当前游戏的账簿（游戏之间互相独立，一份文件只装一个游戏）。
 * 文件名带上游戏名和日期，例如「明日方舟-资源账簿-2026-11-21.json」。
 */
function exportBackup() {
  try {
    const current = game.value;
    if (!current) { toast('当前没有可导出的游戏'); return }
    const today = new Date().toISOString().slice(0, 10);
    // 只截取这个游戏自己的关卡标记
    const stageIds = new Set((current.sources || []).map(src => src.id));
    const marks = {};
    for (const [id, on] of Object.entries(cleared.value)) {
      if (on && stageIds.has(id)) marks[id] = true;
    }
    const payload = {
      schemaVersion: snapshot.value.schemaVersion,
      version: snapshot.value.version,
      updatedAt: new Date().toISOString(),
      games: [JSON.parse(JSON.stringify(current))],
      cleared: marks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFileName(current.name) + '-资源账簿-' + today + '.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出「' + current.name + '」的账簿与进度');
  } catch (e) {
    toast('导出失败：' + e.message);
  }
}

</script>

<template>
  <div class="atlas-root" :class="{ 'intro-done': introDone }">
    <div v-if="loading" class="loading-screen">
      <p class="eyebrow">// RESOURCE LEDGER</p>
      <p>正在打开资源账簿…</p>
    </div>

    <template v-else>
      <div class="local-toolbar">
        <span class="view-tabs">
          <span class="tl-entry-btn" :class="{ active: section === 'overview' }" @click="section = 'overview'">资源一览</span>
          <span class="tl-entry-btn" :class="{ active: section === 'data' }" @click="section = 'data'">数据管理</span>
        </span>
        <GameTabs
          :games="appGames"
          :selected-game-id="gameId"
          @select-game="selectGame"
        />
        <div class="toolbar-spacer"></div>
        <button class="rc-global-btn" @click="pickImport" title="导入账本 JSON（完整快照，或本页导出的备份）">导入 JSON</button>
        <button class="rc-global-btn" @click="exportBackup" title="导出账本与已打进度">导出 JSON</button>
        <input ref="importRef" type="file" accept="application/json,.json" class="atlas-import-file" @change="importJSON" />
      </div>

      <p v-if="storageError" class="notice" role="alert">{{ storageError }}</p>

      <template v-if="section === 'overview'">
        <div v-if="!game" class="empty">
          <p>这本账簿里还没有当前游戏的资源数据。</p>
          <p class="muted">还没有任何账簿。先新建一本，再到「数据管理」里加章节与关卡。</p>
          <button class="rc-global-btn" @click="createGame">＋ 新建账簿</button>
        </div>

        <template v-else>
          <div class="stone-summary">
            <button v-for="st in topStats" :key="st.id" type="button" class="stone-card" :title="`${st.name} · 点开看各章节明细`" @click="detailResource = st">
              <div class="sc-row">
                <i :style="{ background: st.color }" aria-hidden="true"></i>
                <b>{{ st.name }}</b>
                <strong :title="fullNumber(st.got)">{{ formatNumber(st.got) }}</strong>
                <span class="sc-of" :title="fullNumber(st.total)">/ {{ formatNumber(st.total) }} {{ st.unit }}</span>
                <em>{{ st.pct }}%</em>
              </div>
              <div class="sc-bar"><i :style="{ width: st.pct + '%' }"></i></div>
            </button>
          </div>

          <StageProgress
            v-if="chapters.length"
            :chapters="chapters"
            :cleared="cleared"
            unit="颗"
            @toggle="toggleStage"
            @chapter="setChapter"
          />
          <div v-else class="empty">
            <p>还没有章节或关卡。切到「数据管理」新增章节与关卡。</p>
          </div>
        </template>
      </template>

      <div v-else class="atlas-editor-wrap">
        <div v-if="!game" class="empty" style="margin:12px">
          <p>这本账簿里还没有当前游戏的资源数据。</p>
          <p class="muted">先新建一本账簿，再在里面加资源、章节与关卡。</p>
          <button class="rc-global-btn" @click="createGame">＋ 新建账簿</button>
        </div>
        <SourceEditor
          :snapshot="snapshot"
          :selected-game-id="game ? game.id : '__no_book__'"
          :hidden-types="hiddenTypes"
          @changed="save"
          @select-game="selectGame"
          @toggle-hidden="toggleHidden"
        />
      </div>

      <div v-if="detailResource" class="atlas-drawer-mask" @click.self="detailResource = null">
        <aside class="atlas-drawer" role="dialog" aria-modal="true">
          <header class="dr-head">
            <div>
              <p class="eyebrow">// RESOURCE DETAIL</p>
              <h3><i :style="{ background: detailResource.color }" aria-hidden="true"></i>{{ detailResource.name }}</h3>
            </div>
            <button type="button" class="dr-close" title="关闭" @click="detailResource = null">✕</button>
          </header>
          <div class="dr-total">
            <strong :title="fullNumber(detailResource.got)">{{ formatNumber(detailResource.got) }}</strong>
            <span class="dr-of" :title="fullNumber(detailResource.total)">/ {{ formatNumber(detailResource.total) }} {{ detailResource.unit }}</span>
            <em>{{ detailResource.pct }}%</em>
          </div>
          <p class="dr-hint">按章节统计 · 共 {{ detailChapters.length }} 个章节有这种产出</p>
          <div class="dr-list">
            <div v-for="ch in detailChapters" :key="ch.id" class="dr-row">
              <span class="dr-swatch" :style="{ background: ch.color }" aria-hidden="true"></span>
              <span class="dr-name" :title="ch.name">{{ ch.name }}</span>
              <span class="dr-amount" :title="`已获得 ${fullNumber(ch.got)} / 共 ${fullNumber(ch.total)}`">
                {{ formatNumber(ch.got) }}<em>/{{ formatNumber(ch.total) }}</em>
              </span>
              <span class="dr-bar" aria-hidden="true"><i :style="{ width: ch.pct + '%' }"></i></span>
              <span class="dr-pct">{{ ch.pct }}%</span>
            </div>
          </div>
        </aside>
      </div>

      <div v-if="toastMessage" class="toast" role="status">{{ toastMessage }}</div>
    </template>
  </div>
</template>

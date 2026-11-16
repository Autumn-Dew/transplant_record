<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { formatNumber, fullNumber } from '../core/ledger.js';

const props = defineProps({
  snapshot: { type: Object, required: true },
  selectedGameId: { type: String, default: '' },
  hiddenTypes: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['changed', 'select-game', 'toggle-hidden']);
const MAX_QUANTITY = 1e12;
const MAX_OCCURRENCES = 1000000;
const message = ref('');
// 来源类型同样一页 10 条，99 个类型平铺会把页面拉到几千像素
const TYPE_PAGE_SIZE = 10;
const typePage = ref(1);
// 章节排序：原始顺序 / 按名称 / 按关卡数
const typeSort = ref('default');
// 隐藏状态筛选：all = 全部 / hidden = 只看已隐藏 / shown = 只看显示中
const hideFilter = ref('all');
const hiddenCount = computed(() => Object.keys(props.hiddenTypes || {}).length);
// 资源定义同样分页（材料可能有几十种）
const RES_PAGE_SIZE = 10;
const resPage = ref(1);
const game = computed(() => {
  const list = props.snapshot.games || [];
  // 没指定游戏时才用第一个；指定了但账簿里没有 → null（显示空态）。
  // 不能回退到 list[0]，否则切换游戏后内容永远不变。
  if (!props.selectedGameId) return list[0] || null;
  return list.find(entry => entry.id === props.selectedGameId) || null;
});
const gameIndex = computed(() => props.snapshot.games.indexOf(game.value));
// 条目变少时把页码夹回有效范围
watch(() => game.value?.resources.length || 0, () => {
  if (resPage.value > resPageCount.value) resPage.value = resPageCount.value;
  if (resPage.value < 1) resPage.value = 1;
});
watch(() => game.value?.sourceTypes.length || 0, () => {
  if (typePage.value > typePageCount.value) typePage.value = typePageCount.value;
  if (typePage.value < 1) typePage.value = 1;
});
const typePageCount = computed(() => Math.max(1, Math.ceil((game.value?.sourceTypes.length || 0) / TYPE_PAGE_SIZE)));
/** 带原始下标的章节列表（排序后仍能定位到源数组，上移下移才有效） */
const sortedTypes = computed(() => {
  const all = (game.value?.sourceTypes || []).filter(type => {
    if (hideFilter.value === 'hidden') return !!props.hiddenTypes[type.id];
    if (hideFilter.value === 'shown') return !props.hiddenTypes[type.id];
    return true;
  });
  const withIndex = all.map(type => ({ type, index: game.value.sourceTypes.indexOf(type) }));
  if (typeSort.value === 'name') {
    withIndex.sort((a, b) => a.type.name.localeCompare(b.type.name, 'zh-Hans-CN'));
  } else if (typeSort.value === 'stages') {
    withIndex.sort((a, b) => typeUsage(b.type) - typeUsage(a.type));
  }
  return withIndex;
});
const pagedTypes = computed(() => {
  const current = Math.min(Math.max(1, typePage.value), typePageCount.value);
  const from = (current - 1) * TYPE_PAGE_SIZE;
  return sortedTypes.value.slice(from, from + TYPE_PAGE_SIZE);
});
const resPageCount = computed(() => Math.max(1, Math.ceil((game.value?.resources.length || 0) / RES_PAGE_SIZE)));
const pagedResources = computed(() => {
  const all = game.value?.resources || [];
  const current = Math.min(Math.max(1, resPage.value), resPageCount.value);
  const from = (current - 1) * RES_PAGE_SIZE;
  return all.slice(from, from + RES_PAGE_SIZE).map((resource, i) => ({ resource, index: from + i }));
});
const goResPage = n => { resPage.value = Math.min(Math.max(1, Math.round(n)), resPageCount.value); };
// 侧栏：编辑一个来源类型（章节）以及它下面的全部关卡
const editingTypeId = ref('');
const stageKeyword = ref('');
const STAGE_PAGE_SIZE = 10;
const stagePage = ref(1);
const editingType = computed(() => game.value?.sourceTypes.find(type => type.id === editingTypeId.value) || null);
const openTypeEdit = type => { editingTypeId.value = type.id; stageKeyword.value = ''; stagePage.value = 1; };
const closeTypeEdit = () => { editingTypeId.value = ''; };
// 该章节下的关卡（按搜索词过滤）
const editingTypeStages = computed(() => {
  const type = editingType.value;
  if (!type) return [];
  const kw = stageKeyword.value.trim().toLowerCase();
  return (game.value?.sources || []).filter(src => src.typeId === type.id && (!kw || src.name.toLowerCase().includes(kw)));
});
const stagePageCount = computed(() => Math.max(1, Math.ceil(editingTypeStages.value.length / STAGE_PAGE_SIZE)));
const pagedTypeStages = computed(() => {
  const current = Math.min(Math.max(1, stagePage.value), stagePageCount.value);
  const from = (current - 1) * STAGE_PAGE_SIZE;
  return editingTypeStages.value.slice(from, from + STAGE_PAGE_SIZE);
});
const goStagePage = n => { stagePage.value = Math.min(Math.max(1, Math.round(n)), stagePageCount.value); };
// 在侧栏里给当前章节新增一个关卡
function addStageToType() {
  const type = editingType.value;
  if (!type) return;
  game.value.sources.push({
    id: newId('source'), name: '新关卡', typeId: type.id,
    parentId: null, startDate: null, endDate: null,
    occurrences: 1, note: '', grants: [],
  });
  stageKeyword.value = '';
  stagePage.value = 999999;
  changed();
}
const goTypePage = n => { typePage.value = Math.min(Math.max(1, Math.round(n)), typePageCount.value); };

const newId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
const changed = () => { message.value = ''; emit('changed'); };
const selectGame = id => { message.value = ''; emit('select-game', id); };
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
function inputText(object, key, event, required = false, max = 200) {
  const value = event.target.value;
  if ((required && !value.trim()) || value.length > max) return;
  object[key] = value;
  changed();
}
function commitText(object, key, event, required = false, max = 200) {
  const value = required ? event.target.value.trim() : event.target.value;
  if ((required && !value) || value.length > max) {
    event.target.value = object[key];
    message.value = required && !value ? '名称不能为空，已恢复上次合法内容。' : `内容最多 ${max} 字，已恢复上次合法内容。`;
    return;
  }
  object[key] = value;
  event.target.value = value;
  changed();
}
function commitDate(object, key, event, nullable = true) {
  const value = event.target.value;
  if (value && !validDate(value)) {
    event.target.value = object[key] || '';
    message.value = '日期须为有效的 YYYY-MM-DD，已恢复上次合法内容。';
    return;
  }
  object[key] = value || (nullable ? null : '');
  changed();
}
function inputColor(object, event, commit = false) {
  const value = event.target.value;
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    if (commit) { event.target.value = object.color; message.value = '颜色须为完整的 #RRGGBB，已恢复上次合法颜色。'; }
    return;
  }
  object.color = value;
  changed();
}
function inputQuantity(object, key, event, commit = false) {
  const raw = event.target.value.trim(), value = Number(raw);
  const occurrences = key === 'occurrences';
  const legal = raw && Number.isFinite(value) && value >= (occurrences ? 1 : 0) && value <= (occurrences ? MAX_OCCURRENCES : MAX_QUANTITY) && (!occurrences || Number.isInteger(value));
  if (!legal) {
    if (commit) {
      event.target.value = object[key];
      message.value = occurrences ? '次数须为 1 至 1,000,000 的整数，已恢复上次合法值。' : '数量须为 0 至 1,000,000,000,000 的有效数字，已恢复上次合法值。';
    }
    return;
  }
  object[key] = value;
  if (commit) event.target.value = value;
  changed();
}
function stepQuantity(object, key, delta) {
  const min = key === 'occurrences' ? 1 : 0, max = key === 'occurrences' ? MAX_OCCURRENCES : MAX_QUANTITY;
  object[key] = Math.max(min, Math.min(max, object[key] + delta));
  changed();
}
function move(list, index, delta) {
  const next = index + delta;
  if (index < 0 || next < 0 || next >= list.length) return;
  [list[index], list[next]] = [list[next], list[index]];
  changed();
}
function addResource() {
  resPage.value = 999999;
  game.value.resources.push({ id: newId('resource'), name: '新资源', unit: '份', color: '#5C5C5C' });
  changed();
}
const resourceUsage = resource => game.value.sources.filter(source => source.grants.some(grant => grant.resourceId === resource.id)).length;
function deleteResource(resource) {
  const count = resourceUsage(resource);
  if (!window.confirm(`删除资源「${resource.name}」？该资源被 ${count} 个来源引用。确认后将清理这些来源中引用它的产出记录。`)) return;
  game.value.sources.forEach(source => { source.grants = source.grants.filter(grant => grant.resourceId !== resource.id); });
  game.value.resources = game.value.resources.filter(entry => entry.id !== resource.id);
  changed();
}
function addType() {
  typePage.value = 999999;   // 新增的排在末尾，先跳末页（下一页由 watch 夹取）
  const entry = { id: newId('type'), name: '新来源类型', color: '#74746B', note: '' };
  game.value.sourceTypes.push(entry);
  // 切换游戏时不需要重置筛选（列表已按章节分层）
  changed();
}
const typeUsage = type => game.value.sources.filter(source => source.typeId === type.id).length;
function deleteType(type) {
  const ids = new Set(game.value.sources.filter(source => source.typeId === type.id).map(source => source.id));
  game.value.sources.forEach(source => { if (source.parentId && ids.has(source.parentId)) ids.add(source.id); });
  const dependent = ids.size - typeUsage(type);
  if (!window.confirm(`删除来源类型「${type.name}」？它包含 ${typeUsage(type)} 个来源${dependent ? `，另有 ${dependent} 个关联子来源` : ''}，共 ${ids.size} 个来源及其产出会被删除。`)) return;
  game.value.sources = game.value.sources.filter(source => !ids.has(source.id));
  game.value.sourceTypes = game.value.sourceTypes.filter(entry => entry.id !== type.id);
  if (editingTypeId.value === type.id) editingTypeId.value = '';
  changed();
}
function duplicateSource(source) {
  const entry = JSON.parse(JSON.stringify(source));
  entry.id = newId('source');
  entry.name = `${source.name.slice(0, 4996)}（副本）`;
  game.value.sources.splice(game.value.sources.indexOf(source) + 1, 0, entry);
  changed();
}
function deleteSource(source) {
  const children = game.value.sources.filter(entry => entry.parentId === source.id);
  if (!window.confirm(`删除来源「${source.name}」？将丢失 ${source.grants.length} 项产出记录${children.length ? `以及 ${children.length} 个直接子来源及其产出` : ''}。`)) return;
  const ids = new Set([source.id, ...children.map(entry => entry.id)]);
  game.value.sources = game.value.sources.filter(entry => !ids.has(entry.id));
  changed();
}
const availableResources = (source, current = '') => game.value.resources.filter(resource => resource.id === current || !source.grants.some(grant => grant.resourceId === resource.id));
function addGrant(source) {
  const resource = availableResources(source)[0];
  if (!resource) return;
  source.grants.push({ resourceId: resource.id, amount: 0 });
  changed();
}
function setGrantResource(source, grant, event) {
  if (!availableResources(source, grant.resourceId).some(resource => resource.id === event.target.value)) {
    event.target.value = grant.resourceId;
    message.value = '只能选择本游戏内尚未用于此来源的资源。';
    return;
  }
  grant.resourceId = event.target.value;
  changed();
}
function deleteGrant(source, index) { source.grants.splice(index, 1); changed(); }
</script>

<template>
  <div class="data-editor">
    <p v-if="message" class="notice" role="alert">{{ message }}</p>

    <!-- 游戏管理：独自一行 -->

    <!-- 资源定义 + 来源类型：一行 -->
    <div class="editor-pair">
      <section v-if="game" class="editor-section">
        <header class="section-head">
          <div><p class="eyebrow">// RESOURCES / {{ game.resources.length }}</p><h3>资源定义</h3></div>
          <button type="button" class="btn" @click="addResource">＋ 新增资源</button>
        </header>
        <p v-if="!game.resources.length" class="empty">本游戏还没有资源，先定义资源名称与单位。</p>
        <div v-else class="src-table">
          <div class="src-row src-head sr-resource"><span>#</span><span>资源名称</span><span>单位</span><span>颜色</span><span>色值</span><span>引用</span><span></span></div>
          <div v-for="{ resource, index } in pagedResources" :key="resource.id" class="src-row sr-resource">
            <span class="src-idx">{{ String(index + 1).padStart(2, '0') }}</span>
            <input class="sr-input" :value="resource.name" maxlength="200" placeholder="资源名称" @input="inputText(resource, 'name', $event, true)" @change="commitText(resource, 'name', $event, true)">
            <input class="sr-input" :value="resource.unit" maxlength="30" placeholder="单位" @input="inputText(resource, 'unit', $event, false, 30)" @change="commitText(resource, 'unit', $event, false, 30)">
            <input class="sr-color" type="color" :value="resource.color" @input="inputColor(resource, $event)" @change="inputColor(resource, $event, true)">
            <input class="sr-input sr-code" :value="resource.color" maxlength="7" @input="inputText(resource, 'color', $event, false, 7)" @change="commitText(resource, 'color', $event, false, 7)">
            <span class="src-idx" :title="resourceUsage(resource) + ' 个关卡引用'">{{ resourceUsage(resource) }}</span>
            <span class="src-ops"><button type="button" class="btn danger" @click="deleteResource(resource)">删</button></span>
          </div>
        </div>
        <div class="src-pager src-pager-bottom">
          <button type="button" class="btn" :disabled="resPage <= 1" @click="goResPage(1)">«</button>
          <button type="button" class="btn" :disabled="resPage <= 1" @click="goResPage(resPage - 1)">‹</button>
          <span class="src-page-num">{{ Math.min(resPage, resPageCount) }} / {{ resPageCount }}</span>
          <button type="button" class="btn" :disabled="resPage >= resPageCount" @click="goResPage(resPage + 1)">›</button>
          <button type="button" class="btn" :disabled="resPage >= resPageCount" @click="goResPage(resPageCount)">»</button>
        </div>
      </section>

      <section v-if="game" class="editor-section">
        <header class="section-head">
          <div><p class="eyebrow">// CHAPTERS / {{ game.sourceTypes.length }}<span v-if="hiddenCount"> · 已隐 {{ hiddenCount }}</span></p><h3>来源类型</h3></div>
          <div class="section-ops">
            <select v-model="hideFilter" class="sr-sort" title="按隐藏状态筛选">
              <option value="all">全部</option>
              <option value="hidden">只看已隐藏</option>
              <option value="shown">只看显示中</option>
            </select>
            <select v-model="typeSort" class="sr-sort" title="章节排序方式">
              <option value="default">原始顺序</option>
              <option value="name">按名称</option>
              <option value="stages">按关卡数</option>
            </select>
            <button type="button" class="btn" @click="addType">＋ 新增类型</button>
          </div>
        </header>
        <p v-if="!game.sourceTypes.length" class="empty">本游戏还没有来源类型。新增后即可按章节记录关卡。</p>
        <div v-else class="src-table">
          <div class="src-row src-head sr-type"><span>#</span><span>名称</span><span>备注</span><span></span></div>
          <div v-for="{ type, index } in pagedTypes" :key="type.id" class="src-row sr-type" :class="{ 'row-hidden': hiddenTypes[type.id] }">
            <span class="src-idx">{{ String(index + 1).padStart(2, '0') }}</span>
            <input class="sr-input" :value="type.name" maxlength="200" placeholder="类型名称" @input="inputText(type, 'name', $event, true)" @change="commitText(type, 'name', $event, true)">
            <input class="sr-input" :value="type.note" maxlength="4000" placeholder="备注（可空）" @input="inputText(type, 'note', $event, false, 4000)" @change="commitText(type, 'note', $event, false, 4000)">
            <span class="src-ops">
              <button type="button" class="btn" title="编辑本章信息与关卡" @click="openTypeEdit(type)">编辑</button>
              <button type="button" class="btn btn-order" :disabled="index === 0" title="上移一位" @click="move(game.sourceTypes, index, -1)">↑</button>
              <button type="button" class="btn btn-order" :disabled="index === game.sourceTypes.length - 1" title="下移一位" @click="move(game.sourceTypes, index, 1)">↓</button>
              <button
                type="button"
                class="btn"
                :class="{ 'is-hidden': hiddenTypes[type.id] }"
                :title="hiddenTypes[type.id] ? '已隐藏，点此恢复显示' : '隐藏这张章节卡片（不影响资源统计）'"
                @click="emit('toggle-hidden', type.id)"
              >{{ hiddenTypes[type.id] ? '已隐' : '隐藏' }}</button>
            </span>
          </div>
        </div>
        <div class="src-pager src-pager-bottom">
          <button type="button" class="btn" :disabled="typePage <= 1" @click="goTypePage(1)">«</button>
          <button type="button" class="btn" :disabled="typePage <= 1" @click="goTypePage(typePage - 1)">‹</button>
          <span class="src-page-num">{{ Math.min(typePage, typePageCount) }} / {{ typePageCount }}</span>
          <button type="button" class="btn" :disabled="typePage >= typePageCount" @click="goTypePage(typePage + 1)">›</button>
          <button type="button" class="btn" :disabled="typePage >= typePageCount" @click="goTypePage(typePageCount)">»</button>
        </div>
      </section>
    </div>

    <!-- 章节编辑侧栏：类型信息 + 本章全部关卡 -->
    <div v-if="editingType" class="ed-mask" @click.self="closeTypeEdit">
      <aside class="ed-drawer" role="dialog" aria-modal="true">
        <header class="ed-head">
          <div>
            <p class="eyebrow">// EDIT CHAPTER</p>
            <h3>{{ editingType.name || '未命名章节' }}<span v-if="hiddenTypes[editingType.id]" class="ed-hidden-tag">已隐藏</span></h3>
          </div>
          <button type="button" class="ed-close" title="关闭" @click="closeTypeEdit">✕</button>
        </header>
        <div class="ed-body">
          <div class="se-row">
            <label class="se-field se-grow"><span>名称</span><input :value="editingType.name" maxlength="200" @input="inputText(editingType, 'name', $event, true)" @change="commitText(editingType, 'name', $event, true)"></label>
          </div>

          <div class="se-row">
            <label class="se-field se-grow"><span>备注</span><input :value="editingType.note" maxlength="4000" placeholder="可空" @input="inputText(editingType, 'note', $event, false, 4000)" @change="commitText(editingType, 'note', $event, false, 4000)"></label>
          </div>

          <div class="se-ops ed-type-ops">
            <button type="button" class="btn" :disabled="game.sourceTypes.indexOf(editingType) === 0" title="上移" @click="move(game.sourceTypes, game.sourceTypes.indexOf(editingType), -1)">↑ 上移</button>
            <button type="button" class="btn" :disabled="game.sourceTypes.indexOf(editingType) === game.sourceTypes.length - 1" title="下移" @click="move(game.sourceTypes, game.sourceTypes.indexOf(editingType), 1)">↓ 下移</button>
            <button type="button" class="btn danger" title="删除本章" @click="deleteType(editingType)">删除本章</button>
            <button
              type="button"
              class="btn"
              :class="{ 'is-hidden': hiddenTypes[editingType.id] }"
              @click="emit('toggle-hidden', editingType.id)"
            >{{ hiddenTypes[editingType.id] ? '恢复显示' : '隐藏本章' }}</button>
          </div>

          <div class="ed-stages-head">
            <b>本章关卡</b>
            <span class="ed-stages-count">{{ editingTypeStages.length }} 关</span>
            <input v-model="stageKeyword" class="se-input" type="search" placeholder="搜索关卡" />
            <button type="button" class="btn" @click="addStageToType">＋ 新增关卡</button>
          </div>

          <p v-if="!editingTypeStages.length" class="ed-empty">这一章还没有关卡。点「＋ 新增关卡」开始添加。</p>
          <div v-else class="ed-stage-list">
            <div v-for="stage in pagedTypeStages" :key="stage.id" class="ed-stage">
              <input
                class="sr-input ed-stage-name"
                :value="stage.name"
                maxlength="200"
                placeholder="关卡代号"
                @input="inputText(stage, 'name', $event, true)"
                @change="commitText(stage, 'name', $event, true)"
              >
              <span v-if="!game.resources.length" class="ed-hint">先在「资源定义」里加资源</span>
              <span v-else class="ed-grants">
                <span v-for="(grant, gi) in stage.grants" :key="grant.resourceId" class="ed-grant">
                  <select :value="grant.resourceId" @change="setGrantResource(stage, grant, $event)"><option v-for="r in availableResources(stage, grant.resourceId)" :key="r.id" :value="r.id">{{ r.name }}</option></select>
                  <input type="number" inputmode="decimal" min="0" :max="MAX_QUANTITY" step="any" :value="grant.amount" @input="inputQuantity(grant, 'amount', $event)" @change="inputQuantity(grant, 'amount', $event, true)">
                  <span class="ed-unit">{{ (game.resources.find(r => r.id === grant.resourceId) || {}).unit || '' }}</span>
                  <button type="button" class="se-x" title="删除这项产出" @click="deleteGrant(stage, gi)">×</button>
                </span>
                <button type="button" class="se-add" :disabled="!availableResources(stage).length" title="再加一种产出" @click="addGrant(stage)">＋</button>
              </span>
              <span class="ed-stage-ops">
                <button type="button" class="btn" title="复制这个关卡" @click="duplicateSource(stage)">复制</button>
                <button type="button" class="btn danger" title="删除这个关卡" @click="deleteSource(stage)">删</button>
              </span>
            </div>
          </div>
          <div class="src-pager src-pager-bottom">
            <button type="button" class="btn" :disabled="stagePage <= 1" @click="goStagePage(1)">«</button>
            <button type="button" class="btn" :disabled="stagePage <= 1" @click="goStagePage(stagePage - 1)">‹</button>
            <span class="src-page-num">{{ Math.min(stagePage, stagePageCount) }} / {{ stagePageCount }}</span>
            <button type="button" class="btn" :disabled="stagePage >= stagePageCount" @click="goStagePage(stagePage + 1)">›</button>
            <button type="button" class="btn" :disabled="stagePage >= stagePageCount" @click="goStagePage(stagePageCount)">»</button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

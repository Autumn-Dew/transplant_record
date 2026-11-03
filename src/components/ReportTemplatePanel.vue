<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="edit-popup rp-tpl-popup" role="dialog" aria-modal="true" aria-label="日报模板">
      <h4>日报模板（临时修改）</h4>
      <p class="rp-tpl-hint">
        <strong v-if="gameLabel">{{ gameLabel }}</strong>
        的模板 —— <strong>每个游戏各一份</strong>，切日报顶部的游戏页签就是切模板。
        这里改的是<strong>当前这份日报</strong>的模板，会存成草稿（重启后仍在）；
        想让它对该游戏的所有时候生效请点「存为全局预设」，点「恢复默认」回到全局预设。
      </p>

      <div class="rp-tpl-body">
        <div class="rp-tpl-group">
          <div class="rp-tpl-group-title">汇报人</div>
          <label class="rp-tpl-field">
            <span class="rp-tpl-label">该游戏的汇报人</span>
            <input
              class="rp-tpl-inp"
              :value="authorOf"
              placeholder="留空则用主署名"
              @input="setAuthor($event.target.value)"
            />
          </label>
          <p class="rp-tpl-note">日报标题会变成「汇报人 + 的每日汇报」；每个游戏各自一份。</p>
        </div>

        <div class="rp-tpl-group">
          <div class="rp-tpl-group-title">卡片与布局</div>
          <p class="rp-tpl-note">每张卡片都在这里改：内容（任务项 / 资源项 / 自定义行）、顺序（↑↓）、宽度（整行 / 半宽）、显示与否。预设卡与自定义卡用同一套操作；隐藏只是画布上不显示，配置和内容都留着。</p>
          <div class="rp-tpl-card" v-for="(card, i) in layout" :key="card.id">
            <div class="rp-tpl-card-head">
              <input
                v-if="card.kind === 'custom'"
                class="rp-tpl-inp rp-tpl-card-title"
                :value="card.title"
                placeholder="卡片标题"
                @input="patch(card.id, { title: $event.target.value })"
              />
              <input
                v-else
                class="rp-tpl-inp rp-tpl-card-title"
                :value="textOf(card.titleKey, builtinName(card))"
                placeholder="卡片标题"
                @input="setText(card.titleKey, $event.target.value)"
              />
              <div class="rp-tpl-card-tools">
                <button class="rp-tpl-mini" :disabled="i === 0" @click="move(card.id, -1)" title="上移">↑</button>
                <button class="rp-tpl-mini" :disabled="i === layout.length - 1" @click="move(card.id, 1)" title="下移">↓</button>
                <button
                  class="rp-tpl-mini"
                  :class="{ on: card.width === 'half' }"
                  :title="card.width === 'half' ? '半宽：与相邻的半宽卡片并排；点一下改整行' : '整行：点一下改半宽'"
                  @click="patch(card.id, { width: card.width === 'half' ? 'full' : 'half' })"
                >{{ card.width === 'half' ? '半宽' : '整行' }}</button>
                <button
                  class="rp-tpl-mini rp-tpl-hide"
                  :class="{ off: card.visible === false }"
                  :title="card.visible === false ? '当前状态：已隐藏（画布上不显示）。点一下改为显示' : '当前状态：显示中。点一下改为隐藏（配置与内容保留，画布上不显示）'"
                  @click="patch(card.id, { visible: card.visible === false })"
                >{{ card.visible === false ? '隐藏' : '显示' }}</button>
                <button v-if="card.kind === 'custom'" class="rp-tpl-mini is-del" @click="remove(card.id)" title="删除这张自定义卡片">删除</button>
              </div>
            </div>
            <!-- 日常 / 周常：任务项（预设卡与自定义卡同一套操作） -->
            <div class="rp-tpl-lines" v-if="card.kind === 'daily' || card.kind === 'weekly'">
              <div class="rp-tpl-row" v-for="(item, ri) in rowsOf(card.kind)" :key="ri">
                <input class="rp-tpl-inp" :value="item.label" placeholder="这一项的名字" @input="setRowLabel(card.kind, ri, $event.target.value)" />
                <button
                  class="rp-tpl-mini"
                  :class="{ on: item.kind === 'text' }"
                  :title="item.kind === 'text' ? '文本型：日报里直接填内容；点一下改回按钮型' : '按钮型：日报里是完成 / 未完成；点一下改文本型'"
                  @click="setRowKind(card.kind, ri, item.kind === 'text' ? 'check' : 'text')"
                >{{ item.kind === 'text' ? '文本' : '按钮' }}</button>
                <button
                  class="rp-tpl-mini rp-tpl-hide"
                  :class="{ off: item.visible === false }"
                  :title="item.visible === false ? '当前状态：已隐藏（日报里不显示）。点一下改为显示' : '当前状态：显示中。点一下改为隐藏（配置保留，日报里不显示）'"
                  @click="toggleRowHidden(card.kind, ri)"
                >{{ item.visible === false ? '隐藏' : '显示' }}</button>
                <button class="rp-tpl-del" @click="removeRow(card.kind, ri)" title="删除这一项">×</button>
              </div>
              <button class="rp-tpl-add" @click="addRow(card.kind)">+ 添加{{ card.kind === 'daily' ? '日常任务' : '周常' }}</button>

              <!-- 专属行（理智剩余 / 送礼…）就画在日常卡里，标签也在这里改 -->
              <template v-if="card.kind === 'daily' && specialRowFields.length">
                <div class="rp-tpl-sub-title">专属行标签（本游戏固定行）</div>
                <label class="rp-tpl-field" v-for="item in specialRowFields" :key="item.key">
                  <span class="rp-tpl-label">{{ item.label }}</span>
                  <input class="rp-tpl-inp" :value="textOf(item.key, item.def)" @input="setText(item.key, $event.target.value)" />
                </label>
              </template>
            </div>

            <!-- 今日获取资源：默认项 -->
            <div class="rp-tpl-lines" v-else-if="card.kind === 'resources'">
              <div class="rp-tpl-row" v-for="(item, ri) in draft.resources || []" :key="ri">
                <input class="rp-tpl-inp" :value="item" placeholder="资源名" @input="setListItem('resources', ri, $event.target.value)" />
                <button class="rp-tpl-del" @click="removeListItem('resources', ri)" title="删除这一项">×</button>
              </div>
              <button class="rp-tpl-add" @click="addListItem('resources')">+ 添加资源</button>
            </div>

            <!-- 自定义卡片：条目行 -->
            <div class="rp-tpl-lines" v-else-if="card.kind === 'custom'">
              <div class="rp-tpl-row" v-for="(line, li) in card.lines" :key="li">
                <input class="rp-tpl-inp" :value="line.label" placeholder="这一行的名字（不需要就点 × 删掉）" @input="setLine(card.id, li, 'label', $event.target.value)" />
                <button
                  class="rp-tpl-mini"
                  :class="{ on: line.kind === 'text' }"
                  :title="line.kind === 'text' ? '文本型：直接填内容；点一下改按钮型' : '按钮型：完成 / 未完成；点一下改文本型'"
                  @click="setLine(card.id, li, 'kind', line.kind === 'text' ? 'check' : 'text')"
                >{{ line.kind === 'text' ? '文本' : '按钮' }}</button>
                <button
                  class="rp-tpl-mini rp-tpl-hide"
                  :class="{ off: line.visible === false }"
                  :title="line.visible === false ? '当前状态：已隐藏（画布上不显示）。点一下改为显示' : '当前状态：显示中。点一下改为隐藏（内容保留，画布上不显示）'"
                  @click="toggleLineHidden(card.id, li)"
                >{{ line.visible === false ? '隐藏' : '显示' }}</button>
                <button class="rp-tpl-del" @click="removeLine(card.id, li)" title="删除这一行">×</button>
              </div>
              <button class="rp-tpl-add" @click="addLine(card.id)">+ 添加一行</button>
            </div>

            <!-- 明日计划 / 备注 / 截图：内容直接在日报页填写 -->
            <p class="rp-tpl-note" v-else>内容直接在日报页里填写（图片可粘贴或点「+ 图片」）。</p>
          </div>
          <button class="rp-tpl-add" @click="addCard">+ 添加卡片</button>
        </div>

        <!-- 文案字段（较长，放在最后，两列排版） -->
        <div class="rp-tpl-group" v-for="grp in visibleFields" :key="grp.group">
          <div class="rp-tpl-group-title">{{ grp.group }}</div>
          <div class="rp-tpl-grid2">
            <label class="rp-tpl-field" v-for="item in grp.items" :key="item.key">
              <span class="rp-tpl-label">{{ item.label }}</span>
              <input
                class="rp-tpl-inp"
                :value="textOf(item.key, item.def)"
                @input="setText(item.key, $event.target.value)"
              />
            </label>
          </div>
        </div>
      </div>

      <div class="edit-actions rp-tpl-actions">
        <button class="cancel-btn" @click="emit('close')">关闭</button>
        <button class="cancel-btn" @click="emit('reset')" title="清掉这份草稿，回到「数据管理」里的全局预设">恢复默认</button>
        <button
          class="save-btn"
          :style="saveStyle"
          :title="saveTitle"
          @click="emit('save-global')"
        >{{ saveLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// 日报模板面板：只改父组件传进来的**草稿对象**（不碰全局配置）。
// 「存为全局预设」由父组件执行（需要四次点击确认 + 写回 game.report）。
import { computed } from 'vue'
import { appendCustomCard, moveCard, removeCard, patchCard, normalizeRows } from '@/domain/report-layout.js'
const props = defineProps({
  draft: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  gameLabel: { type: String, default: '' },
  gameId: { type: String, default: '' },
  saveStyle: { type: Object, default: () => ({}) },
  saveTitle: { type: String, default: '' },
  saveLabel: { type: String, default: '存为全局预设' },
})
const emit = defineEmits(['close', 'reset', 'save-global'])

function textOf(key, fallback) {
  const v = props.draft.text ? props.draft.text[key] : undefined
  return v == null ? (fallback || '') : v
}

function setText(key, value) {
  if (!props.draft.text) props.draft.text = {}
  props.draft.text[key] = value
}

// 汇报人：草稿里存一份；「存为全局预设」时才写回 game.report.author
const authorOf = computed(() => (props.draft.author == null ? '' : String(props.draft.author)))
function setAuthor(value) {
  props.draft.author = String(value == null ? '' : value)
}

function setListItem(kind, index, value) {
  const list = Array.isArray(props.draft[kind]) ? props.draft[kind] : []
  const next = [...list]
  next[index] = value
  props.draft[kind] = next
}

function addListItem(kind) {
  const list = Array.isArray(props.draft[kind]) ? props.draft[kind] : []
  const placeholder = kind === 'daily' ? '新任务' : kind === 'weekly' ? '新周常' : '新资源'
  props.draft[kind] = [...list, placeholder]
}

function removeListItem(kind, index) {
  const list = Array.isArray(props.draft[kind]) ? props.draft[kind] : []
  const next = [...list]
  next.splice(index, 1)
  props.draft[kind] = next
}

// ── 任务项：按钮型 / 文本型 ──
// 存的是 [{ label, kind }]；旧数据里的字符串在 normalizeRows 里补成按钮型。
const rowsOf = (kind) => normalizeRows(props.draft[kind])

// 直接改原数组，不走 normalizeRows 的 trim —— 否则名字中间打不出空格
function rawRows(kind) {
  const list = Array.isArray(props.draft[kind]) ? props.draft[kind] : []
  return list.map(item => (typeof item === 'string' ? { label: item, kind: 'check' } : { ...item }))
}
function setRowLabel(kind, index, value) {
  const next = rawRows(kind)
  if (next[index]) next[index].label = value
  props.draft[kind] = next
}
function setRowKind(kind, index, value) {
  const next = rawRows(kind)
  if (next[index]) next[index].kind = value === 'text' ? 'text' : 'check'
  props.draft[kind] = next
}
function addRow(kind) {
  props.draft[kind] = [...rowsOf(kind), { label: kind === 'daily' ? '新任务' : '新周常', kind: 'check' }]
}
function toggleRowHidden(kind, index) {
  const next = rawRows(kind)
  if (!next[index]) return
  next[index].visible = next[index].visible === false
  props.draft[kind] = next
}

// 按当前游戏过滤字段：placement === 'card' 的组已经搬进卡片里，不再单列
const gameItems = (items) => {
  const id = props.gameId
  return items.filter(item => !item.games || !id || item.games.includes(id))
}
const visibleFields = computed(() =>
  (props.fields || [])
    .filter(grp => grp.placement !== 'card')
    .map(grp => ({ ...grp, items: gameItems(grp.items) }))
    .filter(grp => grp.items.length > 0),
)

// 「专属行标签」：渲染在日常卡内部（这些行本来就画在日常卡里）
const specialRowFields = computed(() => {
  const grp = (props.fields || []).find(g => g.group === '专属行标签')
  return grp ? gameItems(grp.items) : []
})

function removeRow(kind, index) {
  const next = rowsOf(kind)
  next.splice(index, 1)
  props.draft[kind] = next
}

// ── 卡片与布局 ──
// 与上面的列表编辑一致：只改父组件传进来的草稿（props.draft），
// 落盘 / 存为全局由父组件负责。
const layout = computed(() => (Array.isArray(props.draft.layout) ? props.draft.layout : []))

const BUILTIN_NAME = {
  daily: '日常',
  weekly: '周常',
  resources: '今日获取资源',
  plan: '明日计划',
  note: '备注',
  shots: '截图',
}
// 内置卡的标题在「卡片标题」那一组里改，这里只显示固定名字，避免两处输入框打架
function builtinName(card) {
  return BUILTIN_NAME[card.kind] || card.kind
}

function setLayout(next) {
  props.draft.layout = next
}
function patch(id, changes) {
  setLayout(patchCard(layout.value, id, changes))
}
function move(id, delta) {
  setLayout(moveCard(layout.value, id, delta))
}
function remove(id) {
  setLayout(removeCard(layout.value, id))
}
function addCard() {
  setLayout(appendCustomCard(layout.value))
}
function setLine(id, index, field, value) {
  const card = layout.value.find(c => c.id === id)
  if (!card || !Array.isArray(card.lines) || !card.lines[index]) return
  card.lines[index][field] = field === 'kind' ? (value === 'text' ? 'text' : 'check') : value
}
function addLine(id) {
  const card = layout.value.find(c => c.id === id)
  if (card && Array.isArray(card.lines)) card.lines.push({ label: '', kind: 'text', done: true })
}
function toggleLineHidden(id, index) {
  const card = layout.value.find(c => c.id === id)
  if (!card || !Array.isArray(card.lines) || !card.lines[index]) return
  const line = card.lines[index]
  line.visible = line.visible === false   // 隐藏 ↔ 显示
}

function removeLine(id, index) {
  const card = layout.value.find(c => c.id === id)
  if (card && Array.isArray(card.lines)) card.lines.splice(index, 1)
}
</script>

<style scoped>
.rp-tpl-popup { max-width: 760px; width: min(760px, 92vw); max-height: 86vh; display: flex; flex-direction: column; }
.rp-tpl-hint { font-size: 11px; opacity: 0.55; line-height: 1.6; margin: 4px 0 12px; }
.rp-tpl-body { flex: 1; min-height: 0; overflow: auto; padding-right: 4px; }
.rp-tpl-group { margin-bottom: 14px; }
.rp-tpl-group-title {
  font-size: 11px; font-family: var(--font-mono); letter-spacing: 1px;
  opacity: 0.6; padding-bottom: 4px; margin-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}
.rp-tpl-field, .rp-tpl-row { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.rp-tpl-label { width: 120px; flex-shrink: 0; font-size: 11px; opacity: 0.6; font-family: var(--font-mono); }
.rp-tpl-inp {
  flex: 1; min-width: 0; height: 26px; padding: 0 8px;
  border: 2px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-family: inherit; font-size: 12px;
}
.rp-tpl-inp:focus { outline: none; border-color: var(--btn-hover-bg); }
.rp-tpl-del {
  width: 26px; height: 26px; flex-shrink: 0;
  border: 2px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-family: var(--font-mono); font-size: 12px; cursor: pointer;
}
.rp-tpl-del:hover { background: #d00; border-color: #d00; color: #fff; }
.rp-tpl-add {
  margin-top: 4px; height: 24px; padding: 0 10px;
  border: 1px dashed var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-family: var(--font-mono); font-size: 11px; cursor: pointer;
}

/* ── 卡片与布局 ── */
.rp-tpl-note { font-size: 10px; opacity: 0.5; line-height: 1.6; margin: 0 0 6px; }
.rp-tpl-card {
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  padding: 4px 6px;
  margin-bottom: 4px;
}
.rp-tpl-card-head { display: flex; align-items: center; gap: 6px; }
.rp-tpl-card-name {
  flex: 1; min-width: 0; font-size: 12px; font-family: var(--font-mono);
  letter-spacing: 0.5px; opacity: 0.8;
}
.rp-tpl-card-title { height: 24px; }
.rp-tpl-card-tools { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.rp-tpl-mini {
  height: 24px; padding: 0 9px;
  border: 1px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-family: var(--font-mono); font-size: 11px; font-weight: 600; cursor: pointer;
}
.rp-tpl-mini:hover { background: var(--btn-hover-bg, var(--border-color)); color: var(--btn-hover-fg, #fff); }
.rp-tpl-mini:disabled { opacity: 0.3; cursor: default; }
.rp-tpl-mini.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink, #fff); }
/* 显示中：主题主色实心（开）——文字写的是当前状态，颜色也对应状态 */
.rp-tpl-mini.rp-tpl-hide {
  background: var(--accent); border-color: var(--accent); color: var(--accent-ink, #fff);
  font-weight: 700; box-shadow: inset 0 0 0 2px var(--bg-secondary);
}
.rp-tpl-mini.rp-tpl-hide:hover { filter: brightness(1.12); }
/* 已隐藏：素色（关），点一下恢复 */
.rp-tpl-mini.rp-tpl-hide.off {
  background: var(--bg-secondary); border-color: var(--border-color); color: var(--text-secondary);
  font-weight: 600; box-shadow: none;
}
.rp-tpl-mini.rp-tpl-hide.off:hover { background: var(--btn-hover-bg, var(--border-color)); color: var(--btn-hover-fg, #fff); }
.rp-tpl-mini.is-del:hover { background: #d00; border-color: #d00; color: #fff; }
.rp-tpl-lines { margin: 4px 0 0 8px; }
.rp-tpl-sub-title {
  margin: 8px 0 4px; padding-top: 6px;
  border-top: 1px dashed var(--border-color);
  font-size: 10px; font-family: var(--font-mono); letter-spacing: 0.5px; opacity: 0.55;
}
/* 文案字段：两列，长列表不再一条条占满整行 */
.rp-tpl-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 12px; }
.rp-tpl-grid2 .rp-tpl-label { width: 82px; }
.rp-tpl-grid2 .rp-tpl-field { padding: 1px 0; }

.rp-tpl-add:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.rp-tpl-actions { margin-top: 12px; gap: 8px; }
</style>

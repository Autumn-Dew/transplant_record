<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="edit-popup rp-tpl-popup" role="dialog" aria-modal="true" aria-label="日报模板">
      <h4>日报模板（临时修改）</h4>
      <p class="rp-tpl-hint">
        这里改的是<strong>当前这份日报</strong>的模板，会存成草稿（重启后仍在），
        想让它对所有时候生效请点「存为全局预设」；点和「恢复默认」回到全局预设。
      </p>

      <div class="rp-tpl-body">
        <div class="rp-tpl-group" v-for="grp in fields" :key="grp.group">
          <div class="rp-tpl-group-title">{{ grp.group }}</div>
          <label class="rp-tpl-field" v-for="item in grp.items" :key="item.key">
            <span class="rp-tpl-label">{{ item.label }}</span>
            <input
              class="rp-tpl-inp"
              :value="textOf(item.key, item.def)"
              @input="setText(item.key, $event.target.value)"
            />
          </label>
        </div>

        <div class="rp-tpl-group">
          <div class="rp-tpl-group-title">日常任务项</div>
          <div class="rp-tpl-row" v-for="(item, i) in draft.daily || []" :key="'d' + i">
            <input class="rp-tpl-inp" :value="item" @input="setListItem('daily', i, $event.target.value)" />
            <button class="rp-tpl-del" @click="removeListItem('daily', i)" title="删除这一项">×</button>
          </div>
          <button class="rp-tpl-add" @click="addListItem('daily')">+ 添加日常任务</button>
        </div>

        <div class="rp-tpl-group">
          <div class="rp-tpl-group-title">周常任务项</div>
          <div class="rp-tpl-row" v-for="(item, i) in draft.weekly || []" :key="'w' + i">
            <input class="rp-tpl-inp" :value="item" @input="setListItem('weekly', i, $event.target.value)" />
            <button class="rp-tpl-del" @click="removeListItem('weekly', i)" title="删除这一项">×</button>
          </div>
          <button class="rp-tpl-add" @click="addListItem('weekly')">+ 添加周常</button>
        </div>

        <div class="rp-tpl-group">
          <div class="rp-tpl-group-title">今日获取资源（默认项）</div>
          <div class="rp-tpl-row" v-for="(item, i) in draft.resources || []" :key="'r' + i">
            <input class="rp-tpl-inp" :value="item" @input="setListItem('resources', i, $event.target.value)" />
            <button class="rp-tpl-del" @click="removeListItem('resources', i)" title="删除这一项">×</button>
          </div>
          <button class="rp-tpl-add" @click="addListItem('resources')">+ 添加资源</button>
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
const props = defineProps({
  draft: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
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
.rp-tpl-add:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.rp-tpl-actions { margin-top: 12px; gap: 8px; }
</style>

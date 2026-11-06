<template>
  <div class="sb-wrap">
    <button
      ref="triggerRef"
      type="button"
      class="sb-trigger"
      :class="{ open, disabled }"
      :style="{ width }"
      :disabled="disabled"
      @click.stop="toggle"
    >
      <span class="sb-text">{{ selectedLabel }}</span>
      <svg class="sb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div v-if="open" class="sb-panel" ref="panelRef" :style="panelStyle" @click.stop>
      <!-- 可搜索：输入关键字就地筛选 -->
      <div v-if="searchable" class="sb-search-wrap">
        <input
          ref="searchRef"
          v-model="keyword"
          class="sb-search"
          type="text"
          :placeholder="searchPlaceholder"
          @keydown.esc.stop="open = false"
          @keydown.enter.prevent="pickFirst"
        />
      </div>
      <div v-if="!filteredOptions.length" class="sb-empty">{{ searchable && keyword ? '没有匹配项' : '无可选项' }}</div>
      <div
        v-for="(opt, i) in filteredOptions"
        :key="i"
        class="sb-option"
        :class="{ active: opt.value === modelValue }"
        @click="pick(opt)"
      >{{ opt.label }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  width: { type: String, default: '100%' },
  disabled: { type: Boolean, default: false },
  // 可搜索：面板顶部多一个输入框，按 label 实时筛选
  searchable: { type: Boolean, default: false },
  searchPlaceholder: { type: String, default: '输入关键字筛选…' },
})
const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const triggerRef = ref(null)
const panelRef = ref(null)
const panelStyle = ref({})
const keyword = ref('')
const searchRef = ref(null)
const filteredOptions = computed(() => {
  const list = props.options || []
  const kw = keyword.value.trim().toLowerCase()
  if (!props.searchable) return list
  if (!kw) return list
  return list.filter(o => String(o.label || '').toLowerCase().includes(kw))
})

const selectedLabel = computed(() => {
  const o = (props.options || []).find(x => x.value === props.modelValue)
  return o ? o.label : props.placeholder
})

function updatePos() {
  const el = triggerRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const count = (props.options || []).length
  const panelH = Math.min(280, count * 30 + 8)
  let top = r.bottom + 4
  if (top + panelH > window.innerHeight) top = Math.max(4, r.top - panelH - 4)
  panelStyle.value = {
    position: 'fixed',
    top: top + 'px',
    left: r.left + 'px',
    width: Math.max(r.width, 120) + 'px',
    maxHeight: '280px',
  }
}
function toggle() {
  if (props.disabled) return
  if (open.value) { open.value = false; return }
  updatePos()
  keyword.value = ''
  open.value = true
  nextTick(() => {
    updatePos()
    if (props.searchable && searchRef.value) searchRef.value.focus()
  })
}
function pickFirst() {
  if (filteredOptions.value.length) pick(filteredOptions.value[0])
}
function pick(opt) {
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
  open.value = false
}
function onDocClick(e) {
  if (!open.value) return
  if (triggerRef.value && triggerRef.value.contains(e.target)) return
  open.value = false
}
function closeOnScroll(e) {
  // 面板内部滚动不关闭（支持滚轮浏览选项）
  if (open.value && panelRef.value && e && e.target && panelRef.value.contains(e.target)) return
  open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('scroll', closeOnScroll, true)
  window.addEventListener('resize', closeOnScroll)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('scroll', closeOnScroll, true)
  window.removeEventListener('resize', closeOnScroll)
})
</script>

<style>
/* 可搜索下拉：顶部输入框 */
.sb-search-wrap { padding: 4px; border-bottom: 1px solid var(--border-color); }
.sb-search {
  width: 100%; height: 26px; padding: 0 8px; box-sizing: border-box;
  border: 1px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-family: var(--font-mono); font-size: 11px;
}
.sb-search:focus { outline: none; border-color: var(--accent); }
.sb-wrap { position: relative; display: inline-block; max-width: 100%; }
.sb-trigger {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  height: 28px; padding: 0 6px 0 10px;
  border: 2px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-size: 12px; font-family: inherit;
  cursor: pointer; max-width: 100%;
  transition: background var(--motion-duration-normal), color var(--motion-duration-normal);
}
.sb-trigger:hover, .sb-trigger.open { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.sb-trigger.disabled { opacity: 0.5; cursor: not-allowed; }
.sb-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-arrow { width: 18px; height: 18px; flex-shrink: 0; transition: transform var(--motion-duration-fast) var(--motion-easing-ease); }
.sb-trigger.open .sb-arrow { transform: rotate(180deg); }
.sb-panel {
  z-index: 100000; background: var(--bg-primary); color: var(--text-primary);
  border: 2px solid var(--border-color); overflow-y: auto;
  scrollbar-width: none; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  animation: mt-fade-in var(--motion-duration-fast) var(--motion-easing-ease);
}
.sb-panel::-webkit-scrollbar { display: none; }
.sb-option {
  padding: 6px 10px; font-size: 12px; cursor: pointer; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: background var(--motion-duration-fast), color var(--motion-duration-fast);
}
.sb-option:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.sb-option.active { font-weight: 700; }
.sb-empty { padding: 6px 10px; opacity: 0.5; font-size: 12px; color: var(--text-primary); }
</style>

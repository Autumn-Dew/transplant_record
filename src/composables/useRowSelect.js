import { ref, watch } from 'vue'
import { KEYS, readJSON, writeJSON } from '../data/storage.js'

// 全局共享的「最多可选中数量」X（所有记录页共用同一个值）
function loadLimit() {
  const n = Number(readJSON(KEYS.SELECT_LIMIT, 3))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3
}

const selectLimit = ref(loadLimit())

watch(selectLimit, (v) => {
  const n = Math.max(1, Math.floor(Number(v) || 1))
  if (n !== selectLimit.value) selectLimit.value = n
  writeJSON(KEYS.SELECT_LIMIT, n)
})

/**
 * 记录行「单击选中」：纯视觉，最多 selectLimit 个。
 * 每个页面调用一次，得到该页独立的选中集合，但共享全局 X。
 */
export function useRowSelect() {
  const selectedIds = ref(new Set())

  function isSelected(id) { return selectedIds.value.has(id) }

  function toggleSelect(id) {
    const s = new Set(selectedIds.value)
    if (s.has(id)) {
      s.delete(id)
    } else {
      if (s.size >= selectLimit.value) return
      s.add(id)
    }
    selectedIds.value = s
  }

  function clearSelection() { selectedIds.value = new Set() }

  // 上限调低时，按加入顺序裁剪到上限
  watch(selectLimit, (v) => {
    if (selectedIds.value.size > v) {
      selectedIds.value = new Set([...selectedIds.value].slice(0, v))
    }
  })

  return { selectedIds, isSelected, toggleSelect, clearSelection, selectLimit }
}

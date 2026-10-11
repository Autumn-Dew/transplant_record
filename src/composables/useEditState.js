import { ref } from 'vue'

// 共享编辑状态：列表页设置，新增页读取
const editType = ref(null)    // 'accounts' | 'blueprints' | 'diary'
const editRecord = ref(null)  // 要编辑的记录对象（null = 新增模式）

export function useEditState() {
  function startAdd(type) {
    editType.value = type
    editRecord.value = null
  }

  function startEdit(type, record) {
    editType.value = type
    editRecord.value = { ...record }
  }

  function clearEdit() {
    editType.value = null
    editRecord.value = null
  }

  return { editType, editRecord, startAdd, startEdit, clearEdit }
}

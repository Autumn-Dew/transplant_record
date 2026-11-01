<template>
  <div class="empty">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <template v-if="icon === 'search'">
        <circle cx="11" cy="11" r="8" stroke-width="2" />
        <path d="M21 21l-4.35-4.35" stroke-width="2" />
      </template>
      <template v-else>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-width="2" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke-width="2" />
      </template>
    </svg>
    <p>{{ text }}</p>
  </div>
</template>

<script setup>
// 列表空状态：结构（图标 + 一行文案）原先在代肝代办 / 蓝图 / 代肝记录 三处各写一遍。
// 样式沿用全局 page-common.css 的 `.empty`，组件内不需要再声明。
//   icon = 'doc'    —— 还没有任何记录（初次使用）
//   icon = 'search' —— 有记录但筛选没命中
defineProps({
  text: { type: String, default: '' },
  icon: { type: String, default: 'doc' }, // 'doc' | 'search'
})
</script>

<!--
  资源账簿：把 resource-atlas 集成成本项目的一个页面

  · 骨架与其他页面完全一致：.local-music + .local-header + .local-toolbar
  · 它自带的侧栏 / 顶栏 / 三色条已删除，游戏切换改为工具栏标签（GameTabs）
  · 配色来自 atlas/styles/tokens.css 的映射，跟着应用的主题与明暗模式走
  · 样式用 @scope(.atlas-root) 隔离，不会污染其他页面
  · 数据存在它自己的键里（atlas.*），与代肝业务数据互不影响
-->
<template>
  <div class="local-music" :class="{ entered: entered }">
    <div class="local-header">
      <div>
        <h2>资源账簿</h2>
        <p class="desc">按来源统计游戏资源产出 · RESOURCE ATLAS</p>
      </div>
      <div class="atlas-head-meta">
        <span v-if="version" class="atlas-version">数据版本 {{ version }}</span>
      </div>
    </div>
    <AtlasApp @version="onVersion" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AtlasApp from './atlas/AtlasApp.vue'
import { usePageEnter } from '@/composables/usePageEnter.js'

// 与其他页面共用同一套入场节奏（composables/usePageEnter.js）
const { entered } = usePageEnter()
const version = ref('')
function onVersion(v) { version.value = v || '' }
</script>

<style scoped>
.atlas-head-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.atlas-version {
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: 0.5;
  letter-spacing: 0.4px;
}
/* 让 atlas 内容区跟随页面高度（.local-music 本身已是 100% 高 + overflow-y auto） */
.local-music :deep(.atlas-root) {
  min-height: 0;
}
</style>

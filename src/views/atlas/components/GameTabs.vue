<script setup>
// 游戏切换：原来在 atlas 自带的 238px 侧栏里（GameSidebar），
// 本项目所有页面都没有独立侧栏，改成工具栏上的标签按钮组。
defineProps({
  games: { type: Array, default: () => [] },
  selectedGameId: { type: String, default: '' },
});
const emit = defineEmits(['select-game']);
</script>

<template>
  <div class="game-tabs">
    <button
      v-for="game in games"
      :key="game.id"
      class="game-tab"
      :class="{ active: game.id === selectedGameId, empty: !game.hasData }"
      :title="game.name"
      @click="emit('select-game', game.id)"
    >
      <span class="game-tab-name">{{ game.name }}</span>
    </button>
    <span v-if="!games.length" class="game-tabs-empty">还没有游戏</span>
  </div>
</template>

<style scoped>
/* 与「资源一览 / 数据管理」同一套选项卡外观（.tl-entry-btn） */
.game-tabs {
  margin: 0 !important;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
/* 与左侧视图选项卡之间的细分隔线（紧贴，不加外边距） */
.game-tabs::before {
  content: '';
  width: 2px;
  height: 18px;
  flex: 0 0 2px;
  background: var(--border-color);
  opacity: .3;
}
.game-tab {
  margin: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  line-height: 1;
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.game-tab:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.game-tab:active { transform: scale(0.96); }
.game-tab.active {
  background: var(--btn-hover-bg);
  color: var(--btn-hover-text);
  border-color: var(--btn-hover-bg);
  font-weight: 700;
}
/* 账簿里没有这个游戏的数据时压暗，但依然可点 */
.game-tab.empty { opacity: .5; }
.game-tab.empty:hover { opacity: .8; }
.game-tabs-empty {
  font-family: var(--font-mono);
  font-size: 11px;
  opacity: .5;
}
</style>

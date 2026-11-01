<template>
  <div class="color-swatches">
    <span
      v-for="c in PRESET_COLORS"
      :key="c"
      class="color-swatch"
      :style="{ background: c }"
      :class="{ active: modelValue === c }"
      @click="emit('update:modelValue', c)"
    ></span>
    <input
      type="color"
      class="color-input"
      :value="modelValue || '#000000'"
      title="自定义颜色"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <input
      class="bp-hex"
      :class="{ invalid: !isValidHex(modelValue) }"
      :value="modelValue"
      placeholder="#RRGGBB"
      title="可直接输入 HEX"
      @input="emit('update:modelValue', $event.target.value)"
      @change="emit('update:modelValue', normalizeHex($event.target.value))"
    />
    <button v-if="modelValue" class="pwd-toggle" @click="emit('update:modelValue', '')">清除</button>
  </div>
</template>

<script setup>
// 蓝图颜色选择器：8 色预设 + 系统取色器 + 直接输入 HEX。
// 原先「蓝图详情」与「新增蓝图」各写一份（含重复的 presetColors 数组与四段相同样式）。
// HEX 失焦时才规范化（非法值原样保留，由 `.invalid` 提示，不静默丢弃）。
import { isValidHex, normalizeHex } from '@/domain/blueprints.js'

const PRESET_COLORS = ['#FF1744', '#FF6D00', '#FFEA00', '#00E676', '#00B0FF', '#2979FF', '#9C27B0', '#F50057']

defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
.color-swatches { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.color-swatch {
  width: 22px; height: 22px;
  display: inline-block;
  cursor: pointer;
  border: 2px solid transparent;
  flex-shrink: 0;
}
.color-swatch.active { border-color: var(--text-primary); }
.color-input {
  width: 30px; height: 26px;
  padding: 0;
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  cursor: pointer;
}
.bp-hex {
  width: 96px; height: 26px; padding: 0 6px;
  border: 2px solid var(--border-color); background: var(--bg-primary);
  color: var(--text-primary); font-family: var(--font-mono); font-size: 12px;
}
.bp-hex.invalid { border-color: #d00; color: #d00; }
</style>

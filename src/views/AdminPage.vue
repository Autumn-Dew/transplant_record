<template>
  <div class="local-music" :class="{ entered: entered }">
    <div class="local-header">
      <div><h2>数据管理</h2><p class="desc">管理价格数据（终末地 / 明日方舟）</p></div>
    </div>

    <div class="local-toolbar">
      <SelectBox v-model="game" :options="gameOptions" width="130px" />
      <span class="view-tabs">
        <span class="tl-entry-btn" :class="{ active: mode === 'preset' }" @click="mode = 'preset'">预设</span>
        <span class="tl-entry-btn" :class="{ active: mode === 'custom' }" @click="mode = 'custom'">自定义</span>
        <span class="tl-entry-btn" :class="{ active: mode === 'all' }" @click="mode = 'all'">全部</span>
      </span>
      <button class="rc-global-btn" @click="addCategory">+ 类别</button>
      <div class="toolbar-spacer"></div>
      <button class="rc-global-btn" @click="downloadJSON">下载</button>
      <button class="rc-global-btn" @click="saveToLocal">保存</button>
    </div>

    <div class="ad-body">
      <div class="ad-shop">
        <div class="ad-cat-head">
          <span class="ad-cat-name" style="padding-left:8px">店铺信息</span>
        </div>
        <div class="ad-cat-items">
          <div class="ad-item-header">
            <span style="width:24px"></span>
            <span class="ad-col-pos">位置</span>
            <span class="ad-col-label">名称</span>
            <span class="ad-col-note">内容</span>
            <span style="width:28px"></span>
          </div>
          <div v-for="(info, si) in shopInfo" :key="info.id" class="ad-item">
            <span class="ad-sort ad-sort-sm">
              <button class="ad-sort-btn" @click="moveShop(si, -1)" :disabled="si === 0">↑</button>
              <button class="ad-sort-btn" @click="moveShop(si, 1)" :disabled="si === shopInfo.length - 1">↓</button>
            </span>
            <SelectBox v-model="info.position" :options="positionOptions" width="70px" />
            <input v-model="info.label" class="ad-inp ad-col-label" placeholder="名称" />
            <input v-model="info.value" class="ad-inp ad-col-note" placeholder="内容" />
            <button class="ad-btn-del" @click="shopInfo.splice(si, 1)">×</button>
          </div>
          <button class="ad-add-item" @click="addShopInfo">+ 信息</button>
        </div>
      </div>
      <div v-for="(cat, ci) in filteredCats" :key="ci" class="ad-cat">
        <div class="ad-cat-head">
          <span class="ad-sort">
            <button class="ad-sort-btn" @click="moveCat(cat, -1)" :disabled="catIndex(cat) === 0">↑</button>
            <button class="ad-sort-btn" @click="moveCat(cat, 1)" :disabled="catIndex(cat) === allCategories.length - 1">↓</button>
          </span>
          <input v-model="cat.name" class="ad-inp ad-cat-name" />
          <SelectBox v-model="cat.mode" :options="modeOptions" width="90px" />
          <button class="ad-btn-del" @click="removeCat(cat)">×</button>
        </div>
        <div class="ad-cat-items">
          <div class="ad-item-header">
            <span style="width:24px"></span>
            <span class="ad-col-key">编号</span>
            <span class="ad-col-name">名称</span>
            <span class="ad-col-price">价格</span>
            <span class="ad-col-unit">单位</span>
            <span class="ad-col-note">备注</span>
            <span style="width:28px"></span>
          </div>
          <div v-for="(item, ii) in cat.items" :key="ii" class="ad-item">
            <span class="ad-sort ad-sort-sm">
              <button class="ad-sort-btn" @click="moveItem(cat, ii, -1)" :disabled="ii === 0">↑</button>
              <button class="ad-sort-btn" @click="moveItem(cat, ii, 1)" :disabled="ii === cat.items.length - 1">↓</button>
            </span>
            <input v-model.number="item.key" class="ad-inp ad-col-key" type="number" />
            <input v-model="item.name" class="ad-inp ad-col-name" />
            <input v-model.number="item.price" class="ad-inp ad-col-price" type="number" step="any" />
            <input v-model="item.unit" class="ad-inp ad-col-unit" placeholder="—" />
            <input v-model="item.note" class="ad-inp ad-col-note" placeholder="—" />
            <button class="ad-btn-del" @click="cat.items.splice(ii, 1)">×</button>
          </div>
          <button class="ad-add-item" @click="addItem(cat)">+ 项目</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePrices } from '@/composables/usePrices.js'
import SelectBox from '@/components/SelectBox.vue'

const { prices, save: persist } = usePrices()
const game = ref('endfield')
const mode = ref('all')
const gameOptions = [{ value: 'endfield', label: '终末地' }, { value: 'ak', label: '明日方舟' }]
const modeOptions = [{ value: 'preset', label: '预设' }, { value: 'custom', label: '自定义' }]

const entered = ref(false)
onMounted(() => { requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true })) })

// ══════ 店铺信息（数组：位置/名称/内容，供价格一览头/尾展示） ══════
const SHOP_KEY = 'tr-shop-info'
const positionOptions = [{ value: 'head', label: '头部' }, { value: 'tail', label: '尾部' }]
function defaultShopInfo() {
  return [
    { id: 'c1', label: '代肝联系方式', value: '', position: 'head' },
    { id: 'c2', label: '代肝游戏名称', value: '', position: 'head' },
  ]
}
const shopInfo = ref(defaultShopInfo())
function normalizeShop(list) {
  return list.map((s, i) => ({
    id: s.id || ('s' + i + Date.now().toString(36)),
    label: s.label || '',
    value: s.value || '',
    position: s.position === 'tail' ? 'tail' : 'head',
  }))
}
function loadShopInfo() {
  try {
    const saved = JSON.parse(localStorage.getItem(SHOP_KEY) || 'null')
    if (Array.isArray(saved)) {
      if (saved.length) shopInfo.value = normalizeShop(saved)
    } else if (saved && typeof saved === 'object') {
      // 兼容旧结构 { contact, gameName }
      shopInfo.value = [
        { id: 'c1', label: '代肝联系方式', value: saved.contact || '', position: 'head' },
        { id: 'c2', label: '代肝游戏名称', value: saved.gameName || '', position: 'head' },
      ]
    }
  } catch { /* ignore */ }
}
onMounted(loadShopInfo)
function addShopInfo() {
  shopInfo.value.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), label: '', value: '', position: 'head' })
}
function moveShop(i, dir) {
  const t = i + dir
  if (t < 0 || t >= shopInfo.value.length) return
  const [x] = shopInfo.value.splice(i, 1)
  shopInfo.value.splice(t, 0, x)
}

const allCategories = computed(() => prices.value[game.value]?.categories || [])
const filteredCats = computed(() => {
  const cats = allCategories.value
  return mode.value === 'all' ? cats : cats.filter(c => c.mode === mode.value)
})
function catIndex(cat) { return allCategories.value.indexOf(cat) }

function nextKey() {
  let max = 0
  allCategories.value.forEach(c => c.items.forEach(it => {
    const n = Number(it.key)
    if (Number.isFinite(n) && n > max) max = n
  }))
  return max + 1
}
function addCategory() {
  allCategories.value.push({ name: '新类别', mode: mode.value === 'all' ? 'custom' : mode.value, items: [] })
}
function addItem(cat) {
  cat.items.push({ key: nextKey(), name: '', price: 0, unit: '', note: '' })
}
function removeCat(cat) {
  const all = allCategories.value
  const i = all.indexOf(cat)
  if (i >= 0) all.splice(i, 1)
}
function moveCat(cat, dir) {
  const all = allCategories.value
  const i = all.indexOf(cat)
  const t = i + dir
  if (i < 0 || t < 0 || t >= all.length) return
  const [x] = all.splice(i, 1)
  all.splice(t, 0, x)
}
function moveItem(cat, i, dir) {
  const t = i + dir
  if (t < 0 || t >= cat.items.length) return
  const [x] = cat.items.splice(i, 1)
  cat.items.splice(t, 0, x)
}

function saveToLocal() {
  try {
    localStorage.setItem(SHOP_KEY, JSON.stringify(shopInfo.value.map(s => ({
      id: s.id, label: s.label, value: s.value, position: s.position,
    }))))
  } catch { /* ignore */ }
  try { persist() } catch { /* ignore */ }
}
function downloadJSON() {
  const clean = allCategories.value.map(c => ({ name: c.name, mode: c.mode, items: c.items }))
  const json = JSON.stringify({ categories: clean }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${game.value}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.ad-body { padding: 12px 16px; }
.ad-shop { border: 2px solid var(--border-color); margin-bottom: 16px; background: var(--bg-primary); }
.ad-col-pos { width: 70px; flex-shrink: 0; }
.ad-col-label { width: 120px; flex-shrink: 0; }
.ad-cat { border: 2px solid var(--border-color); margin-bottom: 16px; background: var(--bg-primary); }
.ad-cat-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
.ad-cat-name { flex: 1; font-weight: 700; font-size: 13px; }
.ad-cat-items { padding: 8px 12px; }
.ad-item-header { display: flex; gap: 6px; padding: 4px 0; border-bottom: 1px solid var(--border-color); margin-bottom: 6px; }
.ad-item-header span { font-size: 10px; font-family: monospace; opacity: 0.4; }
.ad-item { display: flex; gap: 6px; align-items: center; padding: 3px 0; }
.ad-inp { border: 2px solid var(--border-color); padding: 3px 6px; font-size: 12px; font-family: inherit; background: var(--bg-primary); color: var(--text-primary); }
.ad-inp:focus { border-color: var(--btn-hover-bg); outline: none; }
.ad-col-key { width: 100px; flex-shrink: 0; }
.ad-col-name { width: 160px; flex-shrink: 0; }
.ad-col-price { width: 60px; flex-shrink: 0; }
.ad-col-unit { width: 50px; flex-shrink: 0; }
.ad-col-note { flex: 1; min-width: 80px; }
.ad-sort { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; }
.ad-sort-sm { gap: 0; }
.ad-sort-btn { font-size: 9px; padding: 0 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); cursor: pointer; font-family: monospace; line-height: 1.4; color: var(--text-primary); transition: background var(--motion-duration-normal), color var(--motion-duration-normal); }
.ad-sort-btn:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.ad-sort-btn:disabled { opacity: 0.15; cursor: default; }
.ad-sort-btn:disabled:hover { background: var(--bg-secondary); color: var(--text-primary); }
.ad-btn-del { font-size: 14px; padding: 2px 6px; border: 2px solid var(--border-color); background: var(--bg-secondary); cursor: pointer; font-family: monospace; color: var(--text-primary); flex-shrink: 0; transition: background var(--motion-duration-normal), color var(--motion-duration-normal), border-color var(--motion-duration-normal); }
.ad-btn-del:hover { background: #d00; color: #fff; border-color: #d00; }
.ad-add-item { font-size: 11px; padding: 4px 8px; border: 2px dashed var(--border-color); background: var(--bg-secondary); cursor: pointer; font-family: monospace; margin-top: 6px; width: 100%; color: var(--text-primary); transition: border-color var(--motion-duration-normal); }
.ad-add-item:hover { border-color: var(--btn-hover-bg); }
</style>

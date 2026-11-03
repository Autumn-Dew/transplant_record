<template>
  <div class="local-music" :class="{ entered: entered }">
    <div class="local-header">
      <div><h2>数据管理</h2><p class="desc">价格数据 · 游戏与服务项目（游戏目录为唯一数据源，创建项目 / 筛选 / 统计 / 价格表自动同步）</p></div>
    </div>

    <div class="local-toolbar">
      <span class="view-tabs">
        <span class="tl-entry-btn" :class="{ active: section === 'prices' }" @click="section = 'prices'">价格数据</span>
        <span class="tl-entry-btn" :class="{ active: section === 'games' }" @click="section = 'games'">游戏与服务</span>
      </span>
      <template v-if="section === 'prices'">
        <SelectBox v-model="game" :options="gameOptions" width="130px" />
        <button class="rc-global-btn" @click="addCategory">+ 类别</button>
      </template>
      <div class="toolbar-spacer"></div>
      <template v-if="section === 'prices'">
        <button class="rc-global-btn" @click="exportCurrentJSON" title="导出当前选中游戏的价格表">导出当前</button>
        <button class="rc-global-btn" @click="downloadAllJSON" title="把全部游戏的价格表导出成一份 JSON（可用于导入）">导出全部</button>
        <button
          class="rc-global-btn"
          title="只导入到当前选中的游戏：可以选单游戏格式 { categories: [...] }，也可以选整份 JSON（只取当前游戏那部分）"
          @click="pickImport('current')"
        >导入当前</button>
        <button
          class="rc-global-btn"
          title="导入整份 JSON：文件里有哪些游戏，就替换哪些游戏的价格表"
          @click="pickImport('all')"
        >导入全部</button>
        <input ref="importRef" type="file" accept="application/json,.json" class="ad-import-file" @change="importJSON" />
        <span class="ad-import-msg" v-if="importMsg">{{ importMsg }}</span>
        <button
          class="rc-global-btn"
          :class="{ 'is-dirty': dirty }"
          :title="dirty ? '有未保存的修改（切页或关闭窗口会丢失）' : '当前没有未保存的修改'"
          @click="saveToLocal"
        >保存{{ dirty ? ' ·未保存' : '' }}</button>
      </template>
    </div>

    <!-- 游戏与服务：原先的独立「游戏管理」页面已并入此处（不再有独立导航入口，游戏不使用图标） -->
    <GameSection v-if="section === 'games'" />

    <div v-else class="ad-body">
      <div class="ad-shop">
        <div class="ad-cat-head">
          <span class="ad-cat-name" style="padding-left:8px">店铺信息</span>
          <button
            class="ad-add-item"
            style="margin-left:8px"
            :title="shopHidden ? '价格表当前不显示店铺信息，点此恢复显示' : '隐藏后价格表将不显示店铺信息'"
            @click="toggleShopHidden"
          >{{ shopHidden ? '已隐藏（点此显示）' : '在价格表中隐藏' }}</button>
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
      <div v-for="(cat, ci) in allCategories" :key="ci" class="ad-cat">
        <div class="ad-cat-head">
          <span class="ad-sort">
            <button class="ad-sort-btn" @click="moveCat(cat, -1)" :disabled="catIndex(cat) === 0">↑</button>
            <button class="ad-sort-btn" @click="moveCat(cat, 1)" :disabled="catIndex(cat) === allCategories.length - 1">↓</button>
          </span>
          <input v-model="cat.name" class="ad-inp ad-cat-name" :class="{ 'ad-inp-hidden': cat.hidden }" />
          <button class="ad-btn-hide" :class="{ 'is-hidden': cat.hidden }" @click="toggleHidden(cat)" :title="cat.hidden ? '当前状态：已隐藏（价格一览、导出图、文案里都不出现）。点一下改为显示' : '当前状态：显示中。点一下改为隐藏（数据保留，随时可恢复）'">{{ cat.hidden ? '隐藏' : '显示' }}</button>
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
            <span style="width:60px"></span>
          </div>
          <div v-for="(item, ii) in cat.items" :key="ii" class="ad-item" :class="{ 'ad-item-hidden': item.hidden }">
            <span class="ad-sort ad-sort-sm">
              <button class="ad-sort-btn" @click="moveItem(cat, ii, -1)" :disabled="ii === 0">↑</button>
              <button class="ad-sort-btn" @click="moveItem(cat, ii, 1)" :disabled="ii === cat.items.length - 1">↓</button>
            </span>
            <input v-model.number="item.key" class="ad-inp ad-col-key" type="number" />
            <input v-model="item.name" class="ad-inp ad-col-name" />
            <input v-model.number="item.price" class="ad-inp ad-col-price" type="number" step="any" />
            <input v-model="item.unit" class="ad-inp ad-col-unit" placeholder="—" />
            <input v-model="item.note" class="ad-inp ad-col-note" placeholder="—" />
            <button class="ad-btn-hide ad-btn-hide-sm" :class="{ 'is-hidden': item.hidden }" @click="toggleHidden(item)" :title="item.hidden ? '当前状态：已隐藏（价格一览、导出图、文案里都不出现）。点一下改为显示' : '当前状态：显示中。点一下改为隐藏（数据保留，随时可恢复）'">{{ item.hidden ? '隐藏' : '显示' }}</button>
            <button class="ad-btn-del" @click="cat.items.splice(ii, 1)">×</button>
          </div>
          <button class="ad-add-item" @click="addItem(cat)">+ 项目</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { usePrices } from '@/composables/usePrices.js'
import SelectBox from '@/components/SelectBox.vue'
import GameSection from '@/components/GameSection.vue'
import { gamesRepo } from '@/data/repos.js'
import { priceGameOptions as buildGameOptions } from '@/domain/games.js'
import { readShopForGame, writeShopForGame, readShopHidden, writeShopHidden } from '@/data/shop-info.js'
import { usePageEnter } from '@/composables/usePageEnter.js'

const { prices, save: persist } = usePrices()
// 数据管理分为两个分类：价格数据 / 游戏与服务（原「游戏管理」页面已并入）
const section = ref('prices')
const game = ref('')
// 游戏列表来自「游戏管理」目录
const gameOptions = computed(() => buildGameOptions(gamesRepo.state.value))

// 入场动画（统一节奏见 composables/usePageEnter）；数据补齐统一在 src/main.js 的 hydrateAll() 里做
const { entered } = usePageEnter()

// 游戏目录可能在挂载后才补齐：数据到了再决定当前游戏（不再硬编码回退到某个游戏）
watch(gameOptions, (opts) => {
  if (!opts.length) return
  if (!opts.some(o => o.value === game.value)) game.value = opts[0].value
}, { immediate: true })

// ══════ 店铺信息（数组：位置/名称/内容，供价格一览头/尾展示） ══════
const positionOptions = [{ value: 'head', label: '头部' }, { value: 'tail', label: '尾部' }]
function defaultShopInfo() {
  return [
    { id: 'c1', label: '代肝联系方式', value: '', position: 'head' },
    { id: 'c2', label: '代肝游戏名称', value: '', position: 'head' },
  ]
}
const shopInfo = ref(defaultShopInfo())
// 是否在价格表中隐藏店铺信息（独立开关，不影响店铺数据本身）
const shopHidden = ref(readShopHidden())
function toggleShopHidden() {
  shopHidden.value = !shopHidden.value
  writeShopHidden(shopHidden.value)
}
function normalizeShop(list) {
  return list.map((s, i) => ({
    id: s.id || ('s' + i + Date.now().toString(36)),
    label: s.label || '',
    value: s.value || '',
    position: s.position === 'tail' ? 'tail' : 'head',
  }))
}
function loadShopInfo() {
  const { list: saved } = readShopForGame(game.value, gameOptions.value.map(o => o.value))
  if (Array.isArray(saved)) {
    if (saved.length) shopInfo.value = normalizeShop(saved)
  } else if (saved && typeof saved === 'object') {
    // 兼容旧结构 { contact, gameName }
    shopInfo.value = [
      { id: 'c1', label: '代肝联系方式', value: saved.contact || '', position: 'head' },
      { id: 'c2', label: '代肝游戏名称', value: saved.gameName || '', position: 'head' },
    ]
  }
}
onMounted(loadShopInfo)
// 切换游戏时加载该游戏的店铺信息（避免把 A 的店铺信息写到 B）
// —— 复位未保存标记的逻辑与它合并写在下方的 watch(game) 里
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

// 有些游戏根本没有价格表（异环、以及后来新增的游戏）：
// 之前 allCategories 在这种情况下返回的是一个「临时空数组」，新增的类别 push 进去就丢，
// 表现为「能点新增、但保存后什么都没有」。这里先给该游戏建一张空表。
watch(game, (g) => {
  if (!g) return
  if (!prices.value[g]) prices.value[g] = { categories: [] }
}, { immediate: true })
function catIndex(cat) { return allCategories.value.indexOf(cat) }

// ── 未保存标记 ──
// 价格与店铺信息是「改动直接进内存单例、点『保存』才落盘」：模板里的 v-model 绑的就是
// usePrices 的 prices 对象。若不提示，切页 / 关窗口时这些改动会静默丢失。
// 这里只在「用户改动了数据」时亮标记，装载与切换游戏阶段的变化不算。
const dirty = ref(false)
let dirtyReady = false
onMounted(() => { nextTick(() => { dirtyReady = true }) })
watch([allCategories, shopInfo], () => { if (dirtyReady) dirty.value = true }, { deep: true })
// 切游戏 = 换了一份数据：先复位标记，装载完成（下一次 flush 之后）再清一次，
// 避免 loadShopInfo 写入的新数据把标记又点亮。
watch(game, async () => {
  dirty.value = false
  loadShopInfo()
  await nextTick()
  dirty.value = false
})

function nextKey() {
  let max = 0
  allCategories.value.forEach(c => c.items.forEach(it => {
    const n = Number(it.key)
    if (Number.isFinite(n) && n > max) max = n
  }))
  return max + 1
}
// 类别 / 项目级隐藏：与每日汇报的卡片隐藏同一套做法 ——
// 只影响展示（价格一览、导出图、文案），数据完整保留，点一下就恢复。
function toggleHidden(obj) {
  if (!obj) return
  if (obj.hidden) delete obj.hidden
  else obj.hidden = true
  dirty.value = true
}

function addCategory() {
  const g = game.value
  if (!g) return
  // 兜底：该游戏还没有价格表时先建（与上面 watch 同样的原因）
  if (!prices.value[g]) prices.value[g] = { categories: [] }
  const cats = prices.value[g].categories
  // 名字必须唯一：保存时会按名称去重，连点两次「新增类别」会只剩一个
  const names = new Set(cats.map(c => String(c && c.name)))
  let name = '新类别'
  let n = 2
  while (names.has(name)) name = `新类别 ${n++}`
  cats.push({ name, items: [] })
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
  writeShopForGame(game.value, shopInfo.value, gameOptions.value.map(o => o.value))
  try { persist() } catch { /* ignore */ }
  dirty.value = false
}
function exportCurrentJSON() {
  const clean = allCategories.value.map(c => ({ name: c.name, items: c.items }))
  const json = JSON.stringify({ categories: clean }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${game.value}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 导出全部游戏：{"endfield": {"categories": [...]}, "ak": {...}} —— 与导入的整份格式对称
function downloadAllJSON() {
  const out = {}
  for (const [g, v] of Object.entries(prices.value)) {
    if (g === '__version' || !v || !Array.isArray(v.categories)) continue
    out[g] = { categories: v.categories.map(c => ({ name: c.name, items: c.items })) }
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'prices-all.json'
  a.click()
  URL.revokeObjectURL(url)
}

// ── 导入 JSON ──
// 两种文件都吃：
//   1. 本页「下载」导出的单游戏格式 { categories: [...] }（或直接是数组）
//   2. 含多个游戏的整份 JSON { endfield: { categories }, ak: { categories }, ... }
// 导入即落盘（不用再点「保存」），同名游戏的价格表会被替换。
const importRef = ref(null)
const importMsg = ref('')
let importTimer = null

let importScope = 'all'
function pickImport(scope = 'all') {
  importScope = scope
  if (importRef.value) importRef.value.click()
}

function normalizeImportedCats(list) {
  return (Array.isArray(list) ? list : [])
    // 自定义类别已取消：导入时一并丢弃，也不再写 mode
    .filter(c => !c || c.mode !== 'custom')
    .map(c => ({
      name: String((c && c.name) != null ? c.name : '').trim() || '未命名类别',
      items: (Array.isArray(c && c.items) ? c.items : [])
        .map((it, i) => {
          const n = Number(it && it.key)
          return {
            key: Number.isInteger(n) && n > 0 ? n : i + 1,
            name: String((it && it.name) != null ? it.name : '').trim(),
            price: Number(it && it.price) || 0,
            unit: String((it && it.unit) != null ? it.unit : ''),
            note: String((it && it.note) != null ? it.note : ''),
          }
        }),
    }))
    .filter(c => c.items.length || c.name)
}

function flashImport(msg) {
  importMsg.value = msg
  if (importTimer) clearTimeout(importTimer)
  importTimer = setTimeout(() => { importMsg.value = '' }, 6000)
}

async function importJSON(e) {
  const file = e && e.target && e.target.files ? e.target.files[0] : null
  if (e && e.target) e.target.value = ''   // 允许连续选同一个文件
  if (!file) return
  try {
    const raw = JSON.parse(await file.text())
    const list = Array.isArray(raw) ? raw : null
    const single = list || (raw && Array.isArray(raw.categories) ? raw.categories : null)
    const multi = !single && raw && typeof raw === 'object'
      ? Object.entries(raw).filter(([k, v]) => k !== '__version' && v && Array.isArray(v.categories))
      : []

    // 「导入当前」：不管文件是单游戏还是整份，都只改当前选中的游戏
    if (importScope === 'current') {
      const g = game.value
      if (!g) throw new Error('先在左上角选一个游戏')
      let list = single
      if (!list && raw && raw[g] && Array.isArray(raw[g].categories)) list = raw[g].categories
      if (!list) throw new Error(`文件里没有「${g}」的价格数据`)
      const cats = normalizeImportedCats(list)
      if (!cats.length) throw new Error('文件里没有可用的类别')
      if (!prices.value[g]) prices.value[g] = { categories: [] }
      prices.value[g].categories = cats
      persist()
      dirty.value = false
      flashImport(`已导入 ${g}：${cats.length} 个类别 / ${cats.reduce((n, c) => n + c.items.length, 0)} 项`)
      return
    }

    if (single) {
      const cats = normalizeImportedCats(single)
      if (!cats.length) throw new Error('文件里没有可用的类别')
      const g = game.value
      if (!g) throw new Error('先在左上角选一个游戏')
      if (!prices.value[g]) prices.value[g] = { categories: [] }
      prices.value[g].categories = cats
      persist()
      dirty.value = false
      flashImport(`已导入 ${g}：${cats.length} 个类别 / ${cats.reduce((n, c) => n + c.items.length, 0)} 项`)
      return
    }

    if (multi.length) {
      let catsTotal = 0, gamesTotal = 0
      for (const [g, v] of multi) {
        const cats = normalizeImportedCats(v.categories)
        if (!cats.length) continue
        prices.value[g] = { categories: cats }
        catsTotal += cats.length
        gamesTotal++
      }
      if (!gamesTotal) throw new Error('文件里没有可用的类别')
      persist()
      dirty.value = false
      flashImport(`已导入 ${gamesTotal} 个游戏 / ${catsTotal} 个类别`)
      return
    }

    throw new Error('认不出来：需要 { categories: [...] } 或 { 游戏id: { categories } }')
  } catch (err) {
    flashImport('导入失败：' + (err && err.message ? err.message : err))
  }
}
</script>

<style scoped>
/* ── 隐藏开关（参考每日汇报的隐藏/已隐藏）── */
.ad-btn-hide {
  flex: 0 0 auto; height: 24px; padding: 0 10px;
  border: 1px solid var(--border-color); font-size: 11px; cursor: pointer; white-space: nowrap;
}
/* 显示中：主题主色实心（开）——文字写的是当前状态，颜色也对应状态 */
.ad-btn-hide {
  background: var(--accent); border-color: var(--accent); color: var(--accent-ink, #fff);
  font-weight: 700; box-shadow: inset 0 0 0 2px var(--bg-secondary);
}
.ad-btn-hide:hover { filter: brightness(1.12); }
/* 已隐藏：素色（关），点一下恢复 */
.ad-btn-hide.is-hidden {
  background: var(--bg-secondary); border-color: var(--border-color); color: var(--text-secondary);
  font-weight: 600; box-shadow: none;
}
.ad-btn-hide.is-hidden:hover { background: var(--btn-hover-bg, var(--border-color)); color: var(--btn-hover-fg, #fff); filter: none; }
.ad-btn-hide-sm { width: 44px; padding: 0; }
.ad-inp-hidden { opacity: 0.45; text-decoration: line-through; }
.ad-item-hidden { opacity: 0.5; }
.ad-body { padding: 12px 16px; }
/* 导入：文件选择器藏起来，由「导入」按钮触发 */
.ad-import-file { display: none; }
.ad-import-msg {
  font-size: 11px; font-family: var(--font-mono); opacity: 0.75;
  max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ad-shop { border: 2px solid var(--border-color); margin-bottom: 16px; background: var(--bg-primary); }
.ad-col-pos { width: 70px; flex-shrink: 0; }
.ad-col-label { width: 120px; flex-shrink: 0; }
.ad-cat { border: 2px solid var(--border-color); margin-bottom: 16px; background: var(--bg-primary); }
.ad-cat-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
.ad-cat-name { flex: 1; font-weight: 700; font-size: 13px; }
.ad-cat-items { padding: 8px 12px; }
.ad-item-header { display: flex; gap: 6px; padding: 4px 0; border-bottom: 1px solid var(--border-color); margin-bottom: 6px; }
.ad-item-header span { font-size: 10px; font-family: var(--font-mono); opacity: 0.4; }
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
.ad-sort-btn { font-size: 9px; padding: 0 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); cursor: pointer; font-family: var(--font-mono); line-height: 1.4; color: var(--text-primary); transition: background var(--motion-duration-normal), color var(--motion-duration-normal); }
.ad-sort-btn:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.ad-sort-btn:disabled { opacity: 0.15; cursor: default; }
.ad-sort-btn:disabled:hover { background: var(--bg-secondary); color: var(--text-primary); }
.ad-btn-del { font-size: 14px; padding: 2px 6px; border: 2px solid var(--border-color); background: var(--bg-secondary); cursor: pointer; font-family: var(--font-mono); color: var(--text-primary); flex-shrink: 0; transition: background var(--motion-duration-normal), color var(--motion-duration-normal), border-color var(--motion-duration-normal); }
.ad-btn-del:hover { background: #d00; color: #fff; border-color: #d00; }
.ad-add-item { font-size: 11px; padding: 4px 8px; border: 2px dashed var(--border-color); background: var(--bg-secondary); cursor: pointer; font-family: var(--font-mono); margin-top: 6px; width: 100%; color: var(--text-primary); transition: border-color var(--motion-duration-normal); }
.ad-add-item:hover { border-color: var(--btn-hover-bg); }
</style>

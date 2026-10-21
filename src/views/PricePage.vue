<template>
  <div class="local-music" :class="{ entered: entered }">
    <div class="local-header">
      <div><h2>价格一览</h2><p class="desc">代肝服务价目表（本地数据）</p></div>
    </div>

    <div class="local-toolbar">
      <SelectBox v-model="game" :options="gameOptions" width="130px" />
      <span class="view-tabs">
        <span class="tl-entry-btn" :class="{ active: mode === 'preset' }" @click="mode = 'preset'">预设</span>
        <span class="tl-entry-btn" :class="{ active: mode === 'custom' }" @click="mode = 'custom'">自定义</span>
        <span class="tl-entry-btn" :class="{ active: mode === 'all' }" @click="mode = 'all'">全部</span>
      </span>
      <button class="rc-global-btn" @click="exportImage(false)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
        <span>导出图片</span>
      </button>
      <!-- 与每日汇报同款：直接把当前画布写成 PNG 放进系统剪贴板 -->
      <button class="rc-global-btn" @click="exportImage(true)" title="把价目表图片复制到剪贴板">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
        <span>复制到剪切板</span>
      </button>
      <!-- 画布外观：原版（默认）/ 终末地风格，独立持久化，不影响业务数据 -->
      <span class="view-tabs">
        <span class="tl-entry-btn" :class="{ active: !isEf }" @click="setTheme('classic')" title="原版价格表">原版</span>
        <span class="tl-entry-btn" :class="{ active: isEf }" @click="setTheme('endfield')" title="终末地风格：工单卡片 / 三色条 / 宽体数字">终末地</span>
      </span>
      <label class="rc-global-btn" style="cursor:pointer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <span>背景</span>
        <input type="file" accept="image/*" hidden @change="onBgFile">
      </label>
      <button v-if="bgUrl" class="rc-global-btn" @click="clearBg">✕ 清除</button>
      <div class="toolbar-spacer"></div>
    </div>

    <div class="pr-body">
      <div class="pr-wrap" :class="{ 'pr-ef': isEf }" ref="wrapRef" :style="bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
        <div class="pr-overlay" v-if="bgUrl"></div>
        <!-- 终末地画布装饰：真实元素 + 绝对定位。
             不用多层 background-image 定位实心色块 —— html2canvas 会忽略
             background-size / position 列表，把整层色块铺满画布（导出全黑）。 -->
        <div class="pr-ef-deco" v-if="isEf" aria-hidden="true">
          <i class="pr-ef-rail"></i>
          <i class="pr-ef-cross"></i>
          <i class="pr-ef-corner pr-ef-corner-lime"></i>
          <i class="pr-ef-corner pr-ef-corner-ink"></i>
          <i class="pr-ef-corner pr-ef-corner-foot"></i>
        </div>
        <div class="pr-content">
          <div class="pr-shop-info" v-if="shopHead.length && !shopHidden">
            <div class="pr-shop-item" v-for="info in shopHead" :key="info.id">
              <span class="pr-shop-label">{{ info.label }}</span>
              <span class="pr-shop-val">{{ info.value || '—' }}</span>
            </div>
          </div>
          <!-- 原版：每个分类一块表格 -->
          <template v-if="!isEf">
            <div v-for="cat in filteredCats" :key="cat._cid" class="pr-cat">
              <div class="pr-cat-head">
                <span class="pr-cat-name">{{ cat.name }}</span>
                <span class="pr-cat-badge">{{ cat.mode === 'preset' ? '预设' : '自定义' }}</span>
              </div>
              <table class="pr-table">
                <thead>
                  <tr>
                    <th class="pr-col-name">项目</th>
                    <th class="pr-col-price">价格</th>
                    <th class="pr-col-note">备注</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in cat.items" :key="item.key">
                    <td class="pr-col-name">{{ item.name }}</td>
                    <td class="pr-col-price">
                      <span class="pr-price">{{ item.price }}r</span>
                      <span v-if="item.priceMax" class="pr-range"> ~ {{ item.priceMax }}r</span>
                      <span v-if="item.unit" class="pr-unit"> / {{ item.unit }}</span>
                    </td>
                    <td class="pr-col-note">{{ item.note || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
          <!-- 终末地风格：分类是卡片（第一张占满、其余并排两列），每个单项一行 -->
          <div class="pr-ef-cards" v-else-if="isEf">
            <div
              v-for="(cat, ci) in filteredCats"
              :key="cat._cid"
              class="pr-ef-card"
              :class="{ wide: ci === 0 }"
              :style="{ '--pr-ef-nm-w': cardNameWidths[ci] ? cardNameWidths[ci] + 'px' : '22%' }"
            >
              <i class="pr-ef-card-deco" aria-hidden="true"></i>
              <div class="pr-ef-card-head">
                <span class="pr-ef-cat">// {{ String(ci + 1).padStart(2, '0') }}</span>
                <span class="pr-ef-cat-name">{{ cat.name }}</span>
              </div>
              <div class="pr-ef-items">
                <div v-for="(item, idx) in cat.items" :key="item.key" class="pr-ef-item">
                  <span class="pr-ef-no">{{ String(idx + 1).padStart(2, '0') }}</span>
                  <span class="pr-ef-nm">{{ item.name }}</span>
                  <span class="pr-ef-note" :class="{ 'is-empty': !item.note }"><span class="pr-ef-note-text">{{ item.note || "" }}</span></span>
                  <span class="pr-ef-pr">{{ item.price }}r<template v-if="item.priceMax">~{{ item.priceMax }}r</template><template v-if="item.unit">/{{ item.unit }}</template></span>
                </div>
              </div>
            </div>
          </div>
          <div class="pr-shop-info pr-shop-tail" v-if="shopTail.length && !shopHidden">
            <div class="pr-shop-item" v-for="info in shopTail" :key="info.id">
              <span class="pr-shop-label">{{ info.label }}</span>
              <span class="pr-shop-val">{{ info.value || '—' }}</span>
            </div>
          </div>
          <!-- 个人标签：画布右下角的署名（导出图里也保留） -->
          <div class="pr-sign" :class="{ 'pr-sign-ef': isEf }">
            <span class="pr-sign-mark"></span>
            <span class="pr-sign-name">{{ SIGNATURE }}</span>
          </div>
        </div>
      </div>
    </div>
    <!-- 名称列的测量尺：按「最长的单项名称」定列宽，放在画布外，不影响导出尺寸 -->
    <span class="pr-ef-measure" ref="measureRef" aria-hidden="true"></span>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import html2canvas from 'html2canvas'
import { usePrices } from '@/composables/usePrices.js'
import { gamesRepo } from '@/data/repos.js'
import { gameOptions as buildGameOptions } from '@/domain/games.js'
import SelectBox from '@/components/SelectBox.vue'
import { readShopForGame, readShopHidden } from '@/data/shop-info.js'
import { KEYS, readJSON, writeJSON } from '@/data/storage.js'

// 个人标签：价格表画布右下角的署名（导出图里也保留）
const SIGNATURE = '秋の露'

// ── 画布外观：原版（默认）/ 终末地风格 ──
// 与每日汇报同一套思路：外观独立持久化，不动任何业务数据（价格仍在 tr-prices 里）。
const PRICE_THEMES = ['classic', 'endfield']
function normalizePriceTheme(v) {
  const raw = String(v == null ? '' : v).replace(/^"|"$/g, '').trim()
  return PRICE_THEMES.includes(raw) ? raw : 'classic'
}
const priceTheme = ref(normalizePriceTheme(readJSON(KEYS.PRICE_THEME, null)))
const isEf = computed(() => priceTheme.value === 'endfield')
function setTheme(id) {
  priceTheme.value = normalizePriceTheme(id)
  try { writeJSON(KEYS.PRICE_THEME, priceTheme.value) } catch { /* 存储失败不影响当前会话 */ }
}

const { getGame } = usePrices()
const game = ref('endfield')
const mode = ref('preset')
const wrapRef = ref(null)
const bgUrl = ref(null)
const shopList = ref([])
// 店铺信息是否在价格表里隐藏（「数据管理」里的开关）
const shopHidden = ref(readShopHidden())
function onShopHiddenChanged() { shopHidden.value = readShopHidden() }
onMounted(() => window.addEventListener('tr-shop-hidden-changed', onShopHiddenChanged))
onUnmounted(() => window.removeEventListener('tr-shop-hidden-changed', onShopHiddenChanged))
const shopHead = computed(() => shopList.value.filter(s => s.position !== 'tail'))
const shopTail = computed(() => shopList.value.filter(s => s.position === 'tail'))
// 游戏列表与「数据管理」共用同一份数据（游戏与服务），不再写死
const gameOptions = computed(() => buildGameOptions(gamesRepo.state.value))

function loadShopInfo() {
  // 店铺信息每个游戏独立（旧的全游戏共用数据会自动迁移：原内容复制给每个游戏）
  try {
    const { list } = readShopForGame(game.value, gameOptions.value.map(o => o.value))
    shopList.value = Array.isArray(list) ? list : []
  } catch { /* ignore */ }
}
onMounted(() => {
  gamesRepo.hydrate()
  // 当前游戏若已不在游戏列表里，回退到第一个可用游戏
  const opts = gameOptions.value.filter(o => o.value && o.value !== 'all')
  if (opts.length && !opts.some(o => o.value === game.value)) game.value = opts[0].value
  loadShopInfo()
})
// 切换游戏时加载该游戏的店铺信息
watch(game, loadShopInfo)

const entered = ref(false)
onMounted(() => { requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true })) })

let cid = 0
const filteredCats = computed(() => {
  const cats = getGame(game.value).categories || []
  cats.forEach(c => { if (c._cid === undefined) c._cid = ++cid })
  return mode.value === 'all' ? cats : cats.filter(c => c.mode === mode.value)
})

/* ── 名称列宽度：按「每张卡片自己的最长名称」算 ──
   不写死百分比（22% 会让短名称那几行留一大片空白、长名称又换行）。
   也不能全局取一个最大值：单独占满一整行的类别（第一张卡片）名称都很短
   （普托 / 精托 / 全托），用全局最大值会把名称列撑到 140px 宽，
   名称与备注之间空出一大截 —— 所以**每张卡片各自取自己最长的名称**。
   用画布外的一把「尺子」逐条量宽度，取该卡片的最大值 + 名称列右内边距，
   写到卡片的 CSS 变量 --pr-ef-nm-w 上，交给 .pr-ef-nm 做 flex-basis；
   备注列 flex: 1 1 auto，自然吃掉剩下的全部宽度。
   尺子放在画布外：不影响画布尺寸，也不会被导出。 */
const measureRef = ref(null)
const cardNameWidths = ref([])   // 与 filteredCats 一一对应的名称列宽（px）
const NAME_COL_PAD = 12          // 名称列 padding-right(10) + 2px 余量

function measureNameColumn() {
  const el = measureRef.value
  if (!el || !isEf.value) { cardNameWidths.value = []; return }
  const widths = filteredCats.value.map((cat) => {
    let max = 0
    for (const item of cat.items || []) {
      el.textContent = String(item.name || '')
      const w = el.getBoundingClientRect().width
      if (w > max) max = w
    }
    return max > 0 ? Math.ceil(max) + NAME_COL_PAD : 0
  })
  el.textContent = ''
  cardNameWidths.value = widths
}
onMounted(() => nextTick(measureNameColumn))
watch([filteredCats, isEf, game, mode], () => nextTick(measureNameColumn), { deep: true })

function onBgFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (bgUrl.value) URL.revokeObjectURL(bgUrl.value)
  bgUrl.value = URL.createObjectURL(file)
}
function clearBg() {
  if (bgUrl.value) URL.revokeObjectURL(bgUrl.value)
  bgUrl.value = null
}
onUnmounted(() => { if (bgUrl.value) URL.revokeObjectURL(bgUrl.value) })

// toClipboard=true：只写系统剪贴板（与每日汇报「复制到剪切板」同款）
async function exportImage(toClipboard = false) {
  if (!wrapRef.value) return
  const now = new Date()
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  try {
    const canvas = await html2canvas(wrapRef.value, { backgroundColor: isEf.value ? '#f4f4f2' : '#ffffff', scale: 2 })
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    if (!blob) return
    if (toClipboard) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]) } catch (e) { console.error(e) }
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `价格一览_${game.value}_${ts}.png`
    a.click()
    URL.revokeObjectURL(url)
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]) } catch {}
  } catch {}
}
</script>

<style scoped>
/* 导出区域：完全按原站布局与样式（白色系） */
.pr-body { padding: 12px 0; }
.pr-wrap { position: relative; max-width: 900px; margin: 0 auto; padding: 80px 24px 24px; background: #fff; color: #0d0d0d; }
.pr-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.72); z-index: 0; pointer-events: none; }
.pr-content { position: relative; z-index: 1; }
.pr-shop-info {
  display: flex; flex-wrap: wrap; gap: 8px 32px;
  margin-bottom: 16px; padding: 8px 14px;
  border: 1px solid rgba(0,0,0,0.12); background: rgba(0,0,0,0.02);
}
.pr-shop-tail { margin-top: 16px; margin-bottom: 0; }
.pr-shop-item { display: flex; align-items: baseline; gap: 10px; }
/* 字体与页面内容一致：名称 ← 表格「项目」列，内容 ← 表格「价格」列(.pr-price) */
.pr-shop-label { font-size: 13px; font-weight: 600; }
.pr-shop-val { font-family: var(--font-mono); font-weight: 800; font-size: 14px; word-break: break-all; }
.pr-cat { margin-bottom: 16px; border: 1px solid rgba(0,0,0,0.12); }
.pr-cat-head { display: flex; align-items: baseline; gap: 10px; padding: 8px 14px; border-bottom: 1px solid rgba(0,0,0,0.08); }
.pr-cat-name { font-size: 13px; font-weight: 800; letter-spacing: 2px; }
.pr-cat-badge { font-size: 10px; font-family: var(--font-mono); padding: 1px 6px; border: 1px solid rgba(0,0,0,0.3); opacity: 0.7; }
.pr-table { width: 100%; border-collapse: collapse; }
.pr-table th { text-align: left; font-size: 10px; font-family: var(--font-mono); font-weight: 700; letter-spacing: 2px; opacity: 0.6; padding: 5px 14px; border-bottom: 1px solid rgba(0,0,0,0.1); }
.pr-table td { padding: 5px 14px; border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 13px; font-weight: 600; }
.pr-table tr:last-child td { border-bottom: none; }
.pr-col-name { width: 32%; }
.pr-col-price { width: 20%; white-space: nowrap; }
.pr-col-note { width: 48%; opacity: 0.65; font-size: 12px; font-weight: 400; }
.pr-price { font-family: var(--font-mono); font-weight: 800; font-size: 14px; }
.pr-range { font-family: var(--font-mono); opacity: 0.7; font-weight: 700; }
.pr-unit { font-family: var(--font-mono); opacity: 0.55; font-size: 11px; font-weight: 600; }
/* 换成正文字体后，金额靠等宽数字对齐（原来靠等宽字体本身） */
.pr-shop-val,
.pr-price,
.pr-range,
.pr-unit,
.pr-ef-no,
.pr-ef-pr { font-variant-numeric: tabular-nums; }

/* ══════════════════════════════════════════════════════════════════
   终末地风格 · 价目工单
     · 版式：分类是卡片，第一张占满一行，其余并排两列（flex-wrap）
     · 卡片内**每个单项一行**：编号 | 项目 | 说明 | 价格（右对齐）
     · 长文字显示不全就换行，不截断、不省略
     · 装饰：顶边三色条、`//` 眉标、右缘条码、右下斜线纹、卡片角块与刻度、
             卡片底纹斜线、行间虚线、尾部细线
   导出走 html2canvas：纯色 / 边框 / 渐变 / 绝对定位伪元素，不用 grid、不用 clip-path。
   ══════════════════════════════════════════════════════════════════ */
.pr-wrap.pr-ef {
  max-width: 1080px;
  padding: 50px 30px 28px;
  background: #f4f4f2;
  color: #161616;
}
.pr-wrap.pr-ef::before {
  content: '';
  position: absolute;
  left: 0; right: 0; top: 0;
  height: 3px;
  background: linear-gradient(90deg, #FF00F0 0 33.33%, #B8FF3D 33.33% 66.66%, #00FFA2 66.66% 100%);
}
.pr-wrap.pr-ef::after {
  content: '// PRICE LIST / 价目工单';
  position: absolute;
  left: 30px; top: 20px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 2.4px;
  color: #6e6e68;
}
/* 画布装饰：右缘条码 + 右下斜线纹（绝对定位，不参与布局） */
.pr-ef .pr-content { position: relative; font-size: 13px; }
.pr-ef .pr-content::before {
  content: '';
  position: absolute;
  right: 0; top: 4px; bottom: 4px;
  width: 5px;
  background: repeating-linear-gradient(180deg,
    rgba(22, 22, 22, 0.26) 0 1px,
    transparent 1px 5px);
  pointer-events: none;
}
.pr-ef .pr-content::after {
  content: '';
  position: absolute;
  right: 12px; bottom: 0;
  width: 104px; height: 104px;
  background: repeating-linear-gradient(-45deg,
    rgba(22, 22, 22, 0.1) 0 1px,
    transparent 1px 7px);
  pointer-events: none;
}
/* 抬头：一行小字 + 细线 */
.pr-ef .pr-shop-info {
  border: none;
  border-bottom: 1px solid #d9d9d6;
  background: transparent;
  padding: 0 0 8px;
  margin-bottom: 10px;
  gap: 4px 20px;
}
.pr-ef .pr-shop-label {
  color: #6e6e68;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.pr-ef .pr-shop-val { color: #161616; font-size: 13px; font-weight: 800; }
/* 卡片：flex 两列，第一张占满 */
.pr-ef .pr-ef-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.pr-ef .pr-ef-card {
  position: relative;
  flex: 1 1 calc(50% - 5px);
  min-width: 0;
  padding: 9px 12px 9px 11px;
  background-color: #ffffff;
  background-image: repeating-linear-gradient(-45deg,
    rgba(22, 22, 22, 0.024) 0 1px,
    transparent 1px 8px);
  border: 1px solid #161616;
  box-shadow: inset 3px 0 0 #b8ff3d;
}
.pr-ef .pr-ef-card.wide { flex: 1 1 100%; }
/* 卡片装饰：右上角 lime 角块 + 右下刻度 */
.pr-ef .pr-ef-card::before {
  content: '';
  position: absolute;
  right: 0; top: 0;
  width: 12px; height: 12px;
  background: #b8ff3d;
  pointer-events: none;
}
.pr-ef .pr-ef-card::after {
  content: '';
  position: absolute;
  right: 14px; bottom: 7px;
  width: 46px; height: 4px;
  background: repeating-linear-gradient(90deg,
    rgba(22, 22, 22, 0.32) 0 1px,
    transparent 1px 4px);
  pointer-events: none;
}
/* 卡片头：编号 + 名称 + 右侧 lime 刻度 */
.pr-ef .pr-ef-card-head {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 0 18px 4px 0;
  margin-bottom: 1px;
  border-bottom: 2px solid #161616;
}
.pr-ef .pr-ef-card-head::after {
  content: '';
  position: absolute;
  right: 0; bottom: 5px;
  width: 22px; height: 2px;
  background: #b8ff3d;
  pointer-events: none;
}
.pr-ef .pr-ef-cat {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.4px;
  color: #6e6e68;
}
.pr-ef .pr-ef-cat-name {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.8px;
}
/* 条目：每个单项一行 —— 编号 | 项目 | 说明 | 价格（右对齐） */
.pr-ef .pr-ef-items { margin: 0; }
.pr-ef .pr-ef-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px dashed #e0e0dc;
  font-size: 12.5px;
  line-height: 1.45;
}
.pr-ef .pr-ef-item:last-child { border-bottom: none; }
.pr-ef .pr-ef-no {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  color: #b0b0ab;
  font-variant-numeric: tabular-nums;
}
.pr-ef .pr-ef-nm {
  flex: 0 1 auto;
  min-width: 0;
  /* 名称过长同样换行，不挤掉说明 */
  white-space: normal;
  overflow-wrap: anywhere;
  font-weight: 800;
  letter-spacing: 0.2px;
}
.pr-ef .pr-ef-note {
  flex: 1 1 auto;
  min-width: 0;
  /* 显示不全就换行，不截断也不省略 */
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.55;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: #454545;
}
.pr-ef .pr-ef-pr {
  flex: 0 0 auto;
  margin-left: auto;
  font-family: var(--font-mono);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
/* ══════════════════════════════════════════════════════════════════
   追加装饰（全部是背景图层 / inset 阴影 / 绝对定位伪元素，导出安全）
     · 画布：24px 工程网格 + 左上坐标十字 + 底部墨线
     · 抬头：下方一条刻度带
     · 卡片：底缘墨线；卡片头的编号前一枚 lime 小方块
     · 条目：行首一条刻度线；有说明的行在名称与价格之间拉一条点线引导
     · 卡片区左下角：工单编号（// TR-PRICE / NO.001）
   ══════════════════════════════════════════════════════════════════ */
/* 画布底纹：只有平铺网格（坐标十字改用真实元素 .pr-ef-cross，见文件后半段的装饰块） */
.pr-wrap.pr-ef {
  background-color: #f4f4f2;
  background-image:
    linear-gradient(90deg, rgba(22, 22, 22, 0.032) 0 1px, transparent 1px),
    linear-gradient(180deg, rgba(22, 22, 22, 0.032) 0 1px, transparent 1px);
  background-size: 24px 24px, 24px 24px;
  background-position: 0 0, 0 0;
  background-repeat: repeat, repeat;
  border-bottom: 3px solid #161616;
}
/* 抬头下的刻度带 */
.pr-ef .pr-shop-info { position: relative; }
.pr-ef .pr-shop-info::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: -5px;
  height: 3px;
  background: repeating-linear-gradient(90deg,
    rgba(22, 22, 22, 0.24) 0 1px,
    transparent 1px 6px);
  pointer-events: none;
}
/* 卡片底缘墨线（与左缘 lime 条同一套 inset 语言） */
.pr-ef .pr-ef-card {
  box-shadow: inset 3px 0 0 #b8ff3d, inset 0 -2px 0 #161616;
}
/* 卡片头编号前的 lime 小方块 */
.pr-ef .pr-ef-cat::before {
  content: '';
  display: inline-block;
  width: 5px; height: 5px;
  margin-right: 5px;
  vertical-align: middle;
  background: #b8ff3d;
}
/* 条目行首刻度线：已随「四列对齐」一节停用（装饰改放在编号列与价格列上） */
.pr-ef .pr-ef-item { position: relative; }
/* 名称与价格之间的点线引导：见文件末尾「四列对齐」一节 */
/* 卡片区左下角的工单编号 */
.pr-ef .pr-ef-cards { position: relative; }
.pr-ef .pr-ef-cards::before {
  content: '// TR-PRICE / NO.001';
  position: absolute;
  left: 0; bottom: -16px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 2px;
  color: #b0b0ab;
  pointer-events: none;
}
/* ══════════════════════════════════════════════════════════════════
   画布 / 卡片装饰（真实元素 + 伪元素）

   ⚠ 这里的坑：**不要用多层 background-image 定位实心色块**。
   html2canvas 不认 `background-size` / `background-position` 的列表写法，
   层数一多就整层回落到 auto —— `linear-gradient(90deg, #161616 0 100%)`
   于是铺满整张画布，导出的 PNG 变成一整块黑（卡片、空白全都 #161616）。
   所以：平铺纹理（网格 / 斜线）才用 background-image，
   需要定位的色块一律用绝对定位的真实元素或伪元素。
   ══════════════════════════════════════════════════════════════════ */
/* 画布网格在上述「画布底纹」块里定义，这里不再重复 */
.pr-wrap.pr-ef::after {
  content: '// PRICE LIST / 价目工单　·　TR-PRICE 001';
}
/* 装饰层：绝对定位，不占布局、不拦鼠标 */
.pr-ef .pr-ef-deco { position: absolute; inset: 0; pointer-events: none; }
.pr-ef .pr-ef-deco i { position: absolute; display: block; }
/* 左缘竖向刻度带 */
.pr-ef .pr-ef-rail {
  left: 0; top: 50px; bottom: 22px; width: 4px;
  background: repeating-linear-gradient(180deg,
    rgba(22, 22, 22, 0.22) 0 1px,
    transparent 1px 10px);
}
/* 左上坐标十字 */
.pr-ef .pr-ef-cross { left: 20px; top: 20px; width: 13px; height: 13px; }
.pr-ef .pr-ef-cross::before,
.pr-ef .pr-ef-cross::after {
  content: ''; position: absolute; background: rgba(22, 22, 22, 0.34);
}
.pr-ef .pr-ef-cross::before { left: 0; right: 0; top: 6px; height: 1px; }
.pr-ef .pr-ef-cross::after { top: 0; bottom: 0; left: 6px; width: 1px; }
/* 三枚角块：右上 lime + 墨色、左下 lime */
.pr-ef .pr-ef-corner-lime { right: 0; top: 0; width: 10px; height: 10px; background: #b8ff3d; }
.pr-ef .pr-ef-corner-ink { right: 0; top: 10px; width: 6px; height: 6px; background: #161616; }
.pr-ef .pr-ef-corner-foot { left: 0; bottom: 0; width: 10px; height: 10px; background: #b8ff3d; }
/* 卡片：底纹斜线沿用上面 `.pr-ef-card` 的那层（平铺，导出安全）；
   右侧竖向刻度 + 左下角墨块用装饰元素画 */
.pr-ef .pr-ef-card-deco { position: absolute; inset: 0; pointer-events: none; }
.pr-ef .pr-ef-card-deco::before {
  content: '';
  position: absolute;
  right: 6px; top: 0; bottom: 0; width: 4px;
  background: repeating-linear-gradient(180deg,
    rgba(22, 22, 22, 0.18) 0 1px,
    transparent 1px 12px);
}
.pr-ef .pr-ef-card-deco::after {
  content: '';
  position: absolute;
  left: 0; bottom: 0; width: 8px; height: 8px;
  background: #161616;
}
/* 卡片头：名称右侧的一小段条码（单层渐变 + 元素自身尺寸，导出安全） */
.pr-ef .pr-ef-card-head::before {
  content: '';
  position: absolute;
  right: 20px; top: 2px;
  width: 34px; height: 7px;
  background: repeating-linear-gradient(90deg,
    rgba(22, 22, 22, 0.34) 0 1px,
    transparent 1px 3px);
  pointer-events: none;
}
/* 条目：行尾 lime 标记已停用（同项的行首/行尾装饰改到编号列与价格列上） */
/* 尾部备注：上方一枚墨色小条 */
.pr-ef .pr-shop-tail { position: relative; }
.pr-ef .pr-shop-tail::before {
  content: '';
  position: absolute;
  left: 0; top: -7px;
  width: 12px; height: 3px;
  background: #161616;
  pointer-events: none;
}
/* 尾部备注：单独一行 */
.pr-ef .pr-shop-tail {
  margin-top: 10px;
  margin-bottom: 0;
  padding-top: 7px;
  border-top: 1px solid #d9d9d6;
  border-bottom: none;
}
/* ══════════════════════════════════════════════════════════════════
   条目列对齐：编号 / 名称 / 说明 / 价格 四列
   用 flex + 固定 flex-basis（不用 table —— table 自动布局会把名称列挤没）：
     · 编号列 30px、名称列 30%（同一张卡片里每行等宽）→ 说明起点对齐
     · 价格列固定 96px、右对齐 → 右缘对齐
     · 说明列占剩余宽度，过长就在自己列内换行
   ══════════════════════════════════════════════════════════════════ */
.pr-ef .pr-ef-items { margin: 0; }
.pr-ef .pr-ef-item {
  display: flex;
  align-items: baseline;
  gap: 0;
  padding: 6px 0;
  border-bottom: 1px dashed #e0e0dc;
  position: relative;
}
.pr-ef .pr-ef-item:last-child { border-bottom: none; }
/* 编号列 */
.pr-ef .pr-ef-no {
  flex: 0 0 26px;
  padding: 0;
}
/* 名称列：宽度 = 最长的单项名称（JS 量出来写到 --pr-ef-nm-w），
   不再写死百分比 —— 短名称那几行不会白留一大片，长名称也不用每行都换行 */
.pr-ef .pr-ef-nm {
  flex: 0 0 var(--pr-ef-nm-w, 22%);
  max-width: 45%;
  min-width: 0;
  padding-right: 10px;
  white-space: normal;
  overflow-wrap: anywhere;
  font-weight: 800;
  letter-spacing: 0.2px;
}
/* 量名称宽度用的尺子：画布外、不可见，但字体字号与 .pr-ef-nm 完全一致。
   用 fixed 放在视口外 —— 不参与文档流，也不会撑出滚动条。 */
.pr-ef-measure {
  position: fixed;
  left: -9999px; top: 0;
  visibility: hidden;
  white-space: nowrap;
  font-family: var(--font-ui);
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: 0.2px;
  pointer-events: none;
}
/* 说明列：占剩余（备注是四列里最宽的），长文字换行不截断 */
.pr-ef .pr-ef-note {
  display: flex;
  align-items: baseline;
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 4px 0 0;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.4;
  font-family: var(--font-mono);
  font-size: 12px;
  color: #454545;
}
.pr-ef .pr-ef-note-text { flex: 0 1 auto; min-width: 0; }
/* 备注文字到价格之间拉一条点线引导：把备注和价格连成一行，
   不然备注短的时候右半边全空，看起来「孤零零挂在左边」。
   点线用 border 画（html2canvas 认），不用 background-size 平铺。 */
.pr-ef .pr-ef-note::after {
  content: '';
  flex: 1 1 auto;
  min-width: 10px;
  margin: 0 8px;
  border-bottom: 1px dotted rgba(22, 22, 22, 0.26);
  transform: translateY(-2px);
}
/* 没有备注的行不画点线（避免空行出现一条无来由的虚线） */
.pr-ef .pr-ef-note.is-empty::after { content: none; }
/* 价格列：固定宽 + 右对齐（右缘与上一行对齐） */
.pr-ef .pr-ef-pr {
  flex: 0 0 84px;
  position: relative;
  padding-left: 8px;
  margin-left: 0;
  text-align: right;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
.pr-ef .pr-ef-pr::after {
  content: '';
  position: absolute;
  right: -8px; top: 4px; bottom: 4px;
  width: 2px;
  background: #b8ff3d;
}
/* 行级伪元素保持关闭（装饰已放在编号列 / 价格列上） */
.pr-ef .pr-ef-item::before,
.pr-ef .pr-ef-item::after { content: none; }

/* ══════════════════════════════════════════════════════════════════
   个人标签（署名）—— 画布底部右侧，导出图里也保留
     原版：灰色小字 + 一条细短线
     终末地：等宽小字 + lime 竖条（与工单编号同一套语言）
   ══════════════════════════════════════════════════════════════════ */
.pr-sign {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px solid #d9d9d6;
}
.pr-sign .pr-sign-mark {
  display: block;
  width: 18px;
  height: 1px;
  background: currentColor;
  opacity: 0.5;
}
.pr-sign .pr-sign-name {
  font-size: 11px;
  letter-spacing: 0.22em;
  opacity: 0.72;
}
/* 终末地风格：等宽小字 + lime 竖条 */
.pr-sign.pr-sign-ef {
  border-top: none;
  margin-top: 16px;
  padding-top: 0;
}
.pr-sign.pr-sign-ef .pr-sign-mark {
  width: 2px;
  height: 11px;
  background: #b8ff3d;
  opacity: 1;
}
.pr-sign.pr-sign-ef .pr-sign-name {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: #6e6e68;
  opacity: 1;
}
</style>
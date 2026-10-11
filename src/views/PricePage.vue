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
      <button class="rc-global-btn" @click="exportImage">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
        <span>导出图片</span>
      </button>
      <label class="rc-global-btn" style="cursor:pointer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <span>背景</span>
        <input type="file" accept="image/*" hidden @change="onBgFile">
      </label>
      <button v-if="bgUrl" class="rc-global-btn" @click="clearBg">✕ 清除</button>
      <div class="toolbar-spacer"></div>
    </div>

    <div class="pr-body">
      <div class="pr-wrap" ref="wrapRef" :style="bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
        <div class="pr-overlay" v-if="bgUrl"></div>
        <div class="pr-content">
          <div class="pr-shop-info" v-if="shopHead.length">
            <div class="pr-shop-item" v-for="info in shopHead" :key="info.id">
              <span class="pr-shop-label">{{ info.label }}</span>
              <span class="pr-shop-val">{{ info.value || '—' }}</span>
            </div>
          </div>
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
          <div class="pr-shop-info pr-shop-tail" v-if="shopTail.length">
            <div class="pr-shop-item" v-for="info in shopTail" :key="info.id">
              <span class="pr-shop-label">{{ info.label }}</span>
              <span class="pr-shop-val">{{ info.value || '—' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import html2canvas from 'html2canvas'
import { usePrices } from '@/composables/usePrices.js'
import { gamesRepo } from '@/data/repos.js'
import { gameOptions as buildGameOptions } from '@/domain/games.js'
import SelectBox from '@/components/SelectBox.vue'
import { readShopForGame } from '@/data/shop-info.js'

const { getGame } = usePrices()
const game = ref('endfield')
const mode = ref('preset')
const wrapRef = ref(null)
const bgUrl = ref(null)
const shopList = ref([])
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

async function exportImage() {
  if (!wrapRef.value) return
  const now = new Date()
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  try {
    const canvas = await html2canvas(wrapRef.value, { backgroundColor: '#ffffff', scale: 2 })
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `价格一览_${game.value}_${ts}.png`
    a.click()
    URL.revokeObjectURL(url)
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
.pr-shop-val { font-family: monospace; font-weight: 800; font-size: 14px; word-break: break-all; }
.pr-cat { margin-bottom: 16px; border: 1px solid rgba(0,0,0,0.12); }
.pr-cat-head { display: flex; align-items: baseline; gap: 10px; padding: 8px 14px; border-bottom: 1px solid rgba(0,0,0,0.08); }
.pr-cat-name { font-size: 13px; font-weight: 800; letter-spacing: 2px; }
.pr-cat-badge { font-size: 10px; font-family: monospace; padding: 1px 6px; border: 1px solid rgba(0,0,0,0.3); opacity: 0.7; }
.pr-table { width: 100%; border-collapse: collapse; }
.pr-table th { text-align: left; font-size: 10px; font-family: monospace; font-weight: 700; letter-spacing: 2px; opacity: 0.6; padding: 5px 14px; border-bottom: 1px solid rgba(0,0,0,0.1); }
.pr-table td { padding: 5px 14px; border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 13px; font-weight: 600; }
.pr-table tr:last-child td { border-bottom: none; }
.pr-col-name { width: 32%; }
.pr-col-price { width: 20%; white-space: nowrap; }
.pr-col-note { width: 48%; opacity: 0.65; font-size: 12px; font-weight: 400; }
.pr-price { font-family: monospace; font-weight: 800; font-size: 14px; }
.pr-range { font-family: monospace; opacity: 0.7; font-weight: 700; }
.pr-unit { font-family: monospace; opacity: 0.55; font-size: 11px; font-weight: 600; }
</style>

<template>
  <!-- 游戏与服务项目：已并入「数据管理」，不再有独立页面与导航入口。
       游戏不需要图标 —— 不提供图标选择、展示或占位。 -->
  <div class="gm-root">
    <div class="local-toolbar">
      <button class="rc-global-btn" @click="addNew">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        <span>新增游戏</span>
      </button>
      <div class="gm-legend">
        <span class="legend-item"><span class="legend-dot" style="background:#00B0FF"></span>启用</span>
        <span class="legend-item"><span class="legend-dot" style="background:#9E9E9E"></span>停用 / 归档</span>
      </div>
      <div class="toolbar-spacer"></div>
      <span class="summary-chip">游戏 <strong>{{ stats.total }}</strong></span>
      <span class="summary-chip">启用 <strong>{{ stats.enabled }}</strong></span>
      <span class="summary-chip">服务项目 <strong>{{ stats.services }}</strong></span>
      <span class="summary-chip">归档 <strong>{{ stats.archived }}</strong></span>
    </div>

    <div class="gm-body">
      <!-- 游戏列表 -->
      <div class="gm-col-list">
        <div class="gm-col-head">游戏目录</div>
        <TransitionGroup name="mv-list" tag="div" class="gm-list-body">
          <div
            v-for="g in games"
            :key="g.id"
            class="gm-item"
            :class="{ active: g.id === currentId, off: !g.enabled || g.archived }"
            @click="currentId = g.id"
          >
          <span class="gm-bar" :style="{ background: g.enabled && !g.archived ? '#00B0FF' : '#9E9E9E' }"></span>
          <div class="gm-item-main">
            <span class="gm-name">{{ g.name }}</span>
            <span class="gm-sub">{{ g.short || '—' }} · {{ (g.services || []).length }} 项服务</span>
          </div>
          <span class="gm-item-tags">
            <span v-if="g.archived" class="gm-tag">归档</span>
            <span v-else-if="!g.enabled" class="gm-tag">停用</span>
          </span>
          <span class="gm-item-actions">
            <button class="gm-btn" @click.stop="moveGame(g.id, -1)" :disabled="indexOf(g.id) === 0" title="上移">↑</button>
            <button class="gm-btn" @click.stop="moveGame(g.id, 1)" :disabled="indexOf(g.id) === games.length - 1" title="下移">↓</button>
          </span>
          </div>
          <div class="empty" v-if="!games.length" key="g-empty">
            <p>还没有游戏，点击「新增游戏」开始</p>
          </div>
        </TransitionGroup>
      </div>

      <!-- 游戏设置 + 服务项目 -->
      <div class="gm-col-detail" v-if="current">
        <div class="gm-detail-head">
          <span class="gm-detail-title">游戏设置</span>
          <span class="gm-detail-id">id: {{ current.id }}（价格表 key）</span>
        </div>

        <div class="gm-fields">
          <label class="gm-field">
            <span>游戏名称</span>
            <input v-model="current.name" @change="saveGame({ name: current.name })" />
          </label>
          <label class="gm-field">
            <span>简称</span>
            <input v-model="current.short" @change="saveGame({ short: current.short })" />
          </label>
          <div class="gm-field gm-field-btns">
            <button class="gm-act" :class="{ active: current.enabled && !current.archived }" @click="toggleGame(current.id)">
              {{ current.enabled && !current.archived ? '已启用' : '已停用' }}
            </button>
            <button class="gm-act" v-if="!current.archived" @click="archiveCurrent">归档</button>
            <button class="gm-act" v-else @click="restoreGame(current.id)">取消归档</button>
            <button class="gm-act danger" @click="askRemoveGame(current)">{{ removeLabel }}</button>
          </div>
        </div>

        <div class="gm-detail-head">
          <span class="gm-detail-title">服务项目</span>
          <button class="gm-add" @click="addService(current.id)">+ 新增服务项目</button>
        </div>

        <div class="gm-svc-head">
          <span style="width:44px"></span>
          <span class="w-name">名称</span>
          <span class="w-price">默认价格</span>
          <span class="w-unit">单位</span>
          <span class="w-note">备注 / 描述</span>
          <span class="w-en">启用</span>
          <span style="width:30px"></span>
        </div>

        <TransitionGroup name="mv-list" tag="div" class="gm-svc-list">
          <div v-for="(s, i) in current.services" :key="s.id" class="gm-svc">
          <span class="gm-svc-sort">
            <button class="gm-btn" @click="moveService(current.id, s.id, -1)" :disabled="i === 0">↑</button>
            <button class="gm-btn" @click="moveService(current.id, s.id, 1)" :disabled="i === current.services.length - 1">↓</button>
          </span>
          <input class="gm-inp w-name" v-model="s.name" @change="saveService(s, { name: s.name })" />
          <input class="gm-inp w-price" type="number" step="any" v-model="s.price" @change="saveService(s, { price: s.price })" />
          <input class="gm-inp w-unit" v-model="s.unit" placeholder="—" @change="saveService(s, { unit: s.unit })" />
          <input class="gm-inp w-note" v-model="s.note" placeholder="—" @change="saveService(s, { note: s.note })" />
          <label class="gm-en">
            <input type="checkbox" :checked="s.enabled" @change="saveService(s, { enabled: $event.target.checked })" />
          </label>
          <button class="gm-del" @click="removeService(current.id, s.id)" title="删除服务项目（不影响历史记录）">×</button>
          </div>
          <div class="empty" v-if="!current.services || !current.services.length" key="svc-empty">
            <p>该游戏还没有服务项目</p>
          </div>
        </TransitionGroup>

        <p class="gm-hint">
          服务项目修改只影响后续新建的项目；已经生成的执行记录保留当时的名称快照，不会被改写。
        </p>
      </div>

      <div class="gm-col-detail gm-col-empty" v-else>
        <p>从左侧选择一个游戏</p>
      </div>
    </div>

    <!-- 删除确认 -->
    <div class="modal-mask" v-if="removeTarget" @click.self="removeTarget = null">
      <div class="edit-popup" style="max-width:420px">
        <h4>删除游戏「{{ removeTarget.name }}」</h4>
        <p class="detail-section" v-if="removeUsage.count">
          该游戏已被 {{ removeUsage.count }} 个项目引用，无法删除。可以改为「归档」，历史数据会完整保留。
        </p>
        <p class="detail-section" v-else>该游戏没有任何项目引用，可以安全删除。</p>
        <div class="edit-actions" style="margin-top:16px">
          <button class="save-btn" v-if="removeUsage.count" @click="archiveTarget">改为归档</button>
          <button class="save-btn danger" v-else @click="confirmRemove">确认删除</button>
          <button class="cancel-btn" @click="removeTarget = null">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { gamesRepo } from '@/data/repos.js'
import {
  addGame, updateGame, removeGame, archiveGame, restoreGame, toggleGame, moveGame,
  addService, updateService, removeService, moveService, gameStats, gameUsage,
} from '@/services/gameService.js'

const games = gamesRepo.state
const stats = computed(() => gameStats())
const currentId = ref('')
const current = computed(() => games.value.find(g => g.id === currentId.value) || null)

onMounted(() => {
  gamesRepo.hydrate()
  currentId.value = games.value[0]?.id || ''
})

function indexOf(id) { return games.value.findIndex(g => g.id === id) }
function addNew() {
  const g = addGame({ name: '新游戏' })
  currentId.value = g.id
}
function saveGame(patch) { if (current.value) updateGame(current.value.id, patch) }
function archiveCurrent() { if (current.value) archiveGame(current.value.id) }

// 删除：有引用则只能归档（二次确认在弹窗内完成）
const removeTarget = ref(null)
const removeUsage = ref({ count: 0 })
const removeLabel = '删除'
function askRemoveGame(game) {
  removeTarget.value = game
  removeUsage.value = gameUsage(game.id, game.name)
}
function confirmRemove() {
  if (!removeTarget.value) return
  const r = removeGame(removeTarget.value.id)
  if (r.ok) {
    removeTarget.value = null
    if (!games.value.some(g => g.id === currentId.value)) currentId.value = games.value[0]?.id || ''
  }
}
function archiveTarget() {
  if (!removeTarget.value) return
  archiveGame(removeTarget.value.id)
  removeTarget.value = null
}

function saveService(svc, patch) { if (current.value) updateService(current.value.id, svc.id, patch) }
</script>

<style scoped>
.gm-root { display: flex; flex-direction: column; min-height: 0; }
.gm-legend { display: flex; align-items: center; gap: 12px; font-size: 11px; font-family: monospace; opacity: 0.7; }
.gm-body { display: flex; gap: 12px; padding: 0 12px 16px; align-items: flex-start; }
.gm-col-list {
  width: 300px; flex-shrink: 0;
  border: 2px solid var(--border-color); background: var(--bg-primary);
}
.gm-col-head {
  padding: 8px 12px; font-size: 11px; font-family: monospace; letter-spacing: 2px;
  background: var(--bg-secondary); border-bottom: 2px solid var(--border-color); opacity: 0.75;
}
.gm-item {
  position: relative; display: flex; align-items: center; gap: 8px;
  padding: 8px 8px 8px 16px; cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background var(--motion-duration-normal) var(--motion-easing-ease);
}
.gm-item:hover { background: var(--bg-secondary); }
.gm-item.active { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.gm-item.off { opacity: 0.55; }
.gm-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }
.gm-item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.gm-name { font-size: 13px; font-weight: 700; }
.gm-sub { font-size: 10px; font-family: monospace; opacity: 0.6; }
.gm-tag {
  font-size: 10px; font-family: monospace; padding: 1px 5px;
  border: 1px solid currentColor; opacity: 0.7;
}
.gm-item-actions { display: flex; flex-direction: column; gap: 1px; }

.gm-btn {
  font-size: 9px; line-height: 1.3; padding: 0 5px;
  border: 1px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); cursor: pointer; font-family: monospace;
}
.gm-btn:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.gm-btn:disabled { opacity: 0.15; cursor: default; }
.gm-btn:disabled:hover { background: var(--bg-secondary); color: var(--text-primary); }

.gm-col-detail {
  flex: 1; min-width: 0;
  border: 2px solid var(--border-color); background: var(--bg-primary);
  padding: 12px;
}
.gm-col-empty { padding: 40px 12px; text-align: center; opacity: 0.5; font-size: 13px; }
.gm-detail-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 4px 0; margin-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}
.gm-detail-title { font-size: 12px; font-weight: 800; letter-spacing: 1px; }
.gm-detail-id { font-size: 10px; font-family: monospace; opacity: 0.5; }
.gm-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin-bottom: 14px; }
.gm-field { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.gm-field > span { width: 64px; opacity: 0.55; font-family: monospace; font-size: 11px; flex-shrink: 0; }
.gm-field input {
  flex: 1; min-width: 0; height: 28px; padding: 0 8px;
  border: 2px solid var(--border-color); background: var(--bg-secondary);
  color: var(--text-primary); font-family: inherit; font-size: 12px;
}
.gm-field input:focus { outline: none; border-color: var(--btn-hover-bg); }
.gm-field-btns { grid-column: 1 / -1; gap: 6px; }
.gm-act {
  height: 28px; padding: 0 12px; border: 2px solid var(--border-color);
  background: var(--bg-secondary); color: var(--text-primary);
  font-family: inherit; font-size: 12px; cursor: pointer;
  transition: background var(--motion-duration-normal) var(--motion-easing-ease);
}
.gm-act:hover, .gm-act.active { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
.gm-act.danger:hover { background: #d00; border-color: #d00; color: #fff; }
.gm-add {
  height: 24px; padding: 0 10px; border: 1px dashed var(--border-color);
  background: var(--bg-secondary); color: var(--text-primary);
  font-family: monospace; font-size: 11px; cursor: pointer;
}
.gm-add:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }

.gm-svc-head, .gm-svc { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
.gm-list-body, .gm-svc-list { position: relative; }
.gm-svc-head { border-bottom: 1px solid var(--border-color); padding-bottom: 4px; margin-bottom: 4px; }
.gm-svc-head span { font-size: 10px; font-family: monospace; opacity: 0.45; }
.gm-svc-sort { width: 44px; display: flex; gap: 1px; flex-shrink: 0; }
.w-name { width: 170px; flex-shrink: 0; }
.w-price { width: 76px; flex-shrink: 0; }
.w-unit { width: 56px; flex-shrink: 0; }
.w-note { flex: 1; min-width: 60px; }
.w-en { width: 34px; flex-shrink: 0; display: flex; justify-content: center; }
.gm-inp {
  height: 26px; padding: 0 6px; border: 2px solid var(--border-color);
  background: var(--bg-primary); color: var(--text-primary);
  font-family: inherit; font-size: 12px;
}
.gm-inp:focus { outline: none; border-color: var(--btn-hover-bg); }
.gm-en { width: 34px; display: flex; justify-content: center; }
.gm-del {
  width: 30px; height: 26px; border: 2px solid var(--border-color);
  background: var(--bg-secondary); color: var(--text-primary);
  font-family: monospace; font-size: 13px; cursor: pointer; flex-shrink: 0;
}
.gm-del:hover { background: #d00; border-color: #d00; color: #fff; }
.gm-hint { font-size: 11px; opacity: 0.5; line-height: 1.6; margin-top: 12px; }
</style>

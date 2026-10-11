/* ══════ 在 src/views/player/PlayHistory.vue 中修改 ══════ */

/* 1. 在 <script setup> 中添加路由跳转函数（goTimeline / goDiary 旁边）： */
const goBoosting = () => router.push('/player/boosting')

/* 2. 在 <template> 的 .header-actions 区域添加按钮（在"日记"按钮之后）： */
<button class="tl-entry-btn" @click="goBoosting" title="代肝日记">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
  <span>代肝</span>
</button>

/* 3. 在 CSS .header-actions .tl-entry-btn:nth-child 中，第三个按钮需要：
   transition-delay: 0.20s; */

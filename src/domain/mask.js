// ═══════════════════════════════════════════════════════════════════
// 脱敏与展示名工具 — 纯函数，不依赖 Vue
// （原 composables/useMask.js 迁移至此，composable 仅做转发以保持兼容）
// ═══════════════════════════════════════════════════════════════════

export const PLATFORM_ORDER = ['wechat', 'qq', 'bilibili', 'xiaohongshu', 'douyin']

export const PLATFORM_LABEL = {
  wechat: '微信',
  qq: 'QQ',
  bilibili: 'B站',
  xiaohongshu: '小红书',
  douyin: '抖音',
}

export const PLATFORM_OPTIONS = PLATFORM_ORDER.map(v => ({ value: v, label: PLATFORM_LABEL[v] }))

// 账号脱敏：138****5678
export function maskAccount(acct) {
  if (!acct) return ''
  const s = String(acct).replace(/\*/g, '')
  if (s.length <= 2) return s
  if (s.length <= 5) return s[0] + '***' + s[s.length - 1]
  if (s.length <= 7) return s.slice(0, 2) + '***' + s.slice(-2)
  return s.slice(0, 3) + '****' + s.slice(-4)
}

// 按优先平台取老板昵称
export function getDisplayName(item) {
  if (!item) return ''
  const map = {
    wechat: item.wechatName,
    qq: item.qqName,
    bilibili: item.bilibiliName,
    xiaohongshu: item.xiaohongshuName,
    douyin: item.douyinName,
  }
  if (item.preferredPlatform && map[item.preferredPlatform]) return map[item.preferredPlatform]
  for (const p of PLATFORM_ORDER) { if (map[p]) return map[p] }
  return map.wechat || ''
}

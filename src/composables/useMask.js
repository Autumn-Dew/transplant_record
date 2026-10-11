// 脱敏与展示名工具（代肝代办 / 代肝日报 共用）

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
  const order = ['wechat', 'qq', 'bilibili', 'xiaohongshu', 'douyin']
  const map = {
    wechat: item.wechatName,
    qq: item.qqName,
    bilibili: item.bilibiliName,
    xiaohongshu: item.xiaohongshuName,
    douyin: item.douyinName,
  }
  if (item.preferredPlatform && map[item.preferredPlatform]) return map[item.preferredPlatform]
  for (const p of order) { if (map[p]) return map[p] }
  return map['wechat'] || ''
}

export function useMask() {
  return { maskAccount, getDisplayName }
}

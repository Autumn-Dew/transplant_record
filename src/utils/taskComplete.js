// 任务「确认完成」的共享逻辑（代肝代办 / 每日汇报 共用）
import { monthSpanDays } from '@/utils/date'
import { getDisplayName } from '@/composables/useMask'

const ACCOUNTS_KEY = 'tr-accounts'
const COMPLETIONS_KEY = 'tr-completions'

// 本地日期 yyyy-MM-dd（避免 UTC 偏移）
export function localToday() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function appendCompletion(record, wasHosting) {
  const list = JSON.parse(localStorage.getItem(COMPLETIONS_KEY) || '[]')
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    taskId: record.id,
    date: localToday(),
    time: new Date().toTimeString().slice(0, 8),
    game: record.game,
    service: record.service || '',
    account: record.account,
    displayName: getDisplayName(record),
    wechatName: record.wechatName || '', qqName: record.qqName || '',
    bilibiliName: record.bilibiliName || '', xiaohongshuName: record.xiaohongshuName || '', douyinName: record.douyinName || '',
    preferredPlatform: record.preferredPlatform || 'wechat',
    fee: record.actualFee || record.totalFee || '',
    totalFee: record.totalFee || '', actualFee: record.actualFee || '', delayedFee: record.delayedFee || '',
    status: record.status || 1,
    wasHosting: !!wasHosting,
    note: record.note || '',
    password: record.password || '',
  })
  localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(list))
}

/**
 * 确认完成某个代办任务。
 * 返回 { ok, completed, reason }：
 *  - reason='not-found'     未找到项目
 *  - reason='confirmed-today' 托管项目今日已确认（每天一次）
 */
export function completeTaskById(taskId) {
  if (!taskId) return { ok: false, reason: 'not-found' }
  let list
  try { list = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') } catch { return { ok: false, reason: 'not-found' } }
  const item = list.find(r => String(r.id) === String(taskId))
  if (!item) return { ok: false, reason: 'not-found' }

  const today = localToday()
  if (item.status === 2 && item.lastConfirmDate === today) {
    return { ok: false, reason: 'confirmed-today' }
  }

  const wasHosting = item.status === 2
  const fallback = wasHosting ? monthSpanDays(item.createdAt) : 1
  const cur = (item.remainingDays != null && item.remainingDays !== '') ? Number(item.remainingDays) : fallback
  item.remainingDays = cur - 1
  item.lastConfirmDate = today

  let completed = false
  if (item.remainingDays <= 0) {
    item.status = 0
    completed = true
    appendCompletion(item, wasHosting)
    // 解锁续费项目：上一项目完成 → 直接后继可确认
    list.forEach(r => { if (r.locked && r.prevTaskId === item.id) r.locked = false })
  }

  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
  try { window.electron?.saveRecords?.(list) } catch { /* ignore */ }
  // 通知其它页面（代肝代办）刷新
  try { window.dispatchEvent(new CustomEvent('tr-accounts-changed')) } catch { /* ignore */ }
  return { ok: true, completed }
}

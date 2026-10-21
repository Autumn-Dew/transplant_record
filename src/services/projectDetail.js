// ═══════════════════════════════════════════════════════════════════
// 项目详情窗口：数据组装 + 可用操作判定
//
//   * 只读 repository，不写存储；所有数据都在这里组装，
//     页面/组件只负责渲染与派发操作（不在组件里拼装业务规则）。
//   * 历史隔离：本文件只读取，绝不修改任何项目 / 执行记录。
//     因此「查看详情」永远不会影响历史周期、收入或执行记录。
//   * 只组装「详情窗口真正要展示的东西」：托管链等聚合视图已下线，不再组装，
//     以免界面出现用不上的内容（链模型仍保留在 domain/service，供历史数据与迁移使用）。
// ═══════════════════════════════════════════════════════════════════

import { projectsRepo } from '../data/repos.js'
import { isHosting, isArchived, hostProgress, paymentsOf, paidTotalOf } from '../domain/project.js'
import { canHardDelete } from './projectService.js'
import { getDisplayName } from '../domain/mask.js'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// 最近一次收费的金额（实际收费优先，其次总收费）
export function periodFee(p) {
  const v = p.actualFee !== '' && p.actualFee != null ? p.actualFee : p.totalFee
  return num(v)
}

/**
 * 同客户同服务的其它托管记录 —— 只用于提示，不做任何修改。
 *
 * 判定：账号 + 游戏 + 服务三项都相同、id 不同。早期数据与后期数据冲突时，
 * 这里会出现两条周期不同的记录（一条可能还是「待激活」），页面据此提醒用户
 * 是哪一条在打架，再用「强制删除」清理。
 */
function duplicatesOf(p) {
  const key = o => `${String(o.account || '')}|${String(o.game || '')}|${String(o.service || '')}`
  const self = key(p)
  return projectsRepo.state.value
    .filter(o => String(o.id) !== String(p.id) && key(o) === self)
    .map(o => {
      const h = isHosting(o) ? hostProgress(o) : null
      return {
        id: o.id,
        days: h ? h.totalDays : 0,
        startDate: h ? h.startDate : '',
        endDate: h ? h.endDate : '',
        locked: !!o.locked,
        archived: isArchived(o),
        state: o.state || '',
      }
    })
}

/**
 * 详情窗口里可用的操作。
 *   · 续费 = 在原项目上加天数 + 记一笔收费
 *   · 归档 = 消耗全部剩余天数、直接完成整个托管
 * 暂停 / 恢复 / 延期 / 提前结束这些托管生命周期操作已下线（用不上）。
 */
export function availableActions(id) {
  const p = projectsRepo.find(id)
  if (!p) return {}
  const hosting = isHosting(p)
  const archived = isArchived(p)
  const canRemove = canHardDelete(id).ok
  return {
    edit: true,
    renew: hosting,
    archive: !archived,
    restore: archived,
    remove: canRemove,
    // 删不掉（有执行记录 / 被后继引用）时给出强制删除入口，避免数据冲突时无处下手
    forceRemove: !canRemove,
  }
}

/**
 * 组装详情窗口需要的数据。
 * 返回 null 表示项目不存在（例如已被删除）。
 * today 仅为兼容既有调用签名保留（剩余天数等由 hostProgress 按本地今天计算）。
 */
export function buildProjectDetail(id) {
  const p = projectsRepo.find(id)
  if (!p) return null

  const hosting = isHosting(p)
  const payments = paymentsOf(p)

  return {
    project: { ...p },
    displayName: getDisplayName(p),
    hosting,
    host: hosting ? hostProgress(p) : null,
    state: p.state,
    archived: isArchived(p),
    locked: !!p.locked,
    finance: {
      // 最近一次收费
      periodFee: periodFee(p),
      totalFee: num(p.totalFee),
      actualFee: num(p.actualFee),
      delayedFee: num(p.delayedFee),
      paidAt: p.paidAt || '',
      createdAt: p.createdAt || '',
      // 收费记录（订单）：一个项目可能被「加天数」多次，每次收费一条
      paidTotal: paidTotalOf(p),
      paymentCount: payments.length,
      payments,
    },
    actions: availableActions(id),
    // 同客户同服务（同账号 + 同游戏 + 同服务）的其它托管记录：
    // 早期数据与后期数据冲突时这里会出现两条周期不同的记录，提示用户是哪一条。
    duplicates: duplicatesOf(p),
  }
}

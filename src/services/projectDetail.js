// ═══════════════════════════════════════════════════════════════════
// 项目详情窗口：数据组装 + 可用操作判定
//
//   * 只读 repository，不写存储；所有分区数据都在这里组装，
//     页面/组件只负责渲染与派发操作（不在组件里拼装业务规则）。
//   * 历史隔离：本文件只读取，绝不修改任何项目 / 执行记录。
//     因此「查看详情」永远不会影响历史周期、收入或执行记录。
// ═══════════════════════════════════════════════════════════════════

import { projectsRepo, completionsRepo } from '../data/repos.js'
import { STATE, isHosting, isCompleted, isCancelled, isArchived, hostProgress } from '../domain/project.js'
import { chainIdOf, chainSummaryOf, chainExecutions, canHardDelete, planRenewal } from './projectService.js'
import { todayLocal } from '../utils/date.js'
import { getDisplayName } from '../domain/mask.js'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// 本期的收费金额（实际收费优先，其次总收费）
export function periodFee(p) {
  const v = p.actualFee !== '' && p.actualFee != null ? p.actualFee : p.totalFee
  return num(v)
}

/**
 * 详情窗口里可用的操作。
 * 不隐藏原版任何操作，只按当前状态给出必要限制（例如已归档才显示「取消归档」）。
 */
export function availableActions(id) {
  const p = projectsRepo.find(id)
  if (!p) return {}
  const hosting = isHosting(p)
  const archived = isArchived(p)
  const closed = isCompleted(p) || isCancelled(p)
  return {
    edit: true,
    pause: hosting && !archived && p.state === STATE.ACTIVE,
    resume: !archived && p.state === STATE.PAUSED,
    extend: hosting && !archived && !closed,
    renew: hosting,
    cancel: !closed && !archived,
    archive: !archived,
    restore: archived,
    remove: canHardDelete(id).ok,
  }
}

// 执行记录排序：实际完成日期倒序（同日按时间倒序）
function byDateDesc(a, b) {
  const da = String(a.completedDate || a.date || '')
  const db = String(b.completedDate || b.date || '')
  if (da !== db) return db.localeCompare(da)
  return String(b.time || '').localeCompare(String(a.time || ''))
}

/**
 * 组装详情窗口的全部分区数据。
 * 返回 null 表示项目不存在（例如已被删除）。
 */
export function buildProjectDetail(id, { today = todayLocal() } = {}) {
  const p = projectsRepo.find(id)
  if (!p) return null

  const hosting = isHosting(p)
  const host = hosting ? hostProgress(p) : null
  const chainId = hosting ? chainIdOf(p.id) : ''
  // 连续托管链：聚合视图（各期仍独立；收入逐期保留）
  const chain = chainId ? chainSummaryOf(p.id, today) : null

  const executions = completionsRepo.state.value
    .filter(c => String(c.projectId || c.taskId) === String(p.id))
    .map(c => ({ ...c }))
    .sort(byDateDesc)

  // 整条链的历史执行记录（按周期归属，供「历史周期」展开查看）
  const chainAll = chainId
    ? chainExecutions(chainId).map(c => ({ ...c })).sort(byDateDesc)
    : []
  const executionsByPeriod = {}
  chainAll.forEach(c => {
    const pid = String(c.projectId || c.taskId)
    if (!executionsByPeriod[pid]) executionsByPeriod[pid] = []
    executionsByPeriod[pid].push(c)
  })

  return {
    project: { ...p },
    displayName: getDisplayName(p),
    hosting,
    host,
    state: p.state,
    archived: isArchived(p),
    locked: !!p.locked,
    chainId,
    chain,
    executions,
    executionsByPeriod,
    chainExecutionCount: chainAll.length,
    // 续费建议（起始日 = 原周期结束日次日，可被用户在确认区覆盖）
    renewPlan: hosting ? planRenewal(p.id, today) : null,
    finance: {
      periodFee: periodFee(p),
      totalFee: num(p.totalFee),
      actualFee: num(p.actualFee),
      delayedFee: num(p.delayedFee),
      paidAt: p.paidAt || '',
      createdAt: p.createdAt || '',
      chainTotal: chain ? chain.totalIncome : periodFee(p),
      chainPeriodCount: chain ? chain.periodCount : 1,
    },
    actions: availableActions(id),
  }
}

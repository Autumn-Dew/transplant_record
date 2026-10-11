// 任务「确认完成」的共享入口（代肝代办 / 每日汇报 共用）
//
// 规则已统一到 services/projectService.js：
//   * 每一次实际执行都会生成一条独立的执行记录（历史事实，不可被后续修改覆盖）
//   * 托管项目每天只能确认一次
//   * 托管次数用尽 → 项目完成（续期 = 在原项目上加天数 + 一条收费记录）
import { confirmExecution } from '../services/projectService.js'
import { isHosting } from '../domain/project.js'

// 本地日期 yyyy-MM-dd（避免 UTC 偏移）
export const localToday = () => {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 确认完成某个项目（代办）。
 * 返回 { ok, completed, record, reason }：
 *  - reason='not-found'        未找到项目
 *  - reason='confirmed-today'  托管项目今日已确认（每天一次）
 *  - reason='not-started'      续费项目尚未生效
 *  - reason='paused'           项目暂停中
 *  - reason='closed'           项目已归档 / 已取消
 */
export function completeTaskById(taskId, opts = {}) {
  const r = confirmExecution(taskId, opts)
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, completed: !!r.completed, record: r.record }
}

export { isHosting }

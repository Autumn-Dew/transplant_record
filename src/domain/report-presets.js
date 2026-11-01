// ═══════════════════════════════════════════════════════════════════
// 日报预设：每个游戏在「每日汇报」里默认出现哪些任务项与资源项
//
// 以前这三套内容写死在 ReportSheet.vue 里，于是：
//   · 新增的游戏根本没有日报页签；
//   · 想改一个任务名，得进组件源码改。
// 现在改成「目录里可配置」：`game.report = { daily, weekly, resources, author, text }`。
//
// 回落规则（重要）：
//   · 目录里配了非空列表 → 用配置；
//   · 没配 / 配成空数组 → 内置三游戏回落到这里的预设，其它游戏回落为空（日报里显示空卡片，由用户自己加）。
// 这样老数据（没有 report 字段）行为与改造前完全一致。
//
// `text` 是模板文案的全局覆盖值（见 domain/report-template.js）：
// 单独回落到默认文案，不受上面「空数组回落」规则影响（文案允许被清空）。
// ═══════════════════════════════════════════════════════════════════

import { normalizeReportText, mergeReportText } from './report-template.js'

// 内置三游戏的默认内容（与原 ReportSheet 里写死的数组逐项一致）
export const BUILTIN_REPORT_PRESETS = {
  ak: {
    daily: ['每日任务', '基建收菜', '信用商店', '公开招募'],
    weekly: ['每周任务', '剿灭作战'],
    resources: ['龙门币', '合成玉'],
    author: '',
  },
  endfield: {
    daily: ['每日任务', '基建收菜', '物资调度', '信用商店', '送货'],
    weekly: ['周常任务'],
    resources: ['嵌晶玉', '武库配额'],
    author: '',
  },
  nte: {
    daily: ['每日活跃', '环期任务', '咖啡店', '许愿树', '喷泉池', '占卜', '送礼', '棉花'],
    weekly: ['周常'],
    resources: ['方斯', '环石'],
    author: '小野',
  },
}

const EMPTY_PRESET = { daily: [], weekly: [], resources: [], author: '' }

function str(v) {
  return v == null ? '' : String(v).trim()
}

function strList(v) {
  return (Array.isArray(v) ? v : []).map(str).filter(Boolean)
}

/** 规范化一份预设（不丢弃未知字段由调用方负责，这里只产出示图所需的四项） */
export function normalizeReportPreset(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    daily: strList(r.daily),
    weekly: strList(r.weekly),
    resources: strList(r.resources),
    author: str(r.author),
    text: normalizeReportText(r.text),
  }
}

/**
 * 取某个游戏最终生效的日报预设。
 * @param {string} gameId 游戏 id（价格表 key）
 * @param {object} [game] 目录里的游戏对象（可带 report 配置）
 */
export function reportPresetFor(gameId, game) {
  const own = normalizeReportPreset(game && game.report)
  const builtin = BUILTIN_REPORT_PRESETS[gameId] || EMPTY_PRESET
  const pick = (ownList, builtinList) => (ownList.length ? ownList : builtinList)
  return {
    daily: pick(own.daily, builtin.daily),
    weekly: pick(own.weekly, builtin.weekly),
    resources: pick(own.resources, builtin.resources),
    author: own.author || builtin.author || '',
    // 文案：默认值 ← 全局配置（草稿层由日报页自己叠）
    text: mergeReportText(builtin.text, own.text),
  }
}

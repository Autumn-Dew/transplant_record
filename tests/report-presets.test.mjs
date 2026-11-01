// ═══════════════════════════════════════════════════════════════════
// 日报预设（domain/report-presets.js）
//
// 契约：目录里配了就按目录（可覆盖内置）；没配 / 配成空数组则：
//   · 内置三游戏回落到各自预设（行为与改造前完全一致）
//   · 其它游戏回落为空（日报显示空卡片，由用户自己加）
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BUILTIN_REPORT_PRESETS, normalizeReportPreset, reportPresetFor,
} from '../src/domain/report-presets.js'
import { normalizeGame } from '../src/domain/games.js'

test('内置三游戏的预设与改造前写死的内容一致', () => {
  assert.deepEqual(BUILTIN_REPORT_PRESETS.ak.daily, ['每日任务', '基建收菜', '信用商店', '公开招募'])
  assert.deepEqual(BUILTIN_REPORT_PRESETS.ak.weekly, ['每周任务', '剿灭作战'])
  assert.deepEqual(BUILTIN_REPORT_PRESETS.ak.resources, ['龙门币', '合成玉'])

  assert.deepEqual(BUILTIN_REPORT_PRESETS.endfield.weekly, ['周常任务'])
  assert.deepEqual(BUILTIN_REPORT_PRESETS.endfield.resources, ['嵌晶玉', '武库配额'])

  assert.equal(BUILTIN_REPORT_PRESETS.nte.daily.length, 8, 'NTE 日常含送礼/棉花')
  assert.deepEqual(BUILTIN_REPORT_PRESETS.nte.resources, ['方斯', '环石'])
  assert.equal(BUILTIN_REPORT_PRESETS.nte.author, '小野', '异环默认汇报人是小野')
})

test('没有 report 字段（老数据）→ 内置游戏回落预设，自定义游戏为空', () => {
  const ak = reportPresetFor('ak', { id: 'ak', name: '明日方舟' })
  assert.deepEqual(ak.daily, BUILTIN_REPORT_PRESETS.ak.daily, '老数据行为不变')
  assert.deepEqual(ak.weekly, BUILTIN_REPORT_PRESETS.ak.weekly)

  const custom = reportPresetFor('wuwa', { id: 'wuwa', name: '鸣潮' })
  assert.deepEqual(custom.daily, [], '新游戏默认空白')
  assert.deepEqual(custom.weekly, [])
  assert.deepEqual(custom.resources, [])
  assert.equal(custom.author, '')
  assert.ok(custom.text && typeof custom.text === 'object', '文案始终给出完整默认值')
  assert.equal(custom.text.cardDaily, '日常', '文案回落默认值')
})

test('文案同样走「全局覆盖 → 默认」的回退链', () => {
  const custom = reportPresetFor('wuwa', { id: 'wuwa', report: { text: { cardDaily: '本日' } } })
  assert.equal(custom.text.cardDaily, '本日', '配了的用配置')
  assert.equal(custom.text.cardWeekly, '周常', '没配的回落默认')
  // 文案允许被清空（与任务项「空数组回落」规则不同）
  const cleared = reportPresetFor('wuwa', { id: 'wuwa', report: { text: { cardDaily: '' } } })
  assert.equal(cleared.text.cardDaily, '', '空字符串是有效值，不回落')
})

test('目录里配了非空列表 → 以目录为准（可覆盖内置）', () => {
  const preset = reportPresetFor('ak', {
    id: 'ak',
    report: { daily: ['只做日常'], weekly: ['只做周常'], resources: ['玉'], author: '阿露' },
  })
  assert.deepEqual(preset.daily, ['只做日常'])
  assert.deepEqual(preset.weekly, ['只做周常'])
  assert.deepEqual(preset.resources, ['玉'])
  assert.equal(preset.author, '阿露')
})

test('配成空数组视为「没配」→ 回落到内置预设', () => {
  const preset = reportPresetFor('endfield', { id: 'endfield', report: { daily: [], weekly: [], resources: [] } })
  assert.deepEqual(preset.daily, BUILTIN_REPORT_PRESETS.endfield.daily)
  assert.deepEqual(preset.resources, BUILTIN_REPORT_PRESETS.endfield.resources)
})

test('只有部分字段时，其余字段各自回落', () => {
  const preset = reportPresetFor('nte', { id: 'nte', report: { weekly: ['自定义周常'] } })
  assert.deepEqual(preset.weekly, ['自定义周常'], '配了的用配置')
  assert.deepEqual(preset.daily, BUILTIN_REPORT_PRESETS.nte.daily, '没配的回落内置')
  assert.equal(preset.author, '小野', 'author 也回落内置')
})

test('normalizeReportPreset 过滤空串与非数组，且全部转字符串', () => {
  const norm = normalizeReportPreset({ daily: ['  a  ', '', null, 3], weekly: 'not-array', resources: [' x '], author: '  阿露 ' })
  assert.deepEqual(norm.daily, ['a', '3'])
  assert.deepEqual(norm.weekly, [])
  assert.deepEqual(norm.resources, ['x'])
  assert.equal(norm.author, '阿露')
  assert.deepEqual(norm.text, {}, '没配文案时是空对象（由 mergeReportText 补默认）')

  const empty = normalizeReportPreset(null)
  assert.deepEqual([empty.daily, empty.weekly, empty.resources, empty.text], [[], [], [], {}])
})

test('normalizeGame 会保留并规范化 report 字段（老数据补空）', () => {
  const withPreset = normalizeGame({ id: 'wuwa', name: '鸣潮', report: { daily: ['刷本'], resources: ['星声'] } })
  assert.deepEqual(withPreset.report.daily, ['刷本'])
  assert.deepEqual(withPreset.report.resources, ['星声'])

  const legacy = normalizeGame({ id: 'ak', name: '明日方舟' })
  const r = legacy.report
  assert.deepEqual([r.daily, r.weekly, r.resources, r.text], [[], [], [], {}], '老数据补空，不报错')
})

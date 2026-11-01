// ═══════════════════════════════════════════════════════════════════
// 日报不再写死三个游戏（M12）
//
// 以前 ReportSheet 里有一套硬编码：GAME_NAME_TO_KEY 三游戏映射、三个写死的页签、
// 三套任务数组、switchGame('nte') 就 setAuthor('小野')。结果是「游戏与服务」里
// 新增的游戏在日报里完全不可用。
//
// 现在：页签来自 gamesRepo、任务项来自 game.report 配置（回落内置预设）、
// 游戏识别走 domain/games.js。这里用源码契约把这些钉住。
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const sheet = read('src/components/ReportSheet.vue')

test('游戏识别走目录，不再有写死的三游戏映射表', () => {
  assert.equal(/GAME_NAME_TO_KEY|GAME_KEY_TO_NAME|GAME_ORDER/.test(sheet), false, '硬编码映射表应已删除')
  assert.match(sheet, /import \{ findGame, gameKeyOf, gameNameOf, usableGames \} from '@\/domain\/games\.js'/, '游戏识别统一走 domain/games')
  assert.match(sheet, /function gameKeyOfRecord\(t\) \{\s*const all = gamesRepo\.state\.value/, '按目录解析游戏 id')
  assert.match(sheet, /gameNameOf\(gamesRepo\.state\.value/, '显示名也走目录')
})

test('页签由「游戏与服务」目录驱动', () => {
  assert.match(sheet, /const reportGames = computed\(\(\) => usableGames\(gamesRepo\.state\.value\)\)/, '页签 = 启用且未归档的游戏')
  assert.match(sheet, /v-for="g in reportGames"/, '页签用 v-for 渲染')
  assert.match(sheet, /switchGame\(g\.id\)/, '点击切片全局')
  // 三个写死的按钮文案不应再出现在页签里
  const tabs = sheet.slice(sheet.indexOf('rp-game-tabs'), sheet.indexOf('rp-game-tabs') + 600)
  assert.equal(/明日方舟|终末地|异环/.test(tabs), false, '页签文案不再写死游戏名')
})

test('任务项来自模板草稿；增删只改草稿，不动全局配置', () => {
  assert.match(sheet, /const currentRows = computed\(\(\) => rowsFor\(reportGame\.value\)\)/, '任务行按当前游戏取')
  assert.match(sheet, /v-for="\(t, i\) in currentRows\.daily"/, '日常任务来自草稿')
  assert.match(sheet, /v-for="\(t, i\) in currentRows\.weekly"/, '周常任务来自草稿')
  assert.match(sheet, /function addTaskRow\(kind\)/, '可以加任务')
  assert.match(sheet, /function removeTaskRow\(kind, index\)/, '可以删任务')
  // 增删改的是 currentTpl（草稿），不是直接写回目录
  assert.match(sheet, /function setTplList\(kind, labels\) \{\s*currentTpl\.value\[kind\]/, '增删落到草稿')
  assert.equal(/function addTaskRow[\s\S]{0,200}updateGame\(/.test(sheet), false, '增删不再直接写回全局配置')
  // 三套写死的数组应已删除
  for (const name of ['dailyTasks', 'efDailyTasks', 'nteDailyA', 'nteDailyB', 'nteWeeklyTasks']) {
    assert.equal(new RegExp(`const ${name} = reactive\\(`).test(sheet), false, `${name} 写死数组应已删除`)
  }
})

test('日报页的增删是临时的：提示文案与实现一致', () => {
  assert.match(sheet, /title="删除这一项（只影响当前这份日报/, '删除按钮的提示要说明是临时删除')
  assert.equal(/同时改掉该游戏的日报预设/.test(sheet), false, '不应再出现过时的「会改掉预设」提示')
  // 增删落在草稿，而不是直接 updateGame
  assert.equal(/function addTaskRow[\s\S]{0,240}updateGame\(/.test(sheet), false, '新增任务不写全局')
  assert.equal(/function removeTaskRow[\s\S]{0,240}updateGame\(/.test(sheet), false, '删除任务不写全局')
})

test('草稿与全局预设是两个入口，且草稿落盘', () => {
  // 草稿：readReportDrafts / writeReportDrafts（防抖写盘）
  assert.match(sheet, /const drafts = reactive\(readReportDrafts\(\)\)/, '草稿从 tr-report-draft 读')
  assert.match(sheet, /function scheduleDraftSave\(\)[\s\S]{0,200}writeReportDrafts\(drafts\)/, '草稿改动落盘')
  // 存为全局：四次确认后写回 game.report
  assert.match(sheet, /function saveTemplateAsGlobal\(\)[\s\S]{0,120}saveGlobalCfm\.trigger\('save-global'\)/, '存为全局要四次确认')
  assert.match(sheet, /updateGame\(game\.id, \{\s*report: \{/, '存为全局写回 game.report')
  // 恢复默认：清掉草稿
  assert.match(sheet, /function resetTemplate\(\)[\s\S]{0,200}clearReportDraft\(/, '恢复默认清草稿')
  // 模板面板
  assert.match(sheet, /<ReportTemplatePanel/, '模板面板已挂载')
  assert.match(sheet, /:draft="currentTpl"/, '面板改的是当前草稿')
})

test('默认资源项与默认汇报人也来自预设', () => {
  assert.match(sheet, /function defaultResourceLabels\(gameId\) \{\s*const game = findGame/, '资源项按游戏取预设')
  assert.match(sheet, /reportPresetFor\(gameId, game\)\.resources/, '资源项来自预设')
  // 汇报人是「每游戏一个固定值」：预设 author 优先，空则回落主署名
  assert.match(sheet, /const currentAuthor = computed\(\(\) => \{[\s\S]{0,160}presetOf\(reportGame\.value\)\.author/, '汇报人取自预设')
  assert.match(sheet, /return \(author && String\(author\)\.trim\(\)\) \|\| APP_SIGN/, '没配则回落主署名')
  assert.match(sheet, /watch\(currentAuthor, \(name\) => setTitle\(name \+ '的每日汇报'\)/, '标题跟着汇报人走')
  // 不再有可切换的汇报人按钮
  assert.equal(/reportAuthors|setAuthor\(|activeAuthor/.test(sheet), false, '不再提供切换汇报人的入口')
  assert.equal(/'小野'/.test(sheet), false, '不再硬编码某个汇报人')
})

test('内置游戏的专属行仍然保留（视觉不变）', () => {
  for (const label of ['理智剩余', '线索传递', '本性像素剩余', '送礼', '都市体力剩余']) {
    assert.match(sheet, new RegExp(label), `专属行「${label}」应仍在`)
  }
  assert.match(sheet, /reportGame === 'ak' \|\| reportGame === 'endfield'/, '理智/线索只在 AK 与终末地出现')
})

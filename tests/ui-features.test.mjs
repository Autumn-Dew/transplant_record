// 本轮功能的结构约束：蓝图备注 / 分组收纳 / 店铺信息可隐藏 / 收入口径
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('蓝图支持备注：详情可查看/编辑，新增表单可填', () => {
  const page = read('src/views/BlueprintPage.vue')
  assert.match(page, /v-model="detailRecord\.note"/, '详情编辑态可填备注')
  assert.match(page, /detailRecord\.note \|\| '—'/, '查看态显示备注')

  const add = read('src/views/AddPage.vue')
  assert.match(add, /v-model="blueprintForm\.note"/, '新增表单可填备注')
  assert.match(add, /note: ''/, '默认值包含备注（编辑旧记录不会被清空）')

  const domain = read('src/domain/blueprints.js')
  assert.match(domain, /BLUEPRINT_FIELDS = \[[^\]]*'note'/, '备注属于蓝图字段（复制时一并带上）')
})

test('蓝图分组可收纳：点分组头收起 / 展开组内条目', () => {
  const page = read('src/views/BlueprintPage.vue')
  assert.match(page, /@click="toggleGroup\(row\.name\)"/, '分组头可点击')
  assert.match(page, /function toggleGroup/, '有折叠逻辑')
  assert.match(page, /if \(collapsed\.value\[grp\.name\]\) return/, '收起时不再渲染该组条目')
  assert.match(page, /bp-caret/, '有展开 / 收起指示')
  assert.match(page, /\.bp-group-head[\s\S]{0,120}cursor: pointer/, '分组头显示为可点击')
})

test('店铺信息可在「数据管理」隐藏，价格表随之不显示', () => {
  const admin = read('src/views/AdminPage.vue')
  assert.match(admin, /toggleShopHidden/, '数据管理里有隐藏开关')
  assert.match(admin, /writeShopHidden/, '开关会落盘')

  const price = read('src/views/PricePage.vue')
  assert.match(price, /readShopHidden/, '价格表读取开关')
  assert.match(price, /!shopHidden/, '价格表按开关决定是否显示店铺信息')

  const shop = read('src/data/shop-info.js')
  assert.match(shop, /SHOP_HIDDEN/, '独立存储键，不改动既有店铺数据结构')
})

test('收入统计只用订单口径，绝不用执行记录累加（会重复计算）', () => {
  const diary = read('src/views/WorkDiary.vue')
  assert.match(diary, /allIncome = computed\(\(\) => revenueStats\(\)/, '累计入账走订单统计')
  assert.equal(
    /reduce\(\(s, r\) => s \+ \(Number\(r\.fee\)/.test(diary),
    false,
    '不得再按执行记录的 fee 累加（同一笔收费会被每条记录重复计算）',
  )
})

test('代肝记录的时间排序不再被「托管」类型分组打乱', () => {
  const diary = read('src/views/WorkDiary.vue')
  // 旧实现：无论选哪种排序，先把 wasHosting 的整体推到前面
  assert.equal(/const ha = a\.wasHosting \? 1 : 0/.test(diary), false, '不再按 wasHosting 分组排序')
  assert.match(diary, /sortMode\.value === 'fee'/, '金额排序按 fee')
  assert.match(diary, /sortMode\.value === 'game'/, '游戏排序按 game')
  assert.match(diary, /`\$\{doneDate\(a\)\} \$\{a\.time \|\| ''\}`/, '时间排序用「完成日期 + 时间」')
})

test('设置页提供「备份全部数据」', () => {
  const settings = read('src/views/SettingsPage.vue')
  assert.match(settings, /@click="backupAll"/, '有备份按钮')
  assert.match(settings, /function backupAll/, '有备份实现')
  assert.match(settings, /startsWith\('tr-'\)/, '导出全部 tr- 键')
  assert.match(settings, /!k\.startsWith\('tr-backup-'\)/, '不含迁移备份键')
  assert.match(settings, /download = `代肝记录备份_/, '导出为带日期的 JSON 文件')
  // 数据管理页不再放备份入口（已统一到设置页）
  assert.equal(/backupAll/.test(read('src/views/AdminPage.vue')), false, '数据管理页不再有备份按钮')
})

test('每日汇报在控件右侧显示当前项目备注', () => {
  const sheet = read('src/components/ReportSheet.vue')
  assert.match(sheet, /class="rp-note"/, '有备注展示位')
  assert.match(sheet, /selectedTask\.note/, '读取当前选中项目的备注')
  assert.match(sheet, /\.rp-note \{[\s\S]{0,200}text-overflow: ellipsis/, '过长时省略')
})

test('代肝记录只统计「整个托管周期已完成」的项目', () => {
  const diary = read('src/views/WorkDiary.vue')
  assert.match(diary, /finishedProjectIds/, '有「周期已完成」判定')
  assert.match(diary, /isCompleted\(p\) \|\| isClosed\(p\) \|\| isExpired\(p\)/, '完成 / 归档 / 到期 都算结束')
  assert.match(diary, /finished\.has\(String\(r\.projectId\)\)/, '列表按项目过滤')
})

test('托管天数可增可减（不做封顶）', () => {
  const svc = read('src/services/projectService.js')
  assert.equal(/Math\.min\(wantN, prevCycle\)/.test(svc), false, '服务层不再封顶')
  const detail = read('src/components/ProjectDetail.vue')
  assert.equal(/maxHostDays/.test(detail), false, '详情窗口不再限制上限')
  const add = read('src/views/AddPage.vue')
  assert.equal(/maxHostDays/.test(add), false, '新增记录页不再限制上限')
})

test('蓝图列表显示备注列，且默认只展开第一个分组', () => {
  const bp = read('src/views/BlueprintPage.vue')
  assert.match(bp, /<div class="bp-col source">备注<\/div>/, '列名改为备注')
  assert.equal(/bp-col source">蓝图来源</.test(bp), false, '不再显示蓝图来源')
  assert.match(bp, /\{\{ row\.item\.note \|\| '—' \}\}/, '单元格显示备注')
  // 分组的真实来源是 groupedRecords（蓝图自带的 group 字段）；groups 是手动排序列表，常为空
  assert.match(bp, /watch\(groupedRecords/, '监听真正渲染的分组，而不是排序用的 groups')
  assert.match(bp, /if \(!name \|\| name in next\) return/, '只补新出现的组')
  assert.match(bp, /next\[name\] = i > 0/, '除第一个组外全部收起')
})

test('所有侧边弹窗占页面一半宽度', () => {
  const css = read('src/assets/css/page-common.css')
  assert.match(css, /\.modal-mask \.edit-popup \{[^}]*width: 50vw/, '侧边弹窗宽度 = 50vw')
})

test('续费窗口与详情窗口同一套版式', () => {
  const add = read('src/views/AddPage.vue')
  const renewBlock = add.slice(add.indexOf('v-if="renewal"'), add.indexOf('v-if="renewal"') + 3000)
  assert.match(renewBlock, /class="edit-popup pd-popup"/, '用详情窗口的 popup 样式')
  assert.match(renewBlock, /class="pd-head"/, '有名称行')
  assert.match(renewBlock, /class="detail-grid"/, '用 detail-grid 布局')
  assert.match(renewBlock, /class="detail-section"/, '有分组标题')
  assert.match(renewBlock, /class="pd-inp"/, '输入框用 pd-inp')
})

test('设置页支持从备份恢复（加载）', () => {
  const settings = read('src/views/SettingsPage.vue')
  assert.match(settings, /从备份恢复/, '有恢复入口')
  assert.match(settings, /type="file"/, '可选择备份文件')
  assert.match(settings, /restoreCfm\.trigger\('restore'\)/, '走多次点击确认')
  assert.match(settings, /saveRecords/, '同步 Electron 文件，避免被旧数据覆盖')
})

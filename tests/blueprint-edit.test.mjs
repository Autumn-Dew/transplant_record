// 蓝图记录编辑优化测试
//   · 记录级字号（常用选项 / 直接输入 / 夹紧 / 默认值 / 不回写历史记录）
//   · 颜色 HEX 规范化与校验
//   · 「以已有蓝图为基础」生成完全独立副本（互不影响）
//   · 兼容性：旧记录无新字段仍正常；normalize 不改写历史字段、不丢自定义字段
//   · 结构约束：分组数据结构未被改动；编辑/添加/删除不丢配置
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)) },
  removeItem: k => { store.delete(k) },
  clear: () => store.clear(),
  key: i => [...store.keys()][i],
  get length() { return store.size },
}
globalThis.window = { dispatchEvent: () => {}, addEventListener: () => {}, removeEventListener: () => {} }

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const { blueprintsRepo, blueprintGroupsRepo } = await import('../src/data/repos.js')
const {
  FONT_SIZE_MIN, FONT_SIZE_MAX, DEFAULT_FONT_SIZE, FONT_SIZE_PRESETS,
  normalizeFontSize, fontSizeOf, isValidFontSize, isValidHex, normalizeHex,
  blueprintCopy, duplicateBlueprint, BLUEPRINT_FIELDS,
} = await import('../src/domain/blueprints.js')

function reset() {
  store.clear()
  blueprintsRepo.replaceAll([])
  blueprintGroupsRepo.save([])
}

const SRC = {
  id: 'bp-src',
  group: '谷地',
  code: 'EF-0021-A',
  name: '四号谷地滑索',
  land: '5x5',
  products: '滑索',
  source: '主线',
  color: '#FF6D00',
  fontSize: 16,
  customTag: '保留我',          // 自定义字段：不得丢失
}

// ══════════ 字号 ══════════

test('字号规范化：空值 / 非数字用默认值，越界夹紧，小数取整', () => {
  assert.equal(normalizeFontSize(''), DEFAULT_FONT_SIZE)
  assert.equal(normalizeFontSize(null), DEFAULT_FONT_SIZE)
  assert.equal(normalizeFontSize(undefined), DEFAULT_FONT_SIZE)
  assert.equal(normalizeFontSize('abc'), DEFAULT_FONT_SIZE)
  assert.equal(normalizeFontSize(NaN), DEFAULT_FONT_SIZE)
  assert.equal(normalizeFontSize(1), FONT_SIZE_MIN, '过小夹到下界')
  assert.equal(normalizeFontSize(999), FONT_SIZE_MAX, '过大夹到上界')
  assert.equal(normalizeFontSize(12.6), 13, '四舍五入')
  assert.equal(normalizeFontSize('14'), 14, '数字字符串可用')
  assert.equal(normalizeFontSize(0), DEFAULT_FONT_SIZE, '0 视为未设置（不是 8）')
})

test('读取记录字号：未设置用默认值，且不修改记录本身', () => {
  const old = { id: 'x', name: '旧记录' }
  assert.equal(fontSizeOf(old), DEFAULT_FONT_SIZE)
  assert.equal('fontSize' in old, false, '读取不得给历史记录写入字段')
  assert.equal(fontSizeOf({ fontSize: 20 }), 20)
  assert.equal(fontSizeOf({ fontSize: '9' }), 9)
  assert.equal(fontSizeOf(null), DEFAULT_FONT_SIZE)
})

test('字号输入校验：空值合法（用默认），非数字与越界不合法', () => {
  assert.equal(isValidFontSize(''), true)
  assert.equal(isValidFontSize(null), true)
  assert.equal(isValidFontSize(12), true)
  assert.equal(isValidFontSize('14'), true)
  assert.equal(isValidFontSize(FONT_SIZE_MIN), true)
  assert.equal(isValidFontSize(FONT_SIZE_MAX), true)
  assert.equal(isValidFontSize('abc'), false)
  assert.equal(isValidFontSize(FONT_SIZE_MIN - 1), false)
  assert.equal(isValidFontSize(FONT_SIZE_MAX + 1), false)
})

test('常用字号选项存在且都在合法范围内', () => {
  assert.ok(FONT_SIZE_PRESETS.length >= 5, '应提供常用字号快捷选项')
  FONT_SIZE_PRESETS.forEach(s => {
    assert.equal(Number.isInteger(s), true)
    assert.ok(s >= FONT_SIZE_MIN && s <= FONT_SIZE_MAX)
  })
  assert.ok(FONT_SIZE_PRESETS.includes(DEFAULT_FONT_SIZE), '常用选项应含默认字号')
})

// ══════════ 颜色 HEX ══════════

test('HEX 校验与规范化：#RGB / #RRGGBB 可用，可省略 #，非法值不静默丢弃', () => {
  assert.equal(isValidHex('#FF6D00'), true)
  assert.equal(isValidHex('#fff'), true)
  assert.equal(isValidHex('ff6d00'), true)
  assert.equal(isValidHex(''), true, '空 = 未设置，仍属合法')
  assert.equal(isValidHex('#GGGGGG'), false)
  assert.equal(isValidHex('red'), false)
  assert.equal(normalizeHex('  ff6d00 '), '#ff6d00')
  assert.equal(normalizeHex('#Ff6D00'), '#Ff6D00')
  assert.equal(normalizeHex('red'), 'red', '非法值原样返回，由界面提示而不是丢弃')
  assert.equal(normalizeHex(''), '')
})

// ══════════ 以已有蓝图为基础 ══════════

test('复制内容：保留全部字段与自定义字段，只去掉 id', () => {
  const copy = blueprintCopy(SRC)
  assert.equal('id' in copy, false, '副本不继承 id')
  for (const f of BLUEPRINT_FIELDS) assert.equal(copy[f], SRC[f], `字段 ${f} 应被复制`)
  assert.equal(copy.customTag, '保留我', '自定义字段也要复制')
  assert.notEqual(copy, SRC, '必须是新对象')
})

test('副本与原记录完全独立（双向）', () => {
  const copy = duplicateBlueprint(SRC, { id: 'bp-copy' })
  assert.equal(copy.id, 'bp-copy')
  assert.notEqual(copy.id, SRC.id)

  // 改副本 → 原记录不受影响
  copy.name = '改过的副本'
  copy.group = '武陵'
  copy.fontSize = 20
  copy.color = '#00B0FF'
  copy.nested = { a: 1 }
  assert.equal(SRC.name, '四号谷地滑索')
  assert.equal(SRC.group, '谷地')
  assert.equal(SRC.fontSize, 16)
  assert.equal(SRC.color, '#FF6D00')
  assert.equal('nested' in SRC, false)

  // 改原记录 → 副本不受影响
  const before = JSON.stringify(copy)
  SRC.name = '改过的原记录'
  SRC.fontSize = 9
  assert.equal(JSON.stringify(copy), before)
  SRC.name = '四号谷地滑索'
  SRC.fontSize = 16
})

test('深拷贝：嵌套对象也互相独立', () => {
  const src = { id: 'a', name: 'n', meta: { tags: ['x'] } }
  const copy = duplicateBlueprint(src, { id: 'b' })
  copy.meta.tags.push('y')
  assert.deepEqual(src.meta.tags, ['x'], '嵌套数组不得共享引用')
})

test('未指定 id 时自动生成新的唯一 id', () => {
  const a = duplicateBlueprint(SRC)
  const b = duplicateBlueprint(SRC)
  assert.ok(a.id && b.id)
  assert.notEqual(a.id, b.id)
  assert.notEqual(a.id, SRC.id)
})

// ══════════ 与 repository 集成（真实数据路径）══════════

test('副本写入后互不影响：改副本 / 删副本都不影响原记录', () => {
  reset()
  blueprintsRepo.add({ ...SRC })
  blueprintsRepo.add(duplicateBlueprint(SRC, { id: 'bp-copy' }))
  assert.equal(blueprintsRepo.state.value.length, 2)

  blueprintsRepo.update('bp-copy', { name: '副本改过', group: '武陵' })
  assert.equal(blueprintsRepo.find('bp-src').name, '四号谷地滑索')
  assert.equal(blueprintsRepo.find('bp-src').group, '谷地')

  blueprintsRepo.update('bp-src', { fontSize: 22 })
  assert.equal(blueprintsRepo.find('bp-copy').fontSize, 16, '原记录改动不反向影响副本')
  assert.equal(blueprintsRepo.find('bp-copy').name, '副本改过')

  blueprintsRepo.remove('bp-copy')
  assert.equal(blueprintsRepo.state.value.length, 1)
  assert.ok(blueprintsRepo.find('bp-src'), '删除副本不得影响原记录')
})

test('编辑（部分字段）不会丢配置：字号、颜色与自定义字段都保留', () => {
  reset()
  blueprintsRepo.add({ ...SRC })
  blueprintsRepo.update('bp-src', { name: '只改名字' })
  const r = blueprintsRepo.find('bp-src')
  assert.equal(r.name, '只改名字')
  assert.equal(r.fontSize, 16, '字号不能被覆盖丢失')
  assert.equal(r.color, '#FF6D00', '颜色不能被覆盖丢失')
  assert.equal(r.customTag, '保留我', '自定义字段不能被覆盖丢失')
  assert.equal(r.group, '谷地')
})

test('兼容性：旧记录（无 fontSize / color / 自定义字段）读写照常，字段不被改写', () => {
  reset()
  // 模拟重构前的真实结构
  store.set('tr-blueprints', JSON.stringify([
    { id: 'old-1', group: '谷地', code: 'EF-0021-A', name: '旧蓝图', land: '5x5', products: '滑索', source: '主线', color: '#FF6D00' },
    { id: 'old-2', group: '谷地', code: 'EF-0022-B', name: '无颜色蓝图' },
  ]))
  blueprintsRepo.reload()
  assert.equal(blueprintsRepo.state.value.length, 2)
  const one = blueprintsRepo.find('old-1')
  assert.equal(fontSizeOf(one), DEFAULT_FONT_SIZE, '缺字号 → 用默认值显示')
  assert.equal('fontSize' in one, false, '打开/读取不会给旧记录写入新字段')

  // 只改一个字段，其余原样保留（含储存在原始键里的字段）
  blueprintsRepo.update('old-2', { fontSize: 18 })
  const after = blueprintsRepo.find('old-2')
  assert.equal(after.fontSize, 18)
  assert.equal(after.name, '无颜色蓝图')
  assert.equal(after.code, 'EF-0022-B')
  assert.equal(blueprintsRepo.find('old-1').fontSize, undefined, '未编辑的记录不受影响')
})

test('分组数据结构未被改动（仍为纯字符串数组）', () => {
  reset()
  blueprintGroupsRepo.save(['谷地', ' 武陵 ', '', '谷地'])
  assert.deepEqual(blueprintGroupsRepo.state.value, ['谷地', '武陵', '谷地'], '仍按既有规则 trim + 去空（不改变既有行为）')

  const reposSrc = read('src/data/repos.js')
  assert.match(reposSrc, /function normalizeGroupList[\s\S]{0,200}String\(s\)\.trim\(\)/, '分组仍是字符串数组')
  const domainSrc = read('src/domain/blueprints.js')
  assert.equal(/import .*repos/.test(domainSrc), false, '字号纯逻辑不导入 repository')
  assert.equal(/blueprintGroupsRepo/.test(domainSrc), false, '不直接操作分组仓库，分组结构未被改动')
})

// ══════════ 结构约束（源码级） ══════════

test('蓝图不再提供字号修改项（列表与两处表单都没有）', () => {
  const page = read('src/views/BlueprintPage.vue')
  assert.equal(/bp-size|fontSizeOf\(/.test(page), false, '蓝图详情不应再有字号控件，列表也不按字号渲染')
  assert.match(page, /class="bp-hex"/, '颜色应支持直接输入 HEX')

  const add = read('src/views/AddPage.vue')
  assert.equal(/bp-size|fontSize/.test(add), false, '新增表单不应再有字号修改项')
  assert.match(add, /class="bp-hex-input"/)
})

test('新增蓝图可选择已有蓝图为基础（复制为独立草稿）', () => {
  const add = read('src/views/AddPage.vue')
  assert.match(add, /从已有选择/, '应提供「从已有选择」入口')
  assert.match(add, /v-if="!editingId"[\s\S]{0,200}selectedBlueprint/, '仅新增时提供，避免编辑态被覆盖')
  assert.match(add, /function applyBlueprintTemplate[\s\S]{0,300}blueprintCopy\(src\)/, '必须深拷贝为独立草稿')
})

test('保存前规范化颜色，空值不写入记录；字号字段不再写入', () => {
  const page = read('src/views/BlueprintPage.vue')
  assert.match(page, /patch\.color = normalizeHex/)
  const add = read('src/views/AddPage.vue')
  assert.match(add, /data\.color = normalizeHex/)
  assert.equal(/fontSize/.test(add), false, '新增表单不再写入字号字段')
})

test('数据同步：删除记录后关闭详情；分组重命名后同步详情', () => {
  const page = read('src/views/BlueprintPage.vue')
  assert.match(
    page,
    /blueprintsRepo\.remove\([\s\S]{0,200}closeDetail\(\)/,
    '删除当前记录后应关闭详情，避免停留在已删除的数据上',
  )
  assert.match(
    page,
    /commitRename[\s\S]{0,900}detailRecord\.value[\s\S]{0,200}group/,
    '分组批量重命名后应同步详情里的组名，避免保存把旧组名写回',
  )
  const add = read('src/views/AddPage.vue')
  assert.match(add, /watch\(\[editRecord, editType\]/, 'AddPage 编辑目标变化时应同步表单')
})

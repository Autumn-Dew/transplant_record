import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(ROOT, p), 'utf8')

globalThis.localStorage = {
  _s: new Map(),
  getItem(k) { return this._s.has(k) ? this._s.get(k) : null },
  setItem(k, v) { this._s.set(k, String(v)) },
  removeItem(k) { this._s.delete(k) },
  clear() { this._s.clear() },
  key(i) { return [...this._s.keys()][i] },
  get length() { return this._s.size },
}

const {
  REPORT_THEMES,
  REPORT_THEME_GROUPS,
  REPORT_THEME_IDS,
  DEFAULT_REPORT_THEME,
  normalizeReportThemeId,
  findReportTheme,
  readReportTheme,
  writeReportTheme,
} = await import('../src/data/report-themes.js')

test('提供十套汇报主题，id 唯一且字段齐全', () => {
  assert.equal(REPORT_THEMES.length, 41, '经典 1 + 五族各 8 套')
  assert.equal(new Set(REPORT_THEME_IDS).size, REPORT_THEMES.length, '主题 id 不得重复')
  for (const t of REPORT_THEMES) {
    assert.match(t.id, /^[a-z0-9-]+$/, `${t.id} 只能用小写字母 / 数字 / 连字符（同时用作类名）`)
    assert.ok(t.label, `${t.id} 需要 label`)
    assert.ok(t.hint && t.hint.length >= 4, `${t.id} 需要一句设计侧重说明`)
    assert.ok(['classic', 'lone-star', 'p3r', 'endfield', 'swiss', 'stijl'].includes(t.family), `${t.id} 的 family 非法`)
  }
})

test('分组：经典 1 套、孤星 3 套、P3R 3 套、终末地 3 套、瑞士 2 套，且分组覆盖全部主题', () => {
  assert.deepEqual(REPORT_THEME_GROUPS.map(g => g.id), ['classic', 'lone-star', 'p3r', 'endfield', 'swiss', 'stijl'], '六个分组顺序固定')
  const grouped = REPORT_THEME_GROUPS.flatMap(g => g.items.map(t => t.id))
  assert.deepEqual([...grouped].sort(), [...REPORT_THEME_IDS].sort(), '分组必须覆盖全部主题且不重复')
  for (const g of REPORT_THEME_GROUPS) {
    assert.ok(g.label, `${g.id} 需要分组名`)
    for (const t of g.items) assert.equal(t.family, g.id, `${t.id} 的 family 必须等于所在分组`)
  }
  assert.equal(REPORT_THEME_GROUPS[0].items.length, 1, '经典只有一套')
  assert.equal(REPORT_THEME_GROUPS[1].items.length, 8, '孤星八套')
  assert.equal(REPORT_THEME_GROUPS[2].items.length, 8, 'P3R 八套')
  assert.equal(REPORT_THEME_GROUPS[3].items.length, 8, '终末地八套')
  assert.equal(REPORT_THEME_GROUPS[4].items.length, 8, '瑞士八套')
  assert.equal(REPORT_THEME_GROUPS[5].items.length, 8, '风格派八套')
})

test('同系列各套彼此不同（不是换色的同一套）', () => {
  const byFamily = fam => REPORT_THEMES.filter(t => t.family === fam)
  for (const fam of ['lone-star', 'p3r', 'endfield', 'swiss', 'stijl']) {
    const hints = byFamily(fam).map(t => t.hint)
    assert.equal(new Set(hints).size, hints.length, `${fam} 各套的说明必须各不相同`)
    const labels = byFamily(fam).map(t => t.label)
    assert.equal(new Set(labels).size, labels.length, `${fam} 各套的名称必须各不相同`)
  }
})

test('未知 / 空值回落到经典简报（老用户默认）', () => {
  assert.equal(DEFAULT_REPORT_THEME, 'classic')
  assert.equal(normalizeReportThemeId(null), DEFAULT_REPORT_THEME)
  assert.equal(normalizeReportThemeId(''), DEFAULT_REPORT_THEME)
  assert.equal(normalizeReportThemeId('dark'), DEFAULT_REPORT_THEME)
  assert.equal(normalizeReportThemeId('theme-p3r-poster'), DEFAULT_REPORT_THEME, '不接受带前缀的类名')
  REPORT_THEME_IDS.forEach(id => assert.equal(normalizeReportThemeId(id), id))
  assert.equal(findReportTheme('不存在').id, DEFAULT_REPORT_THEME)
})

test('主题独立持久化到 tr-report-theme，不碰背景键与应用主题键', () => {
  assert.equal(writeReportTheme('p3r-lunar'), 'p3r-lunar')
  assert.equal(JSON.parse(localStorage.getItem('tr-report-theme')), 'p3r-lunar')
  assert.equal(localStorage.getItem('tr-report-bg'), null, '写主题不得碰背景键')
  assert.equal(localStorage.getItem('tr-theme'), null, '写主题不得碰应用主题键')
  assert.equal(readReportTheme(), 'p3r-lunar')
  assert.equal(writeReportTheme('乱写'), DEFAULT_REPORT_THEME, '非法值自动归一')
  assert.equal(readReportTheme(), DEFAULT_REPORT_THEME)
  // 存储键本身也在 KEYS 里登记，且与背景键不同
  const storage = read('src/data/storage.js')
  assert.match(storage, /REPORT_THEME:\s*'tr-report-theme'/, 'KEYS 需登记 REPORT_THEME')
  assert.match(storage, /REPORT_BG:\s*'tr-report-bg'/, '背景键保持原值不变')
})

test('主题模块不得读写背景键或应用主题键', () => {
  const src = read('src/data/report-themes.js')
  assert.equal(/KEYS\.REPORT_BG/.test(src), false, '主题模块不得碰背景键')
  assert.equal(/KEYS\.THEME(?!_)/.test(src), false, '主题模块不得碰应用主题键')
  assert.equal(/var\(--/.test(src), false, '主题配置只描述语义，不直接引用 CSS 变量')
})

test('画布挂汇报主题类，并与背景各自独立绑定', () => {
  const sheet = read('src/components/ReportSheet.vue')
  assert.match(sheet, /:class="`rp-theme-\$\{reportTheme\.id\}`"/, '画布皮肤取自汇报主题')
  assert.match(sheet, /:style="\{ background: reportBg\.bg \}"/, '画布底层取自背景')
  assert.match(sheet, /v-for="g in REPORT_THEME_GROUPS"/, '按系列分组遍历主题')
  assert.match(sheet, /v-for="t in g\.items"/, '组内遍历主题选项')
  assert.match(sheet, /:class="\{ active: reportThemeId === t\.id \}"/, '标识当前选中主题')
  assert.match(sheet, /@click="setReportTheme\(t\.id\)"/, '点击即切换主题')
  assert.match(sheet, /class="rp-theme-thumb"/, '主题缩略图')
  assert.match(sheet, /class="rtt-title"/, '缩略图含标题带')
  assert.match(sheet, /class="rtt-meta"/, '缩略图含信息栏')
  assert.match(sheet, /class="rtt-head"/, '缩略图含卡片标题')
  // 选择入口是侧边弹窗（与项目详情窗口同一套版式），主题与背景各占一段
  assert.match(sheet, /class="modal-mask" v-if="stylePanelOpen"/, '外观选择为侧边弹窗')
  assert.match(sheet, /class="edit-popup pd-popup rp-look"/, '沿用项目详情窗口的弹窗版式')
  assert.match(sheet, /<p class="detail-section">内容主题/, '主题分段')
  assert.match(sheet, /<p class="detail-section">画布背景/, '背景分段')
  // 弹窗不设底部按钮、不显示滚动条，但内容超出时可以滑动
  assert.equal(/class="edit-actions/.test(sheet), false, '外观弹窗不设底部按钮区（含「关闭」）')
  assert.match(sheet, /\.modal-mask \.edit-popup\.rp-look \{[\s\S]{0,300}?overflow-y:\s*auto/, '外观弹窗内容超出时可滑动（隐藏滚动条不等于不能滚）')
  assert.match(sheet, /\.modal-mask \.edit-popup\.rp-look::-webkit-scrollbar \{[\s\S]{0,120}?display:\s*none/, '滚动条仍然不显示')
  assert.match(sheet, /@click\.self="stylePanelOpen = false"/, '点遮罩即可关闭')
})

test('每套主题在组件里都有对应的变量块与皮肤类', () => {
  const sheet = read('src/components/ReportSheet.vue')
  for (const t of REPORT_THEMES) {
    assert.match(
      sheet,
      new RegExp(`\\.rp-theme-${t.id}\\s*\\{`),
      `缺少 .rp-theme-${t.id} 的样式定义`,
    )
  }
  // 变量必须成组出现：画布与缩略图共享同一组 --rt-*
  assert.match(sheet, /\.rp-wrap,\s*\n\.rp-theme-thumb\s*\{/, '默认主题变量需同时挂在画布与缩略图上')
  for (const v of ['--rt-ink', '--rt-head-bg', '--rt-meta-bg', '--rt-card-edge', '--rt-accent', '--rt-row-rule']) {
    assert.ok(sheet.includes(v), `缺少主题变量 ${v}`)
  }
})

test('主题皮肤不改布局：只允许颜色 / 边框 / 字重 / 字距 / 伪元素', () => {
  const sheet = read('src/components/ReportSheet.vue')
  const start = sheet.indexOf('汇报主题（内容皮肤）')
  assert.ok(start > 0, '找不到主题样式段的起始注释')
  const block = sheet.slice(start)

  // 逐条规则检查：伪元素（绝对定位装饰）允许 font-size / line-height，
  // 真实元素上则一律禁止会改变盒模型与换行的声明。
  const rules = block.split('}')
  const banned = [
    [/(^|[\s;{])padding\s*:/, 'padding'],
    [/(^|[\s;{])margin\s*:/, 'margin'],
    [/(^|[\s;{])display\s*:/, 'display'],
    [/(^|[\s;{])flex\s*:/, 'flex'],
    [/(^|[\s;{])grid(-template)?\s*:/, 'grid'],
    [/(^|[\s;{])gap\s*:/, 'gap'],
  ]
  const bannedOnElements = [
    [/(^|[\s;{])font-size\s*:/, 'font-size'],
    [/(^|[\s;{])line-height\s*:/, 'line-height'],
    [/(^|[\s;{])width\s*:/, 'width'],
    [/(^|[\s;{])height\s*:/, 'height'],
  ]
  for (const rule of rules) {
    const brace = rule.indexOf('{')
    if (brace < 0) continue
    const selector = rule.slice(0, brace)
    const body = rule.slice(brace)
    const isPseudo = /::(before|after)/.test(selector)
    for (const [re, name] of banned) {
      assert.equal(re.test(body), false, `主题样式不得出现 ${name}：${selector.trim()}`)
    }
    if (!isPseudo) {
      for (const [re, name] of bannedOnElements) {
        assert.equal(re.test(body), false, `真实元素上不得出现 ${name}：${selector.trim()}`)
      }
    }
  }
  // 只允许小字距与字重这类不改变盒模型的表现
  assert.match(block, /letter-spacing:/, '应有字距调整')
  assert.equal(/filter\s*:/.test(block), false, '不得使用 filter（html2canvas 不可靠）')
  assert.equal(/clip-path\s*:/.test(block), false, '不得使用 clip-path（html2canvas 不可靠）')
})

test('导出同时带上主题与背景，且不改导出尺寸', () => {
  const sheet = read('src/components/ReportSheet.vue')
  assert.match(sheet, /html2canvas\(wrapRef\.value,\s*\{[^}]*backgroundColor:\s*reportBg\.value\.base/, '导出兜底底色取当前背景')
  assert.match(sheet, /html2canvas\(wrapRef\.value,\s*\{[^}]*scale:\s*3/, '导出比例保持 3 倍不变')
  // 主题与背景都在画布元素上（DOM + 类名），html2canvas 按计算样式渲染，无需额外处理
  assert.match(sheet, /ref="wrapRef"[^>]*:class="`rp-theme-\$\{reportTheme\.id\}`"/, '主题类挂在导出根节点上')
})

test('今日获取资源：可以删到一项不剩，导出时整块隐藏', () => {  const sheet = read('src/components/ReportSheet.vue')
  // 删除按钮不再有「至少保留一项」的门槛
  assert.match(
    sheet,
    /class="rp-row-del rp-no-export" @click="resources\.splice\(i, 1\)"/,
    '每行都能删',
  )
  assert.equal(
    /@click="resources\.splice\(i, 1\)"[^>]*v-if="resources\.length > 1"/.test(sheet),
    false,
    '不再限制「至少留一项」',
  )
  // 资源卡片有独立类名，导出时按「有没有资源项」决定整块显隐
  assert.match(sheet, /<div class="rp-card rp-res-card">/, '资源卡片带 rp-res-card 类')
  assert.match(
    sheet,
    /if \(!resources\.length\) \{\s*const card = wrapRef\.value\.querySelector\('\.rp-res-card'\)/,
    '导出前检查资源项数量',
  )
  const hideBlock = sheet.slice(sheet.indexOf('if (!resources.length)'))
  assert.match(hideBlock.slice(0, 260), /card\.style\.display = 'none'/, '没有资源项时整块不导出')
  assert.match(hideBlock.slice(0, 260), /wasHidden: true/, '导出后恢复显示（屏幕上仍可添加资源）')
})

test('每套汇报主题标明明暗倾向，选择器里显示「浅 / 暗」', () => {
  for (const t of REPORT_THEMES) {
    assert.ok(t.tone === 'light' || t.tone === 'dark', `${t.id} 需要 tone（light / dark）`)
  }
  const dark = REPORT_THEMES.filter(t => t.tone === 'dark').map(t => t.id)
  assert.deepEqual(dark, ['ls-terminal', 'p3r-night', 'ef-nightshift', 'ef-terminal', 'swiss-index', 'swiss-inverse', 'st-inverse'], '七套暗色主题（含风格派的反白）')

  const sheet = read('src/components/ReportSheet.vue')
  // 卡片名后面带一个小标签，暗色主题用强调色描边
  assert.match(sheet, /class="rp-opt-tone"[^>]*:class="`tone-\$\{t\.tone\}`"/, '主题卡标出浅/暗')
  assert.match(sheet, /t\.tone === 'dark' \? '暗' : '浅'/, '文案是「暗 / 浅」')
  assert.match(sheet, /\.rp-opt-tone\.tone-dark/, '暗色标签有独立样式')
  // 分区下面有一句说明
  assert.match(sheet, /class="rp-look-tip"/, '弹窗里有一句明暗说明')
  // 缩略图底色跟随主题明暗：暗色主题的缩略图是深底
  assert.match(sheet, /--rt-canvas: #ffffff/, '浅色主题的画布底色变量')
  assert.match(sheet, /--rt-canvas: #191919/, '夜班的缩略图是石墨底')
  assert.match(sheet, /--rt-canvas: #111111/, '索引版式的缩略图是墨底')
  assert.match(sheet, /background: var\(--rt-canvas/, '缩略图用主题的画布底色')
})

// UI 冒烟测试：用 Electron 加载 dist 产物，逐页截图并做关键 DOM 断言
//
//   npm run ui:smoke          → 截图输出到系统临时目录（默认 <tmp>/tr-shots）
//
// 说明：
//   · 使用**独立 userData 目录**（<tmp>/tr-shots-userdata），绝不触碰用户的真实数据；
//   · 窗口需要 show: true —— 隐藏窗口的 capturePage 可能返回空白；
//   · 本脚本不加载 electron/main.js（因此 IPC handler 未注册，渲染进程会打印
//     "No handler registered for ..."，属预期噪音，已在断言中忽略）；
//   · 断言失败时进程以非 0 退出，可作为回归门禁。
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(os.tmpdir(), 'tr-shots')
fs.mkdirSync(OUT, { recursive: true })
app.setPath('userData', path.join(os.tmpdir(), 'tr-shots-userdata'))
try { app.disableHardwareAcceleration() } catch {}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 写入「有真实感」的测试数据（含连续托管两期），仅在隔离的 userData 中生效
const SEED = `(() => {
  const d = (n) => { const t = new Date(); t.setDate(t.getDate() + n); const p = x => String(x).padStart(2,'0'); return t.getFullYear()+'-'+p(t.getMonth()+1)+'-'+p(t.getDate()) }
  const iso = (n) => { const t = new Date(); t.setDate(t.getDate() + n); return t.toISOString() }
  const games = [
    { id:'endfield', name:'终末地', short:'EF', order:1, enabled:true, archived:false, services:[
      { id:'ef1', name:'普托', price:30, unit:'月', note:'日常托管', enabled:true, order:1 },
      { id:'ef2', name:'当前版本全托', price:150, unit:'月', note:'', enabled:true, order:2 },
      { id:'ef3', name:'基建毕业', price:0, unit:'', note:'不含矿点', enabled:true, order:3 } ] },
    { id:'ak', name:'明日方舟', short:'AK', order:2, enabled:true, archived:false, services:[
      { id:'ak1', name:'普托', price:30, unit:'月', note:'理智清理+基建收菜', enabled:true, order:1 },
      { id:'ak2', name:'精托', price:90, unit:'月', note:'', enabled:true, order:2 },
      { id:'ak3', name:'全托', price:150, unit:'月', note:'', enabled:true, order:3 } ] },
  ]
  localStorage.setItem('tr-games', JSON.stringify(games))
  const common = { account:'13800138000', password:'pw', wechatName:'老板A', preferredPlatform:'wechat', status:2, kind:'hosting', state:'active', schemaVersion:3 }
  const host = (s,e,pt) => ({ startDate:s, endDate:e, cycle:'month', cycleDays:30, plan:{mode:'daily',weekdays:[],timesPerDay:1}, plannedTimes:pt, completedTimes:0, skippedTimes:0, abnormalTimes:0, cancelledTimes:0, skippedDates:[] })
  localStorage.setItem('tr-accounts', JSON.stringify([
    Object.assign({}, common, { id:'p1', game:'endfield', gameName:'终末地', service:'普托', host:host(d(-9), d(20), 30),
      plannedTimes:30, createdAt:iso(-9), totalFee:100, actualFee:100, paidAt:d(-9), hostingChainId:'p1',
      locked:false, remainingDays:30, lastConfirmDate:d(-1), note:'老板很好说话', emailTag:'keep' }),
    Object.assign({}, common, { id:'p2', game:'endfield', gameName:'终末地', service:'普托', host:host(d(21), d(50), 30),
      plannedTimes:30, createdAt:iso(21), totalFee:100, actualFee:'', paidAt:d(0), hostingChainId:'p1', prevTaskId:'p1',
      locked:true, remainingDays:30, note:'' }),
    Object.assign({}, common, { id:'p3', account:'13900139000', wechatName:'老板B', game:'ak', gameName:'明日方舟', status:1, kind:'oneoff', state:'pending',
      service:'主线推图', plannedDate:d(0), plannedTimes:1, createdAt:iso(-2), totalFee:15, remainingDays:1, schemaVersion:3 }),
    Object.assign({}, common, { id:'p4', account:'13700137000', wechatName:'老板C', game:'ak', gameName:'明日方舟', service:'精托', host:host(d(-40), d(-11), 30),
      plannedTimes:30, completedTimes:30, createdAt:iso(-40), totalFee:90, actualFee:90, paidAt:d(-40), hostingChainId:'p4',
      state:'completed', status:0, remainingDays:0, archivedAt:iso(-5), archived:true }),
  ]))
  localStorage.setItem('tr-completions', JSON.stringify([
    { id:'c1', projectId:'p1', taskId:'p1', date:d(-1), completedDate:d(-1), plannedDate:d(-1), time:'21:00:00', game:'终末地', gameName:'终末地', service:'普托', account:'13800138000', displayName:'老板A', fee:100, totalFee:100, status:2, wasHosting:true, result:'done', content:'基建收菜完成', note:'', images:[], hostingChainId:'p1', periodStart:d(-9), periodEnd:d(20), chainStart:d(-9), chainEnd:d(50), chainDayIndex:9, chainRemainingDays:60 },
    { id:'c2', projectId:'p1', taskId:'p1', date:d(-2), completedDate:d(-2), plannedDate:d(-2), time:'20:30:00', game:'终末地', gameName:'终末地', service:'普托', account:'13800138000', displayName:'老板A', fee:100, status:2, wasHosting:true, result:'skipped', content:'', note:'账号异常', images:[], hostingChainId:'p1' },
    { id:'c3', projectId:'p4', taskId:'p4', date:d(-38), completedDate:d(-38), time:'19:00:00', game:'明日方舟', gameName:'明日方舟', service:'精托', account:'13700137000', displayName:'老板C', fee:90, status:0, wasHosting:true, result:'done', content:'', note:'', images:[] },
  ]))
  localStorage.setItem('tr-blueprints', JSON.stringify([
    { id:'b1', group:'谷地', code:'EF-0021-A', name:'四号谷地滑索', land:'5x5', products:'滑索', source:'主线', color:'#FF6D00' },
    { id:'b2', group:'谷地', code:'EF-0022-B', name:'矿点拉线', land:'3x3', products:'铁矿', source:'探索', color:'#00B0FF' },
    { id:'b3', group:'武陵', code:'EF-0031-A', name:'武陵主基地', land:'6x6', products:'综合', source:'主线', color:'#00E676' },
  ]))
  localStorage.setItem('tr-blueprint-groups', JSON.stringify(['谷地','武陵']))
  const cats = [
    { name:'托管', mode:'preset', items:[
      { key:1, name:'普托', price:30, unit:'月', note:'理智清理+基建收菜+日常+周常+剿灭' },
      { key:2, name:'精托', price:90, unit:'月', note:'含 SideStory 活动' },
      { key:3, name:'全托', price:150, unit:'月', note:'含所有限时活动与干员养成' } ] },
    { name:'主线推图', mode:'preset', items:[
      { key:4, name:'0-2章', price:15, unit:'章', note:'含突袭' },
      { key:5, name:'3章全包', price:25, unit:'章', note:'含突袭与隐藏' },
      { key:6, name:'4-6章', price:40, unit:'章', note:'' },
      { key:7, name:'7-17章', price:80, unit:'章', note:'练度需求较高，可能需要额外时间' } ] },
    { name:'基建', mode:'preset', items:[
      { key:8, name:'基建毕业（不含矿点）', price:60, unit:'', note:'' },
      { key:9, name:'四号谷地基建套餐', price:120, unit:'', note:'' } ] },
  ]
  localStorage.setItem('tr-prices', JSON.stringify({ __version:2, endfield:{categories:cats}, ak:{categories:cats} }))
  localStorage.setItem('tr-shop-info', JSON.stringify([
    { id:'c1', label:'代肝联系方式', value:'QQ 123456789', position:'head' },
    { id:'c2', label:'代肝游戏名称', value:'终末地 / 明日方舟', position:'head' },
    { id:'t1', label:'备注', value:'长期合作可优惠', position:'tail' } ]))
  localStorage.setItem('tr-services', JSON.stringify(['基建','打boss','大地图探索','谷地开荒','武陵开荒','托管']))
  // 返图排版：清掉上一轮冒烟留下的布局 / 模板，保证起点确定（原版预设）
  localStorage.removeItem('tr-report-layout-active')
  localStorage.removeItem('tr-report-layouts')
  return 'seeded'
})()`

async function main() {
  const failures = []
  const check = (name, ok, extra) => {
    if (!ok) failures.push(name + (extra ? ' — ' + JSON.stringify(extra) : ''))
  }
  const win = new BrowserWindow({
    width: 1440, height: 1000, show: true, backgroundColor: '#101923',
    webPreferences: {
      preload: path.join(ROOT, 'electron', 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  })
  const errors = []
  win.webContents.on('console-message', (e, level, message, line, source) => {
    const msg = String(message)
    if (level < 2 || msg.indexOf('Security Warning') >= 0) return
    if (msg.indexOf('No handler registered') >= 0) return   // 独立 main 进程未注册 IPC，预期噪音
    errors.push('[console:' + level + '] ' + msg + ' @' + String(source || '').split('/').pop() + ':' + line)
  })
  const js = async code => {
    try { return await win.webContents.executeJavaScript(code) } catch (e) { return { __err: e.message } }
  }
  const shot = async name => {
    const img = await win.webContents.capturePage()
    fs.writeFileSync(path.join(OUT, name + '.png'), img.toPNG())
    console.log('shot ' + name)
  }
  const clickByTitle = async (label) => {
    await js(`(() => { const b = [...document.querySelectorAll('.rc-sub-func-btn')].find(x => (x.title||'') === ${JSON.stringify(label)}); if (b) b.click(); return !!b })()`)
    await sleep(900)
  }
  const clickText = async (selector, text) => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find(x => x.textContent.trim() === ${JSON.stringify(text)}); if (b) b.click(); return !!b })()`)
  // 保存类按钮也是「连点 4 次生效」（全站写操作统一机制）
  const clickSave = async (selector, text) => js(`(() => {
    const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find(x => x.textContent.trim() === ${JSON.stringify(text)})
    if (!b) return false
    for (let i = 0; i < 4; i++) b.click()
    return true
  })()`)

  await win.loadFile(path.join(ROOT, 'dist', 'index.html'))
  await sleep(1600)
  check('首屏已渲染（.rc-main-container 存在）', await js(`!!document.querySelector('.rc-main-container')`))
  await js(SEED)
  await win.webContents.reload()
  await sleep(2200)

  await shot('00-accounts-today')
  await clickText('.tl-entry-btn', '全部'); await sleep(600); await shot('01-accounts-all')
  await clickText('.tl-entry-btn', '代办'); await sleep(600); await shot('02-accounts-todo')

  // ── 四套主题：平级循环切换 + 即时生效 + 持久化 ──
  const themeSeq = []
  const bgSeq = []
  for (let i = 0; i < 4; i++) {
    await clickByTitle('切换主题')
    await sleep(320)
    const id = await js(`document.documentElement.dataset.theme`)
    themeSeq.push(id)
    bgSeq.push(await js(`getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim()`))
    if (id) await shot(`02b-theme-${id}`)
  }
  console.log('    主题循环：', JSON.stringify(themeSeq))
  console.log('    背景变量：', JSON.stringify(bgSeq))
  check('四套主题循环切换', new Set(themeSeq).size === 4)
  check('每套主题背景色都不同（四套独立色板）', new Set(bgSeq).size === 4)
  check('P3R 主题已生效（含深海军蓝 #071B3A）', bgSeq.includes('#071B3A'))
  const storedTheme = await js(`(() => { try { return JSON.parse(localStorage.getItem('tr-theme')) } catch { return localStorage.getItem('tr-theme') } })()`)
  check('主题已写入 tr-theme 并可恢复', themeSeq.includes(storedTheme))

  // 通过设置页把主题定为 P3R 深色，再逐页截图核对（走真实入口，不手改 DOM）
  await clickByTitle('设置'); await sleep(600)
  check('设置页有四个主题选项', await js(`document.querySelectorAll('.theme-picker .tl-entry-btn').length === 4`))
  await js(`(() => { const b = [...document.querySelectorAll('.theme-picker .tl-entry-btn')].find(x => x.textContent.trim() === 'P3R · 深夜'); if (b) b.click(); return !!b })()`)
  await sleep(400)
  check('设置页可切到 P3R 深夜', await js(`document.documentElement.dataset.theme === 'p3r-dark'`))
  await shot('02c-p3r-dark-settings')
  for (const [key, shotName] of [['代肝代办', '02d-p3r-dark-accounts'], ['蓝图记录', '02e-p3r-dark-blueprints'], ['代肝记录', '02f-p3r-dark-diary'], ['新增记录', '02g-p3r-dark-add'], ['价格一览', '02h-p3r-dark-prices'], ['数据管理', '02i-p3r-dark-admin']]) {
    await clickByTitle(key); await sleep(650); await shot(shotName)
  }
  // 切回孤星浅色，保持后续用例的既有视觉前提
  await clickByTitle('设置'); await sleep(500)
  await js(`(() => { const b = [...document.querySelectorAll('.theme-picker .tl-entry-btn')].find(x => x.textContent.trim() === '孤星 · 档案'); if (b) b.click(); return !!b })()`)
  await sleep(400)
  check('可切回孤星 · 档案', await js(`document.documentElement.dataset.theme === 'lone-star-light'`))

  // ── 项目详情（与「代肝记录」同一套弹窗版式；不再有托管链 / 分区 tab）──
  await clickByTitle('代肝代办')
  await clickText('.tl-entry-btn', '全部')   // 详情按钮在列表行视图里
  await sleep(700)
  const openDetail = `(() => { const b = document.querySelector('.song-btn[title="详细信息"]'); if (b) b.click(); return !!b })()`
  const clickBtn = label => js(`(() => { const b = [...document.querySelectorAll('.pd-btn')].find(x => x.textContent.trim().startsWith(${JSON.stringify(label)})); if (b) b.click(); return !!b })()`)

  check('详情入口可打开', await js(openDetail))
  await sleep(600)
  check('详情弹窗已打开（与代肝记录同一套版式）', await js(`!!document.querySelector('.modal-mask .edit-popup .detail-grid')`))
  check('详情里不再有托管链 / 分区 tab / 抽屉', await js(`!document.querySelector('.pd-tab') && !document.querySelector('.pd-drawer') && !document.querySelector('.pd-period-head')`))
  check('不再有暂停 / 恢复 / 延期 / 提前结束按钮', await js(`(() => {
    const labels = [...document.querySelectorAll('.pd-btn')].map(x => x.textContent.trim())
    return !labels.some(x => /暂停|恢复|延期|提前结束/.test(x))
  })()`))
  check('保留原版字段（延后收费 / 收费归属日 / 平台名称 5 项）', await js(`(() => {
    const t = document.querySelector('.edit-popup').textContent
    return t.includes('延后收费') && t.includes('收费归属日') && t.includes('小红书') && t.includes('抖音') && t.includes('B站')
  })()`))
  await shot('04a-detail')

  // 编辑态：托管周期可直接修改（开始日 / 结束日 / 天数）
  check('编辑按钮可用', await clickBtn('编辑'))
  await sleep(400)
  check('编辑态可直接修改托管周期', await js(`(() => {
    const fields = [...document.querySelectorAll('.edit-popup .detail-field')]
    const hasInput = label => fields.some(f => {
      const dl = f.querySelector('.dl')
      return dl && dl.textContent.trim() === label && !!f.querySelector('input')
    })
    return hasInput('开始日') && hasInput('结束日') && hasInput('托管天数')
  })()`))
  await shot('04b-detail-edit-period')
  await clickBtn('取消编辑')
  await sleep(300)

  // 续费 = 在原项目上加天数 + 记一笔收费（不新建项目）
  check('续费按钮可用', await clickBtn('续费'))
  await sleep(400)
  check('续费区可填天数 / 金额 / 收费日期', await js(`(() => {
    const box = document.querySelector('.pd-renew')
    if (!box) return false
    const nums = box.querySelectorAll('input[type="number"]')
    const date = box.querySelector('input[type="date"]')
    return nums.length >= 2 && !!date && !!date.value
  })()`))
  await shot('04c-detail-renew')
  await clickBtn('取消续费')

  check('归档按钮存在（消耗全部天数并完成托管）', await js(`!![...document.querySelectorAll('.pd-btn')].find(x => x.textContent.trim() === '归档')`))
  check('关闭按钮存在', await js(`!![...document.querySelectorAll('.pd-btn')].find(x => x.textContent.trim() === '关闭')`))
  await js(`(() => { const b = [...document.querySelectorAll('.pd-btn')].find(x => x.textContent.trim() === '关闭'); if (b) b.click(); return !!b })()`)
  await sleep(600)
  check('详情可关闭', await js(`!document.querySelector('.modal-mask')`))

  // ── 侧边弹窗占页面一半宽度 ──
  check('详情入口可打开（量宽度）', await js(openDetail))
  await sleep(500)
  const popupSize = await js(`(() => {
    const p = document.querySelector('.modal-mask .edit-popup')
    if (!p) return null
    return { w: Math.round(p.getBoundingClientRect().width), win: window.innerWidth }
  })()`)
  console.log('    弹窗宽度：', JSON.stringify(popupSize))
  check('侧边弹窗宽度 = 页面一半', !!popupSize && Math.abs(popupSize.w - popupSize.win / 2) <= 2)
  await js(`(() => { const b = [...document.querySelectorAll('.pd-btn')].find(x => x.textContent.trim() === '关闭'); if (b) b.click(); return !!b })()`)
  await sleep(500)

  // ── 修改托管天数：结果必须正好等于填写值（含首尾：结束日 = 开始日 + 天数 − 1）──
  await clickText('.tl-entry-btn', '全部'); await sleep(400)
  // 列宽：备注要比「名称 + 账号」更宽
  const colW = await js(`(() => {
    const info = document.querySelector('.song-item .song-info')
    const note = document.querySelector('.song-item .col-note')
    if (!info || !note) return null
    return { info: Math.round(info.getBoundingClientRect().width), note: Math.round(note.getBoundingClientRect().width) }
  })()`)
  console.log('    列宽 名称/账号 vs 备注：', JSON.stringify(colW))
  check('代肝代办：备注列比名称/账号列更宽', !!colW && colW.note > colW.info)
  check('详情入口可打开（改天数前）', await js(openDetail))
  await sleep(500)
  await clickBtn('编辑')
  await sleep(300)
  const setDays = n => js(`(() => {
    const fields = [...document.querySelectorAll('.modal-mask .edit-popup .detail-field')]
    const f = fields.find(x => { const dl = x.querySelector('.dl'); return dl && dl.textContent.trim() === '托管天数' })
    const inp = f && f.querySelector('input[type="number"]')
    if (!inp) return false
    inp.value = String(${n})
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  check('编辑态可以改托管天数', await setDays(20))
  await sleep(200)
  await clickSave('.pd-btn', '保存')
  await sleep(700)
  // 保存后详情会 refreshDetail，直接读窗口里显示的值（编辑态是输入框，只读态是文本）
  const shownDays = await js(`(() => {
    const fields = [...document.querySelectorAll('.modal-mask .edit-popup .detail-field')]
    const get = label => {
      const f = fields.find(x => { const dl = x.querySelector('.dl'); return dl && dl.textContent.trim() === label })
      if (!f) return null
      const inp = f.querySelector('input')
      if (inp) return inp.value
      const dv = f.querySelector('.dv')
      return dv ? dv.textContent.trim() : null
    }
    return { start: get('开始日'), end: get('结束日'), days: get('托管天数'), progress: get('执行进度') }
  })()`)
  console.log('    详情显示：', JSON.stringify(shownDays))
  check('改 20 天后：详情里的托管天数 = 20（不少一天）', !!shownDays && /^20\s*天$/.test(String(shownDays.days)))
  const endOk = (() => {
    if (!shownDays || !shownDays.start || !shownDays.end) return false
    const s = new Date(shownDays.start + 'T00:00:00')
    const e = new Date(shownDays.end + 'T00:00:00')
    return Math.round((e - s) / 86400000) === 19
  })()
  check('改 20 天后：结束日 = 开始日 + 19 天（含首尾 20 天）', endOk)
  check('改 20 天后：计划次数同步为 20', !!shownDays && /\/\s*20\s*次/.test(String(shownDays.progress)))

  // ── 增加天数（20 → 45）──
  await clickBtn('编辑')
  await sleep(300)
  check('编辑态可以增加托管天数', await setDays(45))
  await sleep(200)
  await clickSave('.pd-btn', '保存')
  await sleep(700)
  const grown = await js(`(() => {
    const fields = [...document.querySelectorAll('.modal-mask .edit-popup .detail-field')]
    const get = label => {
      const f = fields.find(x => { const dl = x.querySelector('.dl'); return dl && dl.textContent.trim() === label })
      if (!f) return null
      const inp = f.querySelector('input')
      if (inp) return inp.value
      const dv = f.querySelector('.dv')
      return dv ? dv.textContent.trim() : null
    }
    return { start: get('开始日'), end: get('结束日'), days: get('托管天数'), progress: get('执行进度') }
  })()`)
  console.log('    增加后天数：', JSON.stringify(grown))
  check('改成 45 天后：详情里的托管天数 = 45', !!grown && /^45\s*天$/.test(String(grown.days)))
  const growEndOk = (() => {
    if (!grown || !grown.start || !grown.end) return false
    const s = new Date(grown.start + 'T00:00:00')
    const e = new Date(grown.end + 'T00:00:00')
    return Math.round((e - s) / 86400000) === 44
  })()
  check('改成 45 天后：结束日 = 开始日 + 44 天', growEndOk)
  await js(`(() => { const b = [...document.querySelectorAll('.pd-btn')].find(x => x.textContent.trim() === '关闭'); if (b) b.click(); return !!b })()`)
  await sleep(500)

  // ── 蓝图记录编辑：HEX 直填 / 不再有字号修改项 / 以已有蓝图为基准确认 ──
  await clickByTitle('蓝图记录')
  await sleep(700)
  const bpShown = await js(`document.querySelectorAll('.song-item').length`)
  const bpBefore = await js(`JSON.parse(localStorage.getItem('tr-blueprints') || '[]').length`)
  check('蓝图列表已渲染记录', bpShown > 0)
  // ── 蓝图分组：默认只展开第一个 ──
  const bpFold = await js(`(() => {
    const heads = [...document.querySelectorAll('.bp-group-head')]
    if (heads.length < 2) return { total: heads.length, collapsed: 0 }
    return {
      total: heads.length,
      collapsed: heads.filter(h => h.querySelector('.bp-collapsed-hint')).length,
    }
  })()`)
  console.log('    分组折叠：', JSON.stringify(bpFold))
  check('蓝图分组默认只展开第一个（其余收起）', bpFold.total < 2 || bpFold.collapsed === bpFold.total - 1)
  check('详情入口可打开', await js(`(() => { const b = document.querySelector('.song-btn[title="详细信息/编辑"]'); if (b) b.click(); return !!b })()`))
  await sleep(500)
  check('蓝图详情已打开', await js(`!!document.querySelector('.modal-mask .edit-popup')`))
  await js(`(() => { const b = [...document.querySelectorAll('.save-btn')].find(x => x.textContent.trim() === '编辑'); if (b) b.click(); return !!b })()`)
  await sleep(400)
  check('详情编辑态不再提供字号修改项', await js(`!document.querySelector('.bp-sizes') && !document.querySelector('.bp-size-btn') && !document.querySelector('.bp-size-inp')`))
  check('颜色支持直接输入 HEX', await js(`!!document.querySelector('.bp-hex')`))
  await shot('05b-blueprint-edit')

  // HEX 直填颜色（可省略 #）
  await js(`(() => { const i = document.querySelector('.bp-hex'); if (!i) return false; i.value = '00B0FF'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  await sleep(300)
  await clickSave('.save-btn', '保存')
  await sleep(600)
  check('HEX 被补全 # 后写入记录', await js(`(localStorage.getItem('tr-blueprints') || '').includes('#00B0FF')`))
  await shot('05c-blueprint-color')

  // 以此为基础新建：生成完全独立副本
  check('存在「以此为基础新建」入口', await clickSave('.cancel-btn', '以此为基础新建'))
  await sleep(600)
  check('副本已创建（记录数 +1）', await js(`JSON.parse(localStorage.getItem('tr-blueprints') || '[]').length === ${bpBefore + 1}`))
  check('副本与原记录内容一致但 id 不同', await js(`(() => {
    const list = JSON.parse(localStorage.getItem('tr-blueprints') || '[]')
    const byName = {}
    list.forEach(r => { const k = (r.name || '') + '|' + (r.code || ''); byName[k] = (byName[k] || 0) + 1 })
    const dup = Object.values(byName).some(n => n >= 2)
    const ids = new Set(list.map(r => r.id))
    return dup && ids.size === list.length
  })()`))
  check('副本继承颜色配置', await js(`(() => {
    const list = JSON.parse(localStorage.getItem('tr-blueprints') || '[]')
    return list.filter(r => r.color === '#00B0FF').length >= 2
  })()`))

  // 修改副本不得影响原蓝图
  await js(`(() => { const ins = [...document.querySelectorAll('.detail-grid .form-select')]; const name = ins[2]; if (!name) return false; name.value = '副本改名测试'; name.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
  await sleep(300)
  await clickSave('.save-btn', '保存')
  await sleep(600)
  check('改副本不影响原蓝图（原记录数量与名称保持）', await js(`(() => {
    const list = JSON.parse(localStorage.getItem('tr-blueprints') || '[]')
    const renamed = list.filter(r => r.name === '副本改名测试').length
    return renamed === 1 && list.length === ${bpBefore + 1}
  })()`))
  await shot('05d-blueprint-copy')

  check('导航中已无独立「游戏管理」入口', await js(`![...document.querySelectorAll('.rc-sub-func-btn')].some(b => (b.title||'') === '游戏管理')`))

  for (const [label, name] of [
    ['蓝图记录', '05-blueprints'], ['代肝记录', '06-diary'],
    ['新增记录', '07-add'], ['价格一览', '08-prices'], ['代肝日报', '09-report'],
    ['数据管理', '10-admin'], ['设置', '11-settings'],
  ]) {
    await clickByTitle(label)
    check(`${label} 页面已渲染`, await js(`!document.querySelector('.rc-player-content').textContent.includes('undefined')`))
    await shot(name)
  }

  // 数据管理 → 游戏与服务（原独立「游戏管理」页面已并入，且不使用图标）
  await clickByTitle('数据管理')
  await clickText('.tl-entry-btn', '游戏与服务')
  await sleep(700)
  check('数据管理含「游戏与服务」分类且已渲染', await js(`!!document.querySelector('.gm-root') && !!document.querySelector('.gm-col-list')`))
  check('游戏设置中没有图标字段', await js(`!document.querySelector('.gm-fields').textContent.includes('图标')`))
  check('游戏列表已显示目录内容', await js(`document.querySelectorAll('.gm-item').length > 0`))
  await shot('10b-games-merged')

  // 价格表：预设与调整面板
  await clickByTitle('价格一览')
  await clickText('.pv-chip', '调整'); await sleep(400); await shot('12-prices-panel')
  await clickText('.pv-chip', '航天档案式'); await sleep(800); await shot('13-prices-archive')
  await clickText('.pv-chip', '工业终端式'); await sleep(800); await shot('14-prices-terminal')

  // 每日返图：预设 + 画布外工作区（本轮新能力）
  await clickByTitle('代肝日报')
  await js(`(() => { const b = [...document.querySelectorAll('.rc-global-btn')].find(x => x.textContent.includes('排版')); if (b) b.click(); return !!b })()`)
  await sleep(400)
  // 起点确定：显式回到原版预设（seed 已清掉保存的布局，这里再兜一层）
  await clickText('.rp-chip', '原版')
  await sleep(500)
  await shot('15-report-panel')
  await clickText('.rp-chip', '信息目录式'); await sleep(800); await shot('16-report-index')
  await clickText('.rp-chip', '宣传展示式'); await sleep(800); await shot('17-report-promo')

  await clickText('.rp-chip', '原版'); await sleep(800)

  // 坐标定位（12 列网格）：坐标面板 / 改 X / 移出到未编排区
  await shot('18-report-coords')
  await js(`(() => {
    const rows = [...document.querySelectorAll('.rp-unplaced-row')]
    const row = rows.find(r => r.textContent.includes('日常'))
    if (!row) return false
    const inp = row.querySelectorAll('.rp-num')[2]
    inp.value = '4'; inp.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(500)
  await js(`(() => {
    const row = [...document.querySelectorAll('.rp-unplaced-row')].find(r => r.textContent.includes('日常'))
    if (!row) return false
    const inp = row.querySelectorAll('.rp-num')[2]
    inp.value = '12'; inp.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(400)
  await shot('19-report-conflict')

  check('渲染进程无错误日志', errors.length === 0, errors.slice(0, 5))
  if (failures.length) {
    console.log('\nUI SMOKE FAILED:')
    failures.forEach(f => console.log('  ✗ ' + f))
    console.log('shots -> ' + OUT)
    await sleep(200)
    app.exit(1)
    return
  }
  console.log('\nUI SMOKE PASSED (shots -> ' + OUT + ')')
  await sleep(200)
  app.exit(0)
}

app.whenReady()
  .then(main)
  .catch(e => {
    console.log('FATAL ' + (e && e.stack || e))
    app.exit(2)
  })

// ═══════════════════════════════════════════════════════════════════
// IPC 端到端冒烟：验证「渲染层 → preload → IPC → userData/data/*.json」
//
// 与 tools/ui-smoke.cjs 的区别：
//   · ui-smoke 自己开窗口、**不加载** electron/main.js（因此 IPC 全是噪音）；
//   · 本脚本加载**真正的** main.js（它注册六组 IPC 与窗口），只断言落盘链路。
//
//   npm run ipc:smoke
//
// 说明：
//   · 使用独立 userData（<tmp>/tr-ipc-smoke-*），绝不碰真实数据；
//   · 通过环境变量让 main.js 加载 dist、不显示窗口、跳过单实例锁；
//   · 失败退出码非 0，可直接作为回归门禁。
// ═══════════════════════════════════════════════════════════════════
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const ROOT = path.join(__dirname, '..')
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-ipc-smoke-'))
const DATA_DIR = path.join(USER_DATA, 'data')

// 必须在 require main.js 之前设好（它会在加载时读取 userData 与环境）
app.setPath('userData', USER_DATA)
process.env.TR_LOAD_DIST = '1'
process.env.TR_HEADLESS = '1'
process.env.TR_ALLOW_MULTI = '1'

require(path.join(ROOT, 'electron/main.js'))

const sleep = ms => new Promise(r => setTimeout(r, ms))
const failures = []
function check(name, ok, extra) {
  if (ok) {
    console.log('  ✓ ' + name)
  } else {
    failures.push(name + (extra === undefined ? '' : ' — ' + JSON.stringify(extra)))
    console.log('  ✗ ' + name + (extra === undefined ? '' : ' — ' + JSON.stringify(extra)))
  }
}

function readJson(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'))
  } catch {
    return null
  }
}

async function waitForReadyWindow(timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const w = BrowserWindow.getAllWindows()[0]
    if (w && !w.webContents.isLoading()) return w
    await sleep(200)
  }
  return null
}

app.whenReady().then(async () => {
  const win = await waitForReadyWindow()
  if (!win) {
    console.log('IPC SMOKE FAILED: 窗口未就绪')
    app.exit(1)
    return
  }
  const js = code => win.webContents.executeJavaScript(code)
  await sleep(1500)   // 等 Vue 挂载完成（preload 已暴露 window.electron）

  // ── 1. 数组型通道：项目 / 执行记录 / 蓝图 / 工作日记 ──
  const arrays = [
    ['saveRecords', 'boosting-records.json', [{ id: 'p-ipc', account: '13800138000', game: '终末地', service: '普托', status: 1, schemaVersion: 3 }]],
    ['saveCompletions', 'completions.json', [{ id: 'c-ipc', projectId: 'p-ipc', result: 'done' }]],
    ['saveBlueprints', 'blueprints.json', [{ id: 'bp-ipc', code: 'EF-1' }]],
    ['saveWorkDiary', 'workdiary.json', [{ id: 'w-ipc' }]],
  ]
  for (const [channel, file, payload] of arrays) {
    await js(`window.electron.${channel}(${JSON.stringify(payload)})`)
    await sleep(350)
    const onDisk = readJson(file)
    check(`${channel} 落到 ${file}`, Array.isArray(onDisk) && onDisk[0] && onDisk[0].id === payload[0].id, onDisk)
  }

  // ── 2. 对象型通道：价格表 / 游戏目录 ──
  const objects = [
    ['savePrices', 'prices.json', { endfield: { categories: [] }, __version: 2 }],
    ['saveGames', 'games.json', [{ id: 'g-ipc', name: 'IPC 测试游戏' }]],
  ]
  for (const [channel, file, payload] of objects) {
    await js(`window.electron.${channel}(${JSON.stringify(payload)})`)
    await sleep(350)
    const onDisk = readJson(file)
    check(`${channel} 落到 ${file}`, onDisk !== null && JSON.stringify(onDisk).includes(channel === 'savePrices' ? '__version' : 'g-ipc'), onDisk)
  }

  // ── 3. 读回：清掉 localStorage 后 load* 仍能从磁盘取到 ──
  await js('localStorage.clear()')
  const loaded = await js('window.electron.loadRecords()')
  check('loadRecords 从磁盘读回项目', Array.isArray(loaded) && loaded[0] && loaded[0].id === 'p-ipc', loaded)
  const loadedGames = await js('window.electron.loadGames()')
  check('loadGames 从磁盘读回游戏目录', Array.isArray(loadedGames) && loadedGames[0] && loadedGames[0].id === 'g-ipc', loadedGames)

  // ── 4. 写盘是原子的：不应留下 .tmp 文件 ──
  await sleep(300)
  let leftovers = []
  try { leftovers = fs.readdirSync(DATA_DIR).filter(f => f.includes('.tmp')) } catch { /* 目录不存在由下一条断言兜住 */ }
  check('数据目录存在', fs.existsSync(DATA_DIR))
  check('没有临时文件残留', leftovers.length === 0, leftovers)

  // ── 5. 空数据也能正常覆盖（清空后文件是空数组，不是旧内容） ──
  await js('window.electron.saveRecords([])')
  await sleep(350)
  const cleared = readJson('boosting-records.json')
  check('saveRecords([]) 覆盖为空数组', Array.isArray(cleared) && cleared.length === 0, cleared)

  console.log('')
  if (failures.length) {
    console.log('IPC SMOKE FAILED:')
    failures.forEach(f => console.log('  ✗ ' + f))
    console.log('data dir: ' + DATA_DIR)
    app.exit(1)
  } else {
    console.log('IPC SMOKE PASSED (data dir: ' + DATA_DIR + ')')
    app.exit(0)
  }
}).catch(e => {
  console.log('IPC SMOKE FAILED: ' + (e && e.message))
  app.exit(1)
})

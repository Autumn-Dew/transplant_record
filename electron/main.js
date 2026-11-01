const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs/promises')
const fsSync = require('fs')
const { createJsonPersistence } = require('./persistence.cjs')

const DATA_DIR = path.join(app.getPath('userData'), 'data')
const RECORDS_FILE = path.join(DATA_DIR, 'boosting-records.json')
const BLUEPRINTS_FILE = path.join(DATA_DIR, 'blueprints.json')
const WORKDIARY_FILE = path.join(DATA_DIR, 'workdiary.json')
const PRICES_FILE = path.join(DATA_DIR, 'prices.json')
const COMPLETIONS_FILE = path.join(DATA_DIR, 'completions.json')
const GAMES_FILE = path.join(DATA_DIR, 'games.json')

// 单实例锁（测试脚本用 TR_ALLOW_MULTI=1 跳过，避免与正在运行的应用抢锁）
const gotTheLock = process.env.TR_ALLOW_MULTI === '1' ? true : app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })
}

let win = null
let tray = null

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

const jsonPersistence = createJsonPersistence({ fs, ensureDir: ensureDataDir })

function createWindow() {
  const iconPath = fsSync.existsSync(path.join(__dirname, '..', 'public', 'icon.png'))
    ? path.join(__dirname, '..', 'public', 'icon.png')
    : undefined

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
    frame: false,
    ...(iconPath ? { icon: iconPath } : {}),
    roundedCorners: false,
    show: false,
    backgroundColor: '#121212',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // TR_HEADLESS=1 时不显示窗口（tools/ipc-smoke.cjs 用）
  win.once('ready-to-show', () => { if (process.env.TR_HEADLESS !== '1') win.show() })

  // TR_LOAD_DIST=1 时总是加载打包产物（测试环境没有 vite dev server）
  if (app.isPackaged || process.env.TR_LOAD_DIST === '1') {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  } else {
    win.loadURL('http://localhost:5173')
  }

  win.removeMenu()

  // 关闭 → 隐藏到托盘
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  win.on('maximize', () => win.webContents.send('window-maximized', true))
  win.on('unmaximize', () => win.webContents.send('window-maximized', false))

  createTray()
}

function createTray() {
  const { nativeImage } = require('electron')
  
  // 尝试加载用户图标（统一用 png）
  const iconPaths = [
    path.join(__dirname, '..', 'public', 'icon.png'),
    path.join(__dirname, 'icon.png'),
  ]
  
  let trayIcon = null
  for (const p of iconPaths) {
    if (fsSync.existsSync(p)) {
      trayIcon = nativeImage.createFromPath(p)
      break
    }
  }
  
  if (!trayIcon) {
    const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFklEQVQ4y2P4z8BQz0BKYBw1YNSAUQMIAP3jA/0K3J3vAAAAAElFTkSuQmCC'
    trayIcon = nativeImage.createFromDataURL('data:image/png;base64,' + iconBase64)
  }
  
  tray = new Tray(trayIcon)

  tray.setToolTip('代肝记录 · 客户管理')

  tray.on('click', () => {
    win.isVisible() ? win.hide() : win.show()
  })

  const menu = Menu.buildFromTemplate([
    { label: '代肝记录 · 客户管理', enabled: false },
    { type: 'separator' },
    { label: '打开主界面', click: () => { if (win.isMinimized()) win.restore(); win.show(); win.focus() } },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; tray.destroy(); win.destroy(); app.quit() } },
  ])

  tray.setContextMenu(menu)
}

// ============================================================
// 窗口 IPC
// ============================================================
ipcMain.on('window-minimize', () => win?.minimize())
ipcMain.on('window-hide', () => win?.hide())

// 切换窗口显示 / 隐藏（供全局快捷键与托盘使用）
function toggleWindow() {
  if (!win) return
  if (win.isVisible()) {
    win.hide()
  } else {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
}

ipcMain.on('window-maximize', () => {
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})

ipcMain.on('app-quit', () => {
  app.isQuitting = true
  tray?.destroy()
  win?.destroy()
  app.quit()
})

// ============================================================
// 开机自启
// ============================================================
ipcMain.handle('get-auto-launch', () => {
  return app.getLoginItemSettings().openAtLogin
})

ipcMain.handle('set-auto-launch', (_e, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled })
  return true
})

// ============================================================
// 数据持久化
// ============================================================
async function loadJsonFile(filePath, fallback) {
  const result = await jsonPersistence.load(filePath, fallback)
  return result.data
}

async function saveJsonFile(filePath, data) {
  return await jsonPersistence.save(filePath, data)
}

ipcMain.handle('load-records', async () => {
  return await loadJsonFile(RECORDS_FILE, [])
})

ipcMain.handle('save-records', async (_e, records) => {
  return await saveJsonFile(RECORDS_FILE, records)
})

ipcMain.handle('load-blueprints', async () => {
  return await loadJsonFile(BLUEPRINTS_FILE, [])
})

ipcMain.handle('save-blueprints', async (_e, records) => {
  return await saveJsonFile(BLUEPRINTS_FILE, records)
})

ipcMain.handle('load-workdiary', async () => {
  return await loadJsonFile(WORKDIARY_FILE, [])
})

ipcMain.handle('save-workdiary', async (_e, records) => {
  return await saveJsonFile(WORKDIARY_FILE, records)
})

ipcMain.handle('load-prices', async () => {
  return await loadJsonFile(PRICES_FILE, null)
})

ipcMain.handle('save-prices', async (_e, data) => {
  return await saveJsonFile(PRICES_FILE, data)
})

// 执行记录（历史事实，独立落盘）
ipcMain.handle('load-completions', async () => {
  return await loadJsonFile(COMPLETIONS_FILE, [])
})

ipcMain.handle('save-completions', async (_e, records) => {
  return await saveJsonFile(COMPLETIONS_FILE, records)
})

// 游戏与服务项目目录
ipcMain.handle('load-games', async () => {
  return await loadJsonFile(GAMES_FILE, null)
})

ipcMain.handle('save-games', async (_e, data) => {
  return await saveJsonFile(GAMES_FILE, data)
})

// ============================================================
// 应用启动
// ============================================================
// 全局快捷键：显示 / 隐藏窗口（Alt+P）
// 保留候选数组以便个别环境下备用写法
const TOGGLE_SHORTCUTS = ['Alt+P']
let registeredShortcut = ''
function registerShortcuts() {
  for (const acc of TOGGLE_SHORTCUTS) {
    try {
      if (globalShortcut.register(acc, toggleWindow)) { registeredShortcut = acc; return }
    } catch { /* 尝试下一个写法 */ }
  }
  console.warn('[boosting] 快捷键注册失败（可能已被占用）')
}

app.whenReady().then(() => {
  createWindow()
  registerShortcuts()
})

app.on('will-quit', () => { globalShortcut.unregisterAll() })

app.on('window-all-closed', () => {})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

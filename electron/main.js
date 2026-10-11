const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs/promises')
const fsSync = require('fs')

const DATA_DIR = path.join(app.getPath('userData'), 'data')
const RECORDS_FILE = path.join(DATA_DIR, 'boosting-records.json')
const BLUEPRINTS_FILE = path.join(DATA_DIR, 'blueprints.json')
const WORKDIARY_FILE = path.join(DATA_DIR, 'workdiary.json')
const PRICES_FILE = path.join(DATA_DIR, 'prices.json')

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock()
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
  try { await fs.mkdir(DATA_DIR, { recursive: true }) } catch {}
}

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

  win.once('ready-to-show', () => { win.show() })

  if (app.isPackaged) {
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
  await ensureDataDir()
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function saveJsonFile(filePath, data) {
  await ensureDataDir()
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
  } catch (e) {
    console.error('[boosting] 保存数据失败:', filePath, e.message)
  }
}

ipcMain.handle('load-records', async () => {
  return await loadJsonFile(RECORDS_FILE, [])
})

ipcMain.handle('save-records', async (_e, records) => {
  await saveJsonFile(RECORDS_FILE, records)
  return true
})

ipcMain.handle('load-blueprints', async () => {
  return await loadJsonFile(BLUEPRINTS_FILE, [])
})

ipcMain.handle('save-blueprints', async (_e, records) => {
  await saveJsonFile(BLUEPRINTS_FILE, records)
  return true
})

ipcMain.handle('load-workdiary', async () => {
  return await loadJsonFile(WORKDIARY_FILE, [])
})

ipcMain.handle('save-workdiary', async (_e, records) => {
  await saveJsonFile(WORKDIARY_FILE, records)
  return true
})

ipcMain.handle('load-prices', async () => {
  return await loadJsonFile(PRICES_FILE, null)
})

ipcMain.handle('save-prices', async (_e, data) => {
  await saveJsonFile(PRICES_FILE, data)
  return true
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

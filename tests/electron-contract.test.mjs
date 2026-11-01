// ═══════════════════════════════════════════════════════════════════
// Electron 主进程 / preload / 渲染层之间的静态契约
//
// 这三层没有任何运行时测试（ui-smoke 也不加载主进程），改名或漏注册
// 只会在真机上手点才发现。这里用源码契约把它们钉在一起：
//   1. main.js 注册的每个 load-* / save-* 通道都有 handler
//   2. preload 为每个通道都暴露了对应 API，且不泄漏 ipcRenderer
//   3. 渲染层（repos / usePrices / backupService）引用的 API 名都真实存在
//   4. 落盘走 persistence.cjs 的原子写 + 串行队列
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const main = read('electron/main.js')
const preload = read('electron/preload.js')
const persistence = read('electron/persistence.cjs')
const repos = read('src/data/repos.js')
const prices = read('src/composables/usePrices.js')
const backup = read('src/services/backupService.js')

const channels = [...main.matchAll(/ipcMain\.(?:handle|on)\('([^']+)'/g)].map(m => m[1])

// 渲染层用 invoke 的通道（load-* / save-* / get-set-auto-launch）
const invokeChannels = channels.filter(c => /^(load-|save-|get-|set-)/.test(c))
// 渲染层只用 send 的通道
const sendChannels = channels.filter(c => /^window-|^app-quit$/.test(c))

test('主进程注册了六个数据文件的 load/save 通道', () => {
  for (const name of ['records', 'blueprints', 'workdiary', 'prices', 'completions', 'games']) {
    assert.ok(channels.includes(`load-${name}`), `缺少 load-${name}`)
    assert.ok(channels.includes(`save-${name}`), `缺少 save-${name}`)
  }
})

test('preload 为每个 invoke 通道都暴露了 API', () => {
  assert.ok(invokeChannels.length >= 12, '至少有 6 组 load/save')
  for (const ch of invokeChannels) {
    assert.match(
      preload,
      new RegExp(`invoke\\(\\s*['"]${ch}['"]`),
      `preload 没有暴露 invoke('${ch}')`,
    )
  }
})

test('窗口控制与退出走 send，且 preload 有对应封装', () => {
  for (const ch of sendChannels) {
    assert.match(preload, new RegExp(`send\\(\\s*['"]${ch}['"]`), `preload 没有 send('${ch}')`)
  }
  assert.ok(sendChannels.includes('window-minimize'))
  assert.ok(sendChannels.includes('app-quit'))
})

test('preload 不泄漏 ipcRenderer / Node API', () => {
  assert.match(preload, /contextBridge\.exposeInMainWorld\(\s*['"]electron['"]/, '只暴露 electron 命名空间')
  assert.equal(/exposeInMainWorld\([^)]*ipcRenderer\b/.test(preload), false, '不得把 ipcRenderer 整体暴露')
  assert.equal(/exposeInMainWorld\([^)]*require\b/.test(preload), false, '不得暴露 require')
  assert.equal(/nodeIntegration:\s*true/.test(main), false, '不得开启 nodeIntegration')
  assert.match(main, /contextIsolation:\s*true/, '必须开启 contextIsolation')
})

test('渲染层引用的通道名都真实存在', () => {
  const exposed = [...preload.matchAll(/^\s*(load|save|get|set)[A-Z]\w*:/gm)].map(m => m[0].replace(':', '').trim())
  assert.ok(exposed.length >= 12, `preload 暴露的 API 数量异常：${exposed.length}`)

  // repos 的 ipcLoad / ipcSave
  const declared = [...repos.matchAll(/ipc(?:Load|Save):\s*'(\w+)'/g)].map(m => m[1])
  assert.ok(declared.length >= 8, 'repos 应声明四个仓库的读写通道')
  for (const name of declared) {
    assert.ok(exposed.includes(name), `repos 用了不存在的通道：${name}`)
  }

  // 价格表（不走 repo，自己同步双通道）
  assert.match(prices, /loadPrices\?\./, '价格表读取走 loadPrices')
  assert.match(prices, /savePrices\?\./, '价格表写入走 savePrices')
  assert.ok(exposed.includes('loadPrices') && exposed.includes('savePrices'))

  // 备份服务的文件通道
  const backupChannels = [...backup.matchAll(/channel:\s*'(\w+)'/g)].map(m => m[1])
  assert.ok(backupChannels.length >= 6, '备份应覆盖六个数据文件')
  for (const name of backupChannels) {
    assert.ok(exposed.includes(name), `backupService 用了不存在的通道：${name}`)
  }
})

test('落盘是原子写：临时文件 + rename，且同文件写入串行', () => {
  assert.match(persistence, /\.tmp/, '先写临时文件')
  assert.match(persistence, /rename/, '再 rename 覆盖')
  assert.match(persistence, /queue|Map\(/, '每个文件一个写入队列')
  assert.match(main, /persistence\.cjs|createJsonPersistence/, '主进程使用该持久化实现')
})

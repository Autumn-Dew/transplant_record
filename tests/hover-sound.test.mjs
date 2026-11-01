// 界面音效：悬停音（掠过可交互元素响一次）+ 总开关
// 音频文件来自 rhizome 的 public（ui_cursor_29.wav），复制进本项目 public 后由 BASE_URL 取用。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(path.join(ROOT, p), 'utf8')

function withStorage(init = {}) {
  const store = new Map(Object.entries(init))
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: k => { store.delete(k) },
    clear: () => store.clear(),
    key: i => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
  return store
}

withStorage()
const sound = await import('../src/utils/sound.js')

test('悬停音效文件在 public 里，走 BASE_URL 相对路径', () => {
  const file = path.join(ROOT, 'public', 'ui_cursor_29.wav')
  assert.ok(statSync(file).size > 1024, 'ui_cursor_29.wav 已复制进 public')
  assert.equal(sound.HOVER_SFX, 'ui_cursor_29.wav')
  const src = read('src/utils/sound.js')
  assert.match(src, /new Audio\(BASE \+ HOVER_SFX\)/, '用 BASE_URL 拼接，dev / 打包都能取到')
})

test('悬停音效只在真鼠标环境启用，并且同一元素不重复', () => {
  const src = read('src/utils/sound.js')
  assert.match(src, /\(hover: hover\) and \(pointer: fine\)/, '触摸屏不出声')
  assert.match(src, /if \(el === hoverLast\) return/, '元素内部移动不重复触发')
  assert.match(src, /addEventListener\('mouseover'/, '用事件委托，不需要给每个元素挂监听')
  assert.match(src, /aria-disabled/, '禁用元素不出声')
  assert.match(src, /playHover\(\)/, '进入新元素时播放')
})

test('可交互元素选择器覆盖主要控件', () => {
  const sel = sound.HOVER_SELECTOR
  for (const part of ['button', '[role="button"]', 'a[href]', '.rc-global-btn', '.tl-entry-btn', '.folder-chip', '.song-item', '.sb-option', '.page-tab', '.theme-preview-option']) {
    assert.ok(sel.includes(part), `选择器包含 ${part}`)
  }
})

test('音效总开关可关可开并持久化', () => {
  const store = withStorage()
  assert.equal(sound.isSoundEnabled(), true, '默认开启')
  assert.equal(sound.setSoundEnabled(false), false)
  assert.equal(sound.isSoundEnabled(), false)
  assert.equal(store.get('tr-sound-enabled'), 'false')
  assert.equal(sound.setSoundEnabled(true), true)
  assert.equal(store.get('tr-sound-enabled'), 'true')
  // 存储里是 'false' 时初始即为关闭
  withStorage({ 'tr-sound-enabled': 'false' })
  assert.equal(read('src/utils/sound.js').includes("!== 'false'"), true, '读档时把 \"false\" 视为静音')
})

test('App 启动挂上悬停音效，设置页可关', () => {
  assert.match(read('src/App.vue'), /initHoverSound\(\)/, 'App.vue 启动时初始化')
  const page = read('src/views/SettingsPage.vue')
  assert.match(page, /<span class="setting-label">界面音效<\/span>/)
  assert.match(page, /setSoundEnabled\(!soundOn\.value\)/, '开关直接改总开关')
  assert.match(read('src/data/storage.js'), /SOUND_ENABLED: 'tr-sound-enabled'/, '独立存储键')
})

test('点击 / 递增音效仍受同一个开关控制', () => {
  const src = read('src/utils/sound.js')
  assert.match(src, /export function playClick\(\) \{ playSfx\(SINGLE_SFX\) \}/)
  assert.match(src, /export function playOvercharge\(step\)/)
  assert.match(src, /if \(!enabled \|\| !name \|\| !HAS_AUDIO\) return/, 'playSfx 先看开关')
})

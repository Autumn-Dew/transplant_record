/**
 * 每日汇报 · 自定义皮肤（导入的 JSON 皮肤包）
 *
 * 皮肤包 = 一套主题 + 一套背景，各自带一段 CSS。导入后：
 *   · 存进 localStorage['tr-report-skins']（数组，可多条）
 *   · CSS 在 ReportSheet 挂载时注入 <style>，卸载时移除
 *   · 外观面板里和内置的 33 套主题 / 33 套背景并列显示，可单独删除
 *
 * ── 皮肤包格式 ──
 * {
 *   "type": "transplant-report-skin",
 *   "version": 1,
 *   "name": "夜航",
 *   "theme": {
 *     "label": "夜航主题",
 *     "tone": "dark",
 *     "css": ".rp-theme-skin-xxx { ... }"
 *   },
 *   "background": {
 *     "label": "夜航背景",
 *     "tone": "dark",
 *     "css": ".rp-bg-skin-xxx { ... }"
 *   }
 * }
 *
 * 每个皮肤会分到一个稳定 id（导入时生成，存进 localStorage），
 * 主题类名固定为 rp-theme-skin-<id>，背景类名 rp-bg-skin-<id>，
 * 皮肤包里的 css 可以只写这两个类内部的选择器，不需要自己拼类名。
 */

import { readJSON, writeJSON } from './storage.js'

const SKIN_KEY = 'tr-report-skins'
const MAX_SKINS = 40

export function skinThemeClass(id) { return 'rp-theme-skin-' + id }
export function skinBgClass(id) { return 'rp-bg-skin-' + id }

function str(v, max = 400) {
  return v == null ? '' : String(v).slice(0, max)
}

/** 读全部皮肤（损坏数据一律当空数组） */
export function readSkins() {
  const raw = readJSON(SKIN_KEY, null)
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.list) ? raw.list : [])
  const out = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const id = str(item.id, 60)
    if (!id) continue
    out.push({
      id,
      name: str(item.name, 60) || '未命名皮肤',
      theme: item.theme && typeof item.theme === 'object' ? {
        label: str(item.theme.label, 40) || '自定义主题',
        tone: item.theme.tone === 'dark' ? 'dark' : 'light',
        css: str(item.theme.css, 40000),
      } : null,
      background: item.background && typeof item.background === 'object' ? {
        label: str(item.background.label, 40) || '自定义背景',
        tone: item.background.tone === 'dark' ? 'dark' : 'light',
        css: str(item.background.css, 40000),
      } : null,
    })
  }
  return out.slice(0, MAX_SKINS)
}

export function writeSkins(list) {
  const arr = (Array.isArray(list) ? list : []).slice(0, MAX_SKINS)
  writeJSON(SKIN_KEY, arr)
  return arr
}

/**
 * 校验 + 规范化导入的皮肤包。
 * 返回 { ok, skin, error }：ok 为 false 时 error 说明原因。
 */
export function parseSkinPackage(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '不是 JSON 对象' }
  if (raw.type && raw.type !== 'transplant-report-skin') {
    return { ok: false, error: '不是日报皮肤包（type 应为 transplant-report-skin）' }
  }
  const name = str(raw.name, 60) || '导入的皮肤'
  const theme = raw.theme && typeof raw.theme === 'object' ? raw.theme : null
  const background = raw.background && typeof raw.background === 'object' ? raw.background : null
  if (!theme && !background) return { ok: false, error: '皮肤包至少要包含 theme 或 background' }
  const cssOf = (obj) => str(obj && obj.css, 40000)
  if (theme && !cssOf(theme)) return { ok: false, error: 'theme.css 为空' }
  if (background && !cssOf(background)) return { ok: false, error: 'background.css 为空' }

  const id = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return {
    ok: true,
    skin: {
      id,
      name,
      theme: theme ? {
        label: str(theme.label, 40) || name,
        tone: theme.tone === 'dark' ? 'dark' : 'light',
        css: cssOf(theme),
      } : null,
      background: background ? {
        label: str(background.label, 40) || name,
        tone: background.tone === 'dark' ? 'dark' : 'light',
        css: cssOf(background),
      } : null,
    },
  }
}

/**
 * 把皮肤里的 CSS 关进固定的类名作用域。
 *
 * 皮肤作者写的 CSS 有两种可能：
 *   1. 直接写属性（color: red; background: ...）→ 包进 .rp-theme-skin-<id> { ... }
 *   2. 自带选择器（.rp-card-head { ... }、:scope { --rt-ink: ... }）→ 逐条加前缀
 *
 * 为什么不用 @scope：@scope 内规则的优先级等价于 :where()，比内置主题的
 * `.rp-theme-x .rp-card` 还低，导入的皮肤会被默认样式盖掉，看着像没生效。
 * 这里改成手写前缀，优先级与内置主题持平，靠后插入取胜。
 */
export function scopeSkinCss(css, scopeClass) {
  const text = String(css || '').trim()
  if (!text) return ''
  // 双类提升特异性：内置变量定义在 `.rp-wrap` 上（单类 0,1,0），
  // 皮肤必须压过它才生效，而 `.x.x` 是 0,2,0，比内置主题的 `.rp-theme-y .z` 也高一级。
  // 用重复类名而不是 !important —— 皮肤作者不需要关心优先级。
  const prefix = '.' + scopeClass + '.' + scopeClass
  // 只有属性、没有选择器：直接包一层
  if (text.indexOf('{') < 0) return prefix + ' { ' + text + ' }'
  return prefixRules(text, prefix)
}

/**
 * 扫描顶层规则逐条加前缀。手写而不是正则：正则处理不了嵌套与注释。
 * @media / @supports / @layer / @container 递归进去处理；
 * @keyframes / @font-face / @property 原样保留（它们内部不是选择器）。
 */
function prefixRules(css, prefix) {
  let out = ''
  let i = 0
  const n = css.length
  while (i < n) {
    // 跳过空白
    while (i < n && /\s/.test(css[i])) { out += css[i]; i++ }
    if (i >= n) break
    // 注释原样保留
    if (css[i] === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2)
      const stop = close < 0 ? n : close + 2
      out += css.slice(i, stop)
      i = stop
      continue
    }
    // 读选择器直到 {
    const open = css.indexOf('{', i)
    if (open < 0) { out += css.slice(i); break }
    const selector = css.slice(i, open).trim()
    // 找匹配的 }（考虑嵌套）
    let depth = 0
    let close = open
    for (; close < n; close++) {
      if (css[close] === '{') depth++
      else if (css[close] === '}') { depth--; if (depth === 0) break }
    }
    if (close >= n) { out += css.slice(i); break }
    const body = css.slice(open + 1, close)

    if (/^@(media|supports|layer|container)\b/i.test(selector)) {
      out += selector + ' {' + prefixRules(body, prefix) + '}'
    } else if (/^@/.test(selector)) {
      // @keyframes / @font-face / @property：内部不是选择器，原样保留
      out += selector + '{' + body + '}'
    } else {
      const scoped = selector.split(',').map(one => {
        const t = one.trim()
        if (!t) return t
        if (t === ':scope' || t === '&') return prefix
        if (t.startsWith(':scope')) return prefix + t.slice(6)
        if (t.startsWith('&')) return prefix + t.slice(1)
        return prefix + ' ' + t
      }).join(', ')
      out += scoped + '{' + body + '}'
    }
    i = close + 1
  }
  return out
}

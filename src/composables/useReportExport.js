// ═══════════════════════════════════════════════════════════════════
// 每日汇报的导出流程（从 ReportSheet.vue 抽出的纯逻辑）
//
// 三态：
//   ① 编辑态 —— 真实控件与 contenteditable；
//   ② 导出前变换 —— 空字段填占位、隐藏空卡片与 `.rp-no-export`、原生控件换成带计算样式的 span；
//   ③ 还原 —— `finally` 里执行 undo 闭包，把 DOM 恢复原状。
//
// 调用方只需提供「画布引用 + 资源行 + 日常是否全未完成」这三样状态，
// 组件本身不再关心 html2canvas / 下载 / 剪贴板。
// ═══════════════════════════════════════════════════════════════════

import { ref } from 'vue'
import html2canvas from 'html2canvas'
import { copyPngBlob, downloadBlob, timestampName } from '../utils/clipboard.js'

// 输入框替换成 span 时的宽度补偿（按原控件的 class 给）
const FIELD_WIDTHS = [
  ['rp-num', 'width:52px;text-align:center;'],
  ['rp-res-inp', 'width:100px;'],
  ['rp-extra', 'width:70px;'],
  ['rp-date-sm', 'width:115px;'],
  ['rp-label-inp', 'width:90px;'],
]

// 导出时原生控件会被替换成 span —— html2canvas 不会按浏览器的方式绘制控件文字。
// ⚠ 替代元素必须沿用原控件的**计算样式**（文字色 / 底色 / 边框色 / 字体）。
//   写死「白底 + 继承父级颜色」会让深色信息栏主题里的输入框（浅底深字）导出后
//   变成白底 + 浅色文字，托管天数 / 日期几乎与底色同色，图里读不出来。
function fieldStyle(el, extra) {
  const cs = getComputedStyle(el)
  const bg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
    ? cs.backgroundColor
    : 'transparent'
  return [
    'display:inline-block',
    'vertical-align:middle',
    `font-family:${cs.fontFamily}`,
    `font-size:${cs.fontSize}`,
    `font-weight:${cs.fontWeight}`,
    `font-style:${cs.fontStyle}`,
    'line-height:1.4',
    `color:${cs.color}`,
    `background:${bg}`,
    `border:1px solid ${cs.borderTopColor}`,
    'padding:2px 6px',
  ].join(';') + ';' + extra
}

/**
 * @param {object} opts
 * @param {import('vue').Ref<HTMLElement|null>} opts.wrapRef   画布根节点
 * @param {import('vue').Ref<HTMLElement|null>} opts.noteRef   备注（contenteditable）
 * @param {import('vue').Ref<HTMLElement|null>} opts.planRef   明日计划（contenteditable）
 * @param {Array} opts.resources                               今日获取资源行（会被临时填充 / 还原）
 * @param {import('vue').ComputedRef<boolean>} opts.dailyAllUndone  日常是否全部未完成
 * @param {() => string} opts.backgroundBase                   导出兜底底色
 * @param {() => void} [opts.onExported]                       导出成功后（用于保存资源记录）
 */
export function useReportExport({ wrapRef, noteRef, planRef, resources, dailyAllUndone, backgroundBase, onExported }) {
  // 导出/复制的进行中状态（'' | 'export' | 'copy'）与失败原因，供按钮显示反馈
  const busy = ref('')
  const lastError = ref('')

  function fillEmpty() {
    for (const r of resources) {
      if (!r.label) r.label = '—'
      if (!r.before) r.before = '无'
      if (!r.after) r.after = '无'
    }
  }

  function restoreEmpty() {
    for (const r of resources) {
      if (r.label === '—') r.label = ''
      if (r.before === '无') r.before = ''
      if (r.after === '无') r.after = ''
    }
    const planEl = planRef.value
    if (planEl && planEl.textContent.trim() === '无') planEl.innerHTML = '<div></div>'
  }

  /** 就地变换 DOM，返回「还原」闭包（调用方必须放在 finally 里执行） */
  function prepareExport() {
    fillEmpty()
    const swaps = []
    const hide = (el) => {
      if (!el) return
      el.style.display = 'none'
      swaps.push({ parent: el.parentNode, old: el, current: el, wasHidden: true })
    }

    // 「日常」全部未完成/无 → 导出时不显示「周常」卡片与「托管」信息
    if (dailyAllUndone.value) {
      for (const h of wrapRef.value.querySelectorAll('.rp-card-head')) {
        const txt = h.textContent.replace(/\s+/g, '')
        if (txt.startsWith('日常') || txt.startsWith('周常')) hide(h.closest('.rp-card'))
      }
      hide(wrapRef.value.querySelector('.rp-meta'))
    }

    const hiddens = wrapRef.value.querySelectorAll('.rp-no-export')
    hiddens.forEach(el => { el.style.display = 'none' })

    if (noteRef.value && !noteRef.value.textContent.trim()) hide(noteRef.value.closest('.rp-card'))
    if (planRef.value && !planRef.value.textContent.trim()) hide(planRef.value.closest('.rp-card'))
    // 「今日获取资源」一项都不剩时，整块（连标题）不导出
    if (!resources.length) hide(wrapRef.value.querySelector('.rp-res-card'))

    wrapRef.value.querySelectorAll('select').forEach(sel => {
      const span = document.createElement('span')
      span.textContent = sel.options[sel.selectedIndex]?.text || ''
      span.style.cssText = fieldStyle(sel, '')
      sel.parentNode.replaceChild(span, sel)
      swaps.push({ parent: span.parentNode, old: sel, current: span })
    })
    wrapRef.value.querySelectorAll('input:not([type="radio"]):not([type="checkbox"])').forEach(inp => {
      if (!inp.value) { hide(inp); return }
      const span = document.createElement('span')
      span.textContent = inp.value
      let extra = 'min-width:40px;'
      for (const [cls, width] of FIELD_WIDTHS) {
        if (inp.classList.contains(cls)) extra += width
      }
      span.style.cssText = fieldStyle(inp, extra)
      inp.parentNode.replaceChild(span, inp)
      swaps.push({ parent: span.parentNode, old: inp, current: span })
    })

    return () => {
      // 逐项 try/catch：某个节点被 Vue 重渲染掉时，不能让后面的还原全部中断，
      // 否则画布会残留导出用的临时节点/样式，之后每次导出都会踩到坏状态。
      swaps.forEach(s => {
        try {
          if (s.wasHidden) s.old.style.display = ''
          else if (s.parent && s.parent.contains(s.current)) s.parent.replaceChild(s.old, s.current)
        } catch { /* ignore */ }
      })
      hiddens.forEach(el => { try { el.style.display = '' } catch { /* ignore */ } })
      try { restoreEmpty() } catch { /* ignore */ }
    }
  }

  // html2canvas 的解析器对 calc() / color-mix() 这类值会崩在
  // "Cannot read properties of undefined (reading 'type')"（getAbsoluteValue）。
  // 导出失败时扫一遍画布，把可疑的属性值直接报出来，省得猜。
  const UNSUPPORTED = ['calc(', 'color-mix(', 'oklch(', 'oklab(', 'in srgb', 'in oklab', 'image-set(', 'cross-fade(']
  const WATCHED = [
    'backgroundPosition', 'backgroundSize', 'backgroundImage',
    'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
  ]
  function findUnsupportedStyles() {
    const wrap = wrapRef.value
    if (!wrap) return []
    const hits = []
    const describe = (el, pseudo) => {
      const cls = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || ''
      return el.tagName.toLowerCase() + (cls ? '.' + cls.split(' ')[0] : '') + (pseudo ? pseudo : '')
    }
    // 元素本体 + ::before / ::after 都要看：html2canvas 会一起克隆伪元素
    for (const el of wrap.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo)
        for (const prop of WATCHED) {
          const v = cs[prop]
          if (v == null) continue
          // 空值同样会让 html2canvas 崩（getAbsoluteValue 收到 undefined）
          if (v === '') { hits.push(describe(el, pseudo) + ' 的 ' + prop + ' 是空值'); break }
          if (v === 'none' || v === 'auto' || v === '0px') continue
          const token = UNSUPPORTED.find(t => v.includes(t))
          if (!token) continue
          hits.push(describe(el, pseudo) + ' 的 ' + prop + ' = ' + v.slice(0, 60))
          break
        }
        if (hits.length >= 6) return hits
      }
    }
    return hits
  }

  async function renderImage() {
    // 画布不可见时 html2canvas 会抛错或渲染成空白，这里先拦下来给出可读的原因
    const el = wrapRef.value
    if (!el) throw new Error('画布还没准备好')
    if (!el.offsetWidth || !el.offsetHeight) throw new Error('画布尺寸为 0（日报页面可能未显示）')
    // 背景由画布自身 CSS 承担；backgroundColor 只作为边缘兜底
    return html2canvas(el, { backgroundColor: backgroundBase(), scale: 3 })
  }

  async function exportImage(toClipboard) {
    // 进行中状态：导出要 2~4 秒，不给反馈会被当成「点了没反应」
    if (!wrapRef.value) { lastError.value = '画布还没准备好'; return false }
    if (busy.value) return false
    busy.value = toClipboard ? 'copy' : 'export'
    lastError.value = ''
    const undo = prepareExport()
    const ts = timestampName()
    let ok = false
    try {
      const canvas = await renderImage()
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      if (!blob) return
      if (toClipboard) {
        await copyPngBlob(blob)
      } else {
        downloadBlob(blob, `每日汇报_${ts}.png`)
        // 下载的同时也放一份到剪贴板，方便直接粘贴到聊天窗口
        await copyPngBlob(blob)
      }
      ok = true
    } catch (e) {
      console.error(e)
      // 带上出错位置：html2canvas 内部抛错时靠这行才能定位到是哪个解析器
      const where = e && e.stack ? String(e.stack).split('\n').slice(1, 3).map(s => s.trim()).join(' ').slice(0, 120) : ''
      let hint = ''
      try {
        const bad = findUnsupportedStyles()
        if (bad.length) hint = '｜可疑样式：' + bad.join('；')
      } catch { /* ignore */ }
      lastError.value = '导出失败：' + ((e && e.message) || e) + (where ? '｜' + where : '') + hint
      ok = false
    } finally {
      busy.value = ''
      // 先还原导出时的临时填充（fillEmpty 产生「无」等），再保存「变更后」
      undo()
      if (ok && onExported) onExported()
    return ok
    }
  }

  async function shareImage() {
    if (!wrapRef.value) return
    const undo = prepareExport()
    let ok = false
    try {
      const canvas = await renderImage()
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      if (!blob) return
      const file = new File([blob], '每日汇报.png', { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] })
      else downloadBlob(blob, '每日汇报.png')
      ok = true
    } catch (e) {
      console.error(e)
    } finally {
      undo()
      // 分享导出也要落一次资源记录（以前只有「导出图片 / 复制到剪贴板」会写）
      if (ok && onExported) onExported()
    }
  }

  return { prepareExport, renderImage, exportImage, shareImage, busy, lastError }
}

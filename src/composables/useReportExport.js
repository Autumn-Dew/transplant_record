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
      swaps.forEach(s => { if (s.wasHidden) s.old.style.display = ''; else s.parent.replaceChild(s.old, s.current) })
      hiddens.forEach(el => { el.style.display = '' })
      restoreEmpty()
    }
  }

  async function renderImage() {
    // 背景由画布自身 CSS 承担；backgroundColor 只作为边缘兜底
    return html2canvas(wrapRef.value, { backgroundColor: backgroundBase(), scale: 3 })
  }

  async function exportImage(toClipboard) {
    if (!wrapRef.value) return
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
    } finally {
      // 先还原导出时的临时填充（fillEmpty 产生「无」等），再保存「变更后」
      undo()
      if (ok && onExported) onExported()
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

  return { prepareExport, renderImage, exportImage, shareImage }
}

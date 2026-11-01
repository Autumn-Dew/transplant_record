// ═══════════════════════════════════════════════════════════════════
// 剪贴板与文件下载（文本 / PNG）
//
// 原来这套逻辑在 4 个地方各写一份：蓝图码复制、设置页复制地址、价格表导出、日报分享/复制。
// 关键约束：打包后页面是 `file://`，不算 secure context，`navigator.clipboard` 可能不可用 ——
// 所以文本复制必须带 `execCommand` 回退，图片复制失败要能静默降级。
// ═══════════════════════════════════════════════════════════════════

/** 复制文本，返回是否成功（Clipboard API 不可用时回退到临时 textarea） */
export function copyText(text) {
  const value = String(text == null ? '' : text)
  if (!value) return Promise.resolve(false)
  return new Promise((resolve) => {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(value)
          .then(() => resolve(true))
          .catch(() => resolve(legacyCopy(value)))
        return
      }
    } catch { /* 走回退 */ }
    resolve(legacyCopy(value))
  })
}

function legacyCopy(value) {
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** 把 PNG Blob 写入系统剪贴板（Electron / 现代浏览器），返回是否成功 */
export async function copyPngBlob(blob) {
  if (!blob) return false
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

/** 触发浏览器下载（延迟释放 objectURL，避免个别环境下载被中断） */
export function downloadBlob(blob, fileName) {
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 文件名时间戳：yyyyMMdd_HHmmss */
export function timestampName(date = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
}

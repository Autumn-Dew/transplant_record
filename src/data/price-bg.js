// ═══════════════════════════════════════════════════════════════════
// 价格一览的画布背景图
//
// 之前只把 file 转成 objectURL 放在内存里 —— 关掉窗口就没了，界面却没有任何提示。
// 现在改为：**压缩后存成 dataURL**（`tr-price-bg`），重启仍在。
//
// 为什么要压缩：localStorage 通常只有 5MB，一张手机原图就有 3~8MB，
// 直接存会把整个存储塞满（连带项目数据一起写不进去）。所以统一缩到最宽 1600px、
// JPEG 质量 0.78，并做 2MB 上限校验；超限就不存（返回空串，由调用方提示）。
// ═══════════════════════════════════════════════════════════════════

import { KEYS, readJSON, writeJSON } from './storage.js'

export const MAX_BG_DATA_URL = 2 * 1024 * 1024 // 2MB
export const MAX_BG_WIDTH = 1600
export const BG_JPEG_QUALITY = 0.78

function isImageDataUrl(v) {
  return typeof v === 'string' && v.startsWith('data:image/')
}

/** 读取已保存的背景图（缺失 / 损坏 / 超限一律当成「没有」） */
export function readPriceBg() {
  const raw = readJSON(KEYS.PRICE_BG, '')
  if (!isImageDataUrl(raw) || raw.length > MAX_BG_DATA_URL) return ''
  return raw
}

/** 保存背景图；传空串表示清除。超限 / 非图片返回空串（不写盘） */
export function writePriceBg(dataUrl) {
  if (!dataUrl) {
    writeJSON(KEYS.PRICE_BG, '')
    return ''
  }
  if (!isImageDataUrl(dataUrl) || dataUrl.length > MAX_BG_DATA_URL) return ''
  writeJSON(KEYS.PRICE_BG, dataUrl)
  return dataUrl
}

/**
 * 把用户选的图片文件压成 dataURL。
 * 失败（不是图片 / 画不出来）返回空串，调用方按「没有背景」处理。
 */
export function fileToBgDataUrl(file, { maxWidth = MAX_BG_WIDTH, quality = BG_JPEG_QUALITY } = {}) {
  return new Promise((resolve) => {
    let url = ''
    try {
      url = URL.createObjectURL(file)
    } catch {
      resolve('')
      return
    }
    const cleanup = () => { try { URL.revokeObjectURL(url) } catch { /* ignore */ } }
    const img = new Image()
    img.onload = () => {
      try {
        const srcW = img.width || maxWidth
        const srcH = img.height || maxWidth
        const scale = Math.min(1, maxWidth / srcW)
        const w = Math.max(1, Math.round(srcW * scale))
        const h = Math.max(1, Math.round(srcH * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        cleanup()
        resolve(isImageDataUrl(dataUrl) ? dataUrl : '')
      } catch {
        cleanup()
        resolve('')
      }
    }
    img.onerror = () => { cleanup(); resolve('') }
    img.src = url
  })
}

// 脱敏与展示名工具（代肝代办 / 代肝日报 共用）
// 实现已迁移至 domain 层，此处仅转发以保持既有 import 路径可用。
export { maskAccount, getDisplayName, PLATFORM_ORDER, PLATFORM_LABEL, PLATFORM_OPTIONS } from '@/domain/mask.js'
import { maskAccount, getDisplayName } from '@/domain/mask.js'

export function useMask() {
  return { maskAccount, getDisplayName }
}

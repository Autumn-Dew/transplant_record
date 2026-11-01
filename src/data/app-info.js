// ═══════════════════════════════════════════════════════════════════
// 应用与作者的基础信息（设置页「关于」侧边弹窗用）
//
// 版本号不在这里写死 —— 直接取 package.json 的 version，
// 发版时只改一个字，界面与备份文件里的版本号同时更新。
// 个人信息参考 B 站空间页（UID 354567248）：头像已下载到 public/avatar.jpg，
// 运行时用 BASE_URL 拼接（dev=「/」，打包 file://=「./」），离线也能显示。
// ═══════════════════════════════════════════════════════════════════

export const APP_NAME_CN = '代肝记录'
export const APP_NAME = 'Transplant Record'
export const APP_AUTHOR = 'AutumnDew'
export const APP_SIGN = '秋の露'
export const APP_REPO = 'https://github.com/Autumn-Dew/transplant_record'
export const APP_REPO_LABEL = 'Autumn-Dew / transplant_record'
export const APP_TAGLINE = '一站式代肝工作终端：代肝代办 · 代肝记录 · 蓝图 · 价格表 · 每日汇报'
export const APP_COPYRIGHT = '© 2026 AutumnDew · 数据全部保存在本机，不上传任何服务器'

// ── B 站（头像 / 昵称 / 签名 / 等级取自公开空间信息）──
export const APP_BILI_UID = '354567248'
export const APP_BILI_URL = 'https://space.bilibili.com/354567248'
export const APP_BILI_LEVEL = 6
export const APP_BILI_SIGN = '铸币UP一枚，终末地，明日方舟代肝。如果没回消息就是在睡觉'
export const APP_AVATAR = 'avatar.jpg'   // public/avatar.jpg

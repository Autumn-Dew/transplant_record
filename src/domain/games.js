// ═══════════════════════════════════════════════════════════════════
// 游戏与服务项目目录（domain 层：纯数据与纯函数，不依赖 Vue / localStorage）
//
// 设计约束：
//  1. 业务逻辑不得硬编码游戏名称 —— 一律通过本目录解析。
//  2. 游戏 id 与「价格表」的 key 对齐（prices[id]），新增游戏后
//     创建项目 / 筛选 / 统计 / 价格表会自动获得该游戏。
//  3. 内置的 3 个游戏只是「默认数据」，用于兼容已存在的价格表与项目数据；
//     用户可以自由增删改，不构成固定列表。
// ═══════════════════════════════════════════════════════════════════

function svc(id, name, price, unit, order, note = '') {
  return { id, name, price, unit, note, enabled: true, order }
}

// 默认游戏（含默认服务项目），价格仅作「默认价」参考，价格表可单独调整
export const DEFAULT_GAMES = [
  {
    id: 'endfield',
    name: '终末地',
    short: 'EF',
    order: 1,
    enabled: true,
    archived: false,
    services: [
      svc('ef-host-basic', '普托', 30, '月', 1, '日常托管'),
      svc('ef-host-pro', '当前版本精托', 90, '月', 2, ''),
      svc('ef-host-full', '当前版本全托', 150, '月', 3, ''),
      svc('ef-base', '基建毕业', 0, '', 4, '不含矿点'),
      svc('ef-open-gudi', '四号谷地开荒', 0, '', 5, ''),
      svc('ef-open-wuling', '武陵开荒', 0, '', 6, ''),
      svc('ef-collect', '地图全收集', 0, '', 7, ''),
      svc('ef-event', '当期活动', 0, '期', 8, ''),
      svc('ef-boss', 'boss挑战', 0, '个', 9, ''),
    ],
  },
  {
    id: 'ak',
    name: '明日方舟',
    short: 'AK',
    order: 2,
    enabled: true,
    archived: false,
    services: [
      svc('ak-host-basic', '普托', 30, '月', 1, '理智清理+基建收菜+日常+周常+剿灭'),
      svc('ak-host-pro', '精托', 90, '月', 2, ''),
      svc('ak-host-full', '全托', 150, '月', 3, ''),
      svc('ak-story', '主线推图', 0, '章', 4, ''),
      svc('ak-side', 'SideStory推图', 0, '', 5, ''),
      svc('ak-rogue', '肉鸽', 0, '', 6, ''),
      svc('ak-paradox', '悖论模拟', 0, '个', 7, ''),
      svc('ak-annihilation', '剿灭作战首通', 0, '个', 8, ''),
    ],
  },
  {
    id: 'nte',
    name: '异环',
    short: 'NTE',
    order: 3,
    enabled: true,
    archived: false,
    services: [
      svc('nte-host', '日常托管', 0, '月', 1, ''),
      svc('nte-daily', '每日活跃', 0, '', 2, ''),
      svc('nte-weekly', '周常', 0, '', 3, ''),
    ],
  },
]

// 「代肝记录」遗留的通用服务名（tr-services），作为兜底服务目录
export const LEGACY_DEFAULT_SERVICES = ['基建', '打boss', '大地图探索', '谷地开荒', '武陵开荒', '托管']

export function clone(v) {
  return JSON.parse(JSON.stringify(v))
}

export function defaultGames() {
  return clone(DEFAULT_GAMES)
}

function str(v, d = '') {
  return v == null ? d : String(v)
}

// 规范化单个游戏：补全缺失字段、去重服务、稳定排序
export function normalizeGame(raw, index = 0) {
  const g = raw && typeof raw === 'object' ? raw : {}
  const id = str(g.id).trim() || `game-${index + 1}`
  const services = (Array.isArray(g.services) ? g.services : [])
    .filter(isPlainObject)
    .map((s, i) => ({
      id: str(s.id).trim() || `${id}-svc-${i + 1}`,
      name: str(s.name).trim(),
      price: s.price === '' || s.price == null ? '' : Number(s.price),
      unit: str(s.unit),
      note: str(s.note),
      enabled: s.enabled !== false,
      order: Number.isFinite(Number(s.order)) ? Number(s.order) : i + 1,
    }))
    .filter(s => s.name)
    .sort((a, b) => a.order - b.order)

  return {
    id,
    name: str(g.name).trim() || id,
    short: str(g.short),
    order: Number.isFinite(Number(g.order)) ? Number(g.order) : index + 1,
    enabled: g.enabled !== false,
    archived: !!g.archived,
    services,
    // 游戏不使用图标（产品决定）：仅在旧数据确实带值时原样透传，避免丢字段；
    // 界面既不展示也不编辑它。
    ...(g.icon ? { icon: str(g.icon) } : {}),
  }
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export function normalizeGames(list) {
  const arr = (Array.isArray(list) ? list : []).filter(isPlainObject)
  const used = new Set()
  const out = []
  arr.forEach((raw, i) => {
    const g = normalizeGame(raw, i)
    if (used.has(g.id)) return
    used.add(g.id)
    out.push(g)
  })
  return out.sort((a, b) => a.order - b.order)
}

// 展示用：启用且未归档的游戏
export function usableGames(games) {
  return (games || []).filter(g => g.enabled && !g.archived)
}

// 按 id 或名称（或简称）查找游戏
export function findGame(games, keyOrName) {
  const k = str(keyOrName).trim()
  if (!k) return null
  return (
    (games || []).find(g => g.id === k) ||
    (games || []).find(g => g.name === k) ||
    (games || []).find(g => g.short && g.short === k) ||
    null
  )
}

// 任意输入 → 归属游戏的稳定 id（价格表 key）；找不到则原样返回输入
export function gameKeyOf(games, keyOrName) {
  const g = findGame(games, keyOrName)
  return g ? g.id : str(keyOrName).trim()
}

// 任意输入 → 展示名；找不到则原样返回输入
export function gameNameOf(games, keyOrName) {
  const g = findGame(games, keyOrName)
  return g ? g.name : str(keyOrName).trim()
}

// SelectBox 选项（value 一律使用游戏 id，与价格表 key 一致）
export function gameOptions(games, { includeAll = false, allLabel = '全部游戏' } = {}) {
  const opts = usableGames(games).map(g => ({ value: g.id, label: g.name }))
  return includeAll ? [{ value: '', label: allLabel }, ...opts] : opts
}

// 同一游戏下的服务项目（启用项）
export function serviceNames(game) {
  if (!game) return []
  return (game.services || []).filter(s => s.enabled).map(s => s.name)
}

// 保证历史数据里出现过的游戏都存在于目录中（避免旧数据「消失」于筛选/统计之外）
// 幂等：同一名字只会补一次，且以游戏名作为 id（同时作为价格表 key，稳定）
export function ensureGamesForRecords(games, records) {
  const out = Array.isArray(games) ? [...games] : []
  const known = new Set()
  out.forEach(g => { known.add(g.id); known.add(g.name); if (g.short) known.add(g.short) })
  let order = out.reduce((m, g) => Math.max(m, Number(g.order) || 0), 0)
  ;(Array.isArray(records) ? records : []).forEach(r => {
    const name = str(r?.gameName || r?.game).trim()
    if (!name || known.has(name)) return
    known.add(name)
    order++
    out.push(normalizeGame({ id: name, name, short: '', order, enabled: true }, out.length))
  })
  return out
}

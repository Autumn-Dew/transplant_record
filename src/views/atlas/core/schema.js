/** Strict JSON schema shared by imports, storage and reviewed changes. */
export const SCHEMA_VERSION = 3;
export const MAX_QUANTITY = 1e12;
export const MAX_OCCURRENCES = 1000000;
export const clone = value => JSON.parse(JSON.stringify(value));
export const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
export const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const bad = message => { throw new Error(message); };
export const FIELD_LABELS = Object.freeze({name:'名称',subtitle:'副标题',startedAt:'开服日',unit:'单位',color:'显示颜色',note:'备注',typeId:'来源类型',parentId:'父来源',startDate:'开始日期',endDate:'结束日期',occurrences:'次数',amount:'单次产出'});
export const FIELDS = FIELD_LABELS;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const MAX_LIST = 10000;

export function safeTree(value, depth = 0, budget = {n: 0}) {
  if (++budget.n > 200000 || depth > 24) bad('数据过大或嵌套过深，请分成较小的快照。');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    if (value.length > 100000) bad('文本过长，单个字段不可超过 100000 个字符。');
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) bad('数据包含无法识别的数值。');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_LIST) bad('单个列表最多包含 10000 项。');
    value.forEach(entry => safeTree(entry, depth + 1, budget));
    return;
  }
  if (!plain(value)) bad('数据只能包含普通 JSON 对象、数组、字符串、数字和布尔值。');
  for (const key of Object.keys(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) bad('数据包含不允许的属性名。');
    safeTree(value[key], depth + 1, budget);
  }
}

export function shape(value, fields, where) {
  if (!plain(value)) bad(`${where}必须是对象。`);
  for (const field of fields) if (!own(value, field)) bad(`${where}缺少 ${field} 字段。`);
  for (const field of Object.keys(value)) if (!fields.includes(field)) bad(`${where}包含未知字段 ${field}。`);
}

export function textField(value, where, nonempty = false) {
  if (typeof value !== 'string' || value.length > 5000 || (nonempty && !value.trim())) bad(`${where}须填写${nonempty ? '非空' : ''}文本，最多 5000 字。`);
}

export function list(value, where, key = 'id') {
  if (!Array.isArray(value)) bad(`${where}必须是数组。`);
  const seen = new Set();
  value.forEach((entry, index) => {
    if (!plain(entry) || typeof entry[key] !== 'string' || !ID.test(entry[key])) bad(`${where}第 ${index + 1} 项的 ${key} 无效（使用字母、数字、短横线或下划线）。`);
    if (seen.has(entry[key])) bad(`${where}第 ${index + 1} 项的 ${key} 重复：${entry[key]}。`);
    seen.add(entry[key]);
  });
}

export function dateField(value, where, allowEmpty = false) {
  if (value === null || (allowEmpty && value === '')) return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) bad(`${where}须为 YYYY-MM-DD${allowEmpty ? ' 或空字符串' : ' 或 null'}。`);
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0,10) !== value) bad(`${where}不是有效日期。`);
}

export function colorField(value, where) {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) bad(`${where}颜色须为 #RRGGBB。`);
}

export function quantityField(value, where) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_QUANTITY) bad(`${where}须为 0 至 1000000000000 的有限数字。`);
}

export function validateSnapshot(input) {
  safeTree(input);
  shape(input, ['schemaVersion','version','updatedAt','games'], '快照');
  if (input.schemaVersion !== SCHEMA_VERSION) bad('不支持此快照格式版本；当前使用 schemaVersion = 3，旧格式请先迁移。');
  textField(input.version, '快照版本', true);
  textField(input.updatedAt, '快照更新时间', true);
  if (!Number.isFinite(Date.parse(input.updatedAt))) bad('快照 updatedAt 不是有效日期。');
  list(input.games, '游戏列表');
  input.games.forEach((game, gameIndex) => {
    const g = `第 ${gameIndex + 1} 款游戏「${game.name || game.id}」`;
    shape(game, ['id','name','subtitle','startedAt','resources','sourceTypes','sources'], g);
    textField(game.name, `${g}名称`, true);
    textField(game.subtitle, `${g}副标题`);
    if (typeof game.startedAt !== 'string') bad(`${g}开服日须为 YYYY-MM-DD 或空字符串。`);
    dateField(game.startedAt, `${g}开服日`, true);
    list(game.resources, `${g}资源列表`);
    const resourceIds = new Set(game.resources.map(entry => entry.id));
    game.resources.forEach((resource, index) => {
      const r = `${g}第 ${index + 1} 个资源`;
      shape(resource, ['id','name','unit','color'], r);
      textField(resource.name, `${r}名称`, true);
      textField(resource.unit, `${r}单位`);
      colorField(resource.color, r);
    });
    list(game.sourceTypes, `${g}来源类型列表`);
    const typeIds = new Set(game.sourceTypes.map(entry => entry.id));
    game.sourceTypes.forEach((type, index) => {
      const t = `${g}第 ${index + 1} 个来源类型`;
      shape(type, ['id','name','color','note'], t);
      textField(type.name, `${t}名称`, true);
      textField(type.note, `${t}备注`);
      colorField(type.color, t);
    });
    list(game.sources, `${g}来源列表`);
    const sources = new Map(game.sources.map(source => [source.id, source]));
    game.sources.forEach((source, index) => {
      const s = `${g}第 ${index + 1} 个来源「${source.name || source.id}」`;
      shape(source, ['id','name','typeId','parentId','startDate','endDate','occurrences','note','grants'], s);
      textField(source.name, `${s}名称`, true);
      textField(source.note, `${s}备注`);
      if (!typeIds.has(source.typeId)) bad(`${s}引用了本游戏中不存在的来源类型 ${String(source.typeId)}。`);
      if (source.parentId !== null) {
        if (typeof source.parentId !== 'string' || !sources.has(source.parentId)) bad(`${s}的父来源在本游戏中不存在。`);
        if (source.parentId === source.id) bad(`${s}不能引用自己作为父来源。`);
        if (sources.get(source.parentId).parentId !== null) bad(`${s}只允许一层子来源，不能形成环或嵌套到子来源下。`);
      }
      dateField(source.startDate, `${s}开始日期`);
      dateField(source.endDate, `${s}结束日期`);
      if (!Number.isInteger(source.occurrences) || source.occurrences < 1 || source.occurrences > MAX_OCCURRENCES) bad(`${s}次数须为 1 至 1000000 的整数。`);
      list(source.grants, `${s}产出列表`, 'resourceId');
      source.grants.forEach((grant, grantIndex) => {
        const r = `${s}第 ${grantIndex + 1} 个产出`;
        shape(grant, ['resourceId','amount'], r);
        if (!resourceIds.has(grant.resourceId)) bad(`${r}引用了本游戏中不存在的资源 ${grant.resourceId}。`);
        quantityField(grant.amount, `${r}单次产出`);
      });
    });
  });
  return clone(input);
}

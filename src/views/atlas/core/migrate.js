import {clone,safeTree,shape,textField,list,colorField,quantityField,validateSnapshot,bad} from './schema.js';

/** Validate a retired format before mapping; malformed old data is never guessed. */
function validateLegacyV1(input) {
  safeTree(input);
  shape(input, ['schemaVersion','version','updatedAt','games'], '旧快照');
  if (input.schemaVersion !== 1) bad('仅支持结构版本 1、2 或 3 的快照。');
  textField(input.version, '旧快照版本', true);
  textField(input.updatedAt, '旧快照更新时间', true);
  if (!Number.isFinite(Date.parse(input.updatedAt))) bad('旧快照 updatedAt 不是有效日期。');
  list(input.games, '游戏列表');
  input.games.forEach((game, gi) => {
    const g = `第 ${gi + 1} 款游戏「${game.name || game.id}」`;
    shape(game, ['id','name','subtitle','resources','categories'], g);
    textField(game.name, `${g}名称`, true);
    textField(game.subtitle, `${g}副标题`);
    list(game.resources, `${g}资源列表`);
    const resourceIds = new Set(game.resources.map(resource => resource.id));
    game.resources.forEach((resource, ri) => {
      const r = `${g}第 ${ri + 1} 个资源`;
      shape(resource, ['id','name','unit','color'], r);
      textField(resource.name, `${r}名称`, true);
      textField(resource.unit, `${r}单位`);
      colorField(resource.color, r);
    });
    list(game.categories, `${g}分类列表`);
    game.categories.forEach((category, ci) => {
      const c = `${g}第 ${ci + 1} 个分类「${category.name || category.id}」`;
      shape(category, ['id','name','items'], c);
      textField(category.name, `${c}名称`, true);
      list(category.items, `${c}条目列表`);
      category.items.forEach((item, ii) => {
        const it = `${c}第 ${ii + 1} 个条目「${item.name || item.id}」`;
        shape(item, ['id','name','note','requirements'], it);
        textField(item.name, `${it}名称`, true);
        textField(item.note, `${it}备注`);
        list(item.requirements, `${it}资源记录`, 'resourceId');
        item.requirements.forEach((requirement, ri) => {
          const r = `${it}第 ${ri + 1} 个资源记录`;
          shape(requirement, ['resourceId','target','owned'], r);
          if (!resourceIds.has(requirement.resourceId)) bad(`${r}引用了本游戏中不存在的资源 ${requirement.resourceId}。`);
          quantityField(requirement.target, `${r}目标量`);
          quantityField(requirement.owned, `${r}已拥有量`);
        });
      });
    });
  });
  return clone(input);
}

/** Version 2 tracked a personal 已获得量 next to each grant; it is not statistical data. */
function validateLegacyV2(input) {
  safeTree(input);
  shape(input, ['schemaVersion','version','updatedAt','games'], '旧快照');
  if (input.schemaVersion !== 2) bad('仅支持结构版本 1、2 或 3 的快照。');
  textField(input.version, '旧快照版本', true);
  textField(input.updatedAt, '旧快照更新时间', true);
  if (!Number.isFinite(Date.parse(input.updatedAt))) bad('旧快照 updatedAt 不是有效日期。');
  list(input.games, '游戏列表');
  input.games.forEach((game, gi) => {
    const g = `第 ${gi + 1} 款游戏「${game.name || game.id}」`;
    shape(game, ['id','name','subtitle','startedAt','resources','sourceTypes','sources'], g);
    textField(game.name, `${g}名称`, true);
    textField(game.subtitle, `${g}副标题`);
    list(game.resources, `${g}资源列表`);
    const resourceIds = new Set(game.resources.map(resource => resource.id));
    game.resources.forEach((resource, ri) => {
      const r = `${g}第 ${ri + 1} 个资源`;
      shape(resource, ['id','name','unit','color'], r);
      textField(resource.name, `${r}名称`, true);
      textField(resource.unit, `${r}单位`);
      colorField(resource.color, r);
    });
    list(game.sourceTypes, `${g}来源类型列表`);
    game.sourceTypes.forEach((type, ti) => {
      const t = `${g}第 ${ti + 1} 个来源类型`;
      shape(type, ['id','name','color','note'], t);
      textField(type.name, `${t}名称`, true);
      textField(type.note, `${t}备注`);
      colorField(type.color, t);
    });
    list(game.sources, `${g}来源列表`);
    game.sources.forEach((source, si) => {
      const s = `${g}第 ${si + 1} 个来源「${source.name || source.id}」`;
      shape(source, ['id','name','typeId','parentId','startDate','endDate','occurrences','note','grants'], s);
      textField(source.name, `${s}名称`, true);
      textField(source.note, `${s}备注`);
      list(source.grants, `${s}产出列表`, 'resourceId');
      source.grants.forEach((grant, gi2) => {
        const r = `${s}第 ${gi2 + 1} 个产出`;
        shape(grant, ['resourceId','amount','owned'], r);
        if (!resourceIds.has(grant.resourceId)) bad(`${r}引用了本游戏中不存在的资源 ${grant.resourceId}。`);
        quantityField(grant.amount, `${r}单次产出`);
        quantityField(grant.owned, `${r}已获得量`);
      });
    });
  });
  return clone(input);
}

export const MIGRATION_NOTICE = '旧数据已迁移为统计结构：个人已获得量已移除，累计量 = 单次产出 × 次数，请核对次数';

export function migrateSnapshot(input) {
  if (input?.schemaVersion === 3) return {snapshot:validateSnapshot(input),migrated:false};
  if (input?.schemaVersion === 2) {
    const legacy = validateLegacyV2(input);
    return {snapshot:validateSnapshot(stripPersonal(legacy)),migrated:true};
  }
  const legacy = validateLegacyV1(input);
  return {snapshot:validateSnapshot(fromLegacyList(legacy)),migrated:true};
}

/** Drops 已获得量 from every grant; the statistical fields are untouched. */
function stripPersonal(snapshot) {
  return {
    schemaVersion:3, version:snapshot.version, updatedAt:snapshot.updatedAt,
    games:snapshot.games.map(game => ({
      ...clone(game),
      sources:game.sources.map(source => ({
        ...source,
        occurrences:source.occurrences,
        grants:source.grants.map(grant => ({resourceId:grant.resourceId,amount:grant.amount}))
      }))
    }))
  };
}

/** Legacy 收集清单: categories → 来源类型, items → 来源, target → 单次产出. */
function fromLegacyList(snapshot) {
  const sourceId = (category, item) => {
    const pair = `${category.id.length}-${category.id}-${item.id}`;
    if (pair.length <= 93) return `legacy-${pair}`;
    let hash = 0x6c62272e07bb014262b821756295c58dn;
    const mask = (1n << 128n) - 1n;
    for (const character of pair) hash = ((hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn) & mask;
    return `legacy-${hash.toString(16).padStart(32,'0')}-${item.id.slice(0,50)}`;
  };
  return {
    schemaVersion:3, version:snapshot.version, updatedAt:snapshot.updatedAt,
    games:snapshot.games.map(game => ({
      id:game.id,name:game.name,subtitle:game.subtitle,startedAt:'',resources:clone(game.resources),
      sourceTypes:game.categories.map(category => ({id:category.id,name:category.name,color:'#74746b',note:''})),
      sources:game.categories.flatMap(category => category.items.map(item => ({
        id:sourceId(category,item),name:item.name,typeId:category.id,parentId:null,startDate:null,endDate:null,
        occurrences:1,note:item.note,grants:item.requirements.map(requirement => ({resourceId:requirement.resourceId,amount:requirement.target}))
      })))
    }))
  };
}

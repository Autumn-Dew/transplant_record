/** 统计口径：累计产出 = 单次产出 × 次数。日期只用于展示与排序，从不参与算术。 */
const dictionary = () => Object.create(null);
const sum = values => values.reduce((total, value) => total + value, 0);
const decimal = value => {
  const [coefficient, exponent = '0'] = String(value).split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  return {digits:BigInt(whole + fraction),power:Number(exponent) - fraction.length};
};

/** 向下取整的占比；分母为零时返回 null，页面显示 --，不产生 NaN。 */
export function share(part = 0, total = 0) {
  if (!Number.isFinite(part) || !Number.isFinite(total)) throw new Error('汇总包含无效数值，请检查来源产出。');
  if (total <= 0) return {percent:null, bar:0};
  let percent = Math.floor(part / total * 100);
  // 合法的极小分母可能让浮点比值溢出；用十进制 BigInt 保住整数结果。
  if (!Number.isFinite(percent)) {
    const a = decimal(part), b = decimal(total), power = a.power - b.power + 2;
    const numerator = a.digits * (10n ** BigInt(Math.max(0,power)));
    const denominator = b.digits * (10n ** BigInt(Math.max(0,-power)));
    percent = String(numerator / denominator);
  }
  return {percent, bar:Math.min(100,Math.max(0,Number(percent)))};
}

const laterDate = (a, b) => !a ? b : !b ? a : (a > b ? a : b);
const earlierDate = (a, b) => !a ? b : !b ? a : (a < b ? a : b);

/** 一个账本只聚合一次：总量、占比与构成全部由同一份矩阵派生。 */
export function aggregateGame(snapshot, gameId) {
  const game = snapshot?.games.find(entry => entry.id === gameId) || null;
  if (!game) {
    return {
      game:null,
      totals:{total:0,percent:null,bar:0,sources:0,topLevelSources:0,childSources:0,types:0,resources:0,grants:0,earliest:null,latest:null,ongoing:false},
      rows:[],sourceTypes:[],sources:dictionary()
    };
  }
  const matrix = dictionary();
  game.resources.forEach(resource => {
    matrix[resource.id] = dictionary();
    game.sourceTypes.forEach(type => {matrix[resource.id][type.id] = 0;});
  });
  const sources = dictionary();
  game.sources.forEach(source => {
    const byResource = dictionary();
    game.resources.forEach(resource => {byResource[resource.id] = 0;});
    let total = 0;
    source.grants.forEach(grant => {
      const amount = grant.amount * source.occurrences;
      total += amount;
      byResource[grant.resourceId] += amount;
      matrix[grant.resourceId][source.typeId] += amount;
    });
    sources[source.id] = {direct:{total,byResource},withChildren:{total,byResource}};
  });
  // 一层子来源：父来源的「含子来源累计」= 自身 + 直接子来源。
  game.sources.forEach(source => {
    const children = game.sources.filter(child => child.parentId === source.id);
    if (!children.length) return;
    const byResource = dictionary();
    game.resources.forEach(resource => {byResource[resource.id] = 0;});
    let total = 0;
    for (const member of [source, ...children]) {
      total += sources[member.id].direct.total;
      game.resources.forEach(resource => {byResource[resource.id] += sources[member.id].direct.byResource[resource.id];});
    }
    sources[source.id].withChildren = {total,byResource};
  });

  // 不同单位的资源不能相加：占比一律以「同一资源自己的合计」为分母。
  // rowsTotal 只作为「各类资源加起来」的展示数字，不再参与任何百分比。
  const rowsTotal = sum(game.resources.map(resource => sum(game.sourceTypes.map(type => matrix[resource.id][type.id]))));
  const resourceTotals = dictionary();
  game.resources.forEach(resource => {
    resourceTotals[resource.id] = sum(game.sourceTypes.map(type => matrix[resource.id][type.id]));
  });
  const rows = game.resources.map(resource => {
    const total = resourceTotals[resource.id];
    const byType = dictionary();
    game.sourceTypes.forEach(type => {
      byType[type.id] = {total:matrix[resource.id][type.id],...share(matrix[resource.id][type.id], total)};
    });
    const topType = game.sourceTypes
      .map(type => ({type,total:matrix[resource.id][type.id]}))
      .filter(entry => entry.total > 0)
      .sort((a,b) => b.total - a.total)[0] || null;
    return {
      id:resource.id,name:resource.name,unit:resource.unit,color:resource.color,resource,
      total,percent:null,bar:0,byType,
      sourceCount:game.sources.filter(source => source.grants.some(grant => grant.resourceId === resource.id)).length,
      topType:topType ? {id:topType.type.id,name:topType.type.name,color:topType.type.color,total:topType.total,...share(topType.total, total)} : null
    };
  });

  const sourceTypes = game.sourceTypes.map(type => {
    // 该类型在「每个资源」里各占多少（分母 = 该资源的合计）
    const byResource = dictionary();
    game.resources.forEach(resource => {
      byResource[resource.id] = {total:matrix[resource.id][type.id],...share(matrix[resource.id][type.id], resourceTotals[resource.id])};
    });
    // 跨资源合计只是数字，不给百分比（单位不同，相加没有意义）
    const total = sum(game.resources.map(resource => matrix[resource.id][type.id]));
    const members = game.sources.filter(source => source.typeId === type.id);
    const starts = members.map(source => source.startDate).filter(Boolean).sort();
    const ends = members.map(source => source.endDate).filter(Boolean).sort();
    return {
      id:type.id,name:type.name,color:type.color,note:type.note,
      total,percent:null,bar:0,count:members.length,
      parentCount:members.filter(source => source.parentId === null).length,
      grantCount:members.reduce((n, source) => n + source.grants.length, 0),
      earliest:starts[0] || null, latest:ends.length ? ends[ends.length - 1] : null,
      ongoing:members.some(source => !source.endDate),
      byResource
    };
  });

  const starts = game.sources.map(source => source.startDate).filter(Boolean).sort();
  const ends = game.sources.map(source => source.endDate).filter(Boolean).sort();
  const totals = {
    total:rowsTotal,percent:null,bar:0,resourceTotals,
    sources:game.sources.length,
    topLevelSources:game.sources.filter(source => source.parentId === null).length,
    childSources:game.sources.filter(source => source.parentId !== null).length,
    types:game.sourceTypes.length,
    resources:game.resources.length,
    grants:game.sources.reduce((n, source) => n + source.grants.length, 0),
    earliest:starts[0] || null,
    latest:ends.length ? laterDate(null, ends[ends.length - 1]) : null,
    ongoing:game.sources.some(source => !source.endDate)
  };

  return {game,rows,resources:rows,sourceTypes,sources,totals};
}

/** 单个来源的总量；默认含一层子来源。 */
export function sourceSubtotal(snapshot, gameId, sourceId, includeChildren = true) {
  const metric = aggregateGame(snapshot,gameId).sources[sourceId];
  return metric ? metric[includeChildren ? 'withChildren' : 'direct'] : {total:0,byResource:dictionary()};
}

const fullFormatter = new Intl.NumberFormat('zh-CN',{maximumSignificantDigits:21});
const compactFormatter = new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:2});
export function fullNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return fullFormatter.format(value);
}
export function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return Math.abs(value) >= 1000000 ? compactFormatter.format(value) : fullFormatter.format(value);
}
export const percentText = metric => metric?.percent === null || metric?.percent === undefined ? '--' : `${metric.percent}%`;
export const dateSpanText = (earliest, latest, ongoing) => {
  if (!earliest && !latest) return '未记录日期';
  return `${earliest || '未记录起始日'} — ${ongoing ? '持续至今' : latest || '未记录结束日'}`;
};

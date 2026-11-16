/**
 * 资源账簿 · 起始状态
 *
 * 这里**不内置任何测试数据**。首次打开是一本空账簿，
 * 由你自己在「数据管理」里建游戏 / 章节 / 关卡。
 *
 * 之所以不预置示例：应用更新后不该被上一版留下的演示数据干扰，
 * 也不该在你不想看的时候冒出一堆「明日方舟」「终末地」的假账。
 *
 * 想导入现成数据，用工具栏的「导入 JSON」，游戏之间互相独立。
 */

/** 不需要默认隐藏任何章节（没有内置数据） */
export const DEMO_DEFAULT_HIDDEN = [];

/** 空快照：结构完整，但 games 为空 */
export function buildEmptySnapshot() {
  return {
    schemaVersion: 3,
    version: 'empty',
    updatedAt: new Date().toISOString(),
    games: [],
  };
}

export default buildEmptySnapshot;

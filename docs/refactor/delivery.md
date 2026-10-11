# 交付说明与验收对照

## 1. 交付内容

| # | 交付物 | 位置 |
|---|---|---|
| 1 | 完整重构后的项目 | 本仓库（`npm run build` / `npm start` 可用） |
| 2 | 架构文档 | `docs/refactor/architecture.md` |
| 3 | 数据模型文档 | `docs/refactor/data-model.md` |
| 4 | 数据迁移文档 | `docs/refactor/data-model.md` 第 5 节 + `src/services/migration.js` |
| 5 | 业务流程文档 | `docs/refactor/workflow.md` |
| 6 | 游戏与服务管理 | `src/components/GameSection.vue`（内嵌「数据管理 → 游戏与服务」）+ `src/services/gameService.js`；游戏不使用图标 |
| 7 | 价格表编辑器 | `src/views/PricePage.vue` + `src/data/price-layouts.js` |
| 8 | 每日返图编辑器 | `src/components/ReportSheet.vue` + `src/data/report-layouts.js` + `src/composables/useReportLayout.js` |
| 9 | 统一视觉设计系统 | `src/assets/css/design-tokens.css` + `global-theme.css` + `page-common.css` |
| 10 | 主要交互与动效 | `motion-tokens.css` / `design-tokens.css` / `components/TodayTasks.vue` |
| 11 | 测试结果 | `tests/`（159 用例，`npm test` 全绿）+ `npm run ui:smoke`（截图 + DOM 断言） |
| 12 | 未完成事项清单 | 本文第 3 节 |

> 各轮修正与问题清单见 `rev2` … `rev7-progress.md`（索引见 `docs/refactor/README.md`）。

## 2. 验收标准对照

| 验收标准 | 结果 | 依据 |
|---|---|---|
| 可以自由增加任意游戏 | ✅ | `gameService.addGame`，id 自动去重，测试覆盖 |
| 可以为游戏配置多个服务项目 | ✅ | 服务项目 CRUD + 排序 + 启用，测试覆盖 |
| 可以创建单次项目和托管项目 | ✅ | `createProject` 两类项目，测试覆盖 |
| 托管周期与实际执行次数完全分离 | ✅ | `host.startDate/endDate/cycleDays` 与 `completedTimes` 独立，测试覆盖 |
| 每日代办可以独立管理 | ✅ | `todayTasks` + 完成 / 跳过（异常与延后已按需求移除） |
| 每次实际执行都能产生独立历史记录 | ✅ | `confirmExecution` 先写 `completionsRepo`，测试覆盖 |
| 项目归档后历史记录仍然完整 | ✅ | 归档 = 消耗全部剩余天数并完成该托管；有历史禁止物理删除，测试覆盖 |
| 续期可以正确关联同一个项目 | ✅ | 续期 = 在原项目上加天数（`addHostingPeriod`）+ 追加一条收费记录，不新建项目 |
| 价格表支持预设与区域级自由调整 | ✅ | 原版 + 4 预设构图 + 字号/间距/配色/画布/导出倍率等参数；原版取值有测试锁定 |
| 每日返图支持工作区和截图画布分离 | ✅ | `.rp-canvas` 是导出范围；画布外模块留在画布 DOM 内、绝对定位到画布下方，导出时临时隐藏（严格不进图片） |
| 返图支持模块与字段三态显示规则 | ✅ | `report-layouts` 三态 + 面板；`auto` 在导出阶段按内容判定 |
| 所有历史数据得到妥善保留 | ✅ | 迁移只新增字段；迁移前备份到 `tr-backup-*`；可回滚 |
| 整体界面形成统一的孤星风格视觉体系 | ✅ | 设计令牌 + 暖白档案/深空终端双主题 + 工程编号与工业橙标识 |
| 日常高频操作流畅、数据状态可靠 | ✅ | 今日代办单击完成；数据经 Repository 单一入口 |
| 可被后续 AI 长期维护 | ✅ | 分层清晰 + 纯函数 domain + 159 条测试 + 文档索引 |

## 3. 未完成事项 / 已知限制

1. **人工 UI 走查**：可用 `npm run ui:smoke`（Electron 加载 `dist` 产物，输出 20 张全流程截图到
   `<临时目录>/tr-shots`，并做 DOM 断言；断言失败退出码非 0）。建议首次运行 `npm start` 后仍人工走查一遍
   视觉细节（截图只能验证结构与状态，不能判断"好不好看"）。
2. **返图模块拖动**：**画布外**模块已支持拖动移动 / 拖动调整宽度 / 移回画布（内容可编辑）；
   画布内的模块仍走"预设 + 顺序 + 区域级参数"，尚未实现画布内元素级自由拖动。
3. **价格表自由调整范围**：覆盖字体、字号、密度、间距、列数、配色、画布尺寸、装饰、导出倍率；
   尚未实现元素级自由拖动排版（预设模式 + 参数调整模式已可用）。
4. **返图 `tr-report-roll`**（「变更前 / 后」回填）仍由 ReportSheet 直接读写 localStorage，
   未纳入 Repository。
5. **图片存储**：执行记录与返图里的图片仍为 `blob:` 临时地址，刷新后失效（既有行为，未改变）。
6. **历史遗留文件**：`plugins/daigan-diary`、`boosting-diary/*` 未被任何代码引用，
   为安全起见保留未删（仅作清理候选）。
7. **价格表数据迁移策略**：**用户已有该游戏数据的，完全按用户数据**（不合并内置、零改动，只做键的规整）；
   只有「用户没有该游戏的任何数据」（首次安装 / 被主动清空）时才使用内置默认。
   理由：升级（1.0.42 → 当前版本）对老数据的影响要**最小** —— 既不往用户数据里加东西，
   也不把用户主动删掉的内置项补回来。取舍依据与验证见 `rev7-progress.md`。

> 本文档为第一轮交付说明（测试条数等数字已随后续轮次变化）；最新状态请看 `rev7-progress.md`。

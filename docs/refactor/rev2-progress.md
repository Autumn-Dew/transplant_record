# 第二轮专项修正 — 阶段交付说明

> 本轮按指令优先级推进。**已完成**与**未完成**严格区分，未实现的功能一律标记为「未完成」。

## 1. 实际修改文件

| 文件 | 变更 |
|---|---|
| `src/domain/hosting-chain.js` | **新增** 连续托管关系模型（周期视图、链条聚合、剩余天数、收入归属、链条 ID 追溯） |
| `src/domain/project.js` | `PROJECT_SCHEMA_VERSION` 2 → 3；托管记录补 `hostingChainId` / `paidAt` |
| `src/domain/migrate.js` | 迁移后串联链条 ID（幂等） |
| `src/domain/completion.js` | 执行记录新增托管归属快照（chainId / 周期起止 / 连续托管起止 / 第几天 / 剩余天数） |
| `src/data/price-layouts.js` | **构图结构**：`PRICE_STRUCTURES` / `structureOf()`；layout 新增 `structure`（由 preset 推导） |
| `src/data/report-layouts.js` | **回归修复**：`CLASSIC_CARDS_COLUMNS = 2`；卡片头部分隔线独立变量 `headLine` |
| `src/services/projectService.js` | 续费起点 = 原周期结束日**次日**；价格继承；锁定按「上一期是否结束」；`hostingChainId` 串联；新增 `chainIdOf` / `chainPeriods` / `chainSummaryOf` / `hostingChains` / `chainExecutions` / `revenueStats` / `ensureChains` |
| `src/composables/usePrices.js` | 双通道优先级：本地已有数据时不再被 Electron 文件覆盖 |
| `src/views/PricePage.vue` | **结构化构图**（顶部编号区 / 左右分区 / 侧栏信息区 / 页脚档案信息 / 终端双列面板）；版式重组动效 |
| `src/views/AccountPage.vue` | 新增「连续托管」视图（同客户多周期聚合为一条，可展开各期） |
| `src/views/GamePage.vue` | 游戏与服务项目列表的增删改排序动效（TransitionGroup） |
| `src/components/TodayTasks.vue` | 完成/跳过后的收束离场、进度数字归位动效 |
| `src/components/ReportSheet.vue` | 托管时间改用连续托管真实起止与天数；版式重组动效；卡片分隔线变量 |
| `src/App.vue` | **页面转场**（按页面语义 4 种语法）；**导航指示条滑动**；引入 motion-system |
| `src/assets/css/motion-system.css` | **新增** 动效语汇（框架展开 / 模块调度 / 数据归位 / 仪表扫过 / 版式重组 / 页面转场 / reduced-motion） |
| `src/assets/css/design-tokens.css` | 新增设计令牌（第一轮已有，本轮沿用） |
| `tests/hosting-chain.test.mjs` | **新增** 连续托管测试 |
| `tests/legacy-compat.test.mjs` | **新增** 旧数据兼容 + 双通道一致性测试 |
| `tests/layouts.test.mjs` | **新增** 原版并列布局回归 + 结构化预设测试 |
| `docs/refactor/visual-design.md` | **新增** 视觉与动效设计方案 |
| `docs/refactor/rev2-progress.md` | 本文档 |

## 2. ③ 每日返图原版布局回归 — 已完成

**缺陷与根因**：原版 `.rp-cards-row{display:flex} + .rp-half{flex:1}` 是**两列并列**；
上一轮引入的 `--rp-cols` 默认值为 `1`，使「日常 / 周常」变成纵向排列。

**修复（非 CSS 临时覆盖）**：
* 用 `git show HEAD:src/components/ReportSheet.vue` 核对原版取值；
* domain 层引入 `CLASSIC_CARDS_COLUMNS = 2` 作为原版默认，卡片间距 10px、
  卡片头部分隔线 `rgba(0,0,0,0.06)`、头部底色 `#f5f5f5`、画布 920/24/24 逐一还原；
* 3 条回归测试锁定：任何预设都不得把卡片列数改成非 2，原版间距/线条必须等于修改前。

## 3. ④ 旧数据兼容 — 已完成（结构化验证）

`tests/legacy-compat.test.mjs` 用**修改前真实结构**样本（v1：无 `schemaVersion/kind/state/host`）覆盖：

* 全部 `tr-*` 键（11 个）+ Electron 文件通道
* 未知字段保留（`myOwnField` / `customTag` 逐一断言）
* 缺新字段的旧记录正常读取（单次 / 已完成 / 待激活 / 续费各一）
* 迁移前备份 → `rollback()` 后与迁移前**完全一致**
* 幂等：第 2、3 次迁移 `changed === 0`，数据逐字节不变
* 双通道：本地空 → 从文件补齐并写回；本地有数据 → 文件不反向覆盖；写入时两侧同时更新

> **仍未验证**：你本机的真实旧数据（环境无此数据），需人工执行一次迁移核对。

## 4. ⑤ 连续托管业务模型 — 已完成

### 数据模型变化

```
项目（每个收费周期 = 一个独立项目）
  hostingChainId  连续托管关系 ID（续费继承；首次创建即自身 id）
  paidAt          收费归属日期（收入统计依据，绝不用项目结束日期）
  prevTaskId      上一期项目 ID（保留）

执行记录（新增托管归属快照，生成后不再被改写）
  hostingChainId / periodStart / periodEnd
  chainStart / chainEnd / chainDayIndex / chainRemainingDays
```

### 规则与实现

| 规则 | 实现 |
|---|---|
| 每次续费 = 独立项目与收入 | 新 ID、独立 `totalFee/actualFee/paidAt`、独立执行记录 |
| 同一客户连续托管 = 一条展示 | `hostingChains()` 聚合；底层周期不合并 |
| 续费起点 | 原周期结束日**次日**（不重叠），可被用户覆盖 |
| 资料独立快照 | 复制账号/游戏/服务/价格；之后互不影响 |
| 剩余天数 | `chainEnd - today + 1`（含今天），本地日历；结束日当天 = 1，过期 = 0 |
| 断层不累计 | 下一期开始日 > 当前累计结束日 + 1 天 → 停止累计并标「含空档」 |
| 取消的周期 | 不计入连续剩余时间 |
| 收入独立 | `revenueStats({month})` 按 `paidAt` 归属月份；`incomeByPeriod` 逐期保留 |
| 执行记录归属 | 每条带 `projectId` + 周期快照，续费后历史不被改写 |
| 返图托管时间 | 选项目时用 `chainSummaryOf()` 填充起止与第几天，续费后自动反映新期限 |

## 5. ① 视觉与动效 — 部分完成

**已完成**

* `docs/refactor/visual-design.md`：视觉与动效设计方案（布局层级 / 页面转场 / 高频交互 / 版式重排 / 无障碍）
* `src/assets/css/motion-system.css`：动效语汇
  * 框架展开 `mv-frame-open`（clip-path 扫开）
  * 模块调度 `mv-module-in/out` + `TransitionGroup`（进入展开 / 收束离场 / 剩余项归位）
  * 数据归位 `mv-data-settle`
  * 仪表扫过 `mv-gauge-sweep`
  * 版式重组 `mv-relayout`（stagger 26ms）
  * 页面转场 4 种语法：列表型 / 表单型 / 文档型 / 低频型
  * 导航指示条滑动 `mv-nav-indicator`
  * `prefers-reduced-motion: reduce` 全局降级
* 应用点：页面转场（App.vue）、导航选中转换、今日代办完成/跳过后的收束与数字归位、
  游戏与服务项目增删排序、价格表与返图的版式重组

**未完成**

* 动效**未覆盖全部指定场景**：游戏管理「分组展开」、续费等「新旧周期衔接」、
  返图「工作区与画布之间移动」「元素选中/拖动/缩放」尚无专属动效（这些交互本身也未实现）
* 未对每个页面单独设计差异化入场（目前按 4 类页面语义分组）

## 6. ②③ 价格表与返图预设结构化 — 已完成

**不再是"参数组合"**：两套预设系统都引入了 `structure`（构图）概念，每个预设对应一种真正不同的排版结构。

### 价格表

| 预设 | 构图 | 结构 |
|---|---|---|
| 原版 | 单列：店铺信息 + 分类卡片 | `stack` |
| 航天档案式 | 顶部工程编号区 + **左右分区**（左信息栏 210px + 右价目区）+ 页脚档案信息 | `split` |
| 工业终端式 | 顶部状态区 + **左状态栏 + 右双列面板**（模块化小格子） | `panels` |
| 简约目录式 | 单列高密度 + 去卡片边框的紧凑列表 | `dense` |
| 宣传海报式 | 大标题块 + 加粗分区块 + 放大价格标识 | `block` |

### 每日返图

| 预设 | 构图 | 结构 |
|---|---|---|
| 原版 | 单列纵向（日常/周常两列并列） | `stack` |
| 档案简报式 | 标题 + 托管信息组成**顶部信息带**，正文单列 | `topline` |
| 信息目录式 | **外层双列网格**（标题与托管信息横跨），卡片内部单列堆叠 | `columns` |
| 任务报告式 | 日常/周常**放大为报告主体**（字号/行距放大 + 左侧工业橙标识） | `sections` |
| 宣传展示式 | 标题块作为**主视觉区**（边框 + 居中 + 30px），内容块标题居中加宽字距 | `hero` |

* 两组预设的 `structure` 取值各自互不相同（有测试断言）
* `structure` 由 `preset` 推导，不信任存储值（避免配置被改坏）
* 原版取值不变、业务数据分离、三态显示与 Workspace/Canvas 均保留
* 仍为「区域级」调整：字体 / 字号 / 密度 / 间距 / 列数 / 配色 / 尺寸 / 装饰 / 导出倍率

## 7. 原版保留情况

| 项目 | 情况 |
|---|---|
| 原版价格表 | ✅ 布局与参数完全保留（宽度 900 / 上留白 80 / 内边距 24 / 白底 / 无标题行 / 卡片 16 间距 / 表格 13px），仍为 `classic` 预设 |
| 原版每日返图 | ✅ 已恢复「日常 / 周常并列」；间距 10px、头部底色与分隔线、画布 920/24/24 均还原；原版仍为默认预设 |
| 既有价格数据 / 编辑 / 导出 / 用户模板 | ✅ 未改变存储键与数据结构，兼容 |

## 8. 测试结果

```
npm test       → 110 个用例全部通过（连续 3 次运行结果一致）
npm run build  → 通过
```

| 测试文件 | 用例数 |
|---|---|
| `tests/date.test.mjs` | 5 |
| `tests/domain.test.mjs` | 21 |
| `tests/service.test.mjs` | 21 |
| `tests/game.test.mjs` | 9 |
| `tests/prices.test.mjs` | 8 |
| `tests/layouts.test.mjs` | 18 |
| `tests/hosting-chain.test.mjs` | 21 |
| `tests/legacy-compat.test.mjs` | 16 |

## 9. 白屏事故与修复（用户反馈）

**现象**：点进「代肝记录」后页面全白，只剩背景色。

**定位过程**

1. 用 Vite SSR 渲染全部页面组件做验证 → `WorkDiary` 渲染正常（html=4693、根元素存在），
   **排除 JS 运行时错误**（PricePage / ReportSheet 的 SSR 失败只是 html2canvas 需要 DOM，非缺陷）。
2. 问题因此落在「可见性 / 转场」层，根因是两个缺陷叠加：

| # | 缺陷 | 后果 |
|---|---|---|
| 1 | `.local-music { opacity: 0 }` 把「是否可见」交给 JS 的 `entered` 状态 | 一旦 `.entered` 动画链被阻断，整页永久不可见 |
| 2 | 页面转场 `leave-to { opacity: 0 }` 被 `.local-music.entered { opacity: 1 }`（特异性更高）覆盖 | 离开时没有实际过渡 → `transitionend` 不触发 → `mode="out-in"` **永久阻塞**，新页面永不插入 |

**修复**

* `page-common.css`：`.local-music` **默认可见**，入场改为 `.entered` 触发的 `animation`（mv-page-enter）——
  可见性不再依赖 JS 状态。
* `App.vue`：去掉 `mode="out-in"`，改为普通模式转场（即使离开过渡被打断，新页面也会立即插入）。
* `motion-system.css`：离开页面 `position: absolute; inset: 0`（脱离文档流，避免与新页面叠加跳动）+ 新增 `mv-page-enter` 关键帧。

**验证**

* 构建产物核验：默认不可见的 `.local-music` 规则 0 处、`.entered` 动画 1 处、
  `mv-page-enter` 关键帧 1 处、`leave-active` 绝对定位 1 处。
* 新增 `tests/styles.test.mjs`（6 项）把该教训固化为回归测试：
  页面根元素不得默认隐藏、不得使用 `out-in`、离开元素必须脱离文档流、入场动画结束态必须可见、
  必须支持 reduced-motion、转场需有定位上下文。

## 10. 尚未完成的事项

| # | 事项 | 说明 |
|---|---|---|
| 1 | **返图模块自由拖拽 / 缩放 / 选中** | 现为「上移/下移/移出画布/移回」按钮排序（指令要求的"元素选中、拖动、缩放"未实现）<br>→ **第三轮已部分实现**：画布外模块支持拖动移动 / 拖动调整宽度 / 移回画布，且内容可编辑（见 `rev3-progress.md`）；画布内元素级拖动仍未实现 |
| 2 | **价格表元素级自由拖动** | 现为「预设构图 + 区域级参数调整」 |
| 3 | **动效覆盖不全** | 见第 5 节未完成部分（游戏分组展开、续费周期衔接、画布元素拖动等场景无专属动效） |
| 4 | **人工验证** | UI 走查、真实旧数据迁移核对、`npm run pack` 打包验证均需人工执行 |

# 架构说明（Phase 1 之后）

## 1. 分层

```
Vue 页面 / 组件
    ↓  只调用业务服务，不拼装业务规则
src/services/*        业务规则唯一落点（项目生命周期、续费、归档、迁移）
    ↓
src/data/repos.js     数据访问层（唯一入口；localStorage + Electron 双通道，广播变更）
    ↓
src/domain/*          纯函数领域模型（无 Vue、无 localStorage，可直接单测）
    ↓
localStorage  ⇄  electron/main.js IPC  ⇄  userData/data/*.json
```

### 硬性约束

1. **页面不得直接读写 localStorage。** 一律经由 `src/data/repos.js` / `src/services/*`。
2. **业务规则不得散落在组件中。** 例如「托管每天只能确认一次」「续费不继承进度」
   只在 `services/projectService.js` 实现一次。
3. **不得硬编码游戏名称。** 游戏与服务项目一律经 `src/domain/games.js` 解析。
4. **项目状态 / 代办状态 / 执行记录结果相互独立。**
5. 不更改任何既有存储键名与 IPC 通道名。

## 2. 目录结构

```
src/
  domain/            纯逻辑：games（游戏目录）project（项目/托管）completion（执行记录）
                     mask（脱敏）migrate（迁移纯函数）
  data/              storage.js（键与安全读写）repos.js（Repository 单例：
                     projects / completions / games / blueprints / blueprintGroups）
  services/          projectService（项目业务）gameService（游戏与服务管理）
                     migration.js（启动迁移）
  composables/       useMask（转发 domain）useEditState useRowSelect useGlobalTheme usePrices
  views/             AccountPage 代肝代办（今日/全部/连续托管）BlueprintPage 蓝图
                     WorkDiary 代肝记录 AddPage 新增/编辑（含蓝图表单）PricePage 价格一览
                     ReportPage 日报 AdminPage 数据管理（价格数据 / 游戏与服务）SettingsPage 设置
  components/        TodayTasks（今日代办面板）ReportSheet（返图）GameSection（游戏与服务，内嵌数据管理）SelectBox
  utils/             date.js（本地日期工具）taskComplete.js（确认完成入口）sound.js
tests/               node:test 用例（domain + service + game + prices 集成）
docs/refactor/       数据模型 / 架构 / 业务流程文档
```

## 3. 关键调用链

* 确认完成（今日代办、代肝代办、每日汇报共用）：
  `completeTaskById()` / `confirmExecution()` → 先写 `completionsRepo`（独立执行记录）
  → 再更新 `projectsRepo`（进度 / 状态）→ 次数用尽则完成并 `unlockSuccessors()` 解锁续期项目。
* 今日代办：`projectService.todayTasks()` 按 `state` + `host.plan` + `host.skippedDates` 派生，不落库。
  界面：`components/TodayTasks.vue`（完成 / 跳过）。
* 延期：`postponeTask()` 只调整「何时该做」（托管写 `skippedDates`，单次改 `plannedDate`），
  **不产生执行记录**（界面已不再提供入口，服务层保留）。
* 续期：**在原项目上加天数 + 追加一条收费记录** —— `addHostingPeriod()`（结束日顺延、周期重算、
  `payments` 追加一条），不再新建项目；历史的多项目续费链（`prevTaskId` / `hostingChainId`）仍可读取。
* 归档：`archiveProject()` 把剩余次数全部计入已完成 → 状态置「已完成」→ 打归档标记；
  `restoreProject()` 取消归档并精确还原被消耗的天数。
* 游戏与服务项目：`gameService` 唯一落点；游戏 id 一旦创建不再变更（价格表 key 稳定），
  有项目引用的游戏只能归档不能物理删除。

## 4. 测试与验证

```bash
npm test          # node:test，136 个用例：领域模型 / 业务服务 / 游戏管理 / 价格表数据安全 / 排版预设 / 返图工作区
npm run build     # vite 构建
npm start         # 开发运行（vite + electron）
npm run ui:smoke  # UI 冒烟：Electron 加载 dist，20 张截图 + DOM 断言（失败退出码非 0）
```

`src/package.json` 声明 `src` 为 ESM，使测试可直接导入纯逻辑模块（无构建步骤）。

## 5. 阶段进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 0 | 轻量检查（结构 / 数据入口 / 构建） | ✅ |
| Phase 1 | 统一数据层、游戏目录、托管与执行记录分离、续费、归档、迁移 | ✅ |
| Phase 2 | 今日代办面板、延期 / 跳过 / 异常、单次计划日期 | ✅ |
| Phase 3 | 游戏与服务管理界面、蓝图接入统一数据层 | ✅ |
| Phase 4 | 价格表增强（原版保留为正式预设 + 4 种排版预设 + 自由调整 + 分页/高清导出） | ✅ |
| Phase 5 | 每日返图增强（原版保留 + 4 种预设 + 模块/字段三态 + 画布裁切 + 画布外工作区） | ✅ |
| Phase 6 | 孤星风格视觉与动效升级（设计令牌 / 色彩体系 / 侧栏与页头 / reduced-motion） | ✅ |
| Phase 7 | 回归测试、迁移测试、交付文档 | ✅（人工 UI 走查待用户执行） |

## 6. 排版机制（Phase 4 / 5）

两套排版系统同构：**配置只描述「怎么排」，业务数据始终独立存放**。

* 价格表：`data/price-layouts.js`（预设与规范化）+ `composables/usePriceLayout.js`（状态与模板）
  → `tr-price-layout-active`（当前排版）、`tr-price-layouts`（我的模板）。
* 每日返图：`data/report-layouts.js` + `composables/useReportLayout.js`
  → `tr-report-layout-active`、`tr-report-layouts`。
* 「原版」是两套系统中的第一个正式预设，取值严格等于重构前的既有样式（有测试锁定）。
* 切换预设 / 调整排版 **不会触碰 `tr-prices` 与 `tr-completions`**，因此不需要重新录入，
  也不会改动历史记录。
* 返图三态：模块与字段分别配置 `always / auto / never`。
  `auto` 在编辑界面始终保留（保证可编辑），仅在**导出阶段**按内容是否为空决定是否输出。
* 返图画布：`.rp-canvas` 是导出范围；导出前把画布外模块（`.rp-out-item`）临时置为
  `display: none`，因此**严格不进图片**，且不改变画布尺寸。
* 画布外工作区（zone: `outside`）：模块**留在画布 DOM 内**，用绝对定位落到画布下沿之外 ——
  内容 / 表单 / `contenteditable` 始终是同一份，因此照常可查看、可编辑；
  工作区控制条提供拖动移动、拖动调整宽度、移回画布。
  坐标 `x / y / w` 随排版持久化，移回画布时保留（便于再次移出回到原位）。
  > 不要改用 `<Teleport>`：Vue 只在挂载时解析目标，而返图页是常驻渲染（`v-show`），
  > 挂载阶段子树尚未进入 `document`，目标必然为 `null`，会导致内容丢失。

## 7. 视觉体系（Phase 6）

* 令牌：`assets/css/design-tokens.css`（深空蓝黑 `#101923` / 航天暖白 `#E8E2D3` /
  工业橙 `#D87938` / 警示红 `#A84238` / 仪表灰蓝 `#71818A`）。
* 主题：浅色 = 航天档案纸（暖白底 + 墨色字），深色 = 深空蓝黑终端；
  侧边栏与标题栏恒为深空蓝黑 + 工业橙标识（`.rc-sub-func-btn.active::before`）。
* 静态装饰：工业橙标识条、工程编号、等宽数据标识、刻度线（`.lt-ruler`）——
  不使用发光 / 粒子 / 扫光 / 动态背景。
* 动效：轻量位移 + 淡入（页面入场、列表 stagger、按钮 hover），
  并全局支持 `prefers-reduced-motion: reduce`。
* 价格表与返图画布使用各自独立的排版变量，互不干扰，且不受应用主题影响。

## 8. 已知遗留

* `tr-report-roll`（返图「变更前/后」回填）仍由 ReportSheet 直接读写 localStorage。
* 返图：**画布外**模块已可拖动 / 调整宽度 / 移回（第三轮）；**画布内**模块仍是
  「上移 / 下移 / 移出 / 移回」排序，尚未实现画布内元素级自由拖动。
* 信息目录式的双列网格此前因选择器写成后代式（`.rp-index .rp-wrap`）而未生效，
  第三轮修正为 `.rp-canvas > .rp-wrap.rp-index`（有测试禁止回退）。
* 价格表的自由调整覆盖字体 / 字号 / 密度 / 间距 / 列数 / 配色 / 尺寸 / 装饰；
  尚未实现元素级自由拖动排版。
* `plugins/daigan-diary`、`boosting-diary/*` 为历史遗留补丁与旧插件，未被任何代码引用，保留未删。


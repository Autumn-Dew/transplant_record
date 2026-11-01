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
                     hosting-chain（历史连续托管链）blueprints（蓝图）mask（脱敏）
                     report-presets（日报预设）report-template（日报文案表）
                     migrate（迁移纯函数）
  data/              storage.js（键与安全读写 + 原始键操作）repos.js（Repository 单例：
                     projects / completions / games / blueprints / blueprintGroups）
                     shop-info.js（店铺信息）report-themes.js / report-backgrounds.js（日报外观）
                     price-theme.js（价格画布外观）price-bg.js（价格画布背景图）
                     service-memory.js（手动记忆的服务项目）report-pages.js（日报页签持久化）
                     report-draft.js（日报临时草稿）
  services/          projectService（项目业务）gameService（游戏与服务管理）projectDetail（详情组装）
                     backupService（备份 / 恢复 / 清除）migration.js（启动迁移）
  composables/       useMask（转发 domain）useEditState useRowSelect useGlobalTheme usePrices
                     useConfirmClick（连点 4 次确认）usePageEnter（页面入场节奏）
                     useReportExport（日报导出三态：变换 / 渲染 / 还原）
  views/             AccountPage 代肝代办（今日/全部/连续托管）BlueprintPage 蓝图
                     WorkDiary 代肝记录 AddPage 新增/编辑（含蓝图表单）PricePage 价格一览
                     ReportPage 日报 AdminPage 数据管理（价格数据 / 游戏与服务）SettingsPage 设置
  components/        ReportSheet（返图）ProjectDetail（详情抽屉）GameSection（游戏与服务，内嵌数据管理）
                     SelectBox（下拉）ColorPicker（蓝图颜色）EmptyState（列表空状态）
                     ReportTemplatePanel（日报模板面板）
  utils/             date.js（本地日期 + 每日刷新时间）taskComplete.js（确认完成入口）sound.js
                     fee.js（列表竖线配色）clipboard.js（文本 / PNG 剪贴板与下载）
tests/               node:test 用例（domain + service + game + prices + 迁移 + 样式约束）
docs/refactor/       数据模型 / 架构 / 业务流程文档
```

> 早期的「价格表排版系统」已整体移除（`usePriceLayout` / `useReportLayout` /
> `report-layouts.js` / `price-layouts.js` 全部不再存在），见 §6。

## 3. 关键调用链

* 确认完成（今日代办、代肝代办、每日汇报共用）：
  `completeTaskById()` / `confirmExecution()` → 先写 `completionsRepo`（独立执行记录）
  → 再更新 `projectsRepo`（进度 / 状态）→ 次数用尽则完成并 `unlockSuccessors()` 解锁续期项目。
* 今日代办：`projectService.todayWorkItems()` 按 `state` + `host.plan` + `host.skippedDates`
  + 每日刷新时间派生「今天该做哪些」，不落库，并给出 `blockedReason`；
  界面：`views/AccountPage.vue`（完成 / 跳过）与 `components/ReportSheet.vue`（日报内确认），
  两处共用同一个 read model。
* 延期：`postponeTask()` 只调整「何时该做」（托管写 `skippedDates`，单次改 `plannedDate`），
  **不产生执行记录**（界面已不再提供入口，服务层保留）。
* 续期：**在原项目上加天数 + 追加一条收费记录** —— `addHostingPeriod()`（结束日顺延、周期重算、
  `payments` 追加一条），不再新建项目；历史的多项目续费链（`prevTaskId` / `hostingChainId`）仍可读取。
* 归档：`archiveProject()` 把剩余次数全部计入已完成 → 状态置「已完成」→ 打归档标记；
  `restoreProject()` 取消归档并精确还原被消耗的天数。
* 删除：`canHardDelete()` 判定是否真有「无历史、无后继」；否则详情窗口给出
  `forceDeleteProject()`（连执行记录一起删，并清理 `prevTaskId` / `hostingChainId` 悬空引用）。
* 备份 / 恢复 / 清除：设置页 → `services/backupService.js`
  （`exportSnapshot` / `downloadSnapshot` / `restoreSnapshot` / `clearAllData`）
  → 写回 localStorage → 同步 Electron 的六个数据文件 → `refreshMemory()` 刷新
  repo / 价格表 / 主题 / 音效单例，**不需要重载页面**。
* 游戏与服务项目：`gameService` 唯一落点；游戏 id 一旦创建不再变更（价格表 key 稳定），
  有项目引用的游戏只能归档不能物理删除。

## 4. 测试与验证

```bash
npm test          # node:test，约 340 个用例：领域模型 / 业务服务 / 数据迁移 / 备份恢复 / 价格与外观 / 样式约束
npm run build     # vite 构建
npm start         # 开发运行（vite + electron）
npm run ui:smoke  # UI 冒烟：Electron 加载 dist，30+ 张截图 + DOM 断言（失败退出码非 0）
npm run ipc:smoke # IPC 端到端：加载真实 main.js，断言「渲染层保存 → 磁盘 JSON」真的写出
```

`src/package.json` 声明 `src` 为 ESM，使测试可直接导入纯逻辑模块（无构建步骤）。

## 5. 阶段进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 0 | 轻量检查（结构 / 数据入口 / 构建） | ✅ |
| Phase 1 | 统一数据层、游戏目录、托管与执行记录分离、续费、归档、迁移 | ✅ |
| Phase 2 | 今日代办面板、延期 / 跳过 / 异常、单次计划日期 | ✅ |
| Phase 3 | 游戏与服务管理界面、蓝图接入统一数据层 | ✅ |
| Phase 4 | 价格表增强（原版保留为默认外观 + 终末地风格 + 高清导出） | ✅ |
| Phase 5 | 每日返图增强（41 套主题皮肤 + 背景 + 导出三态 + 计算样式复制） | ✅ |
| Phase 6 | 孤星风格视觉与动效升级（设计令牌 / 色彩体系 / 侧栏与页头 / reduced-motion） | ✅ |
| Phase 7 | 回归测试、迁移测试、交付文档 | ✅（人工 UI 走查待用户执行） |

## 6. 画布外观与导出（现状）

外观（皮肤）与业务数据严格分离：**外观只描述「长什么样」，业务数据始终独立存放**。

* 价格一览：`data/price-theme.js` → `tr-price-theme`（`classic` 原版 / `endfield` 终末地风格）。
  只影响画布内的排版与元素，**不触碰 `tr-prices`**；未知值回落 `classic`。
* 每日汇报：`data/report-themes.js` → `tr-report-theme`（41 套主题皮肤）；
  `data/report-backgrounds.js` → `tr-report-bg`（背景）。两键**互不覆盖**，也与应用主题
  （`tr-theme`）无关，可以自由组合。
* 切换外观 **不会触碰 `tr-prices` / `tr-completions` / `tr-accounts`**，不需要重新录入，
  也不会改动历史记录。
* 日报导出三态（`composables/useReportExport.js` 的 `prepareExport`）：
  ① 编辑态 —— 真实控件与 `contenteditable`；
  ② 导出前变换 —— 空字段填占位符、隐藏空卡片与 `.rp-no-export`、`select/input` 逐个替换为
     带计算样式的 `span`（必须沿用 `getComputedStyle`，否则深色主题导出后文字同色不可读）；
  ③ 还原 —— `finally` 里执行 `undo()` 闭包，把 DOM 恢复原状。
  变换与还原依赖 `try/finally` 与 DOM 结构查询，改动这段代码务必成对修改。
* 画布外内容（工具栏、外观弹窗）不属于导出范围，靠 `.rp-no-export` 在导出前隐藏。
  > 不要改用 `<Teleport>`：返图页是常驻渲染（`v-show`），挂载阶段子树尚未进入 `document`，
  > 目标必然为 `null`，会导致内容丢失。
* ~~旧的「价格表排版预设 / 返图排版预设」系统~~（`usePriceLayout` / `useReportLayout` /
  `report-layouts.js` / `price-layouts.js` / `tr-*-layout-active` / `tr-*-layouts`）
  **已整体移除**，不要再基于这些名字开发。

## 7. 视觉体系（Phase 6）

* 令牌：`assets/css/design-tokens.css`（深空蓝黑 `#101923` / 航天暖白 `#E8E2D3` /
  工业橙 `#D87938` / 警示红 `#A84238` / 仪表灰蓝 `#71818A`）。
* 主题：浅色 = 航天档案纸（暖白底 + 墨色字），深色 = 深空蓝黑终端；
  侧边栏与标题栏恒为深空蓝黑 + 工业橙标识（`.rc-sub-func-btn.active::before`）。
* 静态装饰：工业橙标识条、工程编号、等宽数据标识、刻度线（`.lt-ruler`）——
  不使用发光 / 粒子 / 扫光 / 动态背景。
* 动效：轻量位移 + 淡入（页面入场、列表 stagger、按钮 hover），
  并全局支持 `prefers-reduced-motion: reduce`。
* 价格表与返图画布使用各自独立的外观变量，互不干扰，且不受应用主题影响。

## 8. 已知遗留

* `tr-report-roll`（返图「变更前/后」回填）由 `ReportSheet.vue` 经 `data/storage.js` 读写，
  没有独立的 repository；备份时它会随其它 `tr-` 键一起导出。
* 日报的**模板内容**分两层：
  * **全局预设** —— 「数据管理 → 游戏与服务 → 日报预设」（`game.report`），
    含任务项 / 资源项 / 默认汇报人 / 文案（`text`），见 `domain/report-presets.js`；
  * **临时草稿** —— 「每日汇报 → 模板」面板（`tr-report-draft`），按游戏分开存、**落盘**、
    重启仍在，只影响当前这份日报；「恢复默认」清草稿回到全局，「存为全局预设」把草稿写回配置。
  可改的文案清单在 `domain/report-template.js`（卡片标题 / 专属行标签 / 按钮 / 提示语等）。
  三个内置游戏的**专属行**（理智剩余 / 线索传递 / 本性像素 / 送礼 / 都市体力）
  仍按 `reportGame` 判断，属于这三个游戏独有的字段。
* `ReportSheet.vue` 约 3270 行，其中约 2500 行是主题 CSS（508 个规则块、61 组同选择器的
  「后覆盖前」声明），模板只有 330 行。导出流程已抽到 `composables/useReportExport.js`；
  **主题 CSS 是「单文件 + 跨组件选择器」写法**（`.rp-theme-x .rp-card`），拆组件前必须先决定
  是否连主题系统一起改成 CSS 变量，否则拆出去的选择器会失效。
  `applyTask` 用 `programmaticDate` 标记 + `nextTick` 绕开 `watch(reportGame)` 的同轮重建，
  机制脆弱，改动前先看该函数的注释。
* 重复实现已收敛：页面入场节奏（`usePageEnter`）、列表竖线配色（`utils/fee`）、
  剪贴板与下载（`utils/clipboard`）、蓝图颜色选择器（`components/ColorPicker.vue`）、
  列表空状态（`components/EmptyState.vue`）各只有一份。
* `ui-smoke` 的主题 / 背景数量与样本从 `report-themes.js` / `report-backgrounds.js` 读取，
  增减预设不会再让冒烟断言失效。
* `electron/main.js` / `preload.js` 的落盘链路由 `npm run ipc:smoke` 覆盖（加载真实主进程，
  断言「渲染层保存 → `userData/data/*.json`」）；`tests/electron-contract.test.mjs` 另外锁定
  通道名 / 暴露面 / 原子写这些静态契约。
* 日报页签（`tr-report-pages`）只存标题与当前页，不存正文 —— 正文随页面渲染，刷新即重新生成。


# 数据模型（v2）与数据迁移

> 本文档描述 Phase 1 重构后的数据结构、存储契约与迁移机制。
> 迁移原则：**不删除、不改名、不改写任何 v1 字段**，只做「新增」。

## 1. 存储契约（不得随意变更）

### 1.1 localStorage 键

| 键 | 内容 | 版本 |
|---|---|---|
| `tr-theme` | 主题偏好 | v1 |
| `tr-accounts` | **项目**（单次 / 托管）列表 | v1 → v2 |
| `tr-completions` | **执行记录**（历史事实）列表 | v1 → v2 |
| `tr-blueprints` / `tr-blueprint-groups` | 蓝图记录与分组 | v1 |
| `tr-workdiary` | 工作日记（预留） | v1 |
| `tr-prices` / `tr-prices-version` | 价格表数据与默认数据版本 | v1 |
| `tr-shop-info` | 价格表店铺信息 | v1 |
| `tr-services` | 手动记忆过的服务项目 | v1 |
| `tr-report-roll` | 返图「变更前 / 变更后」回填 | v1 |
| `tr-select-limit` | 列表最多可选中数量 | v1 |
| `tr-games` | **游戏与服务项目目录**（新增） | v2 |
| `tr-schema-version` | 已执行迁移的数据版本（新增） | v2 |
| `tr-backup-accounts` / `tr-backup-completions` | 迁移前原始数据备份（新增） | v2 |
| `tr-report-layout-active` | **返图排版**（当前生效：预设 / 画布 / 字体 / 模块三态与画布归属 / 字段三态 / 导出倍率） | v1 |
| `tr-report-layouts` | **返图「我的模板」**（保存的排版快照） | v1 |
| `tr-price-layout-active` | **价格表排版**（当前生效的预设与参数） | v1 |
| `tr-price-layouts` | **价格表「我的模板」** | v1 |
> `tr-report-layout-active` 中的每个模块可带 `x / y / w`（画布外工作区的摆放盒）。
> 它们属于**排版数据**，与业务数据（项目 / 执行记录 / 价格 / 游戏）完全分离：
> 拖动画布外模块、切换预设都不会改写任何业务数据；移回画布时坐标被保留以便再次移出时回到原位。

### 1.2 Electron 持久化文件（`userData/data/`）

沿用：`boosting-records.json`（项目）、`blueprints.json`、`workdiary.json`、`prices.json`。
新增：`completions.json`（执行记录）、`games.json`（游戏目录）。
IPC 通道全部沿用既有命名风格，**未修改任何既有通道名**。

## 2. 项目（`tr-accounts`）

v1 字段全部原位保留（`id` `account` `password` `game` `service` `status` `remainingDays`
`lastConfirmDate` `locked` `prevTaskId` `note` `wechatName` `qqName` `bilibiliName`
`xiaohongshuName` `douyinName` `preferredPlatform` `totalFee` `actualFee` `delayedFee` `createdAt`）。

v2 新增：

| 字段 | 说明 |
|---|---|
| `schemaVersion` | 数据结构版本 |
| `kind` | `oneoff`（单次） / `hosting`（托管） |
| `state` | **项目生命周期状态**（见下） |
| `gameKey` / `gameName` | 游戏目录 id / 显示名快照 |
| `host` | 仅托管项目：托管周期与执行计划 |
| `payments` | 仅托管项目：**收费记录（订单）** —— 见下；老项目没有该字段时由 `paymentsOf()` 只读派生一条 |
| `paidAt` | 收入归月依据（托管项目） |
| `archived` / `archivedAt` | 归档标记；归档时同时把剩余天数计入已完成（= 完成该托管） |
| `archivedConsumed` | 归档时消耗掉的次数，「取消归档」据此精确还原 |
| `cancelledAt` / `pausedAt` / `resumedAt` / `completedAt` | 状态变更时间戳 |

### 2.0 收费记录（订单）`payments`

托管项目每收一次费记一条；**收入按每笔收费的归属日期归月**。

| 字段 | 说明 |
|---|---|
| `id` | 订单 id |
| `amount` | 本次收费金额 |
| `paidAt` | 收费归属日期（`yyyy-MM-dd`） |
| `days` | 本次增加的天数 |
| `note` | 备注 |
| `createdAt` | 写入时间（ISO） |

* 项目上的 `totalFee` / `actualFee` / `paidAt` 表示**最近一次收费**；累计金额以 `payments` 为准。
* 编辑详情里的「收费」= 编辑**最近一笔订单**（更早的订单不改写）。
* 老数据（没有 `payments`）由 `paymentsOf()` 派生出金额/收费日/周期天数各取自身的一条，
  **只读不写回**；一旦对它「加天数」，派生的一条会随新订单一起落盘为真实记录。

### 2.1 生命周期状态 `state`

`pending` 待执行（单次） · `active` 托管中 · `paused` 暂停中（历史数据）
· `scheduled` 待开始（历史续费项目未生效） · `completed` 已完成 · `cancelled` 已取消
· `expired` 已到期（派生判定，不写入存储） · `archived` 仅用于兼容读取。

**项目状态、代办状态、执行记录结果是三个独立概念，不得混用。**

### 2.2 托管结构 `host`

```js
host = {
  startDate, endDate,        // 托管起止日期（yyyy-MM-dd，本地日期）
  cycle: 'month', cycleDays, // 托管周期
  plan: {                    // 每日执行计划
    mode: 'daily' | 'weekly' | 'custom',
    weekdays: [1..7],        // weekly 时生效，1=周一
    timesPerDay,
  },
  plannedTimes,              // 计划总次数
  completedTimes,            // 已完成次数
  skippedTimes, abnormalTimes, cancelledTimes,
}
```

* **托管周期**（`startDate`~`endDate`、`cycleDays`）与**实际执行次数**（`completedTimes`）完全分离。
* `remainingDays`（v1 字段）保留为「剩余次数」的兼容视图：
  `remainingDays = max(0, plannedTimes - completedTimes)`。

## 3. 执行记录（`tr-completions`）

v1 字段保留（`id` `taskId` `date` `time` `game` `service` `account` `password` `displayName`
平台名 `fee` `totalFee` `actualFee` `delayedFee` `status` `wasHosting` `note`）。

v2 新增：`schemaVersion` `projectId` `plannedDate` `completedDate` `result` `content` `images`
`gameKey` `gameName` `price`。

* `result`：`done` 已完成 / `skipped` 已跳过 / `abnormal` 异常 / `cancelled` 已取消。
* **每次实际执行都会生成一条独立记录**（v1 只在托管用尽次数时记录一次）。
* 生成后不再被项目改名、改价、归档、续费影响（快照式）。

## 4. 游戏与服务项目目录（`tr-games`）

```js
[{ id, name, short, icon, order, enabled, archived,
   services: [{ id, name, price, unit, note, enabled, order }] }]
```

* `id` 同时是价格表 key（`prices[id]`），新增游戏后价格表 / 筛选 / 统计自动获得该游戏。
* 内置 `endfield` / `ak` / `nte` 三个默认游戏，仅用于兼容既有数据，不构成固定列表。
* 迁移时会把历史项目里出现过的陌生游戏名**幂等**补进目录，旧数据不会「消失」。
* 停用 / 归档游戏不影响历史数据。

## 5. 迁移机制（v1 → v2）

实现：`src/services/migration.js` + `src/domain/migrate.js`，在 `main.js` 中
**先于 Vue 挂载**同步执行。

1. 迁移前把原始数据整体写入 `tr-backup-accounts` / `tr-backup-completions`（仅首次写入）。
2. 迁移按记录幂等：`schemaVersion >= 2` 的记录原样返回，不会重复加工。
3. 迁移失败不阻断启动：保留原始数据，仅在返回值中记录错误。
4. 回滚：`rollback(name)` 从备份还原为迁移前数据；`hasBackup(name)` 判断备份是否存在。
5. `tr-schema-version` 记录已完成的迁移版本。

## 6. 已知遗留（后续阶段处理）

* `tr-report-roll`（返图「变更前/后」回填）仍由 ReportSheet 直接读写 localStorage（Phase 5）。
* 返图排版与价格表排版**已落地**（见 1.1 的 `tr-*-layout-active` / `tr-*-layouts`），
  预设 / 三态 / 参数 / 我的模板均已可用；尚未实现的是**元素级自由拖动**（画布内）。
* `plugins/daigan-diary`（旧版插件）与 `boosting-diary/*`（集成补丁说明）未被任何代码引用，
  属历史遗留，将在 Phase 7 统一清理。

## 7. 补充规则（Phase 2 / 3）

### 7.1 代办与执行记录的边界

| 操作 | 是否产生执行记录 | 说明 |
|---|---|---|
| 确认完成（done） | ✅ | 计入 `completedTimes` |
| 跳过（skipped） | ✅ | 计入 `skippedTimes`，不计入已完成次数 |
| 异常（abnormal） | ✅ | 计入 `abnormalTimes` |
| 延期（postpone） | ❌ | 只调整「何时该做」：托管写 `host.skippedDates`，单次改 `plannedDate` |

### 7.2 游戏与服务项目

* 游戏 `id` 创建后**永不改变**（它就是价格表 key），改名只改 `name`。
* 有项目引用的游戏不允许物理删除（`removeGame` 返回 `in-use`），只能 `archiveGame()`。
* 停用 / 归档游戏不影响任何历史数据与既有项目。
* 服务项目名称、价格、备注均为「默认值」；项目与执行记录保存的是当时的快照。

### 7.3 价格表数据安全

`usePrices` 的版本升级策略由「丢弃旧持久化」改为 **合并**：

* 用户已修改的价格、用户自建分类与项目一律保留（以名称为主键匹配）。
* 内置新增的分类与项目会被补入。
* 仅「首次安装（既无本地数据也无本地文件）」才使用打包默认值。
* 通过「游戏管理」新增的游戏，其价格表 key 与游戏 id 对齐，自动出现在价格一览与数据管理页。

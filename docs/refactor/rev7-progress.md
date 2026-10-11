# 第七轮修正 — 按钮机制统一 / 价格策略定案 / 1.0.42 数据无损继承

> 本轮针对三条新要求：① 同步所有按钮的多次点击机制 ② 价格表数据策略按「对老数据影响最小」定案
> ③ 保证 1.0.42 版本的数据升级到当前版本后**无损继承**。

## 1. 所有按钮统一「多次点击确认」

抽出一份统一实现 `src/composables/useConfirmClick.js`：

| 参数 | 值 |
|---|---|
| 生效所需的点击次数 | **4 次**（前 3 次只递进提示，第 4 次执行） |
| 中途停手复位 | **3 秒** |
| 点击过程配色 | 红 `#ff4444` → 橙 `#ff8800` → 紫 `#aa44ff` |
| 提示语 | `删除（点 4 次生效）` → `再次点击删除（2/4）` → `（3/4）` → `最后一次点击删除（4/4）` |

改造后**不再有任何页面各自维护一份实现**（原来的 5 处重复：配色表 + `Map` + 定时器全部删除）。

| 界面 | 接入的写操作按钮 |
|---|---|
| 代肝代办 | 确认完成 / 删除（无历史则删、有历史则归档）/ 跳过今天 |
| 代肝记录 | 删除记录 |
| 蓝图记录 | 删除 / 详情保存 / 以此为基础新建 |
| 新增记录 | 添加·保存（任务）/ 添加·保存（蓝图）/ 确认加天数 |
| 数据管理 | 清除所有数据 |
| 每日汇报 | 确认完成（仍逐层播放音效） |
| 项目详情 | 保存 / 归档 / 删除 / 确认续费 |

**详情窗口原来只有「点 2 次」的归档与删除，现已升级为与全站一致的 4 次。**

> 无害操作（打开详情、进入编辑、取消、关闭、切换视图）不做多次点击。
> 如果觉得「表单提交（添加 / 保存）」也要点 4 次太繁琐，只需一句话即可改成只保护破坏性操作。

## 2. 价格表数据策略：按「对老数据影响最小」定案

| 方案 | 对 1.0.42 老数据的影响 |
|---|---|
| 合并内置新增项 | 会**往用户数据里加**分类/项目，还会把用户主动删掉的内置项补回来 → 改动用户数据 |
| **完全按用户数据（采用）** | 用户数据**零改动**，只做键的规整；只有「该游戏没有任何数据」时才用内置默认 |

因此 `usePrices.mergeGame()` 保持「用户已有 → 完全按用户数据」，并把这一取舍写进代码注释与
`docs/refactor/delivery.md` §7；`tests/prices.test.mjs` 的期望同步改为「不合并 + 逐字节零改动」。

## 3. 1.0.42 → 当前版本 数据无损继承（硬验证）

新增 `tests/upgrade-1042.test.mjs`（10 个用例）：**直接复刻 1.0.42 提交 `9b27760` 的真实写入逻辑**
来生成数据（不是手写的理想样本），再交给当前版本读取校验：

* 来源：`src/utils/taskComplete.js#appendCompletion / completeTaskById`、`src/views/AccountPage.vue#addCompletion`、
  `src/views/AddPage.vue#defaultTask / saveTask`、`useRowSelect / ReportSheet / AdminPage` 的存储键。
* 覆盖的键：`tr-accounts` / `tr-completions` / `tr-blueprints` / `tr-blueprint-groups` / `tr-prices`
  （+ `tr-prices-version`）/ `tr-services` / `tr-shop-info` / `tr-select-limit` / `tr-report-roll` / `tr-theme`
  / 非本应用的无关键。

验证结论：

| 检查 | 结果 |
|---|---|
| 迁移执行 | 无任何错误；**不删除任何既有键**（含无关键） |
| 数量 | 项目 / 执行记录 / 蓝图一条不少 |
| 项目字段 | 1.0.42 的每个字段（含 `remainingDays` / `locked` / `prevTaskId` / 自定义字段）**逐个保留**，只新增 `kind`/`state`/`paidAt` |
| 托管周期 | 由 `remainingDays` + `createdAt` 正确推导（剩 20 次 → 计划 30 / 已完成 10；周期 9/10 → 10/10） |
| 续费链 | `locked` + `prevTaskId` 保留，并按链追溯补上 `hostingChainId` |
| 执行记录 | 两种真实形态（完整 / 精简）旧字段逐个保留，补齐 `projectId`/`completedDate`/`result` |
| 蓝图 / 分组 / 价格 / 其它键 | 内容原样保留（分组仍按既有 trim + 去空规则） |
| 幂等 | 第二次启动 `changed = 0`，数据**逐字节不变** |
| 回滚 | `rollback()` 后与 1.0.42 原始内容**逐字节一致** |

另外确认：`appId`（`com.autumndew.boosting-record`）与 `userData/data` 路径未变，
因此 localStorage 与既有 JSON 文件都能被直接沿用；新增的 `completions.json` / `games.json`
是**新增**文件，旧的 `boosting-records.json` / `blueprints.json` / `workdiary.json` / `prices.json` 通道保持可用。

## 4. 验证

```
npm test         → 158 个用例，全部通过
npm run build    → 通过
npm run ui:smoke → UI SMOKE PASSED
```

新增测试：

* `tests/upgrade-1042.test.mjs`（10 例）：1.0.42 → 当前版本的数据继承。
* `tests/confirm-click.test.mjs`（8 例）：多次点击机制本身（4 次 / 3 秒 / 配色 / 提示语）
  + 全站接入与「不再各自维护一份实现」的源码级约束。

## 5. 项目整理（代码清理与完善）

### 5.1 新增 / 统一

* **根 `README.md`**：项目定位、命令、目录结构、6 条关键约定（数据只经 Repository、业务只在 services、
  domain 纯函数、写操作统一多次点击、老数据只增不改、续期=加天数+收费）。
* **`docs/refactor/README.md`**：文档索引（先读哪份 / 哪些是历史归档）。
* **数据入口统一**：`ReportSheet` 原先直接读 `localStorage['tr-accounts']`，现改为经 `projectsRepo`；
  `useRowSelect` / `useGlobalTheme` / `ReportSheet` 里写死的存储键改为统一取自 `data/storage.js` 的 `KEYS`。
* **健壮性**：`utils/sound.js` 原先直接读 `import.meta.env.BASE_URL`（非 Vite 环境会**模块加载即抛错**），
  现改为容错 + 无 `Audio` 环境直接跳过播放。

### 5.2 删除（均先经脚本确认「同文件 / 其它文件 / 测试」都无引用）

| 类型 | 内容 |
|---|---|
| 死文件 | `composables/usePriceLayout.js`、`data/report-config.js`、`style.css`（均无任何引用） |
| 重复定义 | `constants/storage-keys.js`（与 `data/storage.js` 的 `KEYS.THEME` 重复） |
| 无用存储键 | `KEYS.WORKDIARY` / `PRICES_VERSION` / `PRICE_LAYOUT_ACTIVE` / `PRICE_TEMPLATES` |
| 死导出 | 17 处（`reloadAll` / `hydrateAll` / `removeKey` / `allDataKeys` / `LIVE_STATES` / `PAYMENT_FIELDS` / `GAMES_SCHEMA_VERSION` / `servicePrice` / `upgradeHostingFields` / `extendProject` / `setSfxEnabled` / `isSfxEnabled` / `getProject` / `layoutStyle` / `SHOP_POSITIONS` / `newShopId` / `priceGameKeys`） |
| 未使用 import | 8 处（`computed` / `projectsRepo` / `STATE` / `SelectBox` / `KEYS` / `readJSON` / `writeJSON` / `nextTick`） |

### 5.3 文档与实现对齐

`delivery.md`（测试条数、价格表"模板保存"、归档/续期描述）、`architecture.md`（续期调用链）、
`workflow.md`（§3 续期流程图）、`data-model.md`（新增 `payments` / `archivedConsumed` 字段说明、
`state` 表）都已按当前实现改写。

### 5.4 有意保留（未删）

* `planRenewal` / `renewProject` / `pauseProject` / `resumeProject` / `extendProject` / `cancelProject`
  与托管链相关函数：界面已无入口，但**历史数据兼容、迁移与既有测试**仍需要，代码里已加
  「⚠ 界面已不再使用」的注释说明，避免后续误解。
* `plugins/daigan-diary`、`boosting-diary/*`：1.0.42 起就存在且未被任何代码引用，
  属发布历史的一部分，未删（如需清理可另行确认）。

### 5.5 版本发布

* 版本号：`1.0.42` → **`1.0.43`**（`package.json` + `package-lock.json`；运行时没有显示版本的地方）。
* 按**语义化版本**延续（第三段递增），已装 v1.0.42 的用户可以**直接覆盖安装**，不会被 NSIS 当成「降级」拦住。
  > 注：一开始写的是 `1.0.5`，但它在 semver 里 **小于** `1.0.42`（42 > 5），覆盖安装会被拦；
  > 而当前 electron-builder 24.13.3 没有 `nsis.allowDowngrade` 选项（试过后打包直接报错），
  > 因此按你的确认改为 `1.0.43`。
* `npm run pack` 已实测通过，产物：`dist_electron/代肝记录 Setup 1.0.43.exe`（该目录在 `.gitignore` 内，不入库）。

## 6. 仍未做 / 待确认

1. **暂停 / 恢复 / 延期 / 提前结束**：界面已无入口，服务层函数与相关测试仍保留（可被后续复用）。
2. **连续托管链**：界面已不再展示，domain / 服务层函数保留（历史数据与迁移仍需要
   `assignChainIds` / `resolveChainId`）。
3. **人工验证**：真实旧数据（`npm run pack` 后的安装升级）、以及 1.0.42 实际安装目录里的
   localStorage 内容，仍需在你本机走一遍。

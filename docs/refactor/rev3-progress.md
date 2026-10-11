# 第三轮修正 — 缺陷修复与工作区收尾

> 本轮针对上一轮遗留的**真实缺陷**与**未兑现的规格**做收尾。第 1 节的三个问题都不是"美化"，
> 而是会造成数据/显示错误或与指令不符的问题。

## 1. 本轮修复

| # | 问题 | 性质 | 修法 |
|---|---|---|---|
| 1 | 连续托管剩余天数算错 | **业务数据错误** | `chainEnd` 改为取「连续段内最大结束日」 |
| 2 | 信息目录式预设实际是单列 | 视觉与文档不符（死选择器） | 选择器改为 `.rp-canvas > .rp-wrap.rp-index` |
| 3 | 画布外暂存区只剩一个名字 | 不符 rev2 §三.5（应可查看/编辑/拖动） | 模块留在画布 DOM 内、绝对定位到画布下方 + 控制条 |

### 1.1 连续托管 `chainEnd` 取错周期（`src/domain/hosting-chain.js`）

**现象**：`hosting-chain` 测试偶发失败——`chainRemainingDays` 期望 32、实际 5。

**根因**（真实缺陷，不只是测试不稳定）：

* `buildChainSummary` 用 `chainEnd = head[head.length - 1].endDate`，即**排序后最后一条**的结束日；
* 项目 ID 由 `Date.now().toString(36) + 随机 4 位` 生成，同一毫秒创建的续费项目
  字典序**不可预测**；当续费起点与上一期相同（同一天续费 / 补录旧周期）时，
  两期 `startDate` 相同，排序退化为按 ID 字典序 —— 结束日更晚的一期可能被排到前面，
  于是 `chainEnd` 取到了较小的那个，剩余天数偏小；
* 这是**用户可复现**的错误显示，不只是测试问题。

**修法**：在连续段的扫描过程中维护 `cursorEnd`（段内最大结束日），
`chainEnd` 由 `head` 归约出最大值（与排序完全无关）。同时保留"断层停止累计"的既有语义。

**回归测试**：`tests/hosting-chain.test.mjs` 新增一例，用**字典序不利**的 ID（`zz` / `aa`）
构造同起点两期，并正反两种输入顺序各断言一次 `chainEnd` / `remainingDays` / `segmentCount`。

### 1.2 信息目录式的双列网格是死选择器（`src/components/ReportSheet.vue`）

**现象**：预设 `信息目录式` 声明"外层双列网格"，实际渲染为单列（与 `简约目录式` 几乎无差别）。

**根因**：`rp-<preset>` 类与 `.rp-wrap` 挂在**同一个元素**上，而规则写的是
`.rp-index .rp-wrap`（后代选择器）—— 元素不是自己的后代，规则永不命中。

**修法**：改为 `.rp-canvas > .rp-wrap.rp-index`。用 `.rp-canvas >` 限定的原因：
画布外插槽沿用同一套预设类，若不加限定，单个模块会被塞进双列网格的左半列。

**验证**：`getComputedStyle` 实测 `display: grid`、`gridTemplateColumns: 458px 458px`。

### 1.3 画布外模块：从"名字列表"改为真正可用（`src/components/ReportSheet.vue`）

**原状**：移出画布的模块在工作区只显示「模块名 + 三态 + 移回按钮」，**内容完全消失**
（既看不到也改不了，更不能拖动）—— 与 rev2 §三.5「画布外元素可以查看、编辑和拖动」不符。

**现方案**：模块元素**始终留在画布 DOM 内**，移出画布时加 `.rp-out-item` 并绝对定位到画布下沿之外：

* **可查看 / 可编辑**：仍是同一份 DOM —— 表单、`contenteditable`、文本框全部照常工作，
  不存在"两份内容"或"搬运时丢内容"的问题；
* **可拖动**：工作区里每个画布外模块有一条控制条，`⠿` 拖动移动、`⇔` 拖动调整宽度；
  控制条与模块共用同一个 `(x, y, w)`（控制条 `top = y - 条高`，模块 `top = 画布高 + y`），
  两者同步移动；拖动过程只改内存预览（`dragBox`），**松手才落盘**，避免高频写存储；
* **严格不参与导出**：`prepareExport()` 先把 `.rp-out-item` 置为 `display: none`，
  导出结束由既有 `undo()` 还原。模块本就是绝对定位、脱离画布流的，隐藏它**不改变画布尺寸**，
  因此导出结果与"模块全在画布内"时完全一致；
* **坐标持久化**：`x / y / w` 随排版一起存 `tr-report-layout-active`；移回画布时**保留**坐标
  （再次移出可回到原位），切预设则视为换一套排版而重置。

**两个必须记住的坑**（已写进代码注释与回归测试）：

1. **不要用 Teleport**。Vue 只在**挂载时**解析 Teleport 目标（`to` 不变就不再重解析），
   而本页在 `App.vue` 里是常驻渲染（`v-show`）—— 挂载阶段整棵子树尚未插入 `document`，
   `querySelector` 必然取不到目标 → 目标被缓存为 `null` → 切到画布外时抛
   `Cannot read properties of null (reading 'insertBefore')`，内容直接丢失。
2. **外层 `.rp-cards-row` 不能用 `v-show` 隐藏**：`display: none` 的祖先会**连带隐藏**
   已移出的绝对定位卡片。两张卡片都移出时改用 `.rp-cards-row--empty`（高度与间距归零）。

## 2. 文件变更

| 文件 | 变更 |
|---|---|
| `src/domain/hosting-chain.js` | `chainEnd` 取段内最大结束日（与排序无关） |
| `src/data/report-layouts.js` | 新增 `moduleBox` / `outsideModuleList` / `nextOutsideBox` 与 `OUTSIDE_*` 常量；归一化保留 `x / y / w`；`boxNum` 拒绝 `null / '' / 布尔值` |
| `src/composables/useReportLayout.js` | `setModuleZone(key, zone, box)` 支持携带摆放盒；新增 `setModuleBox` |
| `src/components/ReportSheet.vue` | 画布外工作区（就地绝对定位 + 控制条 + 导出隐藏）；`.rp-canvas` 不再裁切；修复 index 死选择器；`.rp-cards-row--empty` |
| `tests/hosting-chain.test.mjs` | 新增同起点续费的回归用例 |
| `tests/report-workspace.test.mjs` | **新增** 18 个用例（摆放盒 / 状态 / 结构约束） |
| `tools/ui-smoke.cjs` | **新增** UI 冒烟测试（Electron 截图 + DOM 断言 + 退出码门禁） |
| `package.json` | 新增 `npm run ui:smoke` |

## 3. 验证结果

```
npm test         → 136 个用例全部通过
npm run build     → 通过
npm run ui:smoke  → UI SMOKE PASSED（20 张截图 + 18 项 DOM 断言，退出码 0）
```

UI 冒烟覆盖：8 个页面渲染、页内 tab、价格表预设切换、返图预设切换、
返图**移出画布 → 内容仍可编辑 → 位于画布之外 → 导出后隐藏被还原 → 移回画布**、
渲染进程无错误日志。

**原版几何快照对比**（改动前 vs 改动后，实测）：

| 预设 | 关键结构值 | 判定 |
|---|---|---|
| 原版 | `flex` 单列 · 卡片行 `431px 431px`（两列并列）· gap 10px · 标题 18px/2px · 画布 920 · 白底深字 | 与改动前一致 |
| 档案简报式 | 标题行下边框 2px · 标题 22px · 画布 880 · 暖白底 | 生效 |
| 信息目录式 | `grid` + `458px 458px` 双列 | 修复后生效 |
| 任务报告式 | 卡片头 15px（放大）· 深空底 | 生效 |
| 宣传展示式 | 标题 31.8px 居中 · 单列 800px · 3 个模块在画布外 | 生效 |

切回原版后各值与初始**逐字段一致**（预设切换可逆、无残留）。

## 4. 仍未完成

| # | 事项 | 说明 |
|---|---|---|
| 1 | **画布内元素级自由拖动** | 画布内仍是"预设构图 + 模块顺序 + 区域级参数"；元素级拖动目前只在**画布外工作区**提供 |
| 2 | **价格表元素级自由拖动** | 仍为"预设构图 + 区域级参数调整" |
| 3 | **动效覆盖不全** | 游戏分组展开、续费周期衔接、画布外拖动等场景尚无专属动效 |
| 4 | **真实旧数据迁移核对** | 需在本机用真实数据执行一次迁移人工核对（环境无用户数据） |

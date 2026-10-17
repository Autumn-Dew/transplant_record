# 第十四轮修正 — 四套主题 + 每日汇报背景

## 1. 四套主题平级独立（不再有「深色模式」开关）

原来的实现只有 `theme-dark` 一个切换标记（`isDark` 布尔值），本质是「浅色 + 深色覆盖」。
现在改为**四套平级、各自完整**的主题：

| 主题 id | 名称 | 调色板 |
|---|---|---|
| `lone-star-light` | 孤星 · 档案 | 暖白纸面 / 墨色字 / 工业橙（默认） |
| `lone-star-dark` | 孤星 · 终端 | 深空蓝黑 / 工业橙 |
| `p3r-light` | P3R · 白昼 | 冷白 / 深蓝字 / 明蓝交互 |
| `p3r-dark` | P3R · 深夜 | 深海军蓝 / 明蓝 / 明黄 |

实现要点：

* **主题标记**是根节点上的 `theme-<id>` 类名，同时挂 `documentElement` 与页面根容器，
  组件内 scoped 样式也能按主题分支。
* 用 `classList` 增删 `theme-` 前缀的类，**不整体覆盖** `documentElement.className`（会清掉其他状态类）。
* 旧版本只存 `'dark'` / `'light'`，`normalizeThemeId()` 把它们映射到对应的孤星主题，老用户设置不丢；
  未知值回落默认主题，不会把用户留在「无主题」状态。
* 每套主题在 `global-theme.css` 里**各自定义完整变量集**（背景 / 文字 / 边框 / 强调 / 悬停 / 禁用 / 侧栏），
  不是运行时组合出来的。
* 入口有两个：侧栏月亮按钮**按固定顺序循环**四套；设置页新增「界面主题」一行，四个按钮直接点选。
* 切换时颜色 180ms 过渡（避免整屏硬切换闪烁），`prefers-reduced-motion` 下退化为无过渡。

P3R 主题的装饰（斜切色块、月相轨迹、刻度线、锐角面板）集中在新增的 `theme-p3r.css`，
只取几何语言，不含任何游戏素材。

## 2. 每日汇报背景：按风格分组，与应用主题完全解耦

* 新增 `src/data/report-backgrounds.js`：7 套浅色背景
  * **默认**：纯白（与既有汇报版式一致，仍为默认值）
  * **孤星风格**：科研档案 / 航天工程 / 工业仪器
  * **P3R 风格**：斜切海报 / 月相轨迹 / 都市拼贴
* 分组依据是**风格系列**，不是深色/浅色：孤星浅色与孤星深色共用一组，P3R 同理；深浅不会自动换背景。
* 全部由多层 CSS 渐变构成（不引用主题变量、不依赖外部图片），既能被 html2canvas 捕获进导出图，
  也不会随应用主题变色；装饰透明度压在 0.16 以内保证文字可读。
* **两者分别持久化**：应用主题 → `tr-theme`，汇报背景 → `tr-report-bg`。
  切主题不动背景、切背景不动主题（有测试锁定互不读写对方的键）。
* 编辑器入口在工具栏：「背景 · 当前背景名」按钮 → 浮层面板按三组展示缩略图
  （缩略图直接用与画布相同的 `background` 值，所见即所得），点击即切换并收起。
* 导出：画布自身绑定背景，`html2canvas` 的 `backgroundColor` 兜底取当前背景的 `base`，不再写死 `#ffffff`。

## 3. 本轮涉及文件

| 文件 | 变更 |
|---|---|
| `src/composables/useGlobalTheme.js` | **重写**：四套主题 / `THEMES` / `normalizeThemeId` / `setTheme` / `cycleTheme`，旧 API 兼容 |
| `src/assets/css/global-theme.css` | 四套主题各自完整变量块；主题切换过渡与 reduced-motion 降级 |
| `src/assets/css/design-tokens.css` | 移除旧的 `.theme-dark` 补丁块（已被完整主题取代） |
| `src/assets/css/theme-p3r.css` | **新增**：P3R 调色板、斜切/月相/刻度等装饰与动效 |
| `src/assets/css/page-common.css` | 设置页主题选择器样式 |
| `src/views/SettingsPage.vue` | 新增「界面主题」一行（四个平级按钮） |
| `src/App.vue` | 引入 `theme-p3r.css` |
| `src/data/storage.js` | 新增 `KEYS.REPORT_BG = 'tr-report-bg'` |
| `src/data/report-backgrounds.js` | **新增**：7 套背景 + 分组 + 归一 + 独立持久化 |
| `src/components/ReportSheet.vue` | 背景选择浮层；画布绑定背景；导出兜底底色改为当前背景 |
| `tests/theme.test.mjs` | **新增**：四套主题、旧值映射、CSS 完整性、不覆盖 className |
| `tests/report-backgrounds.test.mjs` | **新增**：背景数据、分组、独立持久化、画布/导出一致性 |
| `tools/ui-smoke.cjs` | 新增四套主题循环切换 + 设置页切主题 + 逐页截图断言 |

## 4. 验证

```
npm test         → 199 个用例，全部通过
npm run build    → 通过
npm run ui:smoke → UI SMOKE PASSED
                   四套主题循环切换 ✓（4 个不同 id / 4 个不同 --bg-primary）
                   设置页 4 个主题按钮 ✓，可切到 P3R · 深夜并切回孤星 · 档案 ✓
```
